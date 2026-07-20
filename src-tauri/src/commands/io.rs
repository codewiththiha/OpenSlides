//! Import / export Tauri commands.

use crate::commands::helpers::{
    default_slide_name, dialog_pick_path, fetch_project, now_ms, normalize_code_align,
    normalize_language, sanitize_filename, DialogMode,
};
use crate::db::DbPool;
use crate::models::{
    settings_to_json, Project, ProjectSettings,
};
use serde_json::Value as JsonValue;
use tauri::{AppHandle, State};
use uuid::Uuid;

/// Structured IPC error for import/export so the frontend can tell "the
/// user just closed the dialog" (stay silent) from real failures (toast) —
/// without matching fragile hardcoded message strings across the bridge.
/// Serializes as `{ "code": "CANCELLED" | "ERROR", "message": string }`.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "code", content = "message")]
pub enum IoCommandError {
    #[serde(rename = "CANCELLED")]
    Cancelled(String),
    #[serde(rename = "ERROR")]
    Failed(String),
}

#[tauri::command]
pub async fn export_project_to_json(
    app: AppHandle,
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<String, IoCommandError> {
    let project = fetch_project(pool.inner(), &project_id)
        .await
        .map_err(IoCommandError::Failed)?;

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
        "language": project.settings.language,
        "codeAlign": project.settings.code_align,
        "slides": project.slides.iter().map(|s| serde_json::json!({
            "id": s.id,
            "code": s.code,
            "language": project.settings.language,
            "duration": s.duration,
            "transitionDuration": s.transition_duration,
            "stagger": s.stagger,
            "name": s.name,
            "highlights": s.highlights,
        })).collect::<Vec<_>>(),
    });

    let default_name = format!("{}.json", sanitize_filename(&project.name));
    let app_handle = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || {
        dialog_pick_path(&app_handle, DialogMode::Save, Some(&default_name))
    })
    .await
    .map_err(|e| IoCommandError::Failed(format!("Dialog task failed: {e}")))?
    .ok_or_else(|| IoCommandError::Cancelled("Export cancelled".to_string()))?;

    let pretty = serde_json::to_string_pretty(&export)
        .map_err(|e| IoCommandError::Failed(format!("JSON serialize failed: {e}")))?;

    std::fs::write(&path, pretty)
        .map_err(|e| IoCommandError::Failed(format!("Failed to write file: {e}")))?;

    Ok(path.display().to_string())
}

/// Native open dialog + import web/export JSON into SQLite as a new project.
#[tauri::command]
pub async fn import_project_from_json(
    app: AppHandle,
    pool: State<'_, DbPool>,
) -> Result<Project, IoCommandError> {
    let app_handle = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || {
        dialog_pick_path(&app_handle, DialogMode::Open, None)
    })
    .await
    .map_err(|e| IoCommandError::Failed(format!("Dialog task failed: {e}")))?
    .ok_or_else(|| IoCommandError::Cancelled("Import cancelled".to_string()))?;

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| IoCommandError::Failed(format!("Failed to read file: {e}")))?;
    let value: JsonValue = serde_json::from_str(&raw)
        .map_err(|e| IoCommandError::Failed(format!("Invalid JSON: {e}")))?;

    let name = value
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Deck")
        .to_string();
    let theme = value
        .get("theme")
        .and_then(|v| v.as_str())
        .unwrap_or("dark-plus")
        .to_string();

    let slides_val = value
        .get("slides")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if slides_val.is_empty() {
        return Err(IoCommandError::Failed(
            "Import file has no slides".to_string(),
        ));
    }

    let language = normalize_language(
        value.get("language").and_then(|v| v.as_str())
            .or_else(|| slides_val.first().and_then(|s| s.get("language")).and_then(|v| v.as_str()))
            .unwrap_or(""),
    );

    let code_align = normalize_code_align(
        value.get("codeAlign").and_then(|v| v.as_str()).unwrap_or("left"),
    );

    let mut settings = ProjectSettings {
        show_line_numbers: value
            .get("showLineNumbers")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        font_size: value.get("fontSize").and_then(|v| v.as_i64()).unwrap_or(16),
        line_height: value
            .get("lineHeight")
            .and_then(|v| v.as_f64())
            .unwrap_or(1.5),
        editor_font_size: value
            .get("editorFontSize")
            .and_then(|v| v.as_i64())
            .unwrap_or(14),
        use_global_transition: value
            .get("useGlobalTransition")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        global_transition_duration: value
            .get("globalTransitionDuration")
            .and_then(|v| v.as_i64())
            .unwrap_or(750),
        use_global_stagger: value
            .get("useGlobalStagger")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        global_stagger: value
            .get("globalStagger")
            .and_then(|v| v.as_i64())
            .unwrap_or(5),
        current_slide_id: None,
        language: language.clone(),
        code_align,
    };

    let project_id = Uuid::new_v4().to_string();
    let ts = now_ms();

    let mut parsed_slides: Vec<(String, String, i64, i64, i64, String, String)> = Vec::new();
    for (i, s) in slides_val.iter().enumerate() {
        let id = s
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let code = s
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("// empty")
            .to_string();
        let duration = s.get("duration").and_then(|v| v.as_i64()).unwrap_or(3000);
        let transition = s
            .get("transitionDuration")
            .and_then(|v| v.as_i64())
            .unwrap_or(750);
        let stagger = s.get("stagger").and_then(|v| v.as_i64()).unwrap_or(5);
        let sname = s
            .get("name")
            .and_then(|v| v.as_str())
            .filter(|n| !n.trim().is_empty())
            .map(|n| n.to_string())
            .unwrap_or_else(|| default_slide_name(i as i64));
        let highlights_json = s
            .get("highlights")
            .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());
        if i == 0 {
            settings.current_slide_id = Some(id.clone());
        }
        parsed_slides.push((id, code, duration, transition, stagger, sname, highlights_json));
    }

    // Prefer imported currentSlideId if it matches a slide we keep
    if let Some(cid) = value.get("currentSlideId").and_then(|v| v.as_str()) {
        if parsed_slides.iter().any(|(id, ..)| id == cid) {
            settings.current_slide_id = Some(cid.to_string());
        }
    }

    let settings_json = settings_to_json(&settings).map_err(IoCommandError::Failed)?;

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| IoCommandError::Failed(format!("TX begin failed: {e}")))?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, theme, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&project_id)
    .bind(&name)
    .bind(&theme)
    .bind(&settings_json)
    .bind(ts)
    .bind(ts)
    .execute(&mut *tx)
    .await
    .map_err(|e| IoCommandError::Failed(format!("Failed to insert project: {e}")))?;

    for (i, (id, code, duration, transition, stagger, sname, highlights_json)) in parsed_slides.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO slides
              (id, project_id, order_index, code, language, transition_duration, stagger, duration, name, highlights)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(&project_id)
        .bind(i as i64)
        .bind(code)
        .bind(&language)
        .bind(transition)
        .bind(stagger)
        .bind(duration)
        .bind(sname)
        .bind(highlights_json)
        .execute(&mut *tx)
        .await
        .map_err(|e| IoCommandError::Failed(format!("Failed to insert slide: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| IoCommandError::Failed(format!("TX commit failed: {e}")))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(IoCommandError::Failed)
}
