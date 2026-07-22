//! Full-text search commands for the slide strip.

use crate::db::DbPool;
use crate::error::CommandResult;
use sqlx::Row;
use tauri::State;

async fn run_fts_search(
    pool: &DbPool,
    project_id: &str,
    fts_query: &str,
) -> Result<Vec<String>, sqlx::Error> {
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
    .bind(fts_query)
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|row| row.get::<String, _>("id")).collect())
}

/// Builds a conservative FTS5 prefix expression from user text. Keeping only
/// word characters avoids parser errors from incomplete quotes and operators.
fn safe_prefix_query(query: &str) -> String {
    query
        .split_whitespace()
        .filter_map(|term| {
            let safe: String = term
                .chars()
                .filter(|ch| ch.is_alphanumeric() || *ch == '_')
                .collect();
            (!safe.is_empty()).then(|| format!("{safe}*"))
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Never surface an FTS syntax error to the UI. This fallback is deliberately
/// literal (not LIKE), so `%`, `_`, quotes, and operators remain harmless.
async fn fallback_text_search(
    pool: &DbPool,
    project_id: &str,
    query: &str,
) -> Result<Vec<String>, String> {
    let needle = query
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace() || *ch == '_')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if needle.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        r#"
        SELECT id
        FROM slides
        WHERE project_id = ?
          AND (instr(lower(code), lower(?)) > 0 OR instr(lower(name), lower(?)) > 0)
        ORDER BY order_index
        LIMIT 50
        "#,
    )
    .bind(project_id)
    .bind(&needle)
    .bind(&needle)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to search slides: {error}"))?;

    Ok(rows.into_iter().map(|row| row.get::<String, _>("id")).collect())
}

/// Search slides with SQLite FTS5 BM25 ranking, limited to one project.
#[tauri::command]
pub async fn search_slides(
    pool: State<'_, DbPool>,
    project_id: String,
    query: String,
) -> CommandResult<Vec<String>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    // Explicit FTS syntax is still allowed for advanced users. If it is
    // malformed (for example an unclosed quote), retry with safe prefixes and
    // finally a literal text search instead of returning an error.
    let explicit_fts = query.contains(':')
        || query.contains('*')
        || query.contains('"')
        || query.split_whitespace().any(|term| matches!(term, "AND" | "OR" | "NOT"));
    let primary_query = if explicit_fts {
        query.to_string()
    } else {
        safe_prefix_query(query)
    };

    if !primary_query.is_empty() {
        match run_fts_search(pool.inner(), &project_id, &primary_query).await {
            Ok(rows) => return Ok(rows),
            Err(_) => {
                let safe_query = safe_prefix_query(query);
                if !safe_query.is_empty() && safe_query != primary_query {
                    if let Ok(rows) = run_fts_search(pool.inner(), &project_id, &safe_query).await {
                        return Ok(rows);
                    }
                }
            }
        }
    }

    fallback_text_search(pool.inner(), &project_id, query)
        .await
        .map_err(Into::into)
}
