//! Merustmar syntax-highlight command — Rust port of the frozen JS fallback
//! (see `src/lib/merustmar-highlight.ts` and `src-tauri/src/merustmar.rs`).

/// Render Merustmar code to the same `<span class="line">…</span>` HTML the
/// frozen JS fallback produces (byte-exact, parity-tested).
///
/// Async so it runs on Tauri's async runtime instead of the WebView main
/// thread; the work is pure CPU over slide-sized inputs, no shared state.
#[tauri::command]
pub async fn highlight_merustmar_code(code: String, is_dark: bool) -> String {
    crate::merustmar::highlight_merustmar_code(&code, is_dark)
}
