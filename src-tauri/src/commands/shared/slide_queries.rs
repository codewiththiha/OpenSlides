//! Slide DB read/write helpers and highlight parse/serialize.

use crate::db::DbPool;
use crate::models::Slide;
use sqlx::{Executor, Row, Sqlite};

pub fn parse_highlights(raw: &str) -> Vec<crate::models::Highlight> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        Vec::new()
    } else {
        serde_json::from_str(raw).unwrap_or_default()
    }
}

pub fn serialize_highlights(
    highlights: &[crate::models::Highlight],
) -> Result<String, String> {
    serde_json::to_string(highlights).map_err(|e| e.to_string())
}

pub async fn fetch_slides(
    pool: &DbPool,
    project_id: &str,
    language: &str,
) -> Result<Vec<Slide>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, code, duration, transition_duration, stagger, order_index, name, highlights, thumbnail_html, section_id
        FROM slides
        WHERE project_id = ?
        ORDER BY order_index ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch slides: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let highlights_raw: String = r.try_get("highlights").unwrap_or_else(|_| "[]".to_string());
            let highlights = parse_highlights(&highlights_raw);
            Slide {
                id: r.get("id"),
                code: r.get("code"),
                language: language.to_string(),
                duration: r.get("duration"),
                transition_duration: r.get("transition_duration"),
                stagger: r.get("stagger"),
                order_index: r.get("order_index"),
                name: r.try_get("name").unwrap_or_default(),
                highlights,
                thumbnail_html: r.try_get("thumbnail_html").unwrap_or_default(),
                section_id: r.try_get::<Option<String>, _>("section_id").unwrap_or(None),
            }
        })
        .collect())
}

pub async fn invalidate_project_thumbnails<'c, E>(
    exec: E,
    project_id: &str,
) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    sqlx::query("UPDATE slides SET thumbnail_html = '' WHERE project_id = ?")
        .bind(project_id)
        .execute(exec)
        .await
        .map_err(|e| format!("Failed to invalidate thumbnails: {e}"))?;
    Ok(())
}

pub struct NewSlide<'a> {
    pub id: &'a str,
    pub project_id: &'a str,
    pub order_index: i64,
    pub code: &'a str,
    pub transition_duration: i64,
    pub stagger: i64,
    pub duration: i64,
    pub name: &'a str,
    pub highlights_json: &'a str,
    pub thumbnail_html: &'a str,
    pub section_id: Option<&'a str>,
}

pub async fn insert_slide_row<'c, E>(exec: E, slide: &NewSlide<'_>) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    sqlx::query(
        r#"INSERT INTO slides
           (id, project_id, order_index, code, transition_duration, stagger, duration, name, highlights, thumbnail_html, section_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(slide.id)
    .bind(slide.project_id)
    .bind(slide.order_index)
    .bind(slide.code)
    .bind(slide.transition_duration)
    .bind(slide.stagger)
    .bind(slide.duration)
    .bind(slide.name)
    .bind(slide.highlights_json)
    .bind(slide.thumbnail_html)
    .bind(slide.section_id)
    .execute(exec)
    .await
    .map_err(|e| format!("Failed to insert slide: {e}"))?;
    Ok(())
}

pub async fn batch_reindex<'c, E>(exec: E, project_id: &str, ids: &[String]) -> Result<(), String>
where
    E: Executor<'c, Database = Sqlite>,
{
    if ids.is_empty() { return Ok(()); }
    let json = serde_json::to_string(&ids.iter().enumerate().map(|(i, id)| serde_json::json!({ "id": id, "new_order": i as i64 })).collect::<Vec<_>>()).map_err(|e| e.to_string())?;
    sqlx::query(r#"UPDATE slides SET order_index = new_order FROM (SELECT json_extract(value, '$.id') AS slide_id, CAST(json_extract(value, '$.new_order') AS INTEGER) AS new_order FROM json_each(?)) AS requested WHERE slides.id = requested.slide_id AND slides.project_id = ?"#)
        .bind(json).bind(project_id).execute(exec).await.map_err(|e| e.to_string())?;
    Ok(())
}
