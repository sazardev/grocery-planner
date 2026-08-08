use std::collections::HashMap;

use crate::domain::section::Section;
use crate::error::AppError;

/// Repositorio en memoria de las secciones de la lista (SPEC §4.4).
pub struct SectionStore {
    sections: HashMap<String, Section>,
    next_position: u32,
}

impl SectionStore {
    pub fn new() -> Self {
        Self {
            sections: HashMap::new(),
            next_position: 0,
        }
    }

    pub fn create(&mut self, name: &str) -> Result<Section, AppError> {
        let section = Section::new(name, self.next_position)?;
        self.next_position += 1;
        self.sections.insert(section.id.clone(), section.clone());
        Ok(section)
    }

    pub fn list(&self) -> Vec<Section> {
        let mut sections: Vec<Section> = self.sections.values().cloned().collect();
        sections.sort_by_key(|s| s.position);
        sections
    }

    pub fn get(&self, id: &str) -> Result<Section, AppError> {
        self.sections
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Sección {id} no encontrada")))
    }

    pub fn rename(&mut self, id: &str, name: &str) -> Result<Section, AppError> {
        let section = self
            .sections
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Sección {id} no encontrada")))?;
        section.rename(name)?;
        Ok(section.clone())
    }

    pub fn delete(&mut self, id: &str) -> Result<(), AppError> {
        if self.sections.remove(id).is_none() {
            return Err(AppError::not_found(format!("Sección {id} no encontrada")));
        }
        Ok(())
    }

    /// Mueve una sección una posición (arriba/abajo) en la lista (SPEC §4.4).
    pub fn move_section(&mut self, id: &str, direction: MoveDirection) -> Result<Section, AppError> {
        if !self.sections.contains_key(id) {
            return Err(AppError::not_found(format!("Sección {id} no encontrada")));
        }
        let mut order = self.list();
        let idx = order
            .iter()
            .position(|s| s.id == id)
            .ok_or_else(|| AppError::not_found(format!("Sección {id} no encontrada")))?;
        let target = match direction {
            MoveDirection::Up => {
                if idx == 0 {
                    return Ok(self.sections.get(id).unwrap().clone());
                }
                idx - 1
            }
            MoveDirection::Down => {
                if idx + 1 >= order.len() {
                    return Ok(self.sections.get(id).unwrap().clone());
                }
                idx + 1
            }
        };
        order.swap(idx, target);
        for (i, section) in order.iter().enumerate() {
            if let Some(stored) = self.sections.get_mut(&section.id) {
                stored.position = i as u32;
            }
        }
        Ok(self.sections.get(id).unwrap().clone())
    }

    /// Reemplaza todas las secciones (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, sections: Vec<Section>) {
        self.sections = sections.into_iter().map(|s| (s.id.clone(), s)).collect();
        self.next_position = self
            .sections
            .values()
            .map(|s| s.position)
            .max()
            .map(|p| p + 1)
            .unwrap_or(0);
    }
}

/// Dirección de movimiento de una sección en la lista (SPEC §4.4).
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveDirection {
    Up,
    Down,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crear_listar_y_renombrar() {
        let mut store = SectionStore::new();
        let a = store.create("Desayunos").unwrap();
        let b = store.create("Carnes").unwrap();
        assert_eq!(store.list().len(), 2);
        assert!(a.position < b.position);
        let renamed = store.rename(&a.id, "Desayunos de los niños").unwrap();
        assert_eq!(renamed.name, "Desayunos de los niños");
    }

    #[test]
    fn borrar_y_validar() {
        let mut store = SectionStore::new();
        let s = store.create("Limpieza").unwrap();
        assert!(store.delete(&s.id).is_ok());
        assert!(store.delete(&s.id).is_err());
        assert!(store.create("  ").is_err());
    }
}
