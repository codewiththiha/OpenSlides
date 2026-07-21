//! Native file dialogs for import/export.

use std::sync::mpsc;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

pub enum DialogMode {
    Save,
    Open,
}

/// Await a callback-based dialog on a worker-friendly channel.
pub fn dialog_pick_path(
    app: &AppHandle,
    mode: DialogMode,
    default_name: Option<&str>,
) -> Option<std::path::PathBuf> {
    let (tx, rx) = mpsc::channel();
    let mut builder = app.dialog().file().add_filter("JSON", &["json"]);
    if let Some(name) = default_name {
        builder = builder.set_file_name(name);
    }
    match mode {
        DialogMode::Save => {
            builder.save_file(move |path| {
                let _ = tx.send(path);
            });
        }
        DialogMode::Open => {
            builder.pick_file(move |path| {
                let _ = tx.send(path);
            });
        }
    }
    rx.recv()
        .ok()
        .flatten()
        .and_then(|fp| fp.into_path().ok())
}
