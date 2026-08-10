use serde::{Deserialize, Serialize};

use crate::domain::chat::ChatMessage;
use crate::domain::event::Event;
use crate::domain::home::Home;
use crate::domain::item::GroceryItem;
use crate::domain::notification::AppNotification;
use crate::domain::now_iso;
use crate::domain::plan::Plan;
use crate::domain::rules::HomeRules;
use crate::domain::section::Section;
use crate::domain::trip::ShoppingTrip;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Respaldo completo del hogar para llevarlo a otra máquina (SPEC §15):
/// lista, historial, mandados, eventos, planes, secciones, chat y reglas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupData {
    pub exported_at: String,
    pub home: Option<Home>,
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

/// Exporta todo el hogar como un documento JSON descargable (SPEC §15).
#[tauri::command]
pub fn backup_export(state: AppStateRef) -> Result<BackupData, AppError> {
    let store = store::lock(&state.store)?;
    Ok(BackupData {
        exported_at: now_iso(),
        home: store.home.get().ok().cloned(),
        items: store.items.list(),
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

/// Importa un respaldo: reemplaza la lista, el historial, los mandados, los
/// eventos, los planes, las secciones, el chat y las reglas (SPEC §15).
#[tauri::command]
pub fn backup_import(state: AppStateRef, data: BackupData) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.replace_all(data.items);
    store.trips.replace_all(data.trips);
    store.events.replace_all(data.events);
    store.plans.replace_all(data.plans);
    store.sections.replace_all(data.sections);
    store.chat.replace_all(data.chat);
    store.rules.set_rules(data.rules);
    store.rules.notifications = data.notifications;
    store.rules.projection_choices = data.projection_choices;
    if let Some(home) = data.home {
        store.home.replace(home);
    }
    Ok(())
}
