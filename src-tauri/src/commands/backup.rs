use serde::{Deserialize, Serialize};

use crate::commands::require_role;
use crate::domain::auth::User;
use crate::domain::chat::ChatMessage;
use crate::domain::event::Event;
use crate::domain::home::{Home, Role};
use crate::domain::item::GroceryItem;
use crate::domain::notification::AppNotification;
use crate::domain::now_iso;
use crate::domain::plan::Plan;
use crate::domain::rules::HomeRules;
use crate::domain::section::Section;
use crate::domain::trip::ShoppingTrip;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store::AppStore;
use crate::store;

/// Respaldo completo del hogar para llevarlo a otra máquina (SPEC §15):
/// lista, historial, mandados, eventos, planes, secciones, chat, reglas y
/// cuentas (para no re-registrar a la familia).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupData {
    pub exported_at: String,
    pub home: Option<Home>,
    /// Cuentas de la familia (hashes de contraseña/PIN incluidos).
    #[serde(default)]
    pub users: Vec<User>,
    pub items: Vec<GroceryItem>,
    pub trips: Vec<ShoppingTrip>,
    pub events: Vec<Event>,
    pub plans: Vec<Plan>,
    pub sections: Vec<Section>,
    pub chat: Vec<ChatMessage>,
    pub rules: HomeRules,
    pub notifications: Vec<AppNotification>,
    pub projection_choices: std::collections::HashMap<String, bool>,
}

/// Núcleo del export (sin Tauri): solo el Admin del hogar (SPEC §15) y se
/// respeta la privacidad (§14) en los ítems.
pub fn backup_export_core(store: &AppStore, by: &str) -> Result<BackupData, AppError> {
    require_role(store, by, Role::Admin)?;
    Ok(BackupData {
        exported_at: now_iso(),
        home: store.home.get().ok().cloned(),
        users: store.auth.users_list(),
        items: store
            .items
            .list()
            .into_iter()
            .map(|it| {
                // Fase 2: el backup embebe las fotos (de archivo → data URL)
                // para seguir siendo autocontenido, y luego aplica la privacidad.
                let mut it = it;
                if !it.photos.is_empty() {
                    it.photos = crate::commands::photo::embed_photos(&it.photos);
                }
                store.rules.rules().redact_item(it)
            })
            .collect(),
        trips: store.trips.list(),
        events: store.events.list(),
        plans: store.plans.list(),
        sections: store.sections.list(),
        chat: store.chat.list(),
        rules: store.rules.rules(),
        notifications: store.rules.notifications.clone(),
        projection_choices: store.rules.projection_choices.clone(),
    })
}

/// Núcleo del import (sin Tauri): reemplaza los datos del hogar (SPEC §15),
/// acción exclusiva del Admin.
pub fn backup_import_core(
    store: &mut AppStore,
    by: &str,
    data: BackupData,
) -> Result<(), AppError> {
    require_role(store, by, Role::Admin)?;
    let mut items = data.items;
    // Fase 2: extrae las fotos embebidas del respaldo a archivos en disco.
    for item in &mut items {
        if item.photos.iter().any(|p| p.starts_with("data:")) {
            item.photos = crate::commands::photo::extract_photos(&item.photos);
        }
    }
    store.items.replace_all(items);
    store.trips.replace_all(data.trips);
    store.events.replace_all(data.events);
    store.plans.replace_all(data.plans);
    store.sections.replace_all(data.sections);
    store.chat.replace_all(data.chat);
    store.rules.set_rules(data.rules);
    store.rules.notifications = data.notifications;
    store.rules.projection_choices = data.projection_choices;
    if !data.users.is_empty() {
        store.auth.replace_users(data.users);
    }
    if let Some(home) = data.home {
        store.home.replace(home);
    }
    Ok(())
}

/// Exporta todo el hogar como un documento JSON descargable (SPEC §15).
#[tauri::command]
pub fn backup_export(state: AppStateRef, by: String) -> Result<BackupData, AppError> {
    let store = store::lock(&state.store)?;
    backup_export_core(&store, &by)
}

/// Importa un respaldo: reemplaza la lista, el historial, los mandados, los
/// eventos, los planes, las secciones, el chat y las reglas (SPEC §15).
#[tauri::command]
pub fn backup_import(
    state: AppStateRef,
    by: String,
    data: BackupData,
) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    backup_import_core(&mut store, &by, data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::home::Home;
    use crate::domain::item::Priority;

    fn store_with_home() -> AppStore {
        let mut store = AppStore::new();
        let home = Home::create("Los Ramírez", "Papá").unwrap();
        store.home.replace(home);
        store
    }

    #[test]
    fn export_es_exclusivo_del_admin() {
        let mut store = store_with_home();
        store
            .home
            .get_mut()
            .unwrap()
            .add_member("Luis", Role::Miembro, "Papá")
            .unwrap();
        // Un miembro común no puede exportar.
        assert!(backup_export_core(&store, "Luis").is_err());
        assert!(backup_export_core(&store, "Intruso").is_err());
        // El Admin sí.
        let data = backup_export_core(&store, "Papá").unwrap();
        assert_eq!(data.home.unwrap().name, "Los Ramírez");
    }

    #[test]
    fn import_es_exclusivo_del_admin() {
        let mut store = store_with_home();
        store
            .home
            .get_mut()
            .unwrap()
            .add_member("Luis", Role::Miembro, "Papá")
            .unwrap();
        let mut data = backup_export_core(&store, "Papá").unwrap();
        data.items = Vec::new();
        assert!(backup_import_core(&mut store, "Luis", data.clone()).is_err());
        assert!(backup_import_core(&mut store, "Papá", data).is_ok());
    }

    #[test]
    fn export_redacta_fotos_y_precios_si_privacy_off() {
        let mut store = store_with_home();
        let mut rules = store.rules.rules();
        rules.privacy_show_photos = false;
        rules.privacy_show_prices = false;
        store.rules.set_rules(rules);
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Papá", None, None).unwrap();
        item.price = Some(89.5);
        item.photos.push("data:image/png;base64,AAAA".to_string());
        store.items.create(item);

        let data = backup_export_core(&store, "Papá").unwrap();
        assert_eq!(data.items.len(), 1);
        assert!(data.items[0].photos.is_empty());
        assert!(data.items[0].price.is_none());
    }

    #[test]
    fn export_conserva_fotos_y_precios_si_privacy_on() {
        let store = store_with_home();
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Papá", None, None).unwrap();
        item.price = Some(89.5);
        item.photos.push("data:image/png;base64,AAAA".to_string());
        let mut store = store;
        store.items.create(item);

        let data = backup_export_core(&store, "Papá").unwrap();
        assert_eq!(data.items[0].price, Some(89.5));
        assert_eq!(data.items[0].photos.len(), 1);
    }

    #[test]
    fn respaldo_incluye_y_restaura_cuentas() {
        let mut store = store_with_home();
        store.auth.register("Luis", "secreto123", "web").unwrap();
        let data = backup_export_core(&store, "Papá").unwrap();
        assert!(
            data.users.iter().any(|u| u.name == "Luis"),
            "el backup debe incluir las cuentas"
        );

        // Importa en un store limpio (con hogar previo, como en uso real):
        // la cuenta vuelve y puede iniciar sesión.
        let mut target = AppStore::new();
        target
            .home
            .replace(Home::create("Máquina destino", "Papá").unwrap());
        backup_import_core(&mut target, "Papá", data).unwrap();
        assert!(target.auth.account_exists("Luis"));
        let login = target.auth.login("Luis", "secreto123", "web");
        assert!(login.is_ok(), "la contraseña restaurada debe funcionar");
    }
}
