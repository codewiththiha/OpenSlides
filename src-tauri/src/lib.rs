mod commands;
mod db;
mod error;
mod lifecycle;
mod models;

use commands::*;
use db::init_db;
use lifecycle::{request_flush_before_quit, QUIT_FLUSHED};
use std::sync::atomic::Ordering;
use tauri::Manager;

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
            stack_projects,
            unstack_projects,
            stack_slides,
            unstack_slides,
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
