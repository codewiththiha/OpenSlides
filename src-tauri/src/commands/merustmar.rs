//! Merustmar syntax-highlight command — Rust port of the frozen JS fallback
//! (see `src/lib/merustmar-highlight.ts` and `src-tauri/src/merustmar.rs`).

use crate::merustmar::MerustmarToken;

/// Tokenize Merustmar code: one styled-token list per line. The frontend
/// slices these tokens directly for highlights (raw content, escape at
/// render time) and renders them for display, which eliminated the entire
/// Rust HTML-parsing pipeline that HTML output used to require.
///
/// Async so it runs on Tauri's async runtime instead of the WebView main
/// thread; the work is pure CPU over slide-sized inputs, no shared state.
#[tauri::command]
pub async fn merustmar_tokens(code: String, is_dark: bool) -> Vec<Vec<MerustmarToken>> {
    crate::merustmar::merustmar_tokens(&code, is_dark)
}
