//! Shared helpers for command modules (DB reads, dialogs, clocks).

use crate::db::DbPool;
use crate::models::{parse_settings, settings_to_json, Project, ProjectSettings, Slide};
use sqlx::{Executor, Row, Sqlite};
use std::sync::mpsc;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

pub const DEFAULT_CODE: &str = r#"// Welcome to OpenSlides
// Feedbacks on @codewiththiha
function greet() {
  console.log("Hi, Mom!");
}"#;

pub const DEFAULT_LANGUAGE: &str = "typescript";

pub fn normalize_language(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed == "dynamic" {
        DEFAULT_LANGUAGE.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn normalize_code_align(input: &str) -> String {
    match input {
        "center" => "center".to_string(),
        _ => "left".to_string(),
    }
}

pub fn default_slide_name(order_index: i64) -> String {
    format!("Slide {}", order_index + 1)
}

pub fn parse_highlights(raw: &str) -> Vec<crate::models::Highlight> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        Vec::new()
    } else {
        serde_json::from_str(raw).unwrap_or_default()
    }
}

pub fn serialize_highlights(
    highlights: &[crate::models::Highlight],
) -> Result<String, String> {
    serde_json::to_string(highlights).map_err(|e| e.to_string())
}

pub async fn invalidate_project_thumbnails<'c, E>(
    exec: E,
    project_id: &str,
) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    sqlx::query("UPDATE slides SET thumbnail_html = '' WHERE project_id = ?")
        .bind(project_id)
        .execute(exec)
        .await
        .map_err(|e| format!("Failed to invalidate thumbnails: {e}"))?;
    Ok(())
}

pub fn ensure_current_slide(settings: &mut ProjectSettings, slides: &[Slide]) {
    let valid = settings
        .current_slide_id
        .as_ref()
        .is_some_and(|id| slides.iter().any(|s| &s.id == id));
    if !valid {
        settings.current_slide_id = slides.first().map(|s| s.id.clone());
    }
}

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
        SELECT id, code, duration, transition_duration, stagger, order_index, name, highlights, thumbnail_html
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
        .map(|r| {
            let highlights_raw: String = r.try_get("highlights").unwrap_or_else(|_| "[]".to_string());
            let highlights = parse_highlights(&highlights_raw);
            Slide {
                id: r.get("id"),
                code: r.get("code"),
                language: language.to_string(),
                duration: r.get("duration"),
                transition_duration: r.get("transition_duration"),
                stagger: r.get("stagger"),
                order_index: r.get("order_index"),
                name: r.try_get("name").unwrap_or_default(),
                highlights,
                thumbnail_html: r.try_get("thumbnail_html").unwrap_or_default(),
            }
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

    ensure_current_slide(&mut settings, &slides);

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

/// Load + parse the settings JSON blob of a project.
pub async fn load_settings<'c, E>(exec: E, project_id: &str) -> Result<ProjectSettings, String>
where
    E: Executor<'c, Database = Sqlite>,
{
    let row = sqlx::query("SELECT settings FROM projects WHERE id = ?")
        .bind(project_id)
        .fetch_optional(exec)
        .await
        .map_err(|e| format!("Failed to load project settings: {e}"))?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    let raw: String = row.get("settings");
    Ok(parse_settings(&raw))
}

/// Persist settings JSON back to the project row.
/// `touch: true` also refreshes `updated_at` (user-visible edits).
pub async fn save_settings<'c, E>(
    exec: E,
    project_id: &str,
    settings: &ProjectSettings,
    touch: bool,
) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    let json = settings_to_json(settings)?;
    if touch {
        sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
            .bind(json)
            .bind(now_ms())
            .bind(project_id)
            .execute(exec)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("UPDATE projects SET settings = ? WHERE id = ?")
            .bind(json)
            .bind(project_id)
            .execute(exec)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn touch_project<'c, E>(exec: E, project_id: &str) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
        .bind(now_ms())
        .bind(project_id)
        .execute(exec)
        .await
        .map_err(|e| format!("Failed to update project timestamp: {e}"))?;
    Ok(())
}

pub struct NewSlide<'a> {
    pub id: &'a str,
    pub project_id: &'a str,
    pub order_index: i64,
    pub code: &'a str,
    pub language: &'a str,
    pub transition_duration: i64,
    pub stagger: i64,
    pub duration: i64,
    pub name: &'a str,
    pub highlights_json: &'a str,
    pub thumbnail_html: &'a str,
}

pub async fn insert_slide_row<'c, E>(exec: E, slide: &NewSlide<'_>) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    sqlx::query(
        r#"INSERT INTO slides
           (id, project_id, order_index, code, language, transition_duration, stagger, duration, name, highlights, thumbnail_html)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(slide.id)
    .bind(slide.project_id)
    .bind(slide.order_index)
    .bind(slide.code)
    .bind(slide.language)
    .bind(slide.transition_duration)
    .bind(slide.stagger)
    .bind(slide.duration)
    .bind(slide.name)
    .bind(slide.highlights_json)
    .bind(slide.thumbnail_html)
    .execute(exec)
    .await
    .map_err(|e| format!("Failed to insert slide: {e}"))?;
    Ok(())
}

pub async fn batch_reindex<'c, E>(exec: E, project_id: &str, ids: &[String]) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    if ids.is_empty() { return Ok(()); }
    let json = serde_json::to_string(&ids.iter().enumerate().map(|(i, id)| serde_json::json!({ "id": id, "new_order": i as i64 })).collect::<Vec<_>>()).map_err(|e| e.to_string())?;
    sqlx::query(r#"UPDATE slides SET order_index = new_order FROM (SELECT json_extract(value, '$.id') AS slide_id, CAST(json_extract(value, '$.new_order') AS INTEGER) AS new_order FROM json_each(?)) AS requested WHERE slides.id = requested.slide_id AND slides.project_id = ?"#)
        .bind(json).bind(project_id).execute(exec).await.map_err(|e| e.to_string())?;
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
