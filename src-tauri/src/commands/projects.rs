//! Project-level Tauri commands.

use crate::commands::helpers::{fetch_project, load_settings, now_ms, DEFAULT_CODE};
use crate::db::DbPool;
use crate::models::{
    merge_settings, settings_to_json, Project, ProjectSettings, ProjectSummary,
};
use serde_json::Value as JsonValue;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

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
pub async fn get_project(pool: State<'_, DbPool>, project_id: String) -> Result<Project, String> {
    fetch_project(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn create_project(pool: State<'_, DbPool>, name: String) -> Result<Project, String> {
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
          (id, project_id, order_index, code, language, transition_duration, stagger, duration, name)
        VALUES (?, ?, 0, ?, 'typescript', 750, 5, 3000, 'Slide 1')
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
pub async fn duplicate_project(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<Project, String> {
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
    .ok_or_else(|| format!("Project not found: {project_id}"))?;

    let name: String = project.get("name");
    let theme: String = project.get("theme");
    let settings_raw: String = project.get("settings");
    let mut settings = crate::models::parse_settings(&settings_raw);
    let slides = sqlx::query(
        "SELECT id, order_index, code, language, transition_duration, stagger, duration, name, highlights, thumbnail_html FROM slides WHERE project_id = ? ORDER BY order_index",
    )
    .bind(&project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch slides: {e}"))?;

    let new_project_id = Uuid::new_v4().to_string();
    let mut id_map = std::collections::HashMap::new();
    for row in &slides {
        id_map.insert(row.get::<String, _>("id"), Uuid::new_v4().to_string());
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
        sqlx::query("INSERT INTO slides (id, project_id, order_index, code, language, transition_duration, stagger, duration, name, highlights, thumbnail_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(id_map.get(&old_id).unwrap())
            .bind(&new_project_id)
            .bind(row.get::<i64, _>("order_index"))
            .bind(row.get::<String, _>("code"))
            .bind(row.get::<String, _>("language"))
            .bind(row.get::<i64, _>("transition_duration"))
            .bind(row.get::<i64, _>("stagger"))
            .bind(row.get::<i64, _>("duration"))
            .bind(row.try_get::<String, _>("name").unwrap_or_default())
            .bind(row.try_get::<String, _>("highlights").unwrap_or_else(|_| "[]".to_string()))
            .bind(row.try_get::<String, _>("thumbnail_html").unwrap_or_default())
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to duplicate slide: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;
    fetch_project(pool.inner(), &new_project_id).await
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
pub async fn delete_project(pool: State<'_, DbPool>, project_id: String) -> Result<(), String> {
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
    let existing = load_settings(pool.inner(), &project_id).await?;
    let merged = merge_settings(&existing, &settings)?;

    let settings_json = settings_to_json(&merged)?;
    let ts = now_ms();

    sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
        .bind(&settings_json)
        .bind(ts)
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update settings: {e}"))?;

    // Keep slides.language column in sync for legacy/export convenience — only if changed
    if merged.language != existing.language {
        sqlx::query("UPDATE slides SET language = ? WHERE project_id = ?")
            .bind(&merged.language)
            .bind(&project_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to sync language: {e}"))?;
    }

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

