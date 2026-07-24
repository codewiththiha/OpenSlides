//! Import / export Tauri commands.

use crate::commands::helpers::{
    default_slide_name, dialog_pick_path, fetch_project, is_supported_theme, now_ms,
    normalize_code_align, normalize_imported_highlights, normalize_language, remap_section_id,
    sanitize_filename, DialogMode,
};
use crate::db::DbPool;
use crate::error::{CommandError, CommandResult};
use crate::models::{
    settings_to_json, Project, ProjectSettings,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
pub async fn export_project_to_json(
    app: AppHandle,
    pool: State<'_, DbPool>,
    project_id: String,
) -> CommandResult<String> {
    let project = fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)?;

    let export = serde_json::json!({
        "id": project.id,
        "name": project.name,
        "createdAt": project.created_at,
        "updatedAt": project.updated_at,
        "theme": project.theme,
        "showLineNumbers": project.settings.show_line_numbers,
        "useBlackCodeBackground": project.settings.use_black_code_background,
        "showHighlightStepIndicator": project.settings.show_highlight_step_indicator,
        "fontSize": project.settings.font_size,
        "lineHeight": project.settings.line_height,
        "editorFontSize": project.settings.editor_font_size,
        "useGlobalTransition": project.settings.use_global_transition,
        "globalTransitionDuration": project.settings.global_transition_duration,
        "useGlobalStagger": project.settings.use_global_stagger,
        "globalStagger": project.settings.global_stagger,
        "useGlobalHighlight": project.settings.use_global_highlight,
        "globalDimAmount": project.settings.global_dim_amount,
        "globalSizeUpAmount": project.settings.global_size_up_amount,
        "highlightDimColor": project.settings.highlight_dim_color,
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
            "sectionId": s.section_id,
        })).collect::<Vec<_>>(),
    });

    let default_name = format!("{}.json", sanitize_filename(&project.name));
    let app_handle = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || {
        dialog_pick_path(&app_handle, DialogMode::Save, Some(&default_name))
    })
    .await
    .map_err(|e| CommandError::Failed(format!("Dialog task failed: {e}")))?
    .ok_or_else(|| CommandError::Cancelled("Export cancelled".to_string()))?;

    let pretty = serde_json::to_string_pretty(&export)
        .map_err(|e| CommandError::Failed(format!("JSON serialize failed: {e}")))?;

    let write_path = path.clone();
    tauri::async_runtime::spawn_blocking(move || std::fs::write(write_path, pretty))
        .await
        .map_err(|e| CommandError::Failed(format!("File write task failed: {e}")))?
        .map_err(|e| CommandError::Failed(format!("Failed to write file: {e}")))?;

    Ok(path.display().to_string())
}

/// Native open dialog + import web/export JSON into SQLite as a new project.
#[tauri::command]
pub async fn import_project_from_json(
    app: AppHandle,
    pool: State<'_, DbPool>,
) -> CommandResult<Project> {
    let app_handle = app.clone();
    let path = tauri::async_runtime::spawn_blocking(move || {
        dialog_pick_path(&app_handle, DialogMode::Open, None)
    })
    .await
    .map_err(|e| CommandError::Failed(format!("Dialog task failed: {e}")))?
    .ok_or_else(|| CommandError::Cancelled("Import cancelled".to_string()))?;

    let raw = tauri::async_runtime::spawn_blocking(move || std::fs::read_to_string(path))
        .await
        .map_err(|e| CommandError::Failed(format!("File read task failed: {e}")))?
        .map_err(|e| CommandError::Failed(format!("Failed to read file: {e}")))?;
    let value: JsonValue = serde_json::from_str(&raw)
        .map_err(|_| CommandError::Failed("That file isn't a valid presentation file".to_string()))?;

    let name = value
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Presentation")
        .to_string();
    let imported_theme = value
        .get("theme")
        .and_then(|v| v.as_str())
        .unwrap_or("dark-plus");
    let theme = if is_supported_theme(imported_theme) {
        imported_theme.to_string()
    } else {
        "dark-plus".to_string()
    };

    let slides_val = value
        .get("slides")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if slides_val.is_empty() {
        return Err(CommandError::Failed(
            "This file doesn't contain any slides".to_string(),
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
        use_black_code_background: value
            .get("useBlackCodeBackground")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        show_highlight_step_indicator: value
            .get("showHighlightStepIndicator")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
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
            .unwrap_or(true),
        global_transition_duration: value
            .get("globalTransitionDuration")
            .and_then(|v| v.as_i64())
            .unwrap_or(800),
        use_global_stagger: value
            .get("useGlobalStagger")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        global_stagger: value
            .get("globalStagger")
            .and_then(|v| v.as_i64())
            .unwrap_or(5),
        use_global_highlight: value
            .get("useGlobalHighlight")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        global_dim_amount: value
            .get("globalDimAmount")
            .and_then(|v| v.as_i64())
            .unwrap_or(80),
        global_size_up_amount: value
            .get("globalSizeUpAmount")
            .and_then(|v| v.as_i64())
            .unwrap_or(105),
        highlight_dim_color: value
            .get("highlightDimColor")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "theme".to_string()),
        current_slide_id: None,
        language: language.clone(),
        code_align,
    };

    let project_id = Uuid::new_v4().to_string();
    let ts = now_ms();

    // Imported slides are always assigned fresh IDs. An exported deck can be
    // imported back into the same database, where reusing its old IDs would
    // collide with the original slides table rows.
    let mut imported_slide_ids: HashMap<String, String> = HashMap::new();
    let mut imported_section_ids: HashMap<String, String> = HashMap::new();
    let mut parsed_slides: Vec<(String, String, i64, i64, i64, String, String, Option<String>)> = Vec::new();
    for (i, s) in slides_val.iter().enumerate() {
        let source_id = s
            .get("id")
            .and_then(|v| v.as_str())
            .map(|value| value.to_string());
        let id = Uuid::new_v4().to_string();
        if let Some(source_id) = source_id {
            imported_slide_ids.insert(source_id, id.clone());
        }
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
        let highlights_json = normalize_imported_highlights(s)
            .map_err(CommandError::Failed)?;
        if i == 0 {
            settings.current_slide_id = Some(id.clone());
        }
        let section_id = remap_section_id(
            &mut imported_section_ids,
            s.get("sectionId")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string()),
        );
        parsed_slides.push((id, code, duration, transition, stagger, sname, highlights_json, section_id));
    }

    // Remap the exported current slide ID to the fresh imported slide ID.
    if let Some(cid) = value.get("currentSlideId").and_then(|v| v.as_str()) {
        if let Some(imported_id) = imported_slide_ids.get(cid) {
            settings.current_slide_id = Some(imported_id.clone());
        }
    }

    let settings_json = settings_to_json(&settings).map_err(CommandError::Failed)?;

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| CommandError::Failed(format!("TX begin failed: {e}")))?;

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
    .map_err(|e| CommandError::Failed(format!("Failed to insert project: {e}")))?;

    for (i, (id, code, duration, transition, stagger, sname, highlights_json, section_id)) in parsed_slides.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO slides
              (id, project_id, order_index, code, transition_duration, stagger, duration, name, highlights, section_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(&project_id)
        .bind(i as i64)
        .bind(code)
        .bind(transition)
        .bind(stagger)
        .bind(duration)
        .bind(sname)
        .bind(highlights_json)
        .bind(section_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| CommandError::Failed(format!("Failed to insert slide: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| CommandError::Failed(format!("TX commit failed: {e}")))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}
