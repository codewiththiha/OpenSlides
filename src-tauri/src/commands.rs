//! Tauri IPC commands — all persistent data goes through here.

use crate::db::DbPool;
use crate::models::{
    merge_settings, parse_settings, settings_to_json, CreateSlidePayload, Project, ProjectSettings,
    ProjectSummary, Slide, UpdateSlideSettingsPayload,
};
use serde_json::Value as JsonValue;
use sqlx::Row;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const DEFAULT_CODE: &str = r#"// Welcome to OpenSlides
// Feedbacks on @codewiththiha
function greet() {
  console.log("Hi, Mom!");
}"#;

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

async fn fetch_slides(pool: &DbPool, project_id: &str) -> Result<Vec<Slide>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, code, language, duration, transition_duration, stagger, order_index
        FROM slides
        WHERE project_id = ?
        ORDER BY order_index ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch slides: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|r| Slide {
            id: r.get("id"),
            code: r.get("code"),
            language: r.get("language"),
            duration: r.get("duration"),
            transition_duration: r.get("transition_duration"),
            stagger: r.get("stagger"),
            order_index: r.get("order_index"),
        })
        .collect())
}

async fn fetch_project(pool: &DbPool, project_id: &str) -> Result<Project, String> {
    let row = sqlx::query(
        r#"
        SELECT id, name, theme, settings, created_at, updated_at
        FROM projects WHERE id = ?
        "#,
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch project: {e}"))?
    .ok_or_else(|| format!("Project not found: {project_id}"))?;

    let settings_raw: String = row.get("settings");
    let mut settings = parse_settings(&settings_raw);
    let slides = fetch_slides(pool, project_id).await?;

    if settings.current_slide_id.is_none() {
        settings.current_slide_id = slides.first().map(|s| s.id.clone());
    }

    Ok(Project {
        id: row.get("id"),
        name: row.get("name"),
        theme: row.get("theme"),
        settings,
        slides,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

async fn touch_project(pool: &DbPool, project_id: &str) -> Result<(), String> {
    sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
        .bind(now_ms())
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update project timestamp: {e}"))?;
    Ok(())
}

// ── Commands ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_projects(pool: State<'_, DbPool>) -> Result<Vec<ProjectSummary>, String> {
    let rows = sqlx::query(
        r#"
        SELECT p.id, p.name, p.theme, p.created_at, p.updated_at,
               (SELECT COUNT(*) FROM slides s WHERE s.project_id = p.id) AS slide_count
        FROM projects p
        ORDER BY p.updated_at DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list projects: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|r| ProjectSummary {
            id: r.get("id"),
            name: r.get("name"),
            theme: r.get("theme"),
            slide_count: r.get("slide_count"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect())
}

#[tauri::command]
pub async fn get_project(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<Project, String> {
    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn create_project(
    pool: State<'_, DbPool>,
    name: String,
) -> Result<Project, String> {
    let project_id = Uuid::new_v4().to_string();
    let slide_id = Uuid::new_v4().to_string();
    let ts = now_ms();
    let project_name = if name.trim().is_empty() {
        "Untitled Deck".to_string()
    } else {
        name.trim().to_string()
    };

    let mut settings = ProjectSettings::default();
    settings.current_slide_id = Some(slide_id.clone());
    let settings_json = settings_to_json(&settings)?;

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, theme, settings, created_at, updated_at)
        VALUES (?, ?, 'dark-plus', ?, ?, ?)
        "#,
    )
    .bind(&project_id)
    .bind(&project_name)
    .bind(&settings_json)
    .bind(ts)
    .bind(ts)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to insert project: {e}"))?;

    sqlx::query(
        r#"
        INSERT INTO slides
          (id, project_id, order_index, code, language, transition_duration, stagger, duration)
        VALUES (?, ?, 0, ?, 'typescript', 750, 5, 3000)
        "#,
    )
    .bind(&slide_id)
    .bind(&project_id)
    .bind(DEFAULT_CODE)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to insert default slide: {e}"))?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn rename_project(
    pool: State<'_, DbPool>,
    project_id: String,
    name: String,
) -> Result<Project, String> {
    let project_name = if name.trim().is_empty() {
        "Untitled Deck".to_string()
    } else {
        name.trim().to_string()
    };

    sqlx::query("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&project_name)
        .bind(now_ms())
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to rename project: {e}"))?;

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn delete_project(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete project: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("Project not found: {project_id}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_project_settings(
    pool: State<'_, DbPool>,
    project_id: String,
    settings: JsonValue,
) -> Result<Project, String> {
    let row = sqlx::query("SELECT settings, theme FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to load project: {e}"))?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;

    let existing_raw: String = row.get("settings");
    let existing = parse_settings(&existing_raw);
    let mut merged = merge_settings(&existing, &settings);

    // Theme can also be updated via this command for convenience
    let mut theme: String = row.get("theme");
    if let Some(t) = settings.get("theme").and_then(|v| v.as_str()) {
        theme = t.to_string();
    }
    // currentSlideId lives in settings
    if let Some(id) = settings.get("currentSlideId") {
        merged.current_slide_id = id.as_str().map(|s| s.to_string());
    }

    let settings_json = settings_to_json(&merged)?;
    let ts = now_ms();

    sqlx::query(
        "UPDATE projects SET settings = ?, theme = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&settings_json)
    .bind(&theme)
    .bind(ts)
    .bind(&project_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update settings: {e}"))?;

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn update_project_theme(
    pool: State<'_, DbPool>,
    project_id: String,
    theme: String,
) -> Result<Project, String> {
    sqlx::query("UPDATE projects SET theme = ?, updated_at = ? WHERE id = ?")
        .bind(&theme)
        .bind(now_ms())
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update theme: {e}"))?;

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn create_slide(
    pool: State<'_, DbPool>,
    payload: CreateSlidePayload,
) -> Result<Slide, String> {
    let slide_id = Uuid::new_v4().to_string();
    let code = payload
        .code
        .unwrap_or_else(|| "// New Slide\n// Edit me!".to_string());
    let language = payload
        .language
        .unwrap_or_else(|| "typescript".to_string());

    let max_order: (Option<i64>,) =
        sqlx::query_as("SELECT MAX(order_index) FROM slides WHERE project_id = ?")
            .bind(&payload.project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to get max order: {e}"))?;

    let order_index = max_order.0.map(|m| m + 1).unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO slides
          (id, project_id, order_index, code, language, transition_duration, stagger, duration)
        VALUES (?, ?, ?, ?, ?, 750, 5, 3000)
        "#,
    )
    .bind(&slide_id)
    .bind(&payload.project_id)
    .bind(order_index)
    .bind(&code)
    .bind(&language)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create slide: {e}"))?;

    // Update current slide pointer in settings
    let row = sqlx::query("SELECT settings FROM projects WHERE id = ?")
        .bind(&payload.project_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = row {
        let raw: String = row.get("settings");
        let mut settings = parse_settings(&raw);
        settings.current_slide_id = Some(slide_id.clone());
        let json = settings_to_json(&settings)?;
        sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
            .bind(json)
            .bind(now_ms())
            .bind(&payload.project_id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    } else {
        touch_project(pool.inner(), &payload.project_id).await?;
    }

    Ok(Slide {
        id: slide_id,
        code,
        language,
        duration: 3000,
        transition_duration: 750,
        stagger: 5,
        order_index,
    })
}

#[tauri::command]
pub async fn delete_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_id: String,
) -> Result<Project, String> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM slides WHERE project_id = ?")
        .bind(&project_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Failed to count slides: {e}"))?;

    if count.0 <= 1 {
        return Err("Cannot delete the last slide".into());
    }

    sqlx::query("DELETE FROM slides WHERE id = ? AND project_id = ?")
        .bind(&slide_id)
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete slide: {e}"))?;

    // Reindex remaining slides
    let remaining = fetch_slides(pool.inner(), &project_id).await?;
    for (i, s) in remaining.iter().enumerate() {
        sqlx::query("UPDATE slides SET order_index = ? WHERE id = ?")
            .bind(i as i64)
            .bind(&s.id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    // Fix current_slide_id if needed
    let row = sqlx::query("SELECT settings FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    let raw: String = row.get("settings");
    let mut settings = parse_settings(&raw);
    if settings.current_slide_id.as_deref() == Some(slide_id.as_str()) {
        settings.current_slide_id = remaining.first().map(|s| s.id.clone());
        let json = settings_to_json(&settings)?;
        sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
            .bind(json)
            .bind(now_ms())
            .bind(&project_id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    } else {
        touch_project(pool.inner(), &project_id).await?;
    }

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn update_slide_code(
    pool: State<'_, DbPool>,
    slide_id: String,
    code: String,
) -> Result<(), String> {
    let result = sqlx::query("UPDATE slides SET code = ? WHERE id = ?")
        .bind(&code)
        .bind(&slide_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update slide code: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("Slide not found: {slide_id}"));
    }

    // Touch parent project
    if let Ok(Some(row)) = sqlx::query("SELECT project_id FROM slides WHERE id = ?")
        .bind(&slide_id)
        .fetch_optional(pool.inner())
        .await
    {
        let pid: String = row.get("project_id");
        let _ = touch_project(pool.inner(), &pid).await;
    }

    Ok(())
}

#[tauri::command]
pub async fn update_slide_settings(
    pool: State<'_, DbPool>,
    slide_id: String,
    payload: UpdateSlideSettingsPayload,
) -> Result<Slide, String> {
    let row = sqlx::query(
        r#"
        SELECT id, project_id, code, language, duration, transition_duration, stagger, order_index
        FROM slides WHERE id = ?
        "#,
    )
    .bind(&slide_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Slide not found: {slide_id}"))?;

    let language_changed = payload.language.is_some();
    let language = payload
        .language
        .clone()
        .unwrap_or_else(|| row.get("language"));
    let duration = payload.duration.unwrap_or_else(|| row.get("duration"));
    let transition_duration = payload
        .transition_duration
        .unwrap_or_else(|| row.get("transition_duration"));
    let stagger = payload.stagger.unwrap_or_else(|| row.get("stagger"));
    let project_id: String = row.get("project_id");
    let code: String = row.get("code");
    let order_index: i64 = row.get("order_index");

    // Language is project-wide — propagate to every slide when changed
    if language_changed {
        sqlx::query(
            r#"
            UPDATE slides
            SET language = ?, duration = ?, transition_duration = ?, stagger = ?
            WHERE id = ?
            "#,
        )
        .bind(&language)
        .bind(duration)
        .bind(transition_duration)
        .bind(stagger)
        .bind(&slide_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update slide settings: {e}"))?;

        sqlx::query("UPDATE slides SET language = ? WHERE project_id = ?")
            .bind(&language)
            .bind(&project_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to sync project language: {e}"))?;
    } else {
        sqlx::query(
            r#"
            UPDATE slides
            SET duration = ?, transition_duration = ?, stagger = ?
            WHERE id = ?
            "#,
        )
        .bind(duration)
        .bind(transition_duration)
        .bind(stagger)
        .bind(&slide_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update slide settings: {e}"))?;
    }

    touch_project(pool.inner(), &project_id).await?;

    Ok(Slide {
        id: slide_id,
        code,
        language,
        duration,
        transition_duration,
        stagger,
        order_index,
    })
}

#[tauri::command]
pub async fn reorder_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_ids: Vec<String>,
) -> Result<Project, String> {
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    for (i, id) in slide_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE slides SET order_index = ? WHERE id = ? AND project_id = ?",
        )
        .bind(i as i64)
        .bind(id)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to reorder slide {id}: {e}"))?;
    }

    sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
        .bind(now_ms())
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn set_current_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT settings FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;

    let raw: String = row.get("settings");
    let mut settings = parse_settings(&raw);
    settings.current_slide_id = Some(slide_id);
    let json = settings_to_json(&settings)?;

    sqlx::query("UPDATE projects SET settings = ? WHERE id = ?")
        .bind(json)
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Opens a native save dialog, then writes the project as JSON.
#[tauri::command]
pub async fn export_project_to_json(
    app: AppHandle,
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<String, String> {
    let project = fetch_project(pool.inner(), &project_id).await?;

    // Build web-compatible export shape
    let export = serde_json::json!({
        "id": project.id,
        "name": project.name,
        "createdAt": project.created_at,
        "updatedAt": project.updated_at,
        "theme": project.theme,
        "showLineNumbers": project.settings.show_line_numbers,
        "fontSize": project.settings.font_size,
        "lineHeight": project.settings.line_height,
        "editorFontSize": project.settings.editor_font_size,
        "useGlobalTransition": project.settings.use_global_transition,
        "globalTransitionDuration": project.settings.global_transition_duration,
        "useGlobalStagger": project.settings.use_global_stagger,
        "globalStagger": project.settings.global_stagger,
        "currentSlideId": project.settings.current_slide_id,
        "slides": project.slides.iter().map(|s| serde_json::json!({
            "id": s.id,
            "code": s.code,
            "language": s.language,
            "duration": s.duration,
            "transitionDuration": s.transition_duration,
            "stagger": s.stagger,
        })).collect::<Vec<_>>(),
    });

    let default_name = format!("{}.json", sanitize_filename(&project.name));
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("JSON", &["json"])
        .blocking_save_file();

    let Some(file_path) = file_path else {
        return Err("Export cancelled".into());
    };

    let path = file_path
        .into_path()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let pretty = serde_json::to_string_pretty(&export)
        .map_err(|e| format!("JSON serialize failed: {e}"))?;

    std::fs::write(&path, pretty).map_err(|e| format!("Failed to write file: {e}"))?;

    Ok(path.display().to_string())
}

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "openslides-export".into()
    } else {
        trimmed.replace(' ', "-")
    }
}
