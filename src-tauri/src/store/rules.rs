use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::notification::{AppNotification, NotificationKind};
use crate::domain::rules::{HomeRules, NotificationSettings};

/// Repositorio en memoria de las reglas del hogar, los avisos y las decisiones
/// de proyección (SPEC §7.2, §13 y §14).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulesStore {
    pub rules: HomeRules,
    /// Avisos generados para cada miembro (SPEC §13).
    pub notifications: Vec<AppNotification>,
    /// Decisiones de la familia sobre las proyecciones: nombre del ítem → ¿se
    /// confirmó la sugerencia? (SPEC §7.2).
    pub projection_choices: HashMap<String, bool>,
    /// Ids de eventos cuyo recordatorio ya se notificó (para no repetir).
    #[serde(default)]
    pub reminders_fired: Vec<String>,
}

impl RulesStore {
    pub fn new() -> Self {
        Self {
            rules: HomeRules::default(),
            notifications: Vec::new(),
            projection_choices: HashMap::new(),
            reminders_fired: Vec::new(),
        }
    }

    /// Reglas actuales del hogar.
    pub fn rules(&self) -> HomeRules {
        self.rules.clone()
    }

    pub fn set_rules(&mut self, rules: HomeRules) {
        self.rules = rules;
    }

    // ----- Notificaciones ------------------------------------------------

    pub fn push_notification(&mut self, notification: AppNotification) {
        self.notifications.push(notification);
    }

    pub fn notifications_for(&self, member: &str) -> Vec<AppNotification> {
        let mut list: Vec<AppNotification> = self
            .notifications
            .iter()
            .filter(|n| n.for_member == member)
            .cloned()
            .collect();
        list.sort_by(|a, b| b.at.cmp(&a.at));
        list
    }

    pub fn unread_count(&self, member: &str) -> usize {
        self.notifications
            .iter()
            .filter(|n| n.for_member == member && !n.read)
            .count()
    }

    /// Menciones sin leer (@Nombre en el chat) para el badge del chat.
    pub fn mentions_unread_count(&self, member: &str) -> usize {
        self.notifications
            .iter()
            .filter(|n| n.for_member == member && !n.read && n.kind == NotificationKind::Mention)
            .count()
    }

    /// Marca las menciones sin leer como leídas (al abrir el chat).
    pub fn mark_mentions_read(&mut self, member: &str) {
        for n in self.notifications.iter_mut() {
            if n.for_member == member && n.kind == NotificationKind::Mention {
                n.read = true;
            }
        }
    }

    pub fn mark_read(&mut self, id: &str, member: &str) {
        if let Some(n) = self.notifications.iter_mut().find(|n| n.id == id && n.for_member == member) {
            n.read = true;
        }
    }

    pub fn mark_all_read(&mut self, member: &str) {
        for n in self.notifications.iter_mut() {
            if n.for_member == member {
                n.read = true;
            }
        }
    }

    // ----- Preferencias de notificación por miembro ------------------------

    pub fn settings_for(&self, member: &str) -> NotificationSettings {
        self.rules
            .notifications
            .get(member)
            .cloned()
            .unwrap_or_default()
    }

    pub fn set_settings(&mut self, member: &str, settings: NotificationSettings) {
        self.rules
            .notifications
            .insert(member.to_string(), settings);
    }

    // ----- Decisiones de proyección (SPEC §7.2) ----------------------------

    pub fn decide_projection(&mut self, name: &str, confirmed: bool) {
        self.projection_choices.insert(name.trim().to_string(), confirmed);
    }

    pub fn projection_decision(&self, name: &str) -> Option<bool> {
        self.projection_choices.get(name.trim()).copied()
    }

    pub fn clear_old_choices(&mut self, active_names: &[String]) {
        let active: std::collections::HashSet<String> =
            active_names.iter().cloned().collect();
        self.projection_choices
            .retain(|name, _| active.contains(name));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::notification::NotificationKind;

    #[test]
    fn reglas_por_defecto() {
        let store = RulesStore::new();
        let rules = store.rules();
        assert_eq!(rules.photo_limit, 4);
        assert_eq!(rules.language, "es");
        assert!(rules.stores.is_empty());
    }

    #[test]
    fn notificaciones_por_miembro_y_no_leidas() {
        let mut store = RulesStore::new();
        store.push_notification(AppNotification::new(
            NotificationKind::Urgent,
            "Ana",
            "Pide pollo",
            "pollo urgente",
            None,
        ));
        store.push_notification(AppNotification::new(
            NotificationKind::Mention,
            "Juan",
            "@Juan",
            "te mencionaron",
            None,
        ));
        assert_eq!(store.notifications_for("Ana").len(), 1);
        assert_eq!(store.unread_count("Ana"), 1);
        assert_eq!(store.unread_count("Juan"), 1);
        store.mark_all_read("Ana");
        assert_eq!(store.unread_count("Ana"), 0);
        assert_eq!(store.unread_count("Juan"), 1);
    }

    #[test]
    fn menciones_sin_leer_se_cuentan_y_marcan() {
        let mut store = RulesStore::new();
        store.push_notification(AppNotification::new(
            NotificationKind::Urgent,
            "Ana",
            "Pide pollo",
            "pollo urgente",
            None,
        ));
        store.push_notification(AppNotification::new(
            NotificationKind::Mention,
            "Ana",
            "@Ana",
            "te mencionaron",
            Some("/chat"),
        ));
        store.push_notification(AppNotification::new(
            NotificationKind::Mention,
            "Ana",
            "@Ana",
            "te mencionaron otra vez",
            Some("/chat"),
        ));
        // Solo cuenta menciones sin leer (no el urgente)
        assert_eq!(store.mentions_unread_count("Ana"), 2);
        store.mark_mentions_read("Ana");
        assert_eq!(store.mentions_unread_count("Ana"), 0);
        // El aviso urgente sigue sin leer
        assert_eq!(store.unread_count("Ana"), 1);
    }

    #[test]
    fn settings_por_miembro_con_default() {
        let mut store = RulesStore::new();
        assert!(store.settings_for("Ana").on_mention);
        let mut s = store.settings_for("Ana");
        s.on_mention = false;
        s.silent_from = Some("22:00".into());
        store.set_settings("Ana", s);
        assert!(!store.settings_for("Ana").on_mention);
        assert_eq!(store.settings_for("Ana").silent_from.as_deref(), Some("22:00"));
        assert!(store.settings_for("Juan").on_mention);
    }

    #[test]
    fn decisiones_de_proyeccion() {
        let mut store = RulesStore::new();
        assert_eq!(store.projection_decision("leche"), None);
        store.decide_projection("leche", true);
        assert_eq!(store.projection_decision("leche"), Some(true));
        store.clear_old_choices(&["pollo".into()]);
        assert_eq!(store.projection_decision("leche"), None);
    }
}
