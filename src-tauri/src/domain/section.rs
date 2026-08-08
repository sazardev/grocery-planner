use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

/// Una sección nombrada de la lista (ej. "Desayunos", "Carnes", SPEC §4.4).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: String,
    pub name: String,
    pub position: u32,
}

impl Section {
    pub fn new(name: &str, position: u32) -> Result<Self, AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre de la sección es obligatorio",
            ));
        }
        if name.chars().count() > 50 {
            return Err(AppError::invalid_input(
                "El nombre de la sección no puede superar 50 caracteres",
            ));
        }
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            position,
        })
    }

    pub fn rename(&mut self, name: &str) -> Result<(), AppError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input(
                "El nombre de la sección es obligatorio",
            ));
        }
        self.name = name.to_string();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crear_y_renombrar() {
        let mut s = Section::new("Carnes", 0).unwrap();
        assert!(!s.id.is_empty());
        s.rename("Carnes y pollo").unwrap();
        assert_eq!(s.name, "Carnes y pollo");
    }

    #[test]
    fn nombre_vacio_es_error() {
        assert!(Section::new("  ", 0).is_err());
    }
}
