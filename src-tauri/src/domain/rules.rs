use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Una tienda favorita con sus pasillos (SPEC §14 y §5.4).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreConfig {
    pub name: String,
    pub aisles: Vec<String>,
}

/// Preferencias de notificaciones de un miembro (SPEC §13).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub on_assigned: bool,
    pub on_urgent: bool,
    pub on_trip_started: bool,
    pub on_arrival: bool,
    pub on_mention: bool,
    pub on_event_reminder: bool,
    pub on_projection: bool,
    pub daily_summary: bool,
    pub weekly_summary: bool,
    /// Horario silencioso (no molestar): `HH:MM` opcional desde/hasta (SPEC §13).
    pub silent_from: Option<String>,
    pub silent_to: Option<String>,
    /// Tipos de evento de los que quiere avisos; vacío = todos (SPEC §13).
    pub event_types: Vec<String>,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            on_assigned: true,
            on_urgent: true,
            on_trip_started: true,
            on_arrival: true,
            on_mention: true,
            on_event_reminder: true,
            on_projection: true,
            daily_summary: false,
            weekly_summary: false,
            silent_from: None,
            silent_to: None,
            event_types: Vec::new(),
        }
    }
}

/// Reglas de la familia configurables por el Organizador (SPEC §14).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeRules {
    pub name: String,
    /// Tiendas favoritas y sus pasillos.
    pub stores: Vec<StoreConfig>,
    /// Unidades preferidas (para el agregado rápido).
    pub units: Vec<String>,
    /// Categorías preferidas.
    pub categories: Vec<String>,
    /// Límite de fotos por ítem (SPEC §14, para ahorrar espacio).
    pub photo_limit: usize,
    /// Modo invitado/host del quiosco de casa (SPEC §14).
    pub host_mode: bool,
    /// Si el quiosco se pausa cuando hay visita (SPEC §2.3).
    pub host_pause_with_visitors: bool,
    /// Privacidad: quién puede ver fotos y precios (SPEC §14).
    pub privacy_show_photos: bool,
    pub privacy_show_prices: bool,
    /// Idioma y zona horaria del hogar (SPEC §14).
    pub language: String,
    pub timezone: String,
    /// Preferencias de notificación por miembro (SPEC §13).
    pub notifications: HashMap<String, NotificationSettings>,
}

impl Default for HomeRules {
    fn default() -> Self {
        Self {
            name: "Nuestro hogar".to_string(),
            stores: Vec::new(),
            units: vec![
                "kg".into(),
                "g".into(),
                "l".into(),
                "pieza".into(),
                "bolsa".into(),
                "docena".into(),
                "paquete".into(),
                "tarro".into(),
            ],
            categories: vec![
                "frutas".into(),
                "carnes".into(),
                "lácteos".into(),
                "limpieza".into(),
                "hogar".into(),
                "farmacia".into(),
                "despensa".into(),
            ],
            photo_limit: 4,
            host_mode: false,
            host_pause_with_visitors: false,
            privacy_show_photos: true,
            privacy_show_prices: true,
            language: "es".to_string(),
            timezone: "America/Mexico_City".to_string(),
            notifications: HashMap::new(),
        }
    }
}
