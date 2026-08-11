use crate::commands::require_role;
use crate::domain::home::Role;
use crate::domain::section::Section;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;
use crate::store::section::MoveDirection;

/// Lista las secciones de la lista en orden (SPEC §4.4).
#[tauri::command]
pub fn sections_list(state: AppStateRef) -> Result<Vec<Section>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.sections.list())
}

/// Crea una sección nombrada de la lista (SPEC §4.4). Solo Organizador/Admin.
#[tauri::command]
pub fn section_create(state: AppStateRef, name: String, by: String) -> Result<Section, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    store.sections.create(&name)
}

/// Renombra una sección. Solo Organizador/Admin.
#[tauri::command]
pub fn section_rename(
    state: AppStateRef,
    id: String,
    name: String,
    by: String,
) -> Result<Section, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    store.sections.rename(&id, &name)
}

/// Borra una sección (los ítems quedan sin sección). Solo Organizador/Admin.
#[tauri::command]
pub fn section_delete(state: AppStateRef, id: String, by: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    store.sections.delete(&id)
}

/// Mueve una sección arriba o abajo en la lista (orden manual, SPEC §4.4).
/// Solo Organizador/Admin.
#[tauri::command]
pub fn section_move(
    state: AppStateRef,
    id: String,
    direction: MoveDirection,
    by: String,
) -> Result<Section, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    store.sections.move_section(&id, direction)
}
