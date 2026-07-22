use crate::models::Highlight;
use uuid::Uuid;

pub fn parse_highlights(raw: &str) -> Vec<Highlight> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        Vec::new()
    } else {
        serde_json::from_str(raw).unwrap_or_default()
    }
}

pub fn serialize_highlights(highlights: &[Highlight]) -> Result<String, String> {
    serde_json::to_string(highlights).map_err(|e| e.to_string())
}

/// Normalize highlight IDs when slides are copied into a new context.
///
/// Preview overrides and animation keys are keyed by highlight ID, so copied
/// slides must never share IDs with their source slide/project/import file.
pub fn remap_highlight_ids(raw: &str) -> Result<String, String> {
    let mut highlights = parse_highlights(raw);
    for highlight in &mut highlights {
        highlight.id = Uuid::new_v4().to_string();
    }
    serialize_highlights(&highlights)
}
