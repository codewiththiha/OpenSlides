//! Project-level Tauri commands.

use crate::commands::helpers::{
    fetch_project, invalidate_project_thumbnails, is_supported_language, is_supported_theme, load_settings,
    now_ms, remap_highlight_ids, DEFAULT_CODE,
};
use crate::db::DbPool;
use crate::error::{CommandError, CommandResult};
use crate::models::{
    merge_settings, settings_to_json, Project, ProjectSettings, ProjectSummary,
};
use serde_json::Value as JsonValue;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn get_projects(pool: State<'_, DbPool>) -> CommandResult<Vec<ProjectSummary>> {
    let rows = sqlx::query(
        r#"
        SELECT p.id, p.name, p.theme, p.created_at, p.updated_at, p.group_id, p.group_order,
               (SELECT COUNT(*) FROM slides s WHERE s.project_id = p.id) AS slide_count,
               COALESCE(json_extract(p.settings, '$.language'), 'typescript') AS language,
               (SELECT s.id FROM slides s WHERE s.project_id = p.id ORDER BY s.order_index ASC LIMIT 1) AS first_slide_id,
               COALESCE((SELECT substr(s.code, 1, 400) FROM slides s WHERE s.project_id = p.id ORDER BY s.order_index ASC LIMIT 1), '') AS first_slide_code,
               COALESCE((SELECT s.thumbnail_html FROM slides s WHERE s.project_id = p.id ORDER BY s.order_index ASC LIMIT 1), '') AS first_slide_thumbnail
        FROM projects p
        ORDER BY
            COALESCE((SELECT MAX(p2.updated_at) FROM projects p2 WHERE p2.group_id IS NOT NULL AND p2.group_id != '' AND p2.group_id = p.group_id), p.updated_at) DESC,
            COALESCE(p.group_id, p.id) ASC,
            p.group_order ASC
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
            language: r.try_get("language").unwrap_or_else(|_| "typescript".to_string()),
            first_slide_id: r.try_get("first_slide_id").unwrap_or_default(),
            first_slide_code: r.try_get("first_slide_code").unwrap_or_default(),
            first_slide_thumbnail: r.try_get("first_slide_thumbnail").unwrap_or_default(),
            group_id: r.try_get::<Option<String>, _>("group_id").unwrap_or(None),
            group_order: r.try_get::<i64, _>("group_order").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn get_project(pool: State<'_, DbPool>, project_id: String) -> CommandResult<Project> {
    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn create_project(pool: State<'_, DbPool>, name: String) -> CommandResult<Project> {
    let project_id = Uuid::new_v4().to_string();
    let slide_id = Uuid::new_v4().to_string();
    let ts = now_ms();
    let project_name = if name.trim().is_empty() {
        "Untitled Presentation".to_string()
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
          (id, project_id, order_index, code, transition_duration, stagger, duration, name)
        VALUES (?, ?, 0, ?, 750, 5, 3000, '1. Open with an idea')
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

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn duplicate_project(
    pool: State<'_, DbPool>,
    project_id: String,
) -> CommandResult<Project> {
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let project = sqlx::query(
        "SELECT name, theme, settings FROM projects WHERE id = ?",
    )
    .bind(&project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch project: {e}"))?
    .ok_or_else(|| CommandError::NotFound(format!("Presentation not found: {project_id}")))?;

    let name: String = project.get("name");
    let theme: String = project.get("theme");
    let settings_raw: String = project.get("settings");
    let mut settings = crate::models::parse_settings(&settings_raw);
    let slides = sqlx::query(
        "SELECT id, order_index, code, transition_duration, stagger, duration, name, highlights, thumbnail_html, section_id FROM slides WHERE project_id = ? ORDER BY order_index",
    )
    .bind(&project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch slides: {e}"))?;

    let new_project_id = Uuid::new_v4().to_string();
    let mut id_map = std::collections::HashMap::new();
    let mut section_map = std::collections::HashMap::new();
    for row in &slides {
        id_map.insert(row.get::<String, _>("id"), Uuid::new_v4().to_string());
        if let Some(sec) = row.try_get::<Option<String>, _>("section_id").unwrap_or(None) {
            section_map.entry(sec).or_insert_with(|| Uuid::new_v4().to_string());
        }
    }
    settings.current_slide_id = settings
        .current_slide_id
        .as_ref()
        .and_then(|id| id_map.get(id).cloned())
        .or_else(|| slides.first().and_then(|r| id_map.get(&r.get::<String, _>("id")).cloned()));
    let settings_json = settings_to_json(&settings)?;
    let now = now_ms();

    sqlx::query("INSERT INTO projects (id, name, theme, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&new_project_id)
        .bind(format!("{} Copy", name))
        .bind(&theme)
        .bind(&settings_json)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to duplicate project: {e}"))?;

    for row in slides {
        let old_id: String = row.get("id");
        let old_sec = row.try_get::<Option<String>, _>("section_id").unwrap_or(None);
        let new_sec = old_sec.and_then(|sec| section_map.get(&sec).cloned());
        let highlights_raw: String = row.try_get("highlights").unwrap_or_else(|_| "[]".to_string());
        let duplicate_highlights = remap_highlight_ids(&highlights_raw)?;
        sqlx::query("INSERT INTO slides (id, project_id, order_index, code, transition_duration, stagger, duration, name, highlights, thumbnail_html, section_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(id_map.get(&old_id).unwrap())
            .bind(&new_project_id)
            .bind(row.get::<i64, _>("order_index"))
            .bind(row.get::<String, _>("code"))
            .bind(row.get::<i64, _>("transition_duration"))
            .bind(row.get::<i64, _>("stagger"))
            .bind(row.get::<i64, _>("duration"))
            .bind(row.try_get::<String, _>("name").unwrap_or_default())
            .bind(duplicate_highlights)
            .bind(row.try_get::<String, _>("thumbnail_html").unwrap_or_default())
            .bind(new_sec)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to duplicate slide: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;
    fetch_project(pool.inner(), &new_project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn rename_project(
    pool: State<'_, DbPool>,
    project_id: String,
    name: String,
) -> CommandResult<Project> {
    let project_name = if name.trim().is_empty() {
        "Untitled Presentation".to_string()
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

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn delete_project(pool: State<'_, DbPool>, project_id: String) -> CommandResult<()> {
    let result = sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete project: {e}"))?;

    if result.rows_affected() == 0 {
        return Err(CommandError::NotFound(format!("Presentation not found: {project_id}")));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_project_settings(
    pool: State<'_, DbPool>,
    project_id: String,
    settings: JsonValue,
) -> CommandResult<Project> {
    let existing = load_settings(pool.inner(), &project_id).await?;
    let merged = merge_settings(&existing, &settings)?;
    if !is_supported_language(&merged.language) {
        return Err(CommandError::Validation(format!("Unsupported language: {}", merged.language)));
    }

    let settings_json = settings_to_json(&merged)?;
    let ts = now_ms();

    sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
        .bind(&settings_json)
        .bind(ts)
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update settings: {e}"))?;

    // Thumbnails encode language-specific highlighting — invalidate on change.
    // (The slides.language mirror is gone; settings are the source of truth.)
    if merged.language != existing.language {
        invalidate_project_thumbnails(pool.inner(), &project_id).await?;
    }

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn update_project_theme(
    pool: State<'_, DbPool>,
    project_id: String,
    theme: String,
) -> CommandResult<Project> {
    if !is_supported_theme(&theme) {
        return Err(CommandError::Validation(format!("Unsupported theme: {theme}")));
    }

    sqlx::query("UPDATE projects SET theme = ?, updated_at = ? WHERE id = ?")
        .bind(&theme)
        .bind(now_ms())
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update theme: {e}"))?;

    invalidate_project_thumbnails(pool.inner(), &project_id).await?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}
