use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

/// Rol de un miembro dentro del hogar (SPEC §3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Miembro,
    Organizador,
    Admin,
}

impl Role {
    pub fn label(self) -> &'static str {
        match self {
            Self::Miembro => "Miembro",
            Self::Organizador => "Organizador",
            Self::Admin => "Admin",
        }
    }

    /// Orden jerárquico para comparar permisos (SPEC §3.2).
    pub fn rank(self) -> u8 {
        match self {
            Self::Miembro => 0,
            Self::Organizador => 1,
            Self::Admin => 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub name: String,
    pub role: Role,
    pub added_by: String,
    pub joined_at: String,
}

/// Invitación al hogar (enlace + QR + código corto, SPEC §3.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invitation {
    pub id: String,
    /// Token del enlace/QR: `https://casa:8787/join#<token>`.
    pub token: String,
    /// Código corto de 6 dígitos para dictar por teléfono (ej. `492-113`).
    pub code: String,
    pub role_granted: Role,
    /// `None` = nunca expira.
    pub expires_at: Option<String>,
    /// `None` = ilimitado.
    pub max_uses: Option<u32>,
    pub uses: u32,
    pub revoked: bool,
    pub created_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Home {
    pub id: String,
    pub name: String,
    pub created_by: String,
    pub created_at: String,
    /// Clave de respaldo del hogar para recuperar cuentas (SPEC §2.5).
    pub backup_key: String,
    members: HashMap<String, Member>,
    invitations: HashMap<String, Invitation>,
}

impl Home {
    pub fn create(name: &str, owner: &str) -> Result<Self, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre del hogar es obligatorio",
            ));
        }
        if name.chars().count() > 100 {
            return Err(AppError::invalid_input(
                "El nombre del hogar no puede superar 100 caracteres",
            ));
        }
        let owner = owner.trim();
        if owner.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre del primer miembro es obligatorio",
            ));
        }
        let now = now_iso();
        let mut members = HashMap::new();
        members.insert(
            owner.to_string(),
            Member {
                name: owner.to_string(),
                role: Role::Admin,
                added_by: owner.to_string(),
                joined_at: now.clone(),
            },
        );
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            created_by: owner.to_string(),
            created_at: now,
            backup_key: Uuid::new_v4().to_string(),
            members,
            invitations: HashMap::new(),
        })
    }

    pub fn members(&self) -> Vec<Member> {
        let mut members: Vec<Member> = self.members.values().cloned().collect();
        members.sort_by(|a, b| a.joined_at.cmp(&b.joined_at));
        members
    }

    pub fn member(&self, name: &str) -> Option<Member> {
        self.members.get(name.trim()).cloned()
    }

    pub fn add_member(&mut self, name: &str, role: Role, by: &str) -> Result<Member, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre del miembro es obligatorio",
            ));
        }
        self.require_admin(by)?;
        if self.members.contains_key(name) {
            return Err(AppError::conflict(format!(
                "El miembro {name} ya está en el hogar"
            )));
        }
        let member = Member {
            name: name.to_string(),
            role,
            added_by: by.trim().to_string(),
            joined_at: now_iso(),
        };
        self.members.insert(name.to_string(), member.clone());
        Ok(member)
    }

    /// Expulsa a un miembro (solo Admin). No se puede expulsar al último Admin.
    pub fn remove_member(&mut self, name: &str, by: &str) -> Result<(), AppError> {
        let name = name.trim();
        self.require_admin(by)?;
        let member = self
            .members
            .get(name)
            .ok_or_else(|| AppError::not_found(format!("Miembro {name} no está en el hogar")))?;
        if member.role == Role::Admin {
            let admins = self
                .members
                .values()
                .filter(|m| m.role == Role::Admin)
                .count();
            if admins <= 1 {
                return Err(AppError::conflict(
                    "No se puede expulsar al último Admin del hogar",
                ));
            }
        }
        self.members.remove(name);
        Ok(())
    }

    /// Cambia el rol de un miembro (solo Admin). El último Admin no se degrada.
    pub fn change_role(&mut self, name: &str, role: Role, by: &str) -> Result<Member, AppError> {
        self.require_admin(by)?;
        let name = name.trim();
        if !self.members.contains_key(name) {
            return Err(AppError::not_found(format!(
                "Miembro {name} no está en el hogar"
            )));
        }
        let is_admin = self.members[name].role == Role::Admin;
        if is_admin && role != Role::Admin {
            let admins = self
                .members
                .values()
                .filter(|m| m.role == Role::Admin)
                .count();
            if admins <= 1 {
                return Err(AppError::conflict(
                    "No se puede degradar al último Admin del hogar",
                ));
            }
        }
        let member = self.members.get_mut(name).expect("miembro verificado");
        member.role = role;
        Ok(member.clone())
    }

    /// Genera una invitación con enlace, QR (mismo token) y código corto (SPEC §3.3).
    ///
    /// `expires_in_secs`: `None` = nunca caduca. `max_uses`: `None` = ilimitado.
    pub fn create_invitation(
        &mut self,
        by: &str,
        role_granted: Role,
        expires_in_secs: Option<i64>,
        max_uses: Option<u32>,
    ) -> Result<Invitation, AppError> {
        self.require_admin(by)?;
        if let Some(uses) = max_uses {
            if uses == 0 {
                return Err(AppError::invalid_input(
                    "El límite de usos debe ser mayor que 0",
                ));
            }
        }
        if let Some(secs) = expires_in_secs {
            if secs <= 0 {
                return Err(AppError::invalid_input(
                    "La caducidad debe ser mayor que 0 segundos",
                ));
            }
        }
        let invitation = Invitation {
            id: Uuid::new_v4().to_string(),
            token: Uuid::new_v4().simple().to_string(),
            code: gen_invite_code(),
            role_granted,
            expires_at: expires_in_secs.map(|s| {
                time::OffsetDateTime::now_utc()
                    + time::Duration::seconds(s)
            })
            .map(|t| {
                t.format(&time::format_description::well_known::Rfc3339)
                    .unwrap_or_default()
            }),
            max_uses,
            uses: 0,
            revoked: false,
            created_by: by.trim().to_string(),
            created_at: now_iso(),
        };
        self.invitations.insert(invitation.id.clone(), invitation.clone());
        Ok(invitation)
    }

    pub fn invitations(&self) -> Vec<Invitation> {
        let mut list: Vec<Invitation> = self.invitations.values().cloned().collect();
        list.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        list
    }

    pub fn revoke_invitation(&mut self, id: &str, by: &str) -> Result<Invitation, AppError> {
        self.require_admin(by)?;
        let inv = self
            .invitations
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Invitación {id} no encontrada")))?;
        inv.revoked = true;
        Ok(inv.clone())
    }

    /// Acepta una invitación por token (enlace/QR) o por código corto. Agrega al
    /// miembro con el rol que otorga la invitación (SPEC §3.2 y §3.3).
    pub fn accept_invitation(&mut self, code_or_token: &str, member: &str) -> Result<Member, AppError> {
        let code_or_token = code_or_token.trim();
        let inv = self
            .invitations
            .values_mut()
            .find(|i| i.token == code_or_token || i.code == code_or_token)
            .ok_or_else(|| AppError::not_found("Invitación no encontrada o no válida"))?;
        if inv.revoked {
            return Err(AppError::conflict("La invitación fue revocada"));
        }
        if let Some(exp) = &inv.expires_at {
            if exp.as_str() < now_iso().as_str() {
                return Err(AppError::conflict("La invitación ya caducó"));
            }
        }
        if let Some(max) = inv.max_uses {
            if inv.uses >= max {
                return Err(AppError::conflict(
                    "La invitación alcanzó su límite de usos",
                ));
            }
        }
        let role = inv.role_granted;
        let member_name = member.trim().to_string();
        if self.members.contains_key(&member_name) {
            return Err(AppError::conflict(format!(
                "El miembro {member_name} ya está en el hogar"
            )));
        }
        let member = Member {
            name: member_name.clone(),
            role,
            added_by: "invitación".to_string(),
            joined_at: now_iso(),
        };
        inv.uses += 1;
        self.members.insert(member_name, member.clone());
        Ok(member)
    }

    /// Regenera la clave de respaldo del hogar (SPEC §2.5).
    pub fn regenerate_backup_key(&mut self, by: &str) -> Result<String, AppError> {
        self.require_admin(by)?;
        self.backup_key = Uuid::new_v4().to_string();
        Ok(self.backup_key.clone())
    }

    fn require_admin(&self, by: &str) -> Result<(), AppError> {
        let actor = self
            .members
            .get(by.trim())
            .ok_or_else(|| AppError::not_found(format!("Miembro {by} no está en el hogar")))?;
        if actor.role != Role::Admin {
            return Err(AppError::conflict(
                "Solo un Admin del hogar puede hacer esto",
            ));
        }
        Ok(())
    }

    /// Exige un rol mínimo (Organizador/Admin) para acciones de organización
    /// (SPEC §3.2 y §14): secciones, planes, reglas y reordenar la lista.
    pub fn require_role(&self, by: &str, min: Role) -> Result<(), AppError> {
        let actor = self
            .members
            .get(by.trim())
            .ok_or_else(|| AppError::not_found(format!("Miembro {by} no está en el hogar")))?;
        if actor.role.rank() < min.rank() {
            return Err(AppError::conflict(format!(
                "Se requiere al menos el rol {} para esto",
                min.label()
            )));
        }
        Ok(())
    }
}

