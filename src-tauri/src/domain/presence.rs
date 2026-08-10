use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceView {
    pub name: String,
    pub online: bool,
    pub last_seen: String,
    /// Pantalla en la que está el miembro (ej. "chat", "lista"); `None` = sin declarar.
    pub screen: Option<String>,
}
