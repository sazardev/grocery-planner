use serde::Deserialize;

use crate::commands::require_role;
use crate::domain::home::Role;
use crate::domain::item::{GroceryItem, ItemStatus, Priority};
use crate::domain::notification::AppNotification;
use crate::domain::rules::{HomeRules, NotificationSettings};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Reglas actuales de la familia (SPEC §14).
#[tauri::command]
pub fn rules_get(state: AppStateRef) -> Result<HomeRules, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.rules.rules())
}

/// Campos editables de las reglas (SPEC §14). `None` = no tocar.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRulesBody {
    pub name: Option<String>,
    pub units: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
    pub photo_limit: Option<usize>,
    pub host_mode: Option<bool>,
    pub host_pause_with_visitors: Option<bool>,
    pub privacy_show_photos: Option<bool>,
    pub privacy_show_prices: Option<bool>,
    pub language: Option<String>,
    pub timezone: Option<String>,
}

/// Actualiza campos de las reglas de la familia (SPEC §14). Solo Organizador/Admin.
#[tauri::command]
pub fn rules_update(state: AppStateRef, by: String, body: UpdateRulesBody) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    if let Some(name) = body.name {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre del hogar es obligatorio",
            ));
        }
        store.rules.rules.name = name.to_string();
    }
    if let Some(units) = body.units {
        store.rules.rules.units = units;
    }
    if let Some(categories) = body.categories {
        store.rules.rules.categories = categories;
    }
    if let Some(photo_limit) = body.photo_limit {
        if photo_limit == 0 || photo_limit > 20 {
            return Err(AppError::invalid_input(
                "El límite de fotos debe estar entre 1 y 20",
            ));
        }
        store.rules.rules.photo_limit = photo_limit;
    }
    if let Some(host_mode) = body.host_mode {
        store.rules.rules.host_mode = host_mode;
    }
    if let Some(pause) = body.host_pause_with_visitors {
        store.rules.rules.host_pause_with_visitors = pause;
    }
    if let Some(photos) = body.privacy_show_photos {
        store.rules.rules.privacy_show_photos = photos;
    }
    if let Some(prices) = body.privacy_show_prices {
        store.rules.rules.privacy_show_prices = prices;
    }
    if let Some(language) = body.language {
        store.rules.rules.language = language;
    }
    if let Some(timezone) = body.timezone {
        store.rules.rules.timezone = timezone;
    }
    Ok(store.rules.rules())
}

/// Agrega una tienda favorita con sus pasillos (SPEC §14).
#[tauri::command]
pub fn rules_store_add(
    state: AppStateRef,
    name: String,
    aisles: Vec<String>,
    by: String,
) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::invalid_input("El nombre de la tienda es obligatorio"));
    }
    if store.rules.rules.stores.iter().any(|s| s.name == name) {
        return Err(AppError::conflict(format!("La tienda {name} ya existe")));
    }
    let aisles: Vec<String> = aisles
        .into_iter()
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .collect();
    store
        .rules
        .rules
        .stores
        .push(crate::domain::rules::StoreConfig { name: name.to_string(), aisles });
    Ok(store.rules.rules())
}

/// Renombra una tienda favorita (SPEC §14).
#[tauri::command]
pub fn rules_store_rename(
    state: AppStateRef,
    name: String,
    new_name: String,
    by: String,
) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {name} no encontrada")))?;
    let new_name = new_name.trim();
    if new_name.is_empty() {
        return Err(AppError::invalid_input("El nombre de la tienda es obligatorio"));
    }
    store_config.name = new_name.to_string();
    Ok(store.rules.rules())
}

/// Quita una tienda favorita (SPEC §14).
#[tauri::command]
pub fn rules_store_remove(state: AppStateRef, name: String, by: String) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    store.rules.rules.stores.retain(|s| s.name != name);
    Ok(store.rules.rules())
}

/// Agrega un pasillo a una tienda (SPEC §14).
#[tauri::command]
pub fn rules_aisle_add(
    state: AppStateRef,
    store_name: String,
    aisle: String,
    by: String,
) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == store_name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {store_name} no encontrada")))?;
    let aisle = aisle.trim();
    if aisle.is_empty() {
        return Err(AppError::invalid_input("El nombre del pasillo es obligatorio"));
    }
    if store_config.aisles.iter().any(|a| a == aisle) {
        return Err(AppError::conflict(format!(
            "El pasillo {aisle} ya existe en {store_name}"
        )));
    }
    store_config.aisles.push(aisle.to_string());
    Ok(store.rules.rules())
}

/// Quita un pasillo de una tienda (SPEC §14).
#[tauri::command]
pub fn rules_aisle_remove(
    state: AppStateRef,
    store_name: String,
    aisle: String,
    by: String,
) -> Result<HomeRules, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == store_name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {store_name} no encontrada")))?;
    store_config.aisles.retain(|a| a != &aisle);
    Ok(store.rules.rules())
}

// ----- Notificaciones (SPEC §13) ------------------------------------------

/// Avisos del miembro, del más reciente al más antiguo (SPEC §13).
#[tauri::command]
pub fn notifications_list(state: AppStateRef, member: String) -> Result<Vec<AppNotification>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.rules.notifications_for(&member))
}

/// Cuántos avisos sin leer tiene el miembro (para el badge de la nav).
#[tauri::command]
pub fn notifications_unread_count(state: AppStateRef, member: String) -> Result<usize, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.rules.unread_count(&member))
}

/// Marca un aviso como leído.
#[tauri::command]
pub fn notifications_mark_read(state: AppStateRef, id: String, member: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_read(&id, &member);
    Ok(())
}

