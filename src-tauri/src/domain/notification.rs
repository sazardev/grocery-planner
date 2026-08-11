use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::now_iso;

/// Tipos de aviso que puede recibir un miembro (SPEC §13).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationKind {
    Assigned,
    Urgent,
    TripStarted,
    Arrival,
    Mention,
    EventReminder,
    Projection,
    DailySummary,
    WeeklySummary,
}

/// Un aviso generado por el sistema para un miembro (SPEC §13).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppNotification {
    pub id: String,
    pub at: String,
    pub kind: NotificationKind,
    pub for_member: String,
    pub title: String,
    pub body: String,
    pub read: bool,
    /// Ruta de la app a la que lleva el aviso (ej. `/items/abc`).
    pub link: Option<String>,
}

impl AppNotification {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        kind: NotificationKind,
        for_member: &str,
        title: &str,
        body: &str,
        link: Option<&str>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            at: now_iso(),
            kind,
            for_member: for_member.to_string(),
            title: title.to_string(),
            body: body.to_string(),
            read: false,
            link: link.map(str::to_string),
        }
    }
}
