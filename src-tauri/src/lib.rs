mod commands;
mod db;
mod models;

use commands::*;
use db::init_db;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            rename_project,
            delete_project,
            update_project_settings,
            update_project_theme,
            create_slide,
            delete_slide,
            restore_slide,
            update_slide_code,
            update_slide_settings,
            reorder_slides,
            set_current_slide,
            export_project_to_json,
            import_project_from_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
