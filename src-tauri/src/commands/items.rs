use serde::{Deserialize, Serialize};

use crate::domain::item::{
    self, GroceryItem, ItemComment, ItemEvent, ItemFallback, ItemStatus, Priority,
};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;
use crate::store::item::ItemQuery;
use crate::store::item::ItemSort;
use crate::store::item::MoveDirection;

/// Entrada de una alternativa de la cadena "si no hay X, trae Y".
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FallbackInput {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    pub note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusFlow {
    pub status: ItemStatus,
    pub label: String,
    pub next: Vec<ItemStatus>,
}

/// Mapa completo de la máquina de estados de un ítem (SPEC §3.3).
#[tauri::command]
pub fn item_flows() -> Result<Vec<StatusFlow>, AppError> {
    let statuses = [
        ItemStatus::Falta,
        ItemStatus::Pedido,
        ItemStatus::Llevo,
        ItemStatus::Comprado,
        ItemStatus::Cancelado,
    ];
    Ok(statuses
        .iter()
        .copied()
        .map(|s| StatusFlow {
            status: s,
            label: s.label().to_string(),
            next: s.next().to_vec(),
        })
        .collect())
}

/// Valida y aplica una transición de estado; devuelve Conflict si no es válida.
#[tauri::command]
pub fn item_transition(from: ItemStatus, to: ItemStatus) -> Result<ItemStatus, AppError> {
    from.transition(to)
}

/// Agregado rápido por texto libre, ej. "pollo 2kg" (SPEC §3.2).
#[tauri::command]
pub fn parse_quick_entry(text: String) -> Result<item::QuickEntry, AppError> {
    item::parse_quick_entry(&text)
}

/// Validación de un ítem nuevo antes de persistirlo (fase 2).
#[tauri::command]
pub fn validate_new_item(name: String, quantity: f64, unit: String) -> Result<(), AppError> {
    item::validate_new_item(&name, quantity, &unit)?;
    Ok(())
}

/// Lista todos los ítems, ordenados por fecha de creación.
#[tauri::command]
pub fn items_list(state: AppStateRef) -> Result<Vec<GroceryItem>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.items.list())
}

/// Crea un ítem nuevo (estado inicial: Falta).
#[tauri::command]
pub fn item_create(
    state: AppStateRef,
    name: String,
    quantity: f64,
    unit: String,
    priority: Priority,
    requested_by: String,
    note: Option<String>,
    category: Option<String>,
    price: Option<f64>,
    section: Option<String>,
    brand: Option<String>,
    quantity_max: Option<f64>,
    fallbacks: Option<Vec<FallbackInput>>,
) -> Result<GroceryItem, AppError> {
    let mut item = GroceryItem::new(
        &name,
        quantity,
        &unit,
        priority,
        &requested_by,
        note.as_deref(),
        category.as_deref(),
    )?;
    if let Some(price) = price {
        item.set_price(price)?;
    }
    if let Some(section) = section {
        item.set_section(&section)?;
    }
    if let Some(brand) = brand {
        item.set_brand(&brand, &requested_by)?;
    }
    if let Some(max) = quantity_max {
        item.set_quantity_max(Some(max), &requested_by)?;
    }
    if let Some(fallbacks) = fallbacks {
        for fb in fallbacks {
            item.add_fallback(&fb.name, fb.quantity, &fb.unit, fb.note.as_deref(), &requested_by)?;
        }
    }
    let mut store = store::lock(&state.store)?;
    Ok(store.items.create(item))
}

/// Obtiene un ítem por id.
#[tauri::command]
pub fn item_get(state: AppStateRef, id: String) -> Result<GroceryItem, AppError> {
    let store = store::lock(&state.store)?;
    store.items.get(&id)
}

