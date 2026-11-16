use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn workspace_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("workspace.json"))
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<String>, String> {
    let path = workspace_path(&app)?;
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_workspace(app: AppHandle, contents: String) -> Result<(), String> {
    let path = workspace_path(&app)?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_workspace, save_workspace])
        .run(tauri::generate_context!())
        .expect("error while running Auton");
}
