//! Project and settings DB read/write helpers.

use crate::db::DbPool;
use crate::models::{parse_settings, settings_to_json, Project, ProjectSettings, Slide};
use sqlx::{Executor, Row, Sqlite};

use super::naming::now_ms;
use super::slide_queries::fetch_slides;

pub fn ensure_current_slide(settings: &mut ProjectSettings, slides: &[Slide]) {
    let valid = settings
        .current_slide_id
        .as_ref()
        .is_some_and(|id| slides.iter().any(|s| &s.id == id));
    if !valid {
        settings.current_slide_id = slides.first().map(|s| s.id.clone());
    }
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
    .ok_or_else(|| format!("Presentation not found: {project_id}"))?;

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
        .ok_or_else(|| format!("Presentation not found: {project_id}"))?;
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
