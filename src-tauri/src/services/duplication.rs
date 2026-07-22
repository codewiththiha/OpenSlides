use std::collections::HashMap;
use uuid::Uuid;

use super::highlights::remap_highlight_ids;

/// Section/stack IDs must be preserved within a copied group but fresh in the
/// target project/import context. This remapper owns that normalization rule.
pub fn remap_section_id(
    section_map: &mut HashMap<String, String>,
    source_section_id: Option<String>,
) -> Option<String> {
    source_section_id.and_then(|section_id| {
        let trimmed = section_id.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(
                section_map
                    .entry(trimmed.to_string())
                    .or_insert_with(|| Uuid::new_v4().to_string())
                    .clone(),
            )
        }
    })
}

/// Shared copied-slide normalization. Add future copy rules here instead of in
/// each command path.
pub fn normalize_copied_slide_highlights(raw: &str) -> Result<String, String> {
    remap_highlight_ids(raw)
}
