//! Application quit handshake — ensures debounced slide-code saves are flushed
//! before the process terminates.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

/// Set by `finish_quit` once the frontend flushed the pending debounced
/// slide-code save — the *second* close/exit request is then let through
/// instead of being intercepted again.
pub(crate) static QUIT_FLUSHED: AtomicBool = AtomicBool::new(false);

/// Set when the quit handshake has been initiated so duplicate native close
/// events cannot emit duplicate flush requests or spawn duplicate watchdogs.
pub(crate) static FLUSH_REQUESTED: AtomicBool = AtomicBool::new(false);

/// Ask the webview to flush pending saves before terminating, and arm a
/// hard-exit fallback so a wedged frontend can never trap the OS-level
/// quit (the app force-exits a few seconds later regardless).
/// Works for both `Window` (CloseRequested) and `AppHandle` (ExitRequested).
pub fn request_flush_before_quit<R: tauri::Runtime, E: Emitter<R> + ?Sized>(emitter: &E) {
    if FLUSH_REQUESTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = emitter.emit("app://quit-request", ());
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(4));
        std::process::exit(0);
    });
}
