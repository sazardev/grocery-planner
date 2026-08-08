use crate::domain::event::{Event, EventType};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Lista los eventos del calendario familiar (SPEC §9.3).
#[tauri::command]
pub fn events_list(state: AppStateRef) -> Result<Vec<Event>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.events.list())
}

/// Eventos dentro de un rango de fechas (inclusive, formato AAAA-MM-DD).
#[tauri::command]
pub fn events_list_range(
    state: AppStateRef,
    start: String,
    end: String,
) -> Result<Vec<Event>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.events.list_in_range(&start, &end))
}

/// Crea un evento familiar (SPEC §9.2).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn event_create(
    state: AppStateRef,
    title: String,
    date: String,
    time: Option<String>,
    all_day: bool,
    kind: EventType,
    place: Option<String>,
    participants: Vec<String>,
    note: Option<String>,
    recurring_yearly: bool,
    created_by: String,
) -> Result<Event, AppError> {
    let event = Event::new(
        &title,
        &date,
        time.as_deref(),
        all_day,
        kind,
        place.as_deref(),
        participants,
        note.as_deref(),
        recurring_yearly,
        &created_by,
    )?;
    let mut store = store::lock(&state.store)?;
    Ok(store.events.create(event))
}

/// Obtiene un evento por id.
#[tauri::command]
pub fn event_get(state: AppStateRef, id: String) -> Result<Event, AppError> {
    let store = store::lock(&state.store)?;
    store.events.get(&id)
}

/// Borra un evento del calendario.
#[tauri::command]
pub fn event_delete(state: AppStateRef, id: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.events.delete(&id)
}

/// Agrega un ítem a la lista del evento (SPEC §9.4).
#[tauri::command]
pub fn event_add_item(
    state: AppStateRef,
    id: String,
    item_id: String,
) -> Result<Event, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.get(&item_id)?;
    store.events.add_item(&id, &item_id)
}

/// Quita un ítem de la lista del evento.
#[tauri::command]
pub fn event_remove_item(
    state: AppStateRef,
    id: String,
    item_id: String,
) -> Result<Event, AppError> {
    let mut store = store::lock(&state.store)?;
    store.events.remove_item(&id, &item_id)
}
