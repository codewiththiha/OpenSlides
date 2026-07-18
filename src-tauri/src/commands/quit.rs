//! Quit coordination: the window-close / app-quit handlers in `lib.rs`
//! intercept termination and ask the frontend to flush the pending
//! debounced slide-code save first (see `src/lib/save-flush.ts`). When the
//! flush completes, the frontend calls `finish_quit` to actually terminate.

use std::sync::atomic::Ordering;
use tauri::AppHandle;

/// Acknowledge the flush and exit. Sets the flag that lets the second
/// CloseRequested/ExitRequested pass through instead of being intercepted.
#[tauri::command]
pub async fn finish_quit(app: AppHandle) {
    crate::QUIT_FLUSHED.store(true, Ordering::SeqCst);
    app.exit(0);
}
