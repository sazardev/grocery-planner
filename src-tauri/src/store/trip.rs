use std::collections::HashMap;

use crate::domain::trip::{ShoppingTrip, TripStatus};
use crate::error::AppError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TripStore {
    trips: HashMap<String, ShoppingTrip>,
}

impl TripStore {
    pub fn new() -> Self {
        Self {
            trips: HashMap::new(),
        }
    }

    pub fn create(&mut self, trip: ShoppingTrip) -> ShoppingTrip {
        self.trips.insert(trip.id.clone(), trip.clone());
        trip
    }

    pub fn list(&self) -> Vec<ShoppingTrip> {
        let mut trips: Vec<ShoppingTrip> = self.trips.values().cloned().collect();
        trips.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        trips
    }

    pub fn get(&self, id: &str) -> Result<ShoppingTrip, AppError> {
        self.trips
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Mandado {id} no encontrado")))
    }

    pub fn add_item(&mut self, id: &str, item_id: &str) -> Result<ShoppingTrip, AppError> {
        let trip = mutable(&mut self.trips, id)?;
        if !trip.item_ids.iter().any(|i| i == item_id) {
            trip.item_ids.push(item_id.to_string());
        }
        Ok(trip.clone())
    }

    pub fn remove_item(&mut self, id: &str, item_id: &str) -> Result<ShoppingTrip, AppError> {
        let trip = mutable(&mut self.trips, id)?;
        trip.item_ids.retain(|i| i != item_id);
        Ok(trip.clone())
    }

    pub fn assign(&mut self, id: &str, member: &str) -> Result<ShoppingTrip, AppError> {
        let member = member.trim();
        if member.is_empty() {
            return Err(AppError::invalid_input(
                "El miembro asignado es obligatorio",
            ));
        }
        let trip = mutable(&mut self.trips, id)?;
        trip.assigned_to = Some(member.to_string());
        Ok(trip.clone())
    }

    pub fn set_status(&mut self, id: &str, status: TripStatus) -> Result<ShoppingTrip, AppError> {
        let trip = mutable(&mut self.trips, id)?;
        trip.status = status;
        Ok(trip.clone())
    }

    /// Confirma la recepción del mandado en casa (SPEC §6).
    pub fn confirm_received(&mut self, id: &str, by: &str) -> Result<ShoppingTrip, AppError> {
        let trip = self
            .trips
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Mandado {id} no encontrado")))?;
        trip.confirm_received(by)?;
        Ok(trip.clone())
    }

    /// Reemplaza todos los mandados (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, trips: Vec<ShoppingTrip>) {
        self.trips = trips.into_iter().map(|t| (t.id.clone(), t)).collect();
    }
}

fn mutable<'a>(
    trips: &'a mut HashMap<String, ShoppingTrip>,
    id: &str,
) -> Result<&'a mut ShoppingTrip, AppError> {
    let trip = trips
        .get_mut(id)
        .ok_or_else(|| AppError::not_found(format!("Mandado {id} no encontrado")))?;
    if matches!(trip.status, TripStatus::Completada | TripStatus::Cancelada) {
        return Err(AppError::conflict(format!(
            "El mandado está {}, no se puede modificar",
            trip.status.label()
        )));
    }
    Ok(trip)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> ShoppingTrip {
        ShoppingTrip::new("Mandado del domingo", Some("Walmart"), Some("Ana"), "Papá").unwrap()
    }

    #[test]
    fn crear_listar_y_obtener() {
        let mut store = TripStore::new();
        let trip = store.create(sample());
        assert_eq!(store.list().len(), 1);
        assert_eq!(store.get(&trip.id).unwrap().status, TripStatus::Planificada);
        assert_eq!(
            store.get(&trip.id).unwrap().assigned_to.as_deref(),
            Some("Ana")
        );
    }

    #[test]
    fn obtener_desconocido_es_error() {
        let store = TripStore::new();
        assert!(store.get("no-existe").is_err());
    }

    #[test]
    fn agregar_y_quitar_items_sin_duplicados() {
        let mut store = TripStore::new();
        let trip = store.create(sample());
        store.add_item(&trip.id, "item-1").unwrap();
        store.add_item(&trip.id, "item-2").unwrap();
        store.add_item(&trip.id, "item-1").unwrap();
        assert_eq!(store.get(&trip.id).unwrap().item_ids.len(), 2);
        store.remove_item(&trip.id, "item-1").unwrap();
        assert_eq!(
            store.get(&trip.id).unwrap().item_ids,
            vec!["item-2".to_string()]
        );
    }

    #[test]
    fn completado_no_es_modificable() {
        let mut store = TripStore::new();
        let trip = store.create(sample());
        let done = store.set_status(&trip.id, TripStatus::Completada).unwrap();
        assert_eq!(done.status, TripStatus::Completada);
        assert!(store.add_item(&trip.id, "item-1").is_err());
        assert!(store.assign(&trip.id, "Juan").is_err());
    }

    #[test]
    fn asignar_vacio_es_error() {
        let mut store = TripStore::new();
        let trip = store.create(sample());
        assert!(store.assign(&trip.id, "  ").is_err());
    }
}
