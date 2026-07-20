//! Slide-level Tauri commands.

use crate::commands::helpers::{
    batch_reindex, default_slide_name, fetch_project, insert_slide_row, load_settings,
    parse_highlights, save_settings, serialize_highlights, touch_project, NewSlide,
};
use crate::db::DbPool;
use crate::error::{CommandError, CommandResult};
use crate::models::{
    CreateSlidePayload, Project, Slide, UpdateSlideSettingsPayload,
    DEFAULT_SLIDE_DURATION_MS, DEFAULT_SLIDE_STAGGER, DEFAULT_SLIDE_TRANSITION_MS,
};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn create_slide(
    pool: State<'_, DbPool>,
    payload: CreateSlidePayload,
) -> CommandResult<Slide> {
    let slide_id = Uuid::new_v4().to_string();
    let code = payload
        .code
        .unwrap_or_else(|| "// New Slide\n// Edit me!".to_string());

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let mut settings = load_settings(&mut *tx, &payload.project_id).await?;
    let language = settings.language.clone();

    let max_order: (Option<i64>,) =
        sqlx::query_as("SELECT MAX(order_index) FROM slides WHERE project_id = ?")
            .bind(&payload.project_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| format!("Failed to get max order: {e}"))?;

    let order_index = max_order.0.map(|m| m + 1).unwrap_or(0);
    let slide_name = payload
        .name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| default_slide_name(order_index));

    insert_slide_row(
        &mut *tx,
        &NewSlide {
            id: &slide_id,
            project_id: &payload.project_id,
            order_index,
            code: &code,
            transition_duration: DEFAULT_SLIDE_TRANSITION_MS,
            stagger: DEFAULT_SLIDE_STAGGER,
            duration: DEFAULT_SLIDE_DURATION_MS,
            name: &slide_name,
            highlights_json: "[]",
            thumbnail_html: "",
        },
    )
    .await?;

    settings.current_slide_id = Some(slide_id.clone());
    save_settings(&mut *tx, &payload.project_id, &settings, true).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    Ok(Slide {
        id: slide_id,
        code,
        language,
        duration: DEFAULT_SLIDE_DURATION_MS,
        transition_duration: DEFAULT_SLIDE_TRANSITION_MS,
        stagger: DEFAULT_SLIDE_STAGGER,
        order_index,
        name: slide_name,
        highlights: vec![],
        thumbnail_html: String::new(),
    })
}

