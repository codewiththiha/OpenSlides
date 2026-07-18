//! SQLite database initialization, lightweight migrations, connection pool.
//!
//! Uses a `schema_version` table + imperative migrations so we never need
//! the sqlx `macros` feature (which breaks macOS release builds).

use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous,
};
use sqlx::{Row, SqlitePool};
use std::str::FromStr;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const BASE_SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'dark-plus',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'typescript',
    transition_duration INTEGER NOT NULL DEFAULT 750,
    stagger INTEGER NOT NULL DEFAULT 5,
    duration INTEGER NOT NULL DEFAULT 3000,
    name TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slides_project ON slides(project_id, order_index);
"#;

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let db_path = app_dir.join("openslides.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    // WAL + relaxed sync so the debounced auto-save never blocks reads
    // (scrolling/animation) on the full-DB write lock; busy_timeout avoids
    // transient SQLITE_BUSY instead of erroring the mutation. These are
    // per-connection pragmas, so they live on the pool's connect options,
    // applied identically to all 5 pooled connections.
    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Invalid DB URL: {e}"))?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .pragma("temp_store", "memory")
        .pragma("busy_timeout", "5000");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to open SQLite pool: {e}"))?;

    sqlx::raw_sql(BASE_SCHEMA)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to run base schema: {e}"))?;

    run_migrations(&pool).await?;

    Ok(pool)
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

/// Incremental, additive migrations. Bump TARGET when adding a step.
const TARGET_VERSION: i64 = 3;

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

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
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
                    .filter(|s| !s.is_empty() && s != "dynamic")
                    .unwrap_or_else(|| "typescript".into());

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

    if version < TARGET_VERSION {
        set_version(pool, TARGET_VERSION).await?;
    }

    Ok(())
}

pub type DbPool = SqlitePool;
