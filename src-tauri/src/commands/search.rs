//! Full-text search commands for the slide strip.

use crate::db::DbPool;
use sqlx::Row;
use tauri::State;

/// Search slides with SQLite FTS5 BM25 ranking, limited to one project.
#[tauri::command]
pub async fn search_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    query: String,
) -> Result<Vec<String>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    // Preserve FTS operators/column filters when explicitly supplied; ordinary
    // search terms become prefixes so typing "func" still matches "function".
    let fts_query = if query.contains(':')
        || query.contains('*')
        || query.contains('"')
        || query.split_whitespace().any(|term| matches!(term, "AND" | "OR" | "NOT"))
    {
        query.to_string()
    } else {
        query
            .split_whitespace()
            .map(|term| format!("\"{}\"*", term.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" ")
    };

    let rows = sqlx::query(
        r#"
        SELECT slides.id
        FROM slides_fts
        JOIN slides ON slides.rowid = slides_fts.rowid
        WHERE slides_fts MATCH ? AND slides.project_id = ?
        ORDER BY bm25(slides_fts)
        LIMIT 50
        "#,
    )
    .bind(&fts_query)
    .bind(project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to search slides: {e}"))?;

    Ok(rows.into_iter().map(|row| row.get::<String, _>("id")).collect())
}
