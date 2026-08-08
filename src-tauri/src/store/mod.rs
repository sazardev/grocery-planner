pub mod auth;
pub mod chat;
pub mod event;
pub mod home;
pub mod item;
pub mod plan;
pub mod presence;
pub mod rules;
pub mod section;
pub mod trip;

use std::sync::{Mutex, MutexGuard};

use crate::error::AppError;

/// Agrega los repositorios en memoria del sistema. La persistencia real
/// (sqlx/diesel) llega en la fase 2; esta capa aísla a los commands y al
/// servidor HTTP del almacenamiento.
pub struct AppStore {
    pub auth: auth::AuthStore,
    pub items: item::ItemStore,
    pub trips: trip::TripStore,
    pub presence: presence::PresenceStore,
    pub home: home::HomeStore,
    pub events: event::EventStore,
    pub sections: section::SectionStore,
    pub plans: plan::PlanStore,
    pub chat: chat::ChatStore,
    pub rules: rules::RulesStore,
}

impl AppStore {
    pub fn new() -> Self {
        Self {
            auth: auth::AuthStore::new(),
            items: item::ItemStore::new(),
            trips: trip::TripStore::new(),
            presence: presence::PresenceStore::new(),
            home: home::HomeStore::new(),
            events: event::EventStore::new(),
            sections: section::SectionStore::new(),
            plans: plan::PlanStore::new(),
            chat: chat::ChatStore::new(),
            rules: rules::RulesStore::new(),
        }
    }
}

pub fn lock<'a>(store: &'a Mutex<AppStore>) -> Result<MutexGuard<'a, AppStore>, AppError> {
    store
        .lock()
        .map_err(|_| AppError::internal("Almacén bloqueado"))
}
