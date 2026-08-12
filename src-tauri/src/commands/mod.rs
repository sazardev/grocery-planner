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

/// Exige que `name` sea miembro del hogar (para asignaciones a personas reales,
/// SPEC §6: asignar a un fantasma rompería "Lo mío" y los avisos).
pub fn require_member(store: &AppStore, name: &str) -> Result<(), AppError> {
    let home = store.home.get()?;
    if home.member(name).is_none() {
        return Err(AppError::invalid_input(format!(
            "{name} no es miembro del hogar"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::home::Home;

    fn store_with_home() -> AppStore {
        let mut store = AppStore::new();
        let home = Home::create("Los Ramírez", "Papá").unwrap();
        store.home.create(home);
        store.home.add_member("Mamá", Role::Miembro, "Papá").unwrap();
        store
    }

    #[test]
    fn require_member_acepta_a_miembros_del_hogar() {
        let store = store_with_home();
        assert!(require_member(&store, "Papá").is_ok());
        assert!(require_member(&store, "Mamá").is_ok());
    }

    #[test]
    fn require_member_rechaza_nombres_fantasma() {
        let store = store_with_home();
        assert!(matches!(
            require_member(&store, "Fantasma"),
            Err(AppError::InvalidInput(_))
        ));
    }

    #[test]
    fn require_member_sin_hogar_da_not_found() {
        let store = AppStore::new();
        assert!(matches!(
            require_member(&store, "Papá"),
            Err(AppError::NotFound(_))
        ));
    }
}
