use tauri::{AppHandle, Emitter};

use crate::domain::presence::PresenceView;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

const PRESENCE_EVENT: &str = "presence://changed";

/// Quién está conectado ahora (SPEC §2.2 y §8).
#[tauri::command]
pub fn presence_list(state: AppStateRef) -> Result<Vec<PresenceView>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.presence.list())
}

/// Heartbeat de un miembro conectado; emite el evento de presencia a las ventanas.
#[tauri::command]
pub fn presence_heartbeat(
    app: AppHandle,
    state: AppStateRef,
    name: String,
) -> Result<Vec<PresenceView>, AppError> {
    let views = {
        let mut store = store::lock(&state.store)?;
        store.presence.heartbeat(&name)?;
        store.presence.list()
    };
    let _ = app.emit(PRESENCE_EVENT, &views);
    Ok(views)
}

/// Un miembro se desconecta explícitamente (cierre de sesión / quiosco pausado).
#[tauri::command]
pub fn presence_leave(
    app: AppHandle,
    state: AppStateRef,
    name: String,
) -> Result<Vec<PresenceView>, AppError> {
    let views = {
        let mut store = store::lock(&state.store)?;
        store.presence.leave(&name);
        store.presence.list()
    };
    let _ = app.emit(PRESENCE_EVENT, &views);
    Ok(views)
}
