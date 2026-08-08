use serde::{Deserialize, Serialize};
use time::macros::format_description;
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

/// Frecuencia de repetición de un plan (SPEC §7.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Recurrence {
    #[default]
    Ninguna,
    Semanal,
    Quincenal,
    Mensual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
    Planificado,
    Activo,
    Completado,
    Cancelado,
}

/// Un plan de compra: cuándo se va a comprar, a dónde y quién (SPEC §7.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: String,
    pub title: String,
    /// Fecha y hora del plan en ISO 8601 (ej. `2026-08-15T09:00:00Z`).
    pub scheduled_at: String,
    pub store: Option<String>,
    pub assigned_to: Option<String>,
    pub note: Option<String>,
    pub recurrence: Recurrence,
    pub created_by: String,
    pub created_at: String,
    pub status: PlanStatus,
}

const DATETIME_FMT: &[time::format_description::FormatItem<'static>] =
    format_description!("[year]-[month]-[day]T[hour]:[minute]");

impl Plan {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        title: &str,
        scheduled_at: &str,
        store: Option<&str>,
        assigned_to: Option<&str>,
        note: Option<&str>,
        recurrence: Recurrence,
        created_by: &str,
    ) -> Result<Self, AppError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(AppError::invalid_input(
                "El título del plan es obligatorio",
            ));
        }
        let scheduled_at = scheduled_at.trim();
        time::PrimitiveDateTime::parse(scheduled_at, DATETIME_FMT)
            .map_err(|_| AppError::invalid_input(format!(
                "Fecha y hora inválidas (se espera AAAA-MM-DDTHH:MM): {scheduled_at}"
            )))?;
        let created_by = created_by.trim();
        if created_by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién crea el plan es obligatorio",
            ));
        }
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            scheduled_at: scheduled_at.to_string(),
            store: opt_str(store),
            assigned_to: opt_str(assigned_to),
            note: opt_str(note),
            recurrence,
            created_by: created_by.to_string(),
            created_at: now_iso(),
            status: PlanStatus::Planificado,
        })
    }
}

fn opt_str(s: Option<&str>) -> Option<String> {
    s.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crear_plan_valido() {
        let p = Plan::new(
            "Mandado del sábado",
            "2026-08-15T09:00",
            Some("Walmart"),
            Some("Ana"),
            None,
            Recurrence::Semanal,
            "Papá",
        )
        .unwrap();
        assert_eq!(p.scheduled_at, "2026-08-15T09:00");
        assert_eq!(p.status, PlanStatus::Planificado);
        assert_eq!(p.recurrence, Recurrence::Semanal);
        assert_eq!(p.assigned_to.as_deref(), Some("Ana"));
    }

    #[test]
    fn fechas_invalidas() {
        assert!(Plan::new("X", "15-08-2026 09:00", None, None, None, Recurrence::Ninguna, "Papá").is_err());
        assert!(Plan::new("", "2026-08-15T09:00", None, None, None, Recurrence::Ninguna, "Papá").is_err());
        assert!(Plan::new("X", "2026-08-15T09:00", None, None, None, Recurrence::Ninguna, "  ").is_err());
    }
}
