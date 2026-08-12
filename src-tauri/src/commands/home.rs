use serde::Serialize;

use crate::domain::home::{Home, Invitation, Member, Role};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeView {
    pub id: String,
    pub name: String,
    pub created_by: String,
    pub created_at: String,
    pub backup_key: String,
    pub members: Vec<Member>,
    pub invitations: Vec<Invitation>,
}

fn to_view(home: &Home) -> HomeView {
    HomeView {
        id: home.id.clone(),
        name: home.name.clone(),
        created_by: home.created_by.clone(),
        created_at: home.created_at.clone(),
        backup_key: home.backup_key.clone(),
        members: home.members(),
        invitations: home.invitations(),
    }
}

/// Vista del hogar para `who`: la clave de respaldo solo la ven los Admin
/// (SPEC §3.2). Quien no es miembro obtiene `None`.
fn to_view_for(home: &Home, who: &str) -> Option<HomeView> {
    let member = home.member(who)?;
    let view = to_view(home);
    Some(HomeView {
        backup_key: if member.role == Role::Admin {
            view.backup_key
        } else {
            String::new()
        },
        ..view
    })
}

/// Crea el hogar de la familia; el primer miembro queda como Admin (SPEC §3.1).
#[tauri::command]
pub fn home_create(state: AppStateRef, name: String, owner: String) -> Result<HomeView, AppError> {
    let mut store = store::lock(&state.store)?;
    // SPEC §3.6: un miembro = un hogar. Crear un segundo hogar estando ya en
    // uno reemplazaría al primero (el store guarda un solo hogar) y dejaría
    // huérfanos a sus miembros → se rechaza.
    if store.auth.home_of(&owner).is_some() {
        return Err(AppError::conflict(
            "Ya perteneces a un hogar; un miembro solo puede estar en uno (SPEC §3.6)",
        ));
    }
    let home = Home::create(&name, &owner)?;
    let home = store.home.create(home);
    store.auth.link_home(&owner, &home.id);
    Ok(to_view(&home))
}

/// Datos del hogar: nombre, miembros, invitaciones y clave de respaldo. La clave
/// solo se devuelve al Admin; quien no es miembro no ve nada del hogar (SPEC §3.2/§15).
#[tauri::command]
pub fn home_info(state: AppStateRef, by: String) -> Result<HomeView, AppError> {
    let store = store::lock(&state.store)?;
    // 404 (no 401) si no perteneces al hogar: el 401 global del front cierra la
    // sesión y un miembro sin hogar se quedaría fuera. 404 no revela existencia.
    to_view_for(store.home.get()?, &by)
        .ok_or_else(|| AppError::not_found("Todavía no se crea el hogar"))
}

/// Agrega un miembro al hogar con un rol (solo Admin, SPEC §3.5). El miembro
/// debe tener una cuenta para poder entrar después.
#[tauri::command]
pub fn home_add_member(
    state: AppStateRef,
    name: String,
    role: Role,
    by: String,
) -> Result<Member, AppError> {
    let mut store = store::lock(&state.store)?;
    if !store.auth.account_exists(&name) {
        return Err(AppError::invalid_input(format!(
            "No existe una cuenta con el nombre {name}"
        )));
    }
    store.home.add_member(&name, role, &by)
}

/// Expulsa a un miembro del hogar (solo Admin, SPEC §3.5).
#[tauri::command]
pub fn home_remove_member(state: AppStateRef, name: String, by: String) -> Result<(), AppError> {
    let mut store = store::lock(&state.store)?;
    store.home.remove_member(&name, &by)
}

/// Cambia el rol de un miembro (solo Admin, SPEC §3.5).
#[tauri::command]
pub fn home_change_role(
    state: AppStateRef,
    name: String,
    role: Role,
    by: String,
) -> Result<Member, AppError> {
    let mut store = store::lock(&state.store)?;
    store.home.change_role(&name, role, &by)
}

/// Genera una invitación (enlace + QR + código corto, SPEC §3.3).
#[tauri::command]
pub fn home_invite_create(
    state: AppStateRef,
    by: String,
    role_granted: Role,
    expires_in_secs: Option<i64>,
    max_uses: Option<u32>,
) -> Result<Invitation, AppError> {
    let mut store = store::lock(&state.store)?;
    store
        .home
        .create_invitation(&by, role_granted, expires_in_secs, max_uses)
}

/// Revoca una invitación (los enlaces viejos dejan de servir, SPEC §3.3).
#[tauri::command]
pub fn home_invite_revoke(state: AppStateRef, id: String, by: String) -> Result<Invitation, AppError> {
    let mut store = store::lock(&state.store)?;
    store.home.revoke_invitation(&id, &by)
}

/// Acepta una invitación por token (enlace/QR) o código corto (SPEC §3.3).
#[tauri::command]
pub fn home_invite_accept(
    state: AppStateRef,
    code: String,
    member: String,
) -> Result<Member, AppError> {
    let mut store = store::lock(&state.store)?;
    if !store.auth.account_exists(&member) {
        return Err(AppError::unauthorized(
            "Crea tu cuenta antes de aceptar una invitación",
        ));
    }
    let home = store.home.get()?;
    let home_id = home.id.clone();
    let member = store.home.accept_invitation(&code, &member)?;
    store.auth.link_home(&member.name, &home_id);
    Ok(member)
}

/// Regenera la clave de respaldo del hogar (solo Admin, SPEC §2.5).
#[tauri::command]
pub fn home_backup_key_regenerate(
    state: AppStateRef,
    by: String,
) -> Result<String, AppError> {
    let mut store = store::lock(&state.store)?;
    store.home.regenerate_backup_key(&by)
}
