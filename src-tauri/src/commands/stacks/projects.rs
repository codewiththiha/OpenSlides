//! Stack management commands for projects (dashboard stacks).

use crate::commands::projects::get_projects;
use crate::db::DbPool;
use crate::error::{CommandError, CommandResult};
use crate::models::ProjectSummary;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn stack_projects(
    pool: State<'_, DbPool>,
    source_ids: Vec<String>,
    target_id: String,
) -> CommandResult<Vec<ProjectSummary>> {
    if source_ids.contains(&target_id) {
        return Err(CommandError::Validation(
            "Target presentation cannot be in sources".to_string(),
        ));
    }
    if source_ids.is_empty() {
        return get_projects(pool).await;
    }

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    let target_row = sqlx::query("SELECT group_id FROM projects WHERE id = ?")
        .bind(&target_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("Failed to fetch target project: {e}"))?
        .ok_or_else(|| CommandError::NotFound(format!("Presentation not found: {target_id}")))?;

    let existing_group_id: Option<String> = target_row.try_get("group_id").unwrap_or(None);

    let (target_group_id, mut next_order) = match existing_group_id {
        Some(gid) if !gid.trim().is_empty() => {
            let max_order: (Option<i64>,) =
                sqlx::query_as("SELECT MAX(group_order) FROM projects WHERE group_id = ?")
                    .bind(&gid)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|e| format!("Failed to get max group order: {e}"))?;
            (gid, max_order.0.unwrap_or(0) + 1)
        }
        _ => {
            let gid = Uuid::new_v4().to_string();
            sqlx::query("UPDATE projects SET group_id = ?, group_order = 0 WHERE id = ?")
                .bind(&gid)
                .bind(&target_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to update target group: {e}"))?;
            (gid, 1)
        }
    };

    for source_id in &source_ids {
        if source_id == &target_id {
            continue;
        }
        sqlx::query("UPDATE projects SET group_id = ?, group_order = ? WHERE id = ?")
            .bind(&target_group_id)
            .bind(next_order)
            .bind(source_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to stack project {source_id}: {e}"))?;
        next_order += 1;
    }

    clean_up_single_item_project_groups(&mut *tx).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    get_projects(pool).await
}

#[tauri::command]
pub async fn unstack_projects(
    pool: State<'_, DbPool>,
    project_ids: Vec<String>,
) -> CommandResult<Vec<ProjectSummary>> {
    if project_ids.is_empty() {
        return get_projects(pool).await;
    }

    let mut tx = pool
        .inner()
        .begin()
        .await
        .map_err(|e| format!("TX begin failed: {e}"))?;

    for id in &project_ids {
        sqlx::query("UPDATE projects SET group_id = NULL, group_order = 0 WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to unstack project {id}: {e}"))?;
    }

    clean_up_single_item_project_groups(&mut *tx).await?;

    tx.commit()
        .await
        .map_err(|e| format!("TX commit failed: {e}"))?;

    get_projects(pool).await
}

async fn clean_up_single_item_project_groups(exec: &mut sqlx::SqliteConnection) -> Result<(), String> {
    let single_groups = sqlx::query(
        "SELECT group_id FROM projects WHERE group_id IS NOT NULL AND group_id != '' GROUP BY group_id HAVING COUNT(*) <= 1",
    )
    .fetch_all(&mut *exec)
    .await
    .map_err(|e| format!("Failed to find single item groups: {e}"))?;

    for row in single_groups {
        let gid: String = row.get("group_id");
        sqlx::query("UPDATE projects SET group_id = NULL, group_order = 0 WHERE group_id = ?")
            .bind(&gid)
            .execute(&mut *exec)
            .await
            .map_err(|e| format!("Failed to dissolve group {gid}: {e}"))?;
    }

    let groups = sqlx::query(
        "SELECT DISTINCT group_id FROM projects WHERE group_id IS NOT NULL AND group_id != ''",
    )
    .fetch_all(&mut *exec)
    .await
    .map_err(|e| format!("Failed to fetch remaining groups: {e}"))?;

    for row in groups {
        let gid: String = row.get("group_id");
        let members = sqlx::query(
            "SELECT id FROM projects WHERE group_id = ? ORDER BY group_order ASC, updated_at DESC",
        )
        .bind(&gid)
        .fetch_all(&mut *exec)
        .await
        .map_err(|e| format!("Failed to fetch group members for {gid}: {e}"))?;

        for (idx, m) in members.iter().enumerate() {
            let id: String = m.get("id");
            sqlx::query("UPDATE projects SET group_order = ? WHERE id = ?")
                .bind(idx as i64)
                .bind(&id)
                .execute(&mut *exec)
                .await
                .map_err(|e| format!("Failed to reindex group order for {id}: {e}"))?;
        }
    }

    Ok(())
}
