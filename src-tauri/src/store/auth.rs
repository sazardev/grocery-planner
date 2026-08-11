use std::collections::HashMap;

use crate::domain::auth::{Session, User};
use crate::error::AppError;

/// Cuenta fija sembrada al arrancar (bypass de desarrollo para entrar sin
/// registrar). Cámbiala antes de exponer el hogar a internet (§15).
pub const DEFAULT_ACCOUNT: &str = "admin";
pub const DEFAULT_PASSWORD: &str = "admin123";

/// Repositorio de cuentas y sesiones (fase 1: en memoria, persistencia en fase 2).
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStore {
    /// Cuentas indexadas por id.
    users: HashMap<String, User>,
    /// Índice nombre → id (el nombre es la identidad visible, SPEC §2.1).
    name_index: HashMap<String, String>,
    /// Sesiones activas indexadas por token.
    sessions: HashMap<String, Session>,
}

impl AuthStore {
    pub fn new() -> Self {
        Self {
            users: HashMap::new(),
            name_index: HashMap::new(),
            sessions: HashMap::new(),
        }
    }

    /// Crea la cuenta fija de bypass (solo si no existe aún). Sin sesión: quien
    /// la use entra con el flujo normal de login.
    pub fn seed_default_account(&mut self) {
        if self.name_index.contains_key(DEFAULT_ACCOUNT) {
            return;
        }
        if let Ok(user) = User::create(DEFAULT_ACCOUNT, DEFAULT_PASSWORD) {
            self.name_index.insert(user.name.clone(), user.id.clone());
            self.users.insert(user.id.clone(), user);
        }
    }

    fn user_by_name(&self, name: &str) -> Option<User> {
        self.name_index
            .get(name.trim())
            .and_then(|id| self.users.get(id))
            .cloned()
    }