/// Edita campos de un ítem (SPEC §3.1). Campos con `None` no se tocan.
#[tauri::command]
pub fn item_update(
    state: AppStateRef,
    id: String,
    by: String,
    name: Option<String>,
    quantity: Option<f64>,
    unit: Option<String>,
    priority: Option<Priority>,
    note: Option<String>,
    category: Option<String>,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.update(
        &id,
        &by,
        name.as_deref(),
        quantity,
        unit.as_deref(),
        priority,
        note.as_deref(),
        category.as_deref(),
    )
}

/// Cambia la prioridad de un ítem (SPEC §3.3).
#[tauri::command]
pub fn item_set_priority(
    state: AppStateRef,
    id: String,
    priority: Priority,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.set_priority(&id, priority, &by)
}

/// Mueve un ítem arriba o abajo en la lista (orden manual, SPEC §3.4).
#[tauri::command]
pub fn item_move(
    state: AppStateRef,
    id: String,
    direction: MoveDirection,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.move_item(&id, direction)
}

/// Elimina un ítem de la lista (SPEC §3.1: "quitar").
#[tauri::command]
pub fn item_delete(state: AppStateRef, id: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.delete(&id)
}

/// Cambia el estado de un ítem validando la transición (SPEC §3.3).
#[tauri::command]
pub fn item_change_status(
    state: AppStateRef,
    id: String,
    to: ItemStatus,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.change_status(&id, to, &by)
}

/// Asigna un ítem a un miembro (SPEC §5).
#[tauri::command]
pub fn item_assign(
    state: AppStateRef,
    id: String,
    member: String,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.assign(&id, &member, &by)
}

/// Cancela un ítem (transición a Cancelado) con motivo opcional.
#[tauri::command]
pub fn item_cancel(
    state: AppStateRef,
    id: String,
    by: String,
    reason: Option<String>,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.cancel(&id, &by, reason.as_deref())
}

/// Historial completo del ítem (SPEC §6.1).
#[tauri::command]
pub fn item_history(state: AppStateRef, id: String) -> Result<Vec<ItemEvent>, AppError> {
    let store = store::lock(&state.store)?;
    store.items.history(&id)
}

/// Agrega un comentario de la familia al ítem (SPEC §4.6 y §11.3).
#[tauri::command]
pub fn item_add_comment(
    state: AppStateRef,
    id: String,
    by: String,
    body: String,
) -> Result<ItemComment, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.add_comment(&id, &by, &body)
}

/// Fija el precio aproximado del ítem para reportes de gasto (SPEC §8.2).
#[tauri::command]
pub fn item_set_price(state: AppStateRef, id: String, price: f64) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.set_price(&id, price)
}

/// Mueve un ítem a una sección de la lista (SPEC §4.4).
#[tauri::command]
pub fn item_set_section(
    state: AppStateRef,
    id: String,
    section: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.sections.get(&section)?;
    store.items.set_section(&id, &section)
}

/// Búsqueda y filtros combinables de la lista (SPEC §4.5).
#[tauri::command]
pub fn items_query(state: AppStateRef, filters: ItemFilters) -> Result<Vec<GroceryItem>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.items.query(&filters.into_query()))
}

/// Filtros de búsqueda de la lista (SPEC §4.5). Campos opcionales.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemFilters {
    pub search: Option<String>,
    pub status: Option<ItemStatus>,
    pub category: Option<String>,
    pub priority: Option<Priority>,
    pub section: Option<String>,
    pub requested_by: Option<String>,
    pub assigned_to: Option<String>,
    pub store: Option<String>,
    #[serde(default)]
    pub urgent: bool,
    #[serde(default)]
    pub only_comments: bool,
    #[serde(default)]
    pub only_photos: bool,
    #[serde(default)]
    pub sort: Option<ItemSort>,
}

impl ItemFilters {
    pub fn into_query(self) -> ItemQuery {
        ItemQuery {
            search: self.search,
            status: self.status,
            category: self.category,
            priority: self.priority,
            section: self.section,
            requested_by: self.requested_by,
            assigned_to: self.assigned_to,
            store: self.store,
            urgent: self.urgent,
            only_comments: self.only_comments,
            only_photos: self.only_photos,
            sort: self.sort,
        }
    }
}