#[tauri::command]
pub async fn duplicate_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_id: String,
) -> CommandResult<Project> {
    // Atomic duplicate: copy slide at original.order+1, shift others, set current to new
    // Rust side for atomicity and single round-trip DB, not frontend copy-paste
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let orig = sqlx::query(
        r#"
        SELECT id, code, transition_duration, stagger, duration, order_index, name, highlights, thumbnail_html
        FROM slides WHERE id = ? AND project_id = ?
        "#,
    )
    .bind(&slide_id)
    .bind(&project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch original slide: {e}"))?
    .ok_or_else(|| CommandError::NotFound(format!("Slide not found: {slide_id}")))?;

    let orig_code: String = orig.get("code");
    let orig_trans: i64 = orig.get("transition_duration");
    let orig_stagger: i64 = orig.get("stagger");
    let orig_duration: i64 = orig.get("duration");
    let orig_order: i64 = orig.get("order_index");
    let orig_name: String = orig.try_get("name").unwrap_or_default();
    let orig_highlights: String = orig.try_get("highlights").unwrap_or_else(|_| "[]".to_string());
    let orig_thumbnail: String = orig.try_get("thumbnail_html").unwrap_or_default();

    let new_order = orig_order + 1;
    let new_id = Uuid::new_v4().to_string();
    let new_name = if orig_name.trim().is_empty() {
        format!("Slide {} Copy", new_order + 1)
    } else if orig_name.ends_with(" Copy") {
        format!("{} 2", orig_name)
    } else {
        format!("{} Copy", orig_name)
    };

    // Shift slides after original
    sqlx::query(
        "UPDATE slides SET order_index = order_index + 1 WHERE project_id = ? AND order_index > ?",
    )
    .bind(&project_id)
    .bind(orig_order)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to shift slides: {e}"))?;

    insert_slide_row(
        &mut *tx,
        &NewSlide {
            id: &new_id,
            project_id: &project_id,
            order_index: new_order,
            code: &orig_code,
            transition_duration: orig_trans,
            stagger: orig_stagger,
            duration: orig_duration,
            name: &new_name,
            highlights_json: &orig_highlights,
            thumbnail_html: &orig_thumbnail,
        },
    )
    .await?;

    let mut settings = load_settings(&mut *tx, &project_id).await?;
    settings.current_slide_id = Some(new_id.clone());
    save_settings(&mut *tx, &project_id, &settings, true).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn delete_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_id: String,
) -> CommandResult<Project> {
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
        return Err(CommandError::Validation("Cannot delete the last slide".into()));
    }

    sqlx::query("DELETE FROM slides WHERE id = ? AND project_id = ?")
        .bind(&slide_id)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete slide: {e}"))?;

    // Fetch remaining IDs after deletion; the reindex reads post-delete state.
    let remaining_rows = sqlx::query("SELECT id FROM slides WHERE project_id = ? ORDER BY order_index ASC")
        .bind(&project_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| format!("Failed to fetch slides: {e}"))?;
    let remaining_ids: Vec<String> = remaining_rows.iter().map(|row| row.get("id")).collect();
    batch_reindex(&mut *tx, &project_id, &remaining_ids).await?;

    let mut settings = load_settings(&mut *tx, &project_id).await?;
    if settings.current_slide_id.as_deref() == Some(slide_id.as_str()) {
        settings.current_slide_id = remaining_ids.first().cloned();
        save_settings(&mut *tx, &project_id, &settings, true).await?;
    } else {
        touch_project(&mut *tx, &project_id).await?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

/// Soft-delete alternative: restore a previously deleted slide snapshot.
#[tauri::command]
pub async fn restore_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide: Slide,
    insert_at: Option<i64>,
) -> CommandResult<Project> {
    let order_index = insert_at.unwrap_or(0);

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    sqlx::query(
        "UPDATE slides SET order_index = order_index + 1 WHERE project_id = ? AND order_index >= ?",
    )
    .bind(&project_id)
    .bind(order_index)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let settings = load_settings(&mut *tx, &project_id).await?;

    let restore_name = if slide.name.trim().is_empty() {
        default_slide_name(order_index)
    } else {
        slide.name.clone()
    };

    let highlights_json = serialize_highlights(&slide.highlights)?;

    insert_slide_row(
        &mut *tx,
        &NewSlide {
            id: &slide.id,
            project_id: &project_id,
            order_index,
            code: &slide.code,
            transition_duration: slide.transition_duration,
            stagger: slide.stagger,
            duration: slide.duration,
            name: &restore_name,
            highlights_json: &highlights_json,
            thumbnail_html: "",
        },
    )
    .await?;

    touch_project(&mut *tx, &project_id).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn update_slide_code(
    pool: State<'_, DbPool>,
    slide_id: String,
    code: String,
) -> CommandResult<()> {
    // Use RETURNING to get project_id in same round-trip — eliminates SELECT after UPDATE
    // Previously: UPDATE → SELECT project_id → UPDATE projects updated_at = 3 trips per keystroke
    // Now: UPDATE RETURNING project_id → UPDATE projects updated_at = 2 trips (33% fewer)
    let row = sqlx::query("UPDATE slides SET code = ?, thumbnail_html = '' WHERE id = ? RETURNING project_id")
        .bind(&code)
        .bind(&slide_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to update slide code: {e}"))?;

    let Some(row) = row else {
        return Err(CommandError::NotFound(format!("Slide not found: {slide_id}")));
    };

    let pid: String = row.get("project_id");
    let _ = touch_project(pool.inner(), &pid).await;

    Ok(())
}

/// Only write if the code still matches the rendered request — prevents a
/// stale worker response from overwriting a newer thumbnail.
#[tauri::command]
pub async fn cache_thumbnail(
    pool: State<'_, DbPool>,
    slide_id: String,
    code: String,
    html: String,
) -> CommandResult<()> {
    sqlx::query("UPDATE slides SET thumbnail_html = ? WHERE id = ? AND code = ?")
        .bind(html)
        .bind(slide_id)
        .bind(&code)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to cache thumbnail: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn update_slide_settings(
    pool: State<'_, DbPool>,
    slide_id: String,
    payload: UpdateSlideSettingsPayload,
) -> CommandResult<Slide> {
    let row = sqlx::query(
        r#"
        SELECT id, project_id, code, duration, transition_duration, stagger, order_index, name, highlights
        FROM slides WHERE id = ?
        "#,
    )
    .bind(&slide_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| CommandError::NotFound(format!("Slide not found: {slide_id}")))?;

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
    let existing_highlights = parse_highlights(&highlights_raw);
    let highlights = payload.highlights.unwrap_or(existing_highlights);
    let highlights_json = serialize_highlights(&highlights)?;

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
        thumbnail_html: String::new(),
    })
}

#[tauri::command]
pub async fn reorder_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_ids: Vec<String>,
) -> CommandResult<Project> {
    if slide_ids.is_empty() {
        return fetch_project(pool.inner(), &project_id)
            .await
            .map_err(CommandError::Failed);
    }

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;
    batch_reindex(&mut *tx, &project_id, &slide_ids).await?;
    touch_project(&mut *tx, &project_id).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_project(pool.inner(), &project_id)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn set_current_slide(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_id: String,
) -> CommandResult<()> {
    let mut settings = load_settings(pool.inner(), &project_id).await?;
    settings.current_slide_id = Some(slide_id);
    // No updated_at bump — purely a navigation record.
    save_settings(pool.inner(), &project_id, &settings, false).await?;

    Ok(())
}
