use serde_json::Value as JsonValue;

use super::duplication::normalize_copied_slide_highlights;

/// Normalize an imported slide's highlight payload before inserting it into a
/// new project context. Imported JSON may come from an existing local deck, so
/// IDs are always remapped.
pub fn normalize_imported_highlights(slide: &JsonValue) -> Result<String, String> {
    let raw = slide
        .get("highlights")
        .map(|value| serde_json::to_string(value).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());
    normalize_copied_slide_highlights(&raw)
}
