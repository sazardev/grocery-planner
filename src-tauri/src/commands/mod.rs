pub mod app;
pub mod auth;
pub mod background;
pub mod backup;
pub mod chat;
pub mod events;
pub mod health;
pub mod home;
pub mod items;
pub mod notify;
pub mod photo;
pub mod plans;
pub mod presence;
pub mod reports;
pub mod rules;
pub mod sections;
pub mod timeline;
pub mod trips;

use crate::domain::home::Role;
use crate::error::AppError;
use crate::store::AppStore;

/// Exige un rol mínimo (Organizador/Admin) sobre el hogar (SPEC §3.2 y §14).
pub fn require_role(store: &AppStore, by: &str, min: Role) -> Result<(), AppError> {
    let home = store.home.get()?;
    home.require_role(by, min)
}