/// Genera un código corto de 6 dígitos con formato `492-113` (SPEC §3.3).
fn gen_invite_code() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    Uuid::new_v4().hash(&mut hasher);
    let n = hasher.finish() % 1_000_000;
    let digits = format!("{n:06}");
    format!("{}-{}", &digits[..3], &digits[3..])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_home() -> Home {
        Home::create("Los Ramírez", "Papá").unwrap()
    }

    #[test]
    fn crear_hogar_con_admin() {
        let home = sample_home();
        assert_eq!(home.name, "Los Ramírez");
        assert_eq!(home.members().len(), 1);
        assert_eq!(home.members()[0].role, Role::Admin);
        assert!(!home.backup_key.is_empty());
    }

    #[test]
    fn nombre_y_owner_obligatorios() {
        assert!(Home::create("  ", "Papá").is_err());
        assert!(Home::create("Los Ramírez", "  ").is_err());
    }

    #[test]
    fn agregar_y_expulsar_miembros() {
        let mut home = sample_home();
        let m = home.add_member("Ana", Role::Organizador, "Papá").unwrap();
        assert_eq!(m.role, Role::Organizador);
        assert!(home.members().iter().any(|m| m.name == "Ana"));
        home.remove_member("Ana", "Papá").unwrap();
        assert!(!home.members().iter().any(|m| m.name == "Ana"));
    }

    #[test]
    fn roles_controlan_permisos() {
        let mut home = sample_home();
        home.add_member("Ana", Role::Organizador, "Papá").unwrap();
        home.add_member("Luis", Role::Miembro, "Papá").unwrap();
        // Admin y Organizador sí pueden organizar.
        assert!(home.require_role("Papá", Role::Organizador).is_ok());
        assert!(home.require_role("Ana", Role::Organizador).is_ok());
        // Un miembro común no.
        assert!(home.require_role("Luis", Role::Organizador).is_err());
        // Nadie fuera del hogar.
        assert!(home.require_role("Forastero", Role::Organizador).is_err());
    }

    #[test]
    fn expulsar_ultimo_admin_bloqueado() {
        let mut home = sample_home();
        assert!(home.remove_member("Papá", "Papá").is_err());
        assert!(home.change_role("Papá", Role::Miembro, "Papá").is_err());
    }

    #[test]
    fn solo_admin_gestiona() {
        let mut home = sample_home();
        home.add_member("Ana", Role::Miembro, "Papá").unwrap();
        assert!(home.add_member("Juan", Role::Miembro, "Ana").is_err());
        assert!(home.remove_member("Ana", "Ana").is_err());
    }

    #[test]
    fn invitacion_ciclo_completo() {
        let mut home = sample_home();
        let inv = home
            .create_invitation("Papá", Role::Miembro, None, None)
            .unwrap();
        assert_eq!(inv.code.len(), 7);
        let member = home.accept_invitation(&inv.code, "Abuela").unwrap();
        assert_eq!(member.role, Role::Miembro);
        assert!(home.members().iter().any(|m| m.name == "Abuela"));
        assert_eq!(home.invitations()[0].uses, 1);
    }

    #[test]
    fn invitacion_con_limite_de_usos() {
        let mut home = sample_home();
        let inv = home
            .create_invitation("Papá", Role::Miembro, None, Some(1))
            .unwrap();
        home.accept_invitation(&inv.code, "Abuela").unwrap();
        assert!(home.accept_invitation(&inv.code, "Tío").is_err());
    }

    #[test]
    fn invitacion_revocada_no_sirve() {
        let mut home = sample_home();
        let inv = home.create_invitation("Papá", Role::Miembro, None, None).unwrap();
        home.revoke_invitation(&inv.id, "Papá").unwrap();
        assert!(home.accept_invitation(&inv.token, "Abuela").is_err());
    }

    #[test]
    fn invitacion_caducada_no_sirve() {
        let mut home = sample_home();
        let mut inv = home
            .create_invitation("Papá", Role::Miembro, Some(60), None)
            .unwrap();
        inv.expires_at = Some("2000-01-01T00:00:00Z".to_string());
        let code = inv.code.clone();
        let id = inv.id.clone();
        home.invitations.insert(id, inv);
        assert!(home.accept_invitation(&code, "Abuela").is_err());
    }

    #[test]
    fn backup_key_se_regenera() {
        let mut home = sample_home();
        let old = home.backup_key.clone();
        let new = home.regenerate_backup_key("Papá").unwrap();
        assert_ne!(old, new);
    }

    #[test]
    fn aceptar_por_token_o_codigo() {
        let mut home = sample_home();
        let inv = home.create_invitation("Papá", Role::Miembro, None, None).unwrap();
        home.accept_invitation(&inv.token, "Ana").unwrap();
        assert!(home.accept_invitation(&inv.code, "Ana").is_err());
    }
}
