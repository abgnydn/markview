// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

mod file_handler;

/// Holds a file path that arrived before the webview was ready.
/// The frontend pulls this via `get_pending_file` once it has initialized.
pub struct PendingFile(pub Mutex<Option<String>>);

/// Called by the frontend after the Tauri bridge listener is registered.
/// Returns the pending file path (if any) and clears it from state.
#[tauri::command]
fn get_pending_file(state: tauri::State<PendingFile>) -> Option<file_handler::FileOpenedPayload> {
    let mut pending = state.0.lock().unwrap();
    if let Some(path) = pending.take() {
        file_handler::read_file(&path)
    } else {
        None
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PendingFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_pending_file])
        .setup(|app| {
            // Handle files passed via command-line args at launch
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let path = args[1].clone();
                // Store as pending — frontend will pull it once ready
                app.state::<PendingFile>().0.lock().unwrap().replace(path);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    let path = url.to_file_path().unwrap_or_default();
                    let path_str = path.to_string_lossy().to_string();
                    if path_str.is_empty() {
                        continue;
                    }

                    // Try to deliver immediately if the window is ready,
                    // otherwise store as pending for the frontend to pull.
                    if let Some(window) = app_handle.get_webview_window("main") {
                        // Emit and also store — bridge will deduplicate via the pull
                        file_handler::open_file_in_window(&window, &path_str);
                    } else {
                        app_handle
                            .state::<PendingFile>()
                            .0
                            .lock()
                            .unwrap()
                            .replace(path_str);
                    }
                }
            }
        });
}
