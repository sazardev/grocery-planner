use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TripStatus {
    Planificada,
    Activa,
    Completada,
    Cancelada,
}

impl TripStatus {
    pub fn label(self) -> &'static str {
        match self {
            Self::Planificada => "planificada",
            Self::Activa => "activa",
            Self::Completada => "completada",
            Self::Cancelada => "cancelada",
        }
    }
}

/// Un mandado: salida de compras con quién la hace, a qué tienda y qué ítems
/// lleva (SPEC §4 y §5).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingTrip {
    pub id: String,
    pub title: String,
    pub store: Option<String>,
    pub assigned_to: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub status: TripStatus,
    pub item_ids: Vec<String>,
    /// Cuándo alguien de la casa confirmó que llegó el mandado (SPEC §6).
    pub received_at: Option<String>,
    /// Quién confirmó la recepción.
    pub received_by: Option<String>,
    /// Cuándo se marcó como completado (SPEC §8.1: "cuándo llegó").
    #[serde(default)]
    pub completed_at: Option<String>,
}

impl ShoppingTrip {
    pub fn new(
        title: &str,
        store: Option<&str>,
        assigned_to: Option<&str>,
        created_by: &str,
    ) -> Result<Self, AppError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(AppError::invalid_input(
                "El título del mandado es obligatorio",
            ));
        }
        let created_by = created_by.trim();
        if created_by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién crea el mandado es obligatorio",
            ));
        }
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            store: store
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            assigned_to: assigned_to
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            created_by: created_by.to_string(),
            created_at: now_iso(),
            status: TripStatus::Planificada,
            item_ids: Vec::new(),
            received_at: None,
            received_by: None,
            completed_at: None,
        })
    }

    /// Confirma la recepción del mandado cuando llega a casa (SPEC §6).
    /// Solo se puede confirmar un mandado completado.
    pub fn confirm_received(&mut self, by: &str) -> Result<(), AppError> {
        let by = by.trim();
        if by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién confirma la recepción es obligatorio",
            ));
        }
        if self.status != TripStatus::Completada {
            return Err(AppError::conflict(
                "Solo se confirma la recepción de un mandado completado",
            ));
        }
        if self.received_at.is_some() {
            return Err(AppError::conflict(
                "Este mandado ya se marcó como recibido",
            ));
        }
        self.received_at = Some(now_iso());
        self.received_by = Some(by.to_string());
        Ok(())
    }
}
