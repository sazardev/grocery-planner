use crate::domain::notification::NotificationKind;
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

/// Asigna (o retoma) el mandado a un miembro. Avisa al asignado (SPEC §13).
#[tauri::command]
pub fn trips_assign(
    state: AppStateRef,
    id: String,
    member: String,
) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    let title = store.trips.get(&id)?.title.clone();
    let assigned = store.trips.assign(&id, &member)?;
    crate::commands::notify::push_managed(
        &mut store.rules,
        &member,
        NotificationKind::Assigned,
        "Te asignaron un mandado",
        &format!("El mandado \"{title}\" es tuyo."),
        Some(&format!("/trips/{id}")),
    );
    Ok(assigned)
}

/// Marca el mandado como activo (el mandado está en curso). Avisa a la familia
/// (SPEC §13: "alguien conectado empieza el mandado") y declara a quien lo
/// empieza como "en el mandado" en la presencia (SPEC §12).
#[tauri::command]
pub fn trips_activate(state: AppStateRef, id: String, by: String) -> Result<ShoppingTrip, AppError> {
    let mut store = store::lock(&state.store)?;
    let title = store.trips.get(&id)?.title.clone();
    let who = store.trips.get(&id)?.assigned_to.clone().unwrap_or_default();
    let activated = store.trips.set_status(&id, TripStatus::Activa)?;
    store.presence.heartbeat(&by, Some("mandado"))?;
    let home = store.home.get().ok();
    let members: Vec<String> = home
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    for m in members {
        if m != who {
            let detail = if who.is_empty() {
                String::new()
            } else {
                format!(" (lo lleva {who})")
            };
            crate::commands::notify::push_managed(
                &mut store.rules,
                &m,
                NotificationKind::TripStarted,
                "Empezó el mandado",
                &format!("El mandado \"{title}\" está en curso{detail}."),
                Some(&format!("/trips/{id}")),
            );
        }
    }
    Ok(activated)
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
        crate::commands::notify::push_managed(
            &mut store.rules,
            &buyer,
            NotificationKind::Arrival,
            &format!("{by} recibió el mandado"),
            &format!("El mandado \"{title}\" ya llegó a casa. ¡Gracias!"),
            Some(&format!("/trips/{id}")),
        );
    }
    Ok(received)
}
