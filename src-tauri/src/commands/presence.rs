use crate::domain::presence::PresenceView;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Quién está conectado ahora (SPEC §2.2 y §8).
#[tauri::command]
pub fn presence_list(state: AppStateRef) -> Result<Vec<PresenceView>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.presence.list())
}

/// Heartbeat de un miembro conectado. La presencia no se emite por evento:
/// el heartbeat es una consulta que ya re-fetchea sola (y emitir habría creado
/// un bucle heartbeat→invalidate→heartbeat). En desktop tampoco: las mutaciones
/// IPC invalidan por su cuenta.
#[tauri::command]
pub fn presence_heartbeat(
    state: AppStateRef,
    name: String,
    screen: Option<String>,
) -> Result<Vec<PresenceView>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.presence.heartbeat(&name, screen.as_deref())?;
    Ok(store.presence.list())
}

/// Un miembro se desconecta explícitamente (cierre de sesión / quiosco pausado).
#[tauri::command]
pub fn presence_leave(state: AppStateRef, name: String) -> Result<Vec<PresenceView>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.presence.leave(&name);
    Ok(store.presence.list())
}