/// Agrega una foto al ítem como data URL (SPEC §10). Respeta el límite de la
/// familia configurado en las reglas (SPEC §14).
#[tauri::command]
pub fn item_add_photo(state: AppStateRef, id: String, photo: String) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    let limit = store.rules.rules.photo_limit;
    store.items.add_photo(&id, &photo, limit)
}

/// Quita una foto del ítem por índice (SPEC §10).
#[tauri::command]
pub fn item_remove_photo(state: AppStateRef, id: String, index: usize) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.remove_photo(&id, index)
}

/// Fija la tienda donde se consigue el ítem (SPEC §4.1 y §5.4).
#[tauri::command]
pub fn item_set_store(
    state: AppStateRef,
    id: String,
    store_name: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.set_store(&id, &store_name)
}

/// Fija la marca preferida del ítem ("la marca que nos gusta").
#[tauri::command]
pub fn item_set_brand(
    state: AppStateRef,
    id: String,
    brand: String,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.set_brand(&id, &brand, &by)
}

/// Fija la cantidad máxima aceptada (opcional). `None` la quita.
#[tauri::command]
pub fn item_set_quantity_max(
    state: AppStateRef,
    id: String,
    max: Option<f64>,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.set_quantity_max(&id, max, &by)
}

/// Agrega una alternativa a la cadena de respaldo del ítem.
#[tauri::command]
pub fn item_add_fallback(
    state: AppStateRef,
    id: String,
    name: String,
    quantity: f64,
    unit: String,
    note: Option<String>,
    by: String,
) -> Result<ItemFallback, AppError> {
    let mut store = store::lock(&state.store)?;
    store
        .items
        .add_fallback(&id, &name, quantity, &unit, note.as_deref(), &by)
}

/// Quita una alternativa de la cadena de respaldo por posición.
#[tauri::command]
pub fn item_remove_fallback(
    state: AppStateRef,
    id: String,
    index: usize,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.remove_fallback(&id, index, &by)
}

/// Aplica una alternativa: el ítem pasa a pedir el producto de reemplazo y la
/// alternativa usada se quita de la cadena (el resto queda como plan B).
#[tauri::command]
pub fn item_use_fallback(
    state: AppStateRef,
    id: String,
    index: usize,
    by: String,
) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.use_fallback(&id, index, &by)
}

/// Trae de vuelta un ítem cancelado por error (SPEC §8.2: recuperación).
/// Solo aplica a ítems cancelados; los vuelve a "Falta" con su historial intacto.
#[tauri::command]
pub fn item_recover(state: AppStateRef, id: String, by: String) -> Result<GroceryItem, AppError> {
    let mut store = store::lock(&state.store)?;
    let item = store.items.get(&id)?;
    if item.status != ItemStatus::Cancelado {
        return Err(AppError::conflict(
            "Solo se recupera un ítem que fue cancelado",
        ));
    }
    store.items.change_status(&id, ItemStatus::Falta, &by)
}

/// Ítems que se compraron entre dos marcas ISO (SPEC §8.2: "comprar lo mismo
/// de la semana pasada"). Devuelve cada ítem con su compra dentro del rango.
#[tauri::command]
pub fn items_purchased_between(
    state: AppStateRef,
    start: String,
    end: String,
) -> Result<Vec<GroceryItem>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store
        .items
        .list()
        .into_iter()
        .filter(|item| {
            item.history.iter().any(|ev| {
                matches!(
                    &ev.kind,
                    crate::domain::item::ItemEventKind::StatusChanged {
                        to: ItemStatus::Comprado,
                        ..
                    }
                ) && ev.at >= start && ev.at <= end
            })
        })
        .collect())
}
