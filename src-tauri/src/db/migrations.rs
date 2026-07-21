//! Incremental, additive migrations. Bump TARGET when adding a step.

use sqlx::{Row, SqlitePool};

pub const TARGET_VERSION: i64 = 8;

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    let mut version = current_version(pool).await?;

    // v1: hoist language into projects.settings JSON (project-wide source of truth).
    if version < 1 {
        let projects = sqlx::query("SELECT id, settings FROM projects")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

        for row in projects {
            let id: String = row.get("id");
            let raw: String = row.get("settings");
            let mut settings: serde_json::Value =
                serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));

            let needs_lang = settings
                .get("language")
                .and_then(|v| v.as_str())
                .map(|s| s.is_empty())
                .unwrap_or(true);

            if needs_lang {
                let lang_row = sqlx::query(
                    "SELECT language FROM slides WHERE project_id = ? ORDER BY order_index ASC LIMIT 1",
                )
                .bind(&id)
                .fetch_optional(pool)
                .await
                .map_err(|e| e.to_string())?;

                let lang = lang_row
                    .map(|r| r.get::<String, _>("language"))
                    .map(|s| if s.trim().is_empty() || s == "dynamic" { "typescript".to_string() } else { s.trim().to_string() })
                    .unwrap_or_else(|| "typescript".to_string());

                if let Some(obj) = settings.as_object_mut() {
                    obj.insert("language".into(), serde_json::Value::String(lang.clone()));
                }

                let new_raw = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
                sqlx::query("UPDATE projects SET settings = ? WHERE id = ?")
                    .bind(&new_raw)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;

                sqlx::query(
                    "UPDATE slides SET language = ? WHERE project_id = ? AND (language = 'dynamic' OR language = '')",
                )
                .bind(&lang)
                .bind(&id)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
            }
        }

        version = 1;
        set_version(pool, version).await?;
    }

    // v2: slide.name + default codeAlign in settings
    if version < 2 {
        if !column_exists(pool, "slides", "name").await? {
            sqlx::query("ALTER TABLE slides ADD COLUMN name TEXT NOT NULL DEFAULT ''")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add slides.name: {e}"))?;
        }

        // Seed default names "Slide 1", "Slide 2", … where empty
        let slides = sqlx::query(
            "SELECT id, project_id, order_index, name FROM slides ORDER BY project_id, order_index",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        for row in slides {
            let name: String = row.get("name");
            if name.trim().is_empty() {
                let order: i64 = row.get("order_index");
                let id: String = row.get("id");
                let label = format!("Slide {}", order + 1);
                sqlx::query("UPDATE slides SET name = ? WHERE id = ?")
                    .bind(&label)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }

        // Ensure codeAlign exists in project settings JSON
        let projects = sqlx::query("SELECT id, settings FROM projects")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
        for row in projects {
            let id: String = row.get("id");
            let raw: String = row.get("settings");
            let mut settings: serde_json::Value =
                serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
            if settings.get("codeAlign").is_none() {
                if let Some(obj) = settings.as_object_mut() {
                    obj.insert("codeAlign".into(), serde_json::Value::String("left".into()));
                }
                let new_raw = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
                sqlx::query("UPDATE projects SET settings = ? WHERE id = ?")
                    .bind(&new_raw)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }

        version = 2;
        set_version(pool, version).await?;
    }

    // v3: add highlights JSON column to slides
    if version < 3 {
        if !column_exists(pool, "slides", "highlights").await? {
            sqlx::query("ALTER TABLE slides ADD COLUMN highlights TEXT NOT NULL DEFAULT '[]'")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add slides.highlights: {e}"))?;
        }
        version = 3;
        set_version(pool, version).await?;
    }

    // v4: FTS5 index for ranked, project-scoped slide search.
    if version < 4 {
        sqlx::raw_sql(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS slides_fts USING fts5(
                name,
                code,
                content=slides,
                content_rowid=rowid
            );
            CREATE TRIGGER IF NOT EXISTS slides_fts_ai AFTER INSERT ON slides BEGIN
                INSERT INTO slides_fts(rowid, name, code)
                VALUES (new.rowid, new.name, new.code);
            END;
            CREATE TRIGGER IF NOT EXISTS slides_fts_ad AFTER DELETE ON slides BEGIN
                INSERT INTO slides_fts(slides_fts, rowid, name, code)
                VALUES ('delete', old.rowid, old.name, old.code);
            END;
            CREATE TRIGGER IF NOT EXISTS slides_fts_au AFTER UPDATE OF name, code ON slides BEGIN
                INSERT INTO slides_fts(slides_fts, rowid, name, code)
                VALUES ('delete', old.rowid, old.name, old.code);
                INSERT INTO slides_fts(rowid, name, code)
                VALUES (new.rowid, new.name, new.code);
            END;
            INSERT INTO slides_fts(slides_fts) VALUES ('rebuild');
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create slide search index: {e}"))?;
        version = 4;
        set_version(pool, version).await?;
    }

    // v5: write-behind Shiki thumbnail cache.
    if version < 5 {
        if !column_exists(pool, "slides", "thumbnail_html").await? {
            sqlx::query("ALTER TABLE slides ADD COLUMN thumbnail_html TEXT NOT NULL DEFAULT ''")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add slides.thumbnail_html: {e}"))?;
        }
        version = 5;
        set_version(pool, version).await?;
    }

    // v6: drop the legacy per-slide language mirror. Project settings JSON has
    // been the source of truth since v1; the column survived only for export
    // compatibility and is now derived on read. Safe on fresh DBs too: the
    // column_exists guard skips the DROP when BASE_SCHEMA never created it.
    // (v1's slide-language queries only run for version-0 DBs, which always
    // predate this schema and therefore still have the column.)
    if version < 6 {
        if column_exists(pool, "slides", "language").await? {
            sqlx::query("ALTER TABLE slides DROP COLUMN language")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to drop slides.language: {e}"))?;
        }
        version = 6;
        set_version(pool, version).await?;
    }

    // v7: add group_id / group_order to projects for dashboard stacks
    if version < 7 {
        if !column_exists(pool, "projects", "group_id").await? {
            sqlx::query("ALTER TABLE projects ADD COLUMN group_id TEXT DEFAULT NULL")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add projects.group_id: {e}"))?;
        }
        if !column_exists(pool, "projects", "group_order").await? {
            sqlx::query("ALTER TABLE projects ADD COLUMN group_order INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add projects.group_order: {e}"))?;
        }
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(group_id, group_order)")
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to create projects group index: {e}"))?;
        version = 7;
        set_version(pool, version).await?;
    }

    // v8: add section_id to slides for slide strip stacks (sections)
    if version < 8 {
        if !column_exists(pool, "slides", "section_id").await? {
            sqlx::query("ALTER TABLE slides ADD COLUMN section_id TEXT DEFAULT NULL")
                .execute(pool)
                .await
                .map_err(|e| format!("Failed to add slides.section_id: {e}"))?;
        }
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_slides_section ON slides(project_id, section_id, order_index)")
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to create slides section index: {e}"))?;
        version = 8;
        set_version(pool, version).await?;
    }

    if version < TARGET_VERSION {
        set_version(pool, TARGET_VERSION).await?;
    }

    Ok(())
}

async fn current_version(pool: &SqlitePool) -> Result<i64, String> {
    let row = sqlx::query("SELECT version FROM schema_version LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(match row {
        Some(r) => r.get::<i64, _>("version"),
        None => {
            sqlx::query("INSERT INTO schema_version (version) VALUES (0)")
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
            0
        }
    })
}

async fn set_version(pool: &SqlitePool, v: i64) -> Result<(), String> {
    sqlx::query("UPDATE schema_version SET version = ?")
        .bind(v)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> Result<bool, String> {
    let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().any(|r| {
        let name: String = r.get("name");
        name == column
    }))
}
