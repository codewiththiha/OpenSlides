mod commands;
mod db;
mod error;
mod models;

use commands::*;
use db::init_db;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

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
fn request_flush_before_quit<R: tauri::Runtime, E: Emitter<R> + ?Sized>(emitter: &E) {
    if FLUSH_REQUESTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = emitter.emit("app://quit-request", ());
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(4));
        std::process::exit(0);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = init_db(&handle)
                    .await
                    .expect("failed to initialize database");
                handle.manage(pool);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_projects,
            get_project,
            create_project,
            duplicate_project,
            rename_project,
            delete_project,
            update_project_settings,
            update_project_theme,
            create_slide,
            delete_slide,
            duplicate_slide,
            restore_slide,
            update_slide_code,
            cache_thumbnail,
            update_slide_settings,
            reorder_slides,
            set_current_slide,
            export_project_to_json,
            import_project_from_json,
            search_slides,
            finish_quit,
        ])
        .on_window_event(|window, event| {
            // Window X / native close: flush the debounced auto-save first —
            // without this, the last <500ms of keystrokes could vanish.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !QUIT_FLUSHED.load(Ordering::SeqCst) {
                    api.prevent_close();
                    request_flush_before_quit(window);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // Cmd+Q / OS-level quit goes through the same flush handshake.
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            if !QUIT_FLUSHED.load(Ordering::SeqCst) {
                api.prevent_exit();
                request_flush_before_quit(app_handle);
            }
        }
    });
}
