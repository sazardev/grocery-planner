use crate::commands::require_role;
use crate::domain::event::{Event, EventType};
use crate::domain::home::Role;
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
    reminder_minutes: Option<i64>,
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
        reminder_minutes,
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

/// Edita un evento (SPEC §9.3: ver, editar, mover, borrar). Cambiar la fecha
/// equivale a moverlo. Cualquier miembro puede editar lo que creó; para lo ajeno
/// se exige Organizador/Admin.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn event_update(
    state: AppStateRef,
    id: String,
    by: String,
    title: Option<String>,
    date: Option<String>,
    time: Option<String>,
    all_day: Option<bool>,
    kind: Option<EventType>,
    place: Option<String>,
    participants: Option<Vec<String>>,
    note: Option<String>,
    recurring_yearly: Option<bool>,
    reminder_minutes: Option<Option<i64>>,
) -> Result<Event, AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    if event.created_by != by {
        require_role(&store, &by, Role::Organizador)?;
    }
    store.events.update(
        &id,
        title.as_deref(),
        date.as_deref(),
        time.as_deref(),
        all_day,
        kind,
        place.as_deref(),
        participants.as_deref(),
        note.as_deref(),
        recurring_yearly,
        reminder_minutes,
        &by,
    )
}

/// Borra un evento del calendario. El creador puede borrar el suyo; para los
/// ajenos se exige Organizador/Admin (SPEC §9.3: según el rol).
#[tauri::command]
pub fn event_delete(state: AppStateRef, id: String, by: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    if event.created_by != by {
        require_role(&store, &by, Role::Organizador)?;
    }
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

/// Fusiona la lista del evento a la lista del hogar (SPEC §9.4): los ítems ya
/// viven en la lista compartida, así que basta con desligarlos del evento.
#[tauri::command]
pub fn event_merge_to_home(state: AppStateRef, id: String) -> Result<Event, AppError> {
    let mut store = store::lock(&state.store)?;
    store.events.clear_items(&id)
}

/// Descarta la lista del evento (SPEC §9.4): borra los ítems que solo servían
/// para esa ocasión y desliga el resto del evento.
#[tauri::command]
pub fn event_discard_list(state: AppStateRef, id: String) -> Result<Event, AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    let ids = event.item_ids.clone();
    let by = event.created_by.clone();
    for item_id in &ids {
        store.items.delete(item_id, &by)?;
    }
    store.events.clear_items(&id)
}