/// Marca todos los avisos del miembro como leídos.
#[tauri::command]
pub fn notifications_mark_all_read(state: AppStateRef, member: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_all_read(&member);
    Ok(())
}

/// Menciones de chat sin leer (para el badge "te mencionaron" de la nav).
#[tauri::command]
pub fn notifications_mentions_unread_count(state: AppStateRef, member: String) -> Result<usize, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.rules.mentions_unread_count(&member))
}

/// Marca las menciones del chat como leídas (al entrar al chat).
#[tauri::command]
pub fn notifications_mentions_mark_read(state: AppStateRef, member: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_mentions_read(&member);
    Ok(())
}

/// Preferencias de avisos de un miembro (SPEC §13).
#[tauri::command]
pub fn notifications_settings_get(
    state: AppStateRef,
    member: String,
) -> Result<NotificationSettings, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.rules.settings_for(&member))
}

/// Guarda las preferencias de avisos de un miembro (SPEC §13).
#[tauri::command]
pub fn notifications_settings_update(
    state: AppStateRef,
    member: String,
    settings: NotificationSettings,
) -> Result<NotificationSettings, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.set_settings(&member, settings);
    Ok(store.rules.settings_for(&member))
}

// ----- Modo host: llave del quiosco (SPEC §2.3/§14) -------------------------

/// Genera (o regenera) la llave del modo host. Solo Admin. El quiosco la usa
/// para entrar sin credenciales en la red de la casa.
#[tauri::command]
pub fn rules_host_key_generate(state: AppStateRef, by: String) -> Result<String, AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Admin)?;
    let key = uuid::Uuid::new_v4().simple().to_string();
    store.rules.rules.host_key = Some(key.clone());
    Ok(key)
}

/// Desactiva el modo host (quita la llave).
#[tauri::command]
pub fn rules_host_key_clear(state: AppStateRef, by: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    require_role(&store, &by, Role::Admin)?;
    store.rules.rules.host_key = None;
    Ok(())
}

// ----- Proyección: confirmar o descartar (SPEC §7.2) ------------------------
/// Registra la decisión de la familia sobre una sugerencia de proyección
/// ("en 2 días faltará leche" → confirmado o descartado). Si se confirma,
/// el ítem entra de verdad a la lista (SPEC §7.2: "lo confirmado entra a la
/// lista del próximo plan"), evitando duplicar uno que ya esté activo.
#[tauri::command]
pub fn projection_decide(
    state: AppStateRef,
    name: String,
    confirmed: bool,
    by: String,
) -> Result<bool, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.decide_projection(&name, confirmed);
    if confirmed {
        let active = store.items.active();
        let already = active.iter().any(|i| {
            i.name == name && i.status != ItemStatus::Comprado && i.status != ItemStatus::Cancelado
        });
        if !already {
            if let Some(p) = crate::commands::reports::compute_projection(&store)
                .into_iter()
                .find(|p| p.name == name)
            {
                let item = GroceryItem::new(
                    &name,
                    p.quantity,
                    &p.unit,
                    Priority::Media,
                    &by,
                    None,
                    None,
                )?;
                store.items.create(item);
            }
        }
    }
    Ok(confirmed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::home::Home;
    use crate::domain::item::{GroceryItem, ItemStatus, Priority};
    use crate::store::AppStore;

    fn buy_twice(store: &mut AppStore, name: &str) {
        let item = GroceryItem::new(name, 1.0, "l", Priority::Media, "Papá", None, None).unwrap();
        let id = item.id.clone();
        store.items.create(item);
        // 1ª compra
        store.items.change_status(&id, ItemStatus::Comprado, "Papá").unwrap();
        // volver a falta (comprado → cancelado → falta)
        store.items.change_status(&id, ItemStatus::Cancelado, "Papá").unwrap();
        store.items.change_status(&id, ItemStatus::Falta, "Papá").unwrap();
        // 2ª compra
        store.items.change_status(&id, ItemStatus::Comprado, "Papá").unwrap();
    }

    #[test]
    fn confirmar_proyeccion_crea_el_item_en_la_lista() {
        let mut store = AppStore::new();
        store.home.create(Home::create("Los Ramírez", "Papá").unwrap());
        buy_twice(&mut store, "leche");
        // Sin duplicar: el ítem original está comprado; la proyección propone "leche".
        let before = store.items.active().len();
        decide_impl(&mut store, "leche", true, "Papá").unwrap();
        let after = store.items.active();
        assert_eq!(after.len(), before + 1, "debe crear el ítem confirmado");
        let created = after.iter().find(|i| i.status == ItemStatus::Falta && i.name == "leche");
        assert!(created.is_some(), "el nuevo ítem debe estar en 'falta'");
        // Confirmar de nuevo no duplica (ya hay uno activo).
        let before2 = store.items.active().len();
        decide_impl(&mut store, "leche", true, "Papá").unwrap();
        assert_eq!(store.items.active().len(), before2);
    }

    /// Misma lógica que el command `projection_decide` (sin Tauri).
    fn decide_impl(store: &mut AppStore, name: &str, confirmed: bool, by: &str) -> Result<bool, AppError> {
        store.rules.decide_projection(name, confirmed);
        if confirmed {
            let already = store.items.active().iter().any(|i| {
                i.name == name && i.status != ItemStatus::Comprado && i.status != ItemStatus::Cancelado
            });
            if !already {
                if let Some(p) = crate::commands::reports::compute_projection(store)
                    .into_iter()
                    .find(|p| p.name == name)
                {
                    let item = GroceryItem::new(name, p.quantity, &p.unit, Priority::Media, by, None, None)?;
                    store.items.create(item);
                }
            }
        }
        Ok(confirmed)
    }
}
