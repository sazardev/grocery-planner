use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

/// Límites de entrada para cuentas (SPEC §2.1). Pensados para fricción baja.
const MAX_NAME_LEN: usize = 40;
const MIN_PASSWORD_LEN: usize = 6;

/// PIN rápido de 4 dígitos para entrar desde un dispositivo conocido (SPEC §2.3).
const PIN_DIGITS: usize = 4;

/// Cuenta de una persona (SPEC §2.1). La contraseña nunca se guarda en claro:
/// solo su hash argon2id (SPEC §15).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub password_hash: String,
    /// PIN rápido opcional de 4 dígitos (hash argon2id, SPEC §2.3).
    pub pin_hash: Option<String>,
    pub alias: Option<String>,
    pub timezone: Option<String>,
    /// Hogar al que pertenece (fase 1: una cuenta = un hogar, SPEC §3.6).
    pub home_id: Option<String>,
    pub created_at: String,
}

impl User {
    /// Crea una cuenta nueva: valida y hashea la contraseña.
    pub fn create(name: &str, password: &str) -> Result<Self, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre es obligatorio para crear la cuenta",
            ));
        }
        if name.chars().count() > MAX_NAME_LEN {
            return Err(AppError::invalid_input(format!(
                "El nombre no puede superar {MAX_NAME_LEN} caracteres"
            )));
        }
        if password.chars().count() < MIN_PASSWORD_LEN {
            return Err(AppError::invalid_input(format!(
                "La contraseña debe tener al menos {MIN_PASSWORD_LEN} caracteres"
            )));
        }
        let hash = hash_password(password)?;
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            password_hash: hash,
            pin_hash: None,
            alias: None,
            timezone: None,
            home_id: None,
            created_at: now_iso(),
        })
    }

    /// Verifica una contraseña contra el hash guardado.
    pub fn verify_password(&self, password: &str) -> bool {
        verify_password(password, &self.password_hash).unwrap_or(false)
    }

    /// Fija un PIN rápido de 4 dígitos (hash argon2id, SPEC §2.3).
    pub fn set_pin(&mut self, pin: &str) -> Result<(), AppError> {
        validate_pin(pin)?;
        self.pin_hash = Some(hash_password(pin)?);
        Ok(())
    }

    /// Quita el PIN rápido.
    pub fn remove_pin(&mut self) {
        self.pin_hash = None;
    }

    /// Verifica el PIN rápido contra el hash guardado.
    pub fn verify_pin(&self, pin: &str) -> bool {
        match &self.pin_hash {
            Some(hash) => verify_password(pin, hash).unwrap_or(false),
            None => false,
        }
    }
}

fn validate_pin(pin: &str) -> Result<(), AppError> {
    if pin.chars().count() != PIN_DIGITS || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::invalid_input(format!(
            "El PIN debe tener {PIN_DIGITS} dígitos"
        )));
    }
    Ok(())
}

/// Sesión activa de un usuario (SPEC §2.4: varias sesiones por persona).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    /// Etiqueta del dispositivo (ej. "Chrome · Linux") para ver dónde se conecta.
    pub device: String,
    pub created_at: String,
    pub last_used_at: String,
    pub revoked: bool,
}

impl Session {
    pub fn new(user_id: &str, device: &str) -> Self {
        let now = now_iso();
        Self {
            token: new_session_token(),
            user_id: user_id.to_string(),
            device: device.trim().to_string(),
            created_at: now.clone(),
            last_used_at: now,
            revoked: false,
        }
    }
}

/// Genera un token de sesión aleatorio (122 bits de entropía vía UUID v4).
fn new_session_token() -> String {
    Uuid::new_v4().to_string()
}

/// Hash argon2id con salt aleatorio. El salt se guarda dentro del propio hash
/// (formato PHC), así que `verify` no necesita guardar nada extra.
fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::encode_b64(Uuid::new_v4().as_bytes())
        .map_err(|e| AppError::internal(format!("No se pudo generar el salt: {e}")))?;
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|p| p.to_string())
        .map_err(|e| AppError::internal(format!("No se pudo hashear la contraseña: {e}")))
}

fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::internal(format!("Hash de contraseña inválido: {e}")))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crear_cuenta_y_verificar_password() {
        let user = User::create("María", "secreto123").unwrap();
        assert_eq!(user.name, "María");
        assert!(user.verify_password("secreto123"));
        assert!(!user.verify_password("otra-clave"));
        assert_ne!(user.password_hash, "secreto123");
    }

    #[test]
    fn nombre_y_password_obligatorios() {
        assert!(User::create("  ", "secreto123").is_err());
        assert!(User::create("María", "123").is_err());
        assert!(User::create(&"a".repeat(60), "secreto123").is_err());
    }

    #[test]
    fn cada_password_se_hashea_con_salt_distinto() {
        let a = User::create("Ana", "secreto123").unwrap();
        let b = User::create("Ana", "secreto123").unwrap();
        assert_ne!(a.password_hash, b.password_hash);
        assert!(a.verify_password("secreto123"));
        assert!(b.verify_password("secreto123"));
    }

    #[test]
    fn sesion_con_token_unico() {
        let user = User::create("Papá", "secreto123").unwrap();
        let s1 = Session::new(&user.id, "Celular");
        let s2 = Session::new(&user.id, "Chrome");
        assert_ne!(s1.token, s2.token);
        assert!(!s1.revoked);
    }

    #[test]
    fn pin_rapido_de_4_digitos() {
        let mut user = User::create("Ana", "secreto123").unwrap();
        assert!(!user.verify_pin("1234"));
        user.set_pin("1234").unwrap();
        assert!(user.verify_pin("1234"));
        assert!(!user.verify_pin("5678"));
        assert_ne!(user.pin_hash.as_deref(), Some("1234"));
        user.remove_pin();
        assert!(!user.verify_pin("1234"));
    }

    #[test]
    fn pin_invalido_rechazado() {
        let mut user = User::create("Ana", "secreto123").unwrap();
        assert!(user.set_pin("12ab").is_err());
        assert!(user.set_pin("123").is_err());
        assert!(user.set_pin("12345").is_err());
        assert!(user.pin_hash.is_none());
    }
}
