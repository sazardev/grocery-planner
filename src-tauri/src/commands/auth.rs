use serde::Serialize;

use crate::domain::auth::{Session, User};
use crate::domain::home::Role;
use crate::error::AppError;
use crate::persist;
use crate::state::AppStateRef;
use crate::store;

/// Guarda el estado al instante tras una mutación de auth, para que una sesión
/// nueva/cambiada no se pierda si la app se cierra en los segundos del guardado
/// periódico (misma garantía que el servidor HTTP).
fn persist_now(store: &store::AppStore) {
    let _ = persist::save(store, &persist::default_data_path());
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserView {
    pub id: String,
    pub name: String,
    pub alias: Option<String>,
    pub avatar: Option<String>,
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
    /// ISO UTC; `None` = sin expiración (sesión legacy).
    pub expires_at: Option<String>,
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
        avatar: user.avatar.clone(),
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
    persist_now(&store);
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
    persist_now(&store);
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}

/// Cierra la sesión actual.
#[tauri::command]
pub fn auth_logout(state: AppStateRef, token: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.auth.revoke(&token)?;
    persist_now(&store);
    Ok(())
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
            expires_at: s.expires_at,
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
    persist_now(&store);
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
        .change_password(&token, &current_password, &new_password)?;
    persist_now(&store);
    Ok(())
}

/// Actualiza el perfil de la cuenta: alias (ej. "la mamá de Ana") y avatar/foto
/// (SPEC §2.1). `None` = no tocar; cadena vacía = limpiar.
#[tauri::command]
pub fn auth_update_profile(
    state: AppStateRef,
    token: String,
    alias: Option<String>,
    avatar: Option<String>,
) -> Result<UserView, AppError> {
    let mut store = store::lock(&state.store)?;
    let user = store
        .auth
        .update_profile(&token, alias.as_deref(), avatar.as_deref())?;
    persist_now(&store);
    Ok(user_view(&user))
}

/// Restablece la contraseña de un miembro con la clave de respaldo del hogar
/// (SPEC §2.5). La clave la genera el Admin; quien la conozca puede recuperar
/// la cuenta de un miembro SIN necesidad de una sesión activa (perdió la suya).
#[tauri::command]
pub fn auth_reset_password(
    state: AppStateRef,
    name: String,
    backup_key: String,
    new_password: String,
) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    let home = store.home.get()?;
    if home.backup_key != backup_key.trim() {
        return Err(AppError::unauthorized("La clave de respaldo no es válida"));
    }
    store.auth.reset_password(&name, &new_password)?;
    persist_now(&store);
    Ok(())
}

/// Regenera la contraseña de un miembro cuando no hay clave de respaldo
/// (SPEC §2.5): lo hace un Organizador/Admin desde Ajustes.
#[tauri::command]
pub fn auth_admin_reset_password(
    state: AppStateRef,
    by: String,
    name: String,
    new_password: String,
) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    crate::commands::require_role(&store, &by, Role::Organizador)?;
    store.auth.reset_password(&name, &new_password)?;
    persist_now(&store);
    Ok(())
}

/// Fija el PIN rápido de 4 dígitos para entrar desde un dispositivo conocido
/// (SPEC §2.3). La biometría nunca viaja al servidor; el PIN sí (hasheado).
/// Cada quien solo puede cambiar su propio PIN (o el Admin el de cualquier miembro).
#[tauri::command]
pub fn auth_set_pin(
    state: AppStateRef,
    by: String,
    name: String,
    pin: String,
) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    require_self_or_admin(&store, &by, &name)?;
    store.auth.set_pin(&name, &pin)?;
    persist_now(&store);
    Ok(())
}

/// Quita el PIN rápido de la cuenta (propia o la de cualquier miembro como Admin).
#[tauri::command]
pub fn auth_remove_pin(state: AppStateRef, by: String, name: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    require_self_or_admin(&store, &by, &name)?;
    store.auth.remove_pin(&name)?;
    persist_now(&store);
    Ok(())
}

/// ¿`by` es la misma cuenta que `name`, o es Admin del hogar? (SPEC §2.3/§3.2).
pub fn require_self_or_admin(store: &store::AppStore, by: &str, name: &str) -> Result<(), AppError> {
    if by.trim() == name.trim() {
        return Ok(());
    }
    let home = store.home.get().ok();
    let is_admin = home
        .as_ref()
        .map(|h| {
            h.member(by)
                .map(|m| m.role == Role::Admin)
                .unwrap_or(false)
        })
        .unwrap_or(false);
    if is_admin {
        Ok(())
    } else {
        Err(AppError::unauthorized(
            "Solo puedes configurar tu propio PIN (o el de un miembro como Admin)",
        ))
    }
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
    persist_now(&store);
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}

/// Entrada del modo host (SPEC §2.3): el quiosco entra sin credenciales si el
/// Admin activó `hostMode` y quien tiene la llave del hogar la introduce. Abre
/// sesión con la cuenta `admin` del hogar.
#[tauri::command]
pub fn auth_host_login(
    state: AppStateRef,
    host_key: String,
    device: String,
) -> Result<AuthView, AppError> {
    let mut store = store::lock(&state.store)?;
    let rules = store.rules.rules();
    if !rules.host_mode {
        return Err(AppError::conflict(
            "El modo host está desactivado en las reglas de la familia",
        ));
    }
    let valid = rules
        .host_key
        .as_deref()
        .map(|k| k == host_key.trim())
        .unwrap_or(false);
    if !valid {
        return Err(AppError::unauthorized("La llave del modo host no es válida"));
    }
    let (user, token) = store.auth.session_for(
        crate::store::auth::DEFAULT_ACCOUNT,
        &device,
    )?;
    persist_now(&store);
    Ok(AuthView {
        user: user_view(&user),
        token,
    })
}
