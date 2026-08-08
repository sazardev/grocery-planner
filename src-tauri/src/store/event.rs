use std::collections::HashMap;

use crate::domain::event::Event;
use crate::error::AppError;

/// Repositorio en memoria del calendario familiar (fase 1).
pub struct EventStore {
    events: HashMap<String, Event>,
}

impl EventStore {
    pub fn new() -> Self {
        Self {
            events: HashMap::new(),
        }
    }

    pub fn create(&mut self, event: Event) -> Event {
        self.events.insert(event.id.clone(), event.clone());
        event
    }

    pub fn list(&self) -> Vec<Event> {
        let mut events: Vec<Event> = self.events.values().cloned().collect();
        events.sort_by(|a, b| a.date.cmp(&b.date).then(a.created_at.cmp(&b.created_at)));
        events
    }

    /// Eventos cuyo día cae dentro de [start, end] inclusive (SPEC §9.3).
    pub fn list_in_range(&self, start: &str, end: &str) -> Vec<Event> {
        self.list().into_iter().filter(|e| e.in_range(start, end)).collect()
    }

    pub fn get(&self, id: &str) -> Result<Event, AppError> {
        self.events
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Evento {id} no encontrado")))
    }

    pub fn delete(&mut self, id: &str) -> Result<(), AppError> {
        if self.events.remove(id).is_none() {
            return Err(AppError::not_found(format!("Evento {id} no encontrado")));
        }
        Ok(())
    }

    /// Agrega un ítem a la lista del evento (SPEC §9.4), sin duplicados.
    pub fn add_item(&mut self, id: &str, item_id: &str) -> Result<Event, AppError> {
        let event = self
            .events
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Evento {id} no encontrado")))?;
        if !event.item_ids.iter().any(|i| i == item_id) {
            event.item_ids.push(item_id.to_string());
        }
        Ok(event.clone())
    }

    pub fn remove_item(&mut self, id: &str, item_id: &str) -> Result<Event, AppError> {
        let event = self
            .events
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Evento {id} no encontrado")))?;
        event.item_ids.retain(|i| i != item_id);
        Ok(event.clone())
    }

    /// Reemplaza todos los eventos (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, events: Vec<Event>) {
        self.events = events.into_iter().map(|e| (e.id.clone(), e)).collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::event::EventType;

    fn sample(day: &str) -> Event {
        Event::new(day, day, None, true, EventType::Comida, None, vec![], None, false, "Papá").unwrap()
    }

    #[test]
    fn crear_y_listar_ordenado() {
        let mut store = EventStore::new();
        store.create(sample("2026-08-25"));
        store.create(sample("2026-08-10"));
        let list = store.list();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].date, "2026-08-10");
    }

    #[test]
    fn filtrar_por_rango() {
        let mut store = EventStore::new();
        store.create(sample("2026-08-10"));
        store.create(sample("2026-09-01"));
        assert_eq!(store.list_in_range("2026-08-01", "2026-08-31").len(), 1);
    }

    #[test]
    fn items_del_evento_sin_duplicados() {
        let mut store = EventStore::new();
        let e = store.create(sample("2026-08-10"));
        store.add_item(&e.id, "item-1").unwrap();
        store.add_item(&e.id, "item-1").unwrap();
        assert_eq!(store.get(&e.id).unwrap().item_ids.len(), 1);
        store.remove_item(&e.id, "item-1").unwrap();
        assert!(store.get(&e.id).unwrap().item_ids.is_empty());
    }

    #[test]
    fn borrar_y_no_encontrado() {
        let mut store = EventStore::new();
        let e = store.create(sample("2026-08-10"));
        assert!(store.delete(&e.id).is_ok());
        assert!(store.delete(&e.id).is_err());
    }
}
