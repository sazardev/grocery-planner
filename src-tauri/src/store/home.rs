use crate::domain::home::{Home, Invitation, Member, Role};
use crate::error::AppError;

/// Repositorio en memoria del hogar (fase 1: un solo hogar por instancia).
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeStore {
    home: Option<Home>,
}

impl HomeStore {
    pub fn new() -> Self {
        Self { home: None }
    }

    pub fn create(&mut self, home: Home) -> Home {
        self.home = Some(home.clone());
        home
    }

    pub fn get(&self) -> Result<&Home, AppError> {
        self.home
            .as_ref()
            .ok_or_else(|| AppError::not_found("Todavía no se crea el hogar"))
    }

    pub fn get_mut(&mut self) -> Result<&mut Home, AppError> {
        self.home
            .as_mut()
            .ok_or_else(|| AppError::not_found("Todavía no se crea el hogar"))
    }

    pub fn add_member(&mut self, name: &str, role: Role, by: &str) -> Result<Member, AppError> {
        self.get_mut()?.add_member(name, role, by)
    }

    pub fn remove_member(&mut self, name: &str, by: &str) -> Result<(), AppError> {
        self.get_mut()?.remove_member(name, by)
    }

    pub fn change_role(&mut self, name: &str, role: Role, by: &str) -> Result<Member, AppError> {
        self.get_mut()?.change_role(name, role, by)
    }

    pub fn create_invitation(
        &mut self,
        by: &str,
        role: Role,
        expires_in_secs: Option<i64>,
        max_uses: Option<u32>,
    ) -> Result<Invitation, AppError> {
        self.get_mut()?
            .create_invitation(by, role, expires_in_secs, max_uses)
    }

    pub fn revoke_invitation(&mut self, id: &str, by: &str) -> Result<Invitation, AppError> {
        self.get_mut()?.revoke_invitation(id, by)
    }

    pub fn accept_invitation(&mut self, code: &str, member: &str) -> Result<Member, AppError> {
        self.get_mut()?.accept_invitation(code, member)
    }

    pub fn regenerate_backup_key(&mut self, by: &str) -> Result<String, AppError> {
        self.get_mut()?.regenerate_backup_key(by)
    }

    /// Reemplaza el hogar completo (restauración de respaldo, SPEC §15).
    pub fn replace(&mut self, home: Home) {
        self.home = Some(home);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sin_hogar_creado_es_error() {
        let mut store = HomeStore::new();
        assert!(store.get().is_err());
        assert!(store.add_member("Ana", Role::Miembro, "Papá").is_err());
    }

    #[test]
    fn crear_y_acceder() {
        let mut store = HomeStore::new();
        store.create(Home::create("Los Ramírez", "Papá").unwrap());
        assert_eq!(store.get().unwrap().members().len(), 1);
        let member = store.add_member("Ana", Role::Miembro, "Papá").unwrap();
        assert_eq!(member.name, "Ana");
        assert!(store.remove_member("Ana", "Papá").is_ok());
    }
}
