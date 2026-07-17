//! Shared helpers for command modules (DB reads, dialogs, clocks).

use crate::db::DbPool;
use crate::models::{parse_settings, Project, Slide};
use sqlx::Row;
use std::sync::mpsc;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

pub const DEFAULT_CODE: &str = r#"// Welcome to OpenSlides
// Feedbacks on @codewiththiha
function greet() {
  console.log("Hi, Mom!");
}"#;

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub enum DialogMode {
    Save,
    Open,
}

/// Await a callback-based dialog on a worker-friendly channel.
pub fn dialog_pick_path(
    app: &AppHandle,
    mode: DialogMode,
    default_name: Option<&str>,
) -> Option<std::path::PathBuf> {
    let (tx, rx) = mpsc::channel();
    let mut builder = app.dialog().file().add_filter("JSON", &["json"]);
    if let Some(name) = default_name {
        builder = builder.set_file_name(name);
    }
    match mode {
        DialogMode::Save => {
            builder.save_file(move |path| {
                let _ = tx.send(path);
            });
        }
        DialogMode::Open => {
            builder.pick_file(move |path| {
                let _ = tx.send(path);
            });
        }
    }
    rx.recv()
        .ok()
        .flatten()
        .and_then(|fp| fp.into_path().ok())
}

pub async fn fetch_slides(
    pool: &DbPool,
    project_id: &str,
    language: &str,
) -> Result<Vec<Slide>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, code, duration, transition_duration, stagger, order_index, name
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
            language: language.to_string(),
            duration: r.get("duration"),
            transition_duration: r.get("transition_duration"),
            stagger: r.get("stagger"),
            order_index: r.get("order_index"),
            name: r.try_get("name").unwrap_or_default(),
        })
        .collect())
}

pub async fn fetch_project(pool: &DbPool, project_id: &str) -> Result<Project, String> {
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
    let slides = fetch_slides(pool, project_id, &settings.language).await?;

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

pub async fn touch_project(pool: &DbPool, project_id: &str) -> Result<(), String> {
    sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
        .bind(now_ms())
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update project timestamp: {e}"))?;
    Ok(())
}

pub fn sanitize_filename(name: &str) -> String {
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
