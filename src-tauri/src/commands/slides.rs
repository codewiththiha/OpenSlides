//! Slide-level Tauri commands.

use crate::commands::helpers::{
    fetch_project, fetch_slides, load_settings, now_ms, save_settings, touch_project,
};
use crate::db::DbPool;
use crate::models::{
    CreateSlidePayload, Project, Slide, UpdateSlideSettingsPayload,
};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn create_slide(
    pool: State<'_, DbPool>,
    payload: CreateSlidePayload,
) -> Result<Slide, String> {
    let slide_id = Uuid::new_v4().to_string();
    let code = payload
        .code
        .unwrap_or_else(|| "// New Slide\n// Edit me!".to_string());

    // Language comes from project settings
    let mut settings = load_settings(pool.inner(), &payload.project_id).await?;
    let language = settings.language.clone();

    let max_order: (Option<i64>,) =
        sqlx::query_as("SELECT MAX(order_index) FROM slides WHERE project_id = ?")
            .bind(&payload.project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to get max order: {e}"))?;

    let order_index = max_order.0.map(|m| m + 1).unwrap_or(0);
    let slide_name = payload
        .name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("Slide {}", order_index + 1));

    sqlx::query(
        r#"
        INSERT INTO slides
          (id, project_id, order_index, code, language, transition_duration, stagger, duration, name, highlights)
        VALUES (?, ?, ?, ?, ?, 750, 5, 3000, ?, '[]')
        "#,
    )
    .bind(&slide_id)
    .bind(&payload.project_id)
    .bind(order_index)
    .bind(&code)
    .bind(&language)
    .bind(&slide_name)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create slide: {e}"))?;

    settings.current_slide_id = Some(slide_id.clone());
    save_settings(pool.inner(), &payload.project_id, &settings, true).await?;

    Ok(Slide {
        id: slide_id,
        code,
        language,
        duration: 3000,
        transition_duration: 750,
        stagger: 5,
        order_index,
        name: slide_name,
        highlights: vec![],
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

    // Snapshot deleted slide for potential future undo (returned via project reload)
    sqlx::query("DELETE FROM slides WHERE id = ? AND project_id = ?")
        .bind(&slide_id)
        .bind(&project_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete slide: {e}"))?;

    let remaining = {
        let settings = load_settings(pool.inner(), &project_id).await?;
        fetch_slides(pool.inner(), &project_id, &settings.language).await?
    };

    for (i, s) in remaining.iter().enumerate() {
        sqlx::query("UPDATE slides SET order_index = ? WHERE id = ?")
            .bind(i as i64)
            .bind(&s.id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut settings = load_settings(pool.inner(), &project_id).await?;
    if settings.current_slide_id.as_deref() == Some(slide_id.as_str()) {
        settings.current_slide_id = remaining.first().map(|s| s.id.clone());
        save_settings(pool.inner(), &project_id, &settings, true).await?;
    } else {
        touch_project(pool.inner(), &project_id).await?;
    }

    fetch_project(pool.inner(), &project_id).await
}

/// Soft-delete alternative: restore a previously deleted slide snapshot.
#[tauri::command]
pub async fn restore_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide: Slide,
    insert_at: Option<i64>,
) -> Result<Project, String> {
    let order_index = insert_at.unwrap_or_else(|| {
        // append if not specified — caller should pass the original index
        0
    });

    // Shift existing slides at/after insert point
    sqlx::query(
        "UPDATE slides SET order_index = order_index + 1 WHERE project_id = ? AND order_index >= ?",
    )
    .bind(&project_id)
    .bind(order_index)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let settings = load_settings(pool.inner(), &project_id).await?;

    let restore_name = if slide.name.trim().is_empty() {
        format!("Slide {}", order_index + 1)
    } else {
        slide.name.clone()
    };

    let highlights_json = serde_json::to_string(&slide.highlights).map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO slides
          (id, project_id, order_index, code, language, transition_duration, stagger, duration, name, highlights)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&slide.id)
    .bind(&project_id)
    .bind(order_index)
    .bind(&slide.code)
    .bind(&settings.language)
    .bind(slide.transition_duration)
    .bind(slide.stagger)
    .bind(slide.duration)
    .bind(&restore_name)
    .bind(&highlights_json)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to restore slide: {e}"))?;

    touch_project(pool.inner(), &project_id).await?;
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
        SELECT id, project_id, code, language, duration, transition_duration, stagger, order_index, name, highlights
        FROM slides WHERE id = ?
        "#,
    )
    .bind(&slide_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Slide not found: {slide_id}"))?;

    let duration = payload.duration.unwrap_or_else(|| row.get("duration"));
    let transition_duration = payload
        .transition_duration
        .unwrap_or_else(|| row.get("transition_duration"));
    let stagger = payload.stagger.unwrap_or_else(|| row.get("stagger"));
    let name = payload
        .name
        .clone()
        .unwrap_or_else(|| row.try_get("name").unwrap_or_default());
    let project_id: String = row.get("project_id");
    let code: String = row.get("code");
    let order_index: i64 = row.get("order_index");

    // Parse existing highlights or use payload
    let highlights_raw: String = row.try_get("highlights").unwrap_or_else(|_| "[]".to_string());
    let existing_highlights: Vec<crate::models::Highlight> =
        serde_json::from_str(&highlights_raw).unwrap_or_default();
    let highlights = payload.highlights.unwrap_or(existing_highlights);
    let highlights_json = serde_json::to_string(&highlights).map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        UPDATE slides
        SET duration = ?, transition_duration = ?, stagger = ?, name = ?, highlights = ?
        WHERE id = ?
        "#,
    )
    .bind(duration)
    .bind(transition_duration)
    .bind(stagger)
    .bind(&name)
    .bind(&highlights_json)
    .bind(&slide_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update slide settings: {e}"))?;

    touch_project(pool.inner(), &project_id).await?;

    // Stamp language from project settings
    let settings = load_settings(pool.inner(), &project_id).await?;

    Ok(Slide {
        id: slide_id,
        code,
        language: settings.language,
        duration,
        transition_duration,
        stagger,
        order_index,
        name,
        highlights,
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
        sqlx::query("UPDATE slides SET order_index = ? WHERE id = ? AND project_id = ?")
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
    let mut settings = load_settings(pool.inner(), &project_id).await?;
    settings.current_slide_id = Some(slide_id);
    // No updated_at bump — purely a navigation record.
    save_settings(pool.inner(), &project_id, &settings, false).await?;

    Ok(())
}
