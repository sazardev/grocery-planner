use serde::Serialize;

use crate::domain::auth::{Session, User};
use crate::domain::home::Role;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserView {
    pub id: String,
    pub name: String,
    pub alias: Option<String>,
    pub home_id: Option<String>,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    pub token: String,
    pub device: String,
    pub created_at: String,
    pub last_used_at: String,
    pub revoked: bool,
    /// `true` para la sesión actual (la del token usado para consultar).
    pub current: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthView {
    pub user: UserView,
    pub token: String,
}

fn user_view(user: &User) -> UserView {
    UserView {
        id: user.id.clone(),
        name: user.name.clone(),
        alias: user.alias.clone(),
        home_id: user.home_id.clone(),
        created_at: user.created_at.clone(),
    }
}

/// Crea la cuenta de una persona (SPEC §2.1–2.2). La contraseña se guarda
/// hasheada (argon2id); se devuelve la sesión inicial.
#[tauri::command]
pub fn auth_register(
    state: AppStateRef,
    name: String,
    password: String,
) -> Result<AuthView, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.register(&name, &password, "este dispositivo")?;
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}

/// Inicia sesión con nombre y contraseña; abre una sesión nueva (SPEC §2.3).
#[tauri::command]
pub fn auth_login(
    state: AppStateRef,
    name: String,
    password: String,
    device: String,
) -> Result<AuthView, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.login(&name, &password, &device)?;
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}

/// Cierra la sesión actual.
#[tauri::command]
pub fn auth_logout(state: AppStateRef, token: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.auth.revoke(&token)
}

/// Cuenta de la sesión actual (para validar un token guardado al abrir la app).
#[tauri::command]
pub fn auth_me(state: AppStateRef, token: String) -> Result<UserView, AppError> {
    let mut store = store::lock(&state.store)?;
    let user = store.auth.user_by_token(&token)?;
    Ok(user_view(&user))
}

/// Dónde está conectado el usuario actual (dispositivo y último uso, SPEC §2.4).
#[tauri::command]
pub fn auth_sessions(state: AppStateRef, token: String) -> Result<Vec<SessionView>, AppError> {
    let mut store = store::lock(&state.store)?;
    let user = store.auth.user_by_token(&token)?;
    let sessions: Vec<SessionView> = store
        .auth
        .sessions_of(&user.id)
        .into_iter()
        .map(|s: Session| SessionView {
            current: s.token == token,
            token: s.token.clone(),
            device: s.device.clone(),
            created_at: s.created_at,
            last_used_at: s.last_used_at,
            revoked: s.revoked,
        })
        .collect();
    Ok(sessions)
}

/// Cierra una sesión remota: la propia siempre; la ajena solo si quien pide es
/// Admin del hogar (SPEC §2.4). Devuelve `true` si la sesión era la actual.
#[tauri::command]
pub fn auth_revoke_session(
    state: AppStateRef,
    token: String,
    target_token: String,
) -> Result<bool, AppError> {
    let mut store = store::lock(&state.store)?;
    let actor = store.auth.user_by_token(&token)?;
    let target = store.auth.session(&target_token)?;
    if target.user_id != actor.id {
        let is_admin = store
            .home
            .get()
            .ok()
            .map(|h| {
                h.member(&actor.name)
                    .map(|m| m.role == Role::Admin)
                    .unwrap_or(false)
            })
            .unwrap_or(false);
        if !is_admin {
            return Err(AppError::conflict(
                "Solo puedes cerrar tus propias sesiones (o las de tu hogar como Admin)",
            ));
        }
    }
    let is_current = target_token == token;
    store.auth.revoke(&target_token)?;
    Ok(is_current)
}

/// Cambia la contraseña verificando la actual (SPEC §2.1).
#[tauri::command]
pub fn auth_change_password(
    state: AppStateRef,
    token: String,
    current_password: String,
    new_password: String,
) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store
        .auth
        .change_password(&token, &current_password, &new_password)
}

/// Fija el PIN rápido de 4 dígitos para entrar desde un dispositivo conocido
/// (SPEC §2.3). La biometría nunca viaja al servidor; el PIN sí (hasheado).
#[tauri::command]
pub fn auth_set_pin(state: AppStateRef, name: String, pin: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.auth.set_pin(&name, &pin)
}

/// Quita el PIN rápido de la cuenta.
#[tauri::command]
pub fn auth_remove_pin(state: AppStateRef, name: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.auth.remove_pin(&name)
}

/// ¿La cuenta tiene PIN configurado? (para ofrecer "Entrar con PIN").
#[tauri::command]
pub fn auth_has_pin(state: AppStateRef, name: String) -> Result<bool, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.auth.has_pin(&name))
}

/// Inicia sesión con el PIN rápido (SPEC §2.3).
#[tauri::command]
pub fn auth_login_pin(
    state: AppStateRef,
    name: String,
    pin: String,
    device: String,
) -> Result<AuthView, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.login_pin(&name, &pin, &device)?;
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}
