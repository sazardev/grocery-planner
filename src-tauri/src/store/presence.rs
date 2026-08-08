use std::collections::HashMap;

use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::domain::presence::PresenceView;
use crate::error::AppError;

/// Un miembro se considera desconectado si no manda heartbeat en este lapso.
const OFFLINE_AFTER_SECS: i64 = 30;

#[derive(Clone)]
struct PresenceEntry {
    name: String,
    last_seen: OffsetDateTime,
}

pub struct PresenceStore {
    members: HashMap<String, PresenceEntry>,
}

impl PresenceStore {
    pub fn new() -> Self {
        Self {
            members: HashMap::new(),
        }
    }

    pub fn heartbeat(&mut self, name: &str) -> Result<PresenceView, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre del miembro es obligatorio",
            ));
        }
        self.members.insert(
            name.to_string(),
            PresenceEntry {
                name: name.to_string(),
                last_seen: OffsetDateTime::now_utc(),
            },
        );
        self.view(name)
    }

    pub fn leave(&mut self, name: &str) {
        self.members.remove(name.trim());
    }

    pub fn list(&self) -> Vec<PresenceView> {
        let now = OffsetDateTime::now_utc();
        let mut views: Vec<PresenceView> = self.members.values().map(|e| to_view(e, now)).collect();
        views.sort_by(|a, b| a.name.cmp(&b.name));
        views
    }

    pub fn prune(&mut self) {
        let now = OffsetDateTime::now_utc();
        self.members
            .retain(|_, e| (now - e.last_seen).whole_seconds() < OFFLINE_AFTER_SECS);
    }

    fn view(&self, name: &str) -> Result<PresenceView, AppError> {
        let now = OffsetDateTime::now_utc();
        let entry = self
            .members
            .get(name)
            .ok_or_else(|| AppError::not_found(format!("Miembro {name} no registrado")))?;
        Ok(to_view(entry, now))
    }
}

fn to_view(entry: &PresenceEntry, now: OffsetDateTime) -> PresenceView {
    PresenceView {
        name: entry.name.clone(),
        online: (now - entry.last_seen).whole_seconds() < OFFLINE_AFTER_SECS,
        last_seen: entry.last_seen.format(&Rfc3339).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heartbeat_registra_online() {
        let mut store = PresenceStore::new();
        let view = store.heartbeat("Ana").unwrap();
        assert!(view.online);
        assert_eq!(store.list().len(), 1);
        assert_eq!(store.list()[0].name, "Ana");
    }

    #[test]
    fn vencimiento_y_purga() {
        let mut store = PresenceStore::new();
        store.heartbeat("Ana").unwrap();
        let now = OffsetDateTime::now_utc();
        store.members.get_mut("Ana").unwrap().last_seen = now - time::Duration::seconds(60);
        let views = store.list();
        assert_eq!(views.len(), 1);
        assert!(!views[0].online);
        store.prune();
        assert!(store.list().is_empty());
    }

    #[test]
    fn leave_elimina() {
        let mut store = PresenceStore::new();
        store.heartbeat("Ana").unwrap();
        store.leave("Ana");
        assert!(store.list().is_empty());
    }

    #[test]
    fn heartbeat_con_nombre_vacio_es_error() {
        let mut store = PresenceStore::new();
        assert!(store.heartbeat("  ").is_err());
    }
}
