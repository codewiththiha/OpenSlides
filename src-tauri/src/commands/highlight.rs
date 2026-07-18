//! Highlight-processing Tauri commands.
//!
//! Thin wrappers over `crate::highlight` (the pure, unit-tested logic).
//! They do no DB work — they exist so the heavy string parsing (Shiki HTML
//! slicing, range decomposition, entity decoding) runs natively instead of
//! inside the webview's JS.

use crate::highlight::{self, PlanPayload, RangeSpec};

/// Compute the full render plan for one highlight step:
/// clamped per-line char ranges + clone HTML per line + eraser color.
#[tauri::command]
pub async fn compute_highlight_plan(
    code: String,
    html: String,
    range: RangeSpec,
    theme_bg: String,
    dim_percent: i64,
) -> Result<PlanPayload, String> {
    Ok(highlight::build_plan(
        &code,
        &html,
        &range,
        &theme_bg,
        dim_percent,
    ))
}

/// Plain-text snippet per range (highlight settings panel rows).
#[tauri::command]
pub async fn highlight_snippets(
    code: String,
    ranges: Vec<RangeSpec>,
) -> Result<Vec<String>, String> {
    Ok(highlight::snippets(&code, &ranges))
}

/// Convert flat text offsets (textarea selectionStart/End) to a line/char
/// range — the single implementation of line/char semantics, shared by the
/// editor's "add highlight" flow and the overlay's plan computation.
#[tauri::command]
pub async fn selection_range(code: String, start: usize, end: usize) -> Result<RangeSpec, String> {
    Ok(highlight::selection_to_range(&code, start, end))
}
