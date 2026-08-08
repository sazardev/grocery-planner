use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceView {
    pub name: String,
    pub online: bool,
    pub last_seen: String,
}