    /// Registra una cuenta nueva y abre su primera sesión.
    pub fn register(&mut self, name: &str, password: &str, device: &str) -> Result<(User, String), AppError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre es obligatorio para crear la cuenta",
            ));
        }
        if self.name_index.contains_key(&name) {
            return Err(AppError::conflict(format!(
                "Ya existe una cuenta con el nombre {name}"
            )));
        }
        let user = User::create(&name, password)?;
        let session = Session::new(&user.id, device);
        let token = session.token.clone();
        self.name_index.insert(name.clone(), user.id.clone());
        self.users.insert(user.id.clone(), user.clone());
        self.sessions.insert(token.clone(), session);
        Ok((user, token))
    }

    /// Inicia sesión: valida la contraseña y abre una sesión nueva.
    pub fn login(&mut self, name: &str, password: &str, device: &str) -> Result<(User, String), AppError> {
        let user = self
            .user_by_name(name)
            .ok_or_else(|| AppError::unauthorized("Nombre o contraseña incorrectos"))?;
        if !user.verify_password(password) {
            return Err(AppError::unauthorized("Nombre o contraseña incorrectos"));
        }
        let session = Session::new(&user.id, device);
        let token = session.token.clone();
        self.sessions.insert(token.clone(), session);
        Ok((user.clone(), token))
    }

    /// Devuelve la cuenta dueña de una sesión activa (marca el último uso).
    pub fn user_by_token(&mut self, token: &str) -> Result<User, AppError> {
        let session = self
            .sessions
            .get_mut(token)
            .ok_or_else(|| AppError::unauthorized("Sesión no válida"))?;
        if session.revoked {
            return Err(AppError::unauthorized("La sesión fue cerrada"));
        }
        session.last_used_at = crate::domain::now_iso();
        self.users
            .get(&session.user_id)
            .cloned()
            .ok_or_else(|| AppError::unauthorized("La cuenta de esta sesión ya no existe"))
    }

    /// Cierra una sesión (revocación, SPEC §2.4).
    pub fn revoke(&mut self, token: &str) -> Result<(), AppError> {
        let session = self
            .sessions
            .get_mut(token)
            .ok_or_else(|| AppError::unauthorized("Sesión no válida"))?;
        session.revoked = true;
        Ok(())
    }

    /// Sesiones de un usuario, de la más reciente a la más antigua.
    pub fn sessions_of(&self, user_id: &str) -> Vec<Session> {
        let mut list: Vec<Session> = self
            .sessions
            .values()
            .filter(|s| s.user_id == user_id)
            .cloned()
            .collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub fn session(&self, token: &str) -> Result<Session, AppError> {
        self.sessions
            .get(token)
            .cloned()
            .ok_or_else(|| AppError::unauthorized("Sesión no válida"))
    }

    /// Cambia la contraseña verificando la actual (SPEC §2.1).
    pub fn change_password(
        &mut self,
        token: &str,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        let user = self.user_by_token(token)?;
        if !user.verify_password(current_password) {
            return Err(AppError::unauthorized(
                "La contraseña actual es incorrecta",
            ));
        }
        let updated = User::create(&user.name, new_password)?;
        let id = user.id;
        self.users.insert(id, updated);
        Ok(())
    }

    /// Liga una cuenta con el hogar al que pertenece (una cuenta = un hogar).
    pub fn link_home(&mut self, user_name: &str, home_id: &str) {
        let id = self.user_by_name(user_name).map(|u| u.id);
        if let Some(id) = id {
            if let Some(stored) = self.users.get_mut(&id) {
                stored.home_id = Some(home_id.to_string());
            }
        }
    }

    /// Restablece la contraseña de un miembro (SPEC §2.5, verificado por la
    /// clave de respaldo del hogar en el command).
    pub fn reset_password(&mut self, name: &str, new_password: &str) -> Result<(), AppError> {
        let user = self
            .user_by_name(name)
            .ok_or_else(|| AppError::not_found(format!("No existe la cuenta {name}")))?;
        let updated = User::create(&user.name, new_password)?;
        self.users.insert(user.id, updated);
        Ok(())
    }

    /// Fija el PIN rápido de una cuenta (SPEC §2.3).
    pub fn set_pin(&mut self, name: &str, pin: &str) -> Result<(), AppError> {
        let user = self
            .user_by_name(name)
            .ok_or_else(|| AppError::unauthorized("Cuenta no encontrada"))?;
        let id = user.id;
        let stored = self
            .users
            .get_mut(&id)
            .ok_or_else(|| AppError::unauthorized("Cuenta no encontrada"))?;
        stored.set_pin(pin)
    }

    /// Quita el PIN rápido de una cuenta.
    pub fn remove_pin(&mut self, name: &str) -> Result<(), AppError> {
        let user = self
            .user_by_name(name)
            .ok_or_else(|| AppError::unauthorized("Cuenta no encontrada"))?;
        let id = user.id;
        let stored = self
            .users
            .get_mut(&id)
            .ok_or_else(|| AppError::unauthorized("Cuenta no encontrada"))?;
        stored.remove_pin();
        Ok(())
    }

    /// ¿La cuenta tiene PIN configurado? (para mostrar el botón "Entrar con PIN").
    pub fn has_pin(&self, name: &str) -> bool {
        self.user_by_name(name)
            .map(|u| u.pin_hash.is_some())
            .unwrap_or(false)
    }

    /// Inicia sesión con el PIN rápido de 4 dígitos (SPEC §2.3).
    pub fn login_pin(
        &mut self,
        name: &str,
        pin: &str,
        device: &str,
    ) -> Result<(User, String), AppError> {
        let user = self
            .user_by_name(name)
            .ok_or_else(|| AppError::unauthorized("Nombre o PIN incorrectos"))?;
        if !user.verify_pin(pin) {
            return Err(AppError::unauthorized("Nombre o PIN incorrectos"));
        }
        let session = Session::new(&user.id, device);
        let token = session.token.clone();
        self.sessions.insert(token.clone(), session);
        Ok((user.clone(), token))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registrar_y_entrar() {
        let mut store = AuthStore::new();
        let (user, token) = store.register("María", "secreto123", "Celular").unwrap();
        assert_eq!(user.name, "María");
        assert!(store.user_by_token(&token).is_ok());
        let (again, token2) = store.login("María", "secreto123", "Chrome").unwrap();
        assert_eq!(again.id, user.id);
        assert_ne!(token, token2);
    }

    #[test]
    fn nombre_repetido_bloqueado() {
        let mut store = AuthStore::new();
        store.register("María", "secreto123", "").unwrap();
        assert!(store.register("María", "otra-clave", "").is_err());
    }

    #[test]
    fn password_incorrecta_bloqueada() {
        let mut store = AuthStore::new();
        store.register("María", "secreto123", "").unwrap();
        assert!(store.login("María", "incorrecta", "").is_err());
    }

    #[test]
    fn sesion_revocada_no_sirve() {
        let mut store = AuthStore::new();
        let (_, token) = store.register("María", "secreto123", "").unwrap();
        store.revoke(&token).unwrap();
        assert!(store.user_by_token(&token).is_err());
    }

    #[test]
    fn varias_sesiones_del_mismo_usuario() {
        let mut store = AuthStore::new();
        let (user, _) = store.register("María", "secreto123", "Celular").unwrap();
        store.login("María", "secreto123", "Chrome").unwrap();
        store.login("María", "secreto123", "Tablet").unwrap();
        let sessions = store.sessions_of(&user.id);
        assert_eq!(sessions.len(), 3);
        assert_eq!(sessions[0].device, "Tablet");
    }

    #[test]
    fn cambiar_password_y_rechazar_la_antigua() {
        let mut store = AuthStore::new();
        let (_, token) = store.register("María", "secreto123", "").unwrap();
        store
            .change_password(&token, "secreto123", "nueva-secreta")
            .unwrap();
        assert!(store.login("María", "secreto123", "").is_err());
        assert!(store.login("María", "nueva-secreta", "").is_ok());
    }

    #[test]
    fn cambiar_password_pide_la_actual() {
        let mut store = AuthStore::new();
        let (_, token) = store.register("María", "secreto123", "").unwrap();
        assert!(store.change_password(&token, "equivocada", "x").is_err());
    }

    #[test]
    fn linkear_hogar() {
        let mut store = AuthStore::new();
        let (user, _) = store.register("María", "secreto123", "").unwrap();
        store.link_home(&user.name, "home-1");
        let stored = store.login("María", "secreto123", "").unwrap().0;
        assert_eq!(stored.home_id.as_deref(), Some("home-1"));
    }

    #[test]
    fn cuenta_fija_de_bypass_sembrada() {
        let mut store = AuthStore::new();
        store.seed_default_account();
        // se puede entrar con las credenciales fijas
        let (user, _) = store.login(DEFAULT_ACCOUNT, DEFAULT_PASSWORD, "").unwrap();
        assert_eq!(user.name, DEFAULT_ACCOUNT);
        // sembrar de nuevo no la duplica
        store.seed_default_account();
        assert_eq!(store.sessions_of(&user.id).len(), 1);
        // la contraseña fija no se puede re-registrar como cuenta nueva
        assert!(store.register(DEFAULT_ACCOUNT, "otra-clave", "").is_err());
    }

    #[test]
    fn pin_rapido_para_entrar() {
        let mut store = AuthStore::new();
        let (user, _) = store.register("Ana", "secreto123", "").unwrap();
        assert!(!store.has_pin(&user.name));
        store.set_pin(&user.name, "4321").unwrap();
        assert!(store.has_pin(&user.name));
        assert!(store.login_pin(&user.name, "9999", "Tablet").is_err());
        let (logged, token) = store.login_pin(&user.name, "4321", "Tablet").unwrap();
        assert_eq!(logged.id, user.id);
        assert!(store.user_by_token(&token).is_ok());
        store.remove_pin(&user.name).unwrap();
        assert!(!store.has_pin(&user.name));
        assert!(store.login_pin(&user.name, "4321", "Tablet").is_err());
    }
}
