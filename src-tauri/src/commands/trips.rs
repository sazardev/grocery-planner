use crate::domain::notification::{AppNotification, NotificationKind};
use crate::domain::trip::{ShoppingTrip, TripStatus};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Lista los mandados, ordenados por fecha de creación.
#[tauri::command]
pub fn trips_list(state: AppStateRef) -> Result<Vec<ShoppingTrip>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.trips.list())
}

/// Crea un mandado y lo asigna opcionalmente a un miembro (SPEC §5).
#[tauri::command]
pub fn trips_create(
    state: AppStateRef,
    title: String,
    store: Option<String>,
    assigned_to: Option<String>,
    by: String,
) -> Result<ShoppingTrip, AppError> {
    let trip = ShoppingTrip::new(&title, store.as_deref(), assigned_to.as_deref(), &by)?;
    let mut store = store::lock(&state.store)?;
    Ok(store.trips.create(trip))
}

/// Obtiene un mandado por id.
#[tauri::command]
pub fn trips_get(state: AppStateRef, id: String) -> Result<ShoppingTrip, AppError> {
    let store = store::lock(&state.store)?;
    store.trips.get(&id)
}

/// Agrega un ítem existente al mandado.
#[tauri::command]
pub fn trips_add_item(
    state: AppStateRef,
    id: String,
    item_id: String,
) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.get(&item_id)?;
    store.trips.add_item(&id, &item_id)
}

/// Quita un ítem del mandado.
#[tauri::command]
pub fn trips_remove_item(
    state: AppStateRef,
    id: String,
    item_id: String,
) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.trips.remove_item(&id, &item_id)
}

/// Asigna (o retoma) el mandado a un miembro.
#[tauri::command]
pub fn trips_assign(
    state: AppStateRef,
    id: String,
    member: String,
) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.trips.assign(&id, &member)
}

/// Marca el mandado como activo (el mandado está en curso).
#[tauri::command]
pub fn trips_activate(state: AppStateRef, id: String) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.trips.set_status(&id, TripStatus::Activa)
}

/// Marca el mandado como completado.
#[tauri::command]
pub fn trips_complete(state: AppStateRef, id: String) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.trips.set_status(&id, TripStatus::Completada)
}

/// Cancela el mandado.
#[tauri::command]
pub fn trips_cancel(state: AppStateRef, id: String) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    store.trips.set_status(&id, TripStatus::Cancelada)
}

/// Confirma la recepción del mandado en casa (SPEC §6): el que compró recibe
/// el reconocimiento y la familia sabe que ya llegó.
#[tauri::command]
pub fn trips_confirm_received(
    state: AppStateRef,
    id: String,
    by: String,
) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    let trip = store.trips.get(&id)?;
    let buyer = trip.assigned_to.clone().unwrap_or_else(|| trip.created_by.clone());
    let title = trip.title.clone();
    let received = store.trips.confirm_received(&id, &by)?;
    if buyer != by {
        store.rules.push_notification(AppNotification::new(
            NotificationKind::Arrival,
            &buyer,
            &format!("{by} recibió el mandado"),
            &format!("El mandado \"{title}\" ya llegó a casa. ¡Gracias!"),
            Some(&format!("/trips/{id}")),
        ));
    }
    Ok(received)
}
