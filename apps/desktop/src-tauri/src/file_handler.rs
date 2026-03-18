use std::fs;
use tauri::{Emitter, WebviewWindow};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileOpenedPayload {
    pub path: String,
    pub content: String,
    pub filename: String,
}

/// Read a file from disk and return a payload, or None on error.
pub fn read_file(path: &str) -> Option<FileOpenedPayload> {
    match fs::read_to_string(path) {
        Ok(content) => {
            let filename = std::path::Path::new(path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Some(FileOpenedPayload {
                path: path.to_string(),
                content,
                filename,
            })
        }
        Err(err) => {
            eprintln!("Failed to read file {}: {}", path, err);
            None
        }
    }
}

/// Read a file and emit `file-opened` to the given window.
pub fn open_file_in_window(window: &WebviewWindow, path: &str) {
    if let Some(payload) = read_file(path) {
        window.emit("file-opened", payload).unwrap_or_default();
    }
}
