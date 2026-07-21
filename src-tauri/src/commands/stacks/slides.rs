//! Stack management commands for slides (slide sections).

use crate::commands::helpers::{fetch_slides, load_settings};
use crate::db::DbPool;
use crate::error::{CommandError, CommandResult};
use crate::models::Slide;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn stack_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    source_ids: Vec<String>,
    target_id: String,
) -> CommandResult<Vec<Slide>> {
    if source_ids.contains(&target_id) {
        return Err(CommandError::Validation(
            "Target slide cannot be in sources".to_string(),
        ));
    }

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let settings = load_settings(&mut *tx, &project_id).await?;
    let language = settings.language.clone();

    if source_ids.is_empty() {
        return fetch_slides(pool.inner(), &project_id, &language)
            .await
            .map_err(CommandError::Failed);
    }

    let target_row = sqlx::query(
        "SELECT order_index, section_id FROM slides WHERE id = ? AND project_id = ?",
    )
    .bind(&target_id)
    .bind(&project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("Failed to fetch target slide: {e}"))?
    .ok_or_else(|| CommandError::NotFound(format!("Slide not found: {target_id}")))?;

    let existing_section: Option<String> = target_row.try_get("section_id").unwrap_or(None);
    let target_order: i64 = target_row.get("order_index");

    let target_sec = match existing_section {
        Some(sec) if !sec.trim().is_empty() => sec,
        _ => {
            let sec = Uuid::new_v4().to_string();
            sqlx::query("UPDATE slides SET section_id = ? WHERE id = ? AND project_id = ?")
                .bind(&sec)
                .bind(&target_id)
                .bind(&project_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to assign section to target: {e}"))?;
            sec
        }
    };

    let max_sec_order: (Option<i64>,) = sqlx::query_as(
        "SELECT MAX(order_index) FROM slides WHERE project_id = ? AND section_id = ?",
    )
    .bind(&project_id)
    .bind(&target_sec)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Failed to get max section order: {e}"))?;

    let insert_at = max_sec_order.0.unwrap_or(target_order) + 1;

    for (i, sid) in source_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE slides SET order_index = ?, section_id = ? WHERE id = ? AND project_id = ?",
        )
        .bind(-1000 - (i as i64))
        .bind(&target_sec)
        .bind(sid)
        .bind(&project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to move source {sid}: {e}"))?;
    }

    let shift = source_ids.len() as i64;
    sqlx::query(
        "UPDATE slides SET order_index = order_index + ? WHERE project_id = ? AND order_index >= ? AND order_index >= 0",
    )
    .bind(shift)
    .bind(&project_id)
    .bind(insert_at)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to shift slides: {e}"))?;

    for (i, sid) in source_ids.iter().enumerate() {
        sqlx::query("UPDATE slides SET order_index = ? WHERE id = ? AND project_id = ?")
            .bind(insert_at + (i as i64))
            .bind(sid)
            .bind(&project_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to position source {sid}: {e}"))?;
    }

    clean_up_single_item_slide_sections(&mut *tx, &project_id).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_slides(pool.inner(), &project_id, &language)
        .await
        .map_err(CommandError::Failed)
}

#[tauri::command]
pub async fn unstack_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    slide_ids: Vec<String>,
) -> CommandResult<Vec<Slide>> {
    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let settings = load_settings(&mut *tx, &project_id).await?;
    let language = settings.language.clone();

    if slide_ids.is_empty() {
        return fetch_slides(pool.inner(), &project_id, &language)
            .await
            .map_err(CommandError::Failed);
    }

    for id in &slide_ids {
        sqlx::query("UPDATE slides SET section_id = NULL WHERE id = ? AND project_id = ?")
            .bind(id)
            .bind(&project_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to unstack slide {id}: {e}"))?;
    }

    clean_up_single_item_slide_sections(&mut *tx, &project_id).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    fetch_slides(pool.inner(), &project_id, &language)
        .await
        .map_err(CommandError::Failed)
}

async fn clean_up_single_item_slide_sections(exec: &mut sqlx::SqliteConnection, project_id: &str) -> Result<(), String> {
    let single_sections = sqlx::query(
        "SELECT section_id FROM slides WHERE project_id = ? AND section_id IS NOT NULL AND section_id != '' GROUP BY section_id HAVING COUNT(*) <= 1",
    )
    .bind(project_id)
    .fetch_all(&mut *exec)
    .await
    .map_err(|e| format!("Failed to find single slide sections: {e}"))?;

    for row in single_sections {
        let sec: String = row.get("section_id");
        sqlx::query("UPDATE slides SET section_id = NULL WHERE project_id = ? AND section_id = ?")
            .bind(project_id)
            .bind(&sec)
            .execute(&mut *exec)
            .await
            .map_err(|e| format!("Failed to dissolve slide section {sec}: {e}"))?;
    }

    let ordered =
        sqlx::query("SELECT id FROM slides WHERE project_id = ? ORDER BY order_index ASC")
            .bind(project_id)
            .fetch_all(&mut *exec)
            .await
            .map_err(|e| format!("Failed to order slides for re-indexing: {e}"))?;

    for (idx, row) in ordered.iter().enumerate() {
        let id: String = row.get("id");
        sqlx::query("UPDATE slides SET order_index = ? WHERE id = ? AND project_id = ?")
            .bind(idx as i64)
            .bind(&id)
            .bind(project_id)
            .execute(&mut *exec)
            .await
            .map_err(|e| format!("Failed to reindex slide order for {id}: {e}"))?;
    }

    Ok(())
}
