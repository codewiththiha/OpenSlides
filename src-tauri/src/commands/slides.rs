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
    // Atomic transaction: COUNT → DELETE → re-index → settings update → commit
    // Previously 6-8 round trips without atomicity, now single transaction + final fetch
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM slides WHERE project_id = ?")
        .bind(&project_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to count slides: {e}"))?;

    if count.0 <= 1 {
        return Err("Cannot delete the last slide".into());
    }

    sqlx::query("DELETE FROM slides WHERE id = ? AND project_id = ?")
        .bind(&slide_id)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete slide: {e}"))?;

    // Fetch remaining slides (inside tx) for re-index and for current_slide fallback
    let remaining_rows = sqlx::query(
        r#"
        SELECT id, code, duration, transition_duration, stagger, order_index, name, highlights
        FROM slides
        WHERE project_id = ?
        ORDER BY order_index ASC
        "#,
    )
    .bind(&project_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch slides: {e}"))?;

    let mut remaining_ids: Vec<String> = Vec::new();
    let mut remaining_for_fallback: Vec<(String, i64)> = Vec::new(); // (id, order)
    for row in &remaining_rows {
        let id: String = row.get("id");
        let order: i64 = row.get("order_index");
        remaining_ids.push(id.clone());
        remaining_for_fallback.push((id, order));
    }

    // Batch re-index using JSON + json_each — infinitely scalable
    if !remaining_ids.is_empty() {
        let json = serde_json::to_string(
            &remaining_ids
                .iter()
                .enumerate()
                .map(|(i, id)| serde_json::json!({ "id": id, "new_order": i as i64 }))
                .collect::<Vec<_>>(),
        )
        .map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            UPDATE slides SET order_index = new_order
            FROM (
              SELECT json_extract(value, '$.id') as id,
                     CAST(json_extract(value, '$.new_order') AS INTEGER) as new_order
              FROM json_each(?)
            )
            WHERE slides.id = id AND slides.project_id = ?
            "#,
        )
        .bind(&json)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Load settings (inside tx)
    let settings_row = sqlx::query("SELECT settings FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("Failed to load project settings: {e}"))?
        .ok_or_else(|| format!("Project not found: {project_id}"))?;
    let settings_raw: String = settings_row.get("settings");
    let mut settings = crate::models::parse_settings(&settings_raw);

    if settings.current_slide_id.as_deref() == Some(slide_id.as_str()) {
        // Fallback to first remaining slide
        let fallback = remaining_ids.first().cloned();
        settings.current_slide_id = fallback;
        let json = crate::models::settings_to_json(&settings).map_err(|e| e.to_string())?;
        sqlx::query("UPDATE projects SET settings = ?, updated_at = ? WHERE id = ?")
            .bind(json)
            .bind(now_ms())
            .bind(&project_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
            .bind(now_ms())
            .bind(&project_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to update project timestamp: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

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
    if slide_ids.is_empty() {
        return fetch_project(pool.inner(), &project_id).await;
    }

    // Scalable JSON + json_each approach — avoids massive CASE with 300 WHEN clauses
    // that can hit SQLITE_MAX_EXPR_DEPTH and parser limits.
    // Pass JSON array [{"id":"uuid","new_order":0},...] and use UPDATE FROM json_each(?)
    // Infinitely scalable, no SQL string bloat.
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let json = serde_json::to_string(
        &slide_ids
            .iter()
            .enumerate()
            .map(|(i, id)| serde_json::json!({ "id": id, "new_order": i as i64 }))
            .collect::<Vec<_>>(),
    )
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        UPDATE slides SET order_index = new_order
        FROM (
          SELECT json_extract(value, '$.id') as id,
                 CAST(json_extract(value, '$.new_order') AS INTEGER) as new_order
          FROM json_each(?)
        )
        WHERE slides.id = id AND slides.project_id = ?
        "#,
    )
    .bind(&json)
    .bind(&project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to reorder slides batch: {e}"))?;

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
