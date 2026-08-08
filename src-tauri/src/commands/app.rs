use serde::Serialize;

use crate::error::AppError;
use crate::state::AppStateRef;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub db_ready: bool,
}

/// Comando de ejemplo para verificar IPC desktop/mobile/web.
#[tauri::command]
pub fn greet(name: &str) -> Result<String, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::InvalidInput("name is required".into()));
    }
    Ok(format!("Hola, {name}!"))
}

#[tauri::command]
pub fn app_info(state: AppStateRef) -> Result<AppInfo, AppError> {
    Ok(AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        db_ready: state.db_ready,
    })
}
