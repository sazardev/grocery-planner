use std::collections::HashMap;

use crate::domain::item::{GroceryItem, ItemComment, ItemEvent, ItemStatus, Priority};
use crate::error::AppError;

/// Repositorio en memoria de ítems. La persistencia real (sqlx/diesel) llega en
/// la fase 2; esta capa aísla los commands del almacenamiento.
pub struct ItemStore {
    items: HashMap<String, GroceryItem>,
}

impl ItemStore {
    pub fn new() -> Self {
        Self {
            items: HashMap::new(),
        }
    }

    pub fn create(&mut self, item: GroceryItem) -> GroceryItem {
        self.items.insert(item.id.clone(), item.clone());
        item
    }

    pub fn list(&self) -> Vec<GroceryItem> {
        let mut items: Vec<GroceryItem> = self.items.values().cloned().collect();
        items.sort_by(|a, b| a.position.total_cmp(&b.position));
        items
    }

    pub fn get(&self, id: &str) -> Result<GroceryItem, AppError> {
        self.items
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))
    }

    pub fn change_status(
        &mut self,
        id: &str,
        to: ItemStatus,
        by: &str,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.change_status(to, by)?;
        Ok(item.clone())
    }

    pub fn assign(&mut self, id: &str, member: &str, by: &str) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.assign(member, by)?;
        Ok(item.clone())
    }

    pub fn cancel(
        &mut self,
        id: &str,
        by: &str,
        reason: Option<&str>,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.cancel(by, reason)?;
        Ok(item.clone())
    }

    pub fn history(&self, id: &str) -> Result<Vec<ItemEvent>, AppError> {
        let item = self
            .items
            .get(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        Ok(item.history.clone())
    }

    /// Edita los campos de un ítem (SPEC §3.1).
    #[allow(clippy::too_many_arguments)]
    pub fn update(
        &mut self,
        id: &str,
        by: &str,
        name: Option<&str>,
        quantity: Option<f64>,
        unit: Option<&str>,
        priority: Option<Priority>,
        note: Option<&str>,
        category: Option<&str>,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.update(by, name, quantity, unit, priority, note, category)?;
        Ok(item.clone())
    }

    /// Cambia la prioridad de un ítem.
    pub fn set_priority(
        &mut self,
        id: &str,
        priority: Priority,
        by: &str,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.set_priority(priority, by)?;
        Ok(item.clone())
    }

    /// Mueve un ítem a una posición absoluta (orden manual, SPEC §3.4).
    pub fn set_position(&mut self, id: &str, position: f64) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.set_position(position);
        Ok(item.clone())
    }

    /// Mueve un ítem una posición relativa en la lista (arriba/abajo).
    pub fn move_item(
        &mut self,
        id: &str,
        direction: MoveDirection,
    ) -> Result<GroceryItem, AppError> {
        if !self.items.contains_key(id) {
            return Err(AppError::not_found(format!("Ítem {id} no encontrado")));
        }
        let mut order = self.list();
        let idx = order
            .iter()
            .position(|it| it.id == id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;

        let target = match direction {
            MoveDirection::Up => {
                if idx == 0 {
                    return Ok(self.items.get(id).unwrap().clone());
                }
                idx - 1
            }
            MoveDirection::Down => {
                if idx + 1 >= order.len() {
                    return Ok(self.items.get(id).unwrap().clone());
                }
                idx + 1
            }
        };

        order.swap(idx, target);
        // Reasigna posiciones enteras en el nuevo orden.
        for (i, item) in order.iter().enumerate() {
            if let Some(store_item) = self.items.get_mut(&item.id) {
                store_item.set_position(i as f64);
            }
        }
        Ok(self.items.get(id).unwrap().clone())
    }

    /// Elimina un ítem de la lista (SPEC §3.1: "quitar"; sin persistencia real en fase 1).
    pub fn delete(&mut self, id: &str) -> Result<(), AppError> {
        self.items
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))
    }

    /// Agrega un comentario al ítem (SPEC §4.6 y §11.3).
    pub fn add_comment(
        &mut self,
        id: &str,
        by: &str,
        body: &str,
    ) -> Result<ItemComment, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.add_comment(by, body)
    }

    /// Fija el precio aproximado del ítem (SPEC §8.2).
    pub fn set_price(&mut self, id: &str, price: f64) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.set_price(price)?;
        Ok(item.clone())
    }

    /// Mueve el ítem a una sección (SPEC §4.4). `section_id` debe existir en el
    /// store de secciones; la validación la hace la capa de commands.
    pub fn set_section(
        &mut self,
        id: &str,
        section_id: &str,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.set_section(section_id)?;
        Ok(item.clone())
    }

    /// Fija la tienda del ítem (SPEC §4.1 y §5.4).
    pub fn set_store(&mut self, id: &str, store: &str) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.set_store(store)?;
        Ok(item.clone())
    }

    /// Agrega una foto al ítem respetando el límite de la familia (SPEC §10).
    pub fn add_photo(
        &mut self,
        id: &str,
        photo: &str,
        limit: usize,
    ) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.add_photo(photo, limit)?;
        Ok(item.clone())
    }

    /// Quita una foto del ítem por índice (SPEC §10).
    pub fn remove_photo(&mut self, id: &str, index: usize) -> Result<GroceryItem, AppError> {
        let item = self
            .items
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Ítem {id} no encontrado")))?;
        item.remove_photo(index)?;
        Ok(item.clone())
    }

    /// Búsqueda y filtros combinables de la lista (SPEC §4.5).
    pub fn query(&self, q: &ItemQuery) -> Vec<GroceryItem> {
        let mut items: Vec<GroceryItem> = self
            .items
            .values()
            .filter(|it| matches(q, it))
            .cloned()
            .collect();
        sort_items(&mut items, q.sort);
        items
    }

    /// Reemplaza todos los ítems (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, items: Vec<GroceryItem>) {
        self.items = items.into_iter().map(|i| (i.id.clone(), i)).collect();
    }
}

/// Ordena los ítems según el criterio pedido (SPEC §4.4).
fn sort_items(items: &mut [GroceryItem], sort: Option<ItemSort>) {
    use std::cmp::Ordering;
    items.sort_by(|a, b| match sort.unwrap_or(ItemSort::Manual) {
        ItemSort::Manual => a.position.total_cmp(&b.position),
        ItemSort::Priority => match b.priority.cmp(&a.priority) {
            Ordering::Equal => a.position.total_cmp(&b.position),
            other => other,
        },
        ItemSort::Name => a.name.cmp(&b.name),
        ItemSort::Category => a
            .category
            .as_deref()
            .unwrap_or("")
            .cmp(b.category.as_deref().unwrap_or("")),
        ItemSort::RequestedBy => a.requested_by.cmp(&b.requested_by),
        ItemSort::Price => a
            .price
            .unwrap_or(f64::MAX)
            .total_cmp(&b.price.unwrap_or(f64::MAX)),
        ItemSort::Store => a
            .store
            .as_deref()
            .unwrap_or("")
            .cmp(b.store.as_deref().unwrap_or("")),
    });
}

/// Dirección en la que se mueve un ítem en la lista (orden manual).
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveDirection {
    Up,
    Down,
}

/// Criterio de orden de la lista (SPEC §4.4).
#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemSort {
    /// Orden manual (posición fijada por el Organizador).
    #[default]
    Manual,
    Priority,
    Name,
    Category,
    RequestedBy,
    Price,
    Store,
}

/// Filtros de búsqueda de la lista de compras (SPEC §4.5).
#[derive(Debug, Clone, Default)]
pub struct ItemQuery {
    pub search: Option<String>,
    pub status: Option<ItemStatus>,
    pub category: Option<String>,
    pub priority: Option<Priority>,
    pub section: Option<String>,
    pub requested_by: Option<String>,
    pub assigned_to: Option<String>,
    pub store: Option<String>,
    pub urgent: bool,
    pub only_comments: bool,
    /// Solo ítems con foto (SPEC §4.5 y §10).
    pub only_photos: bool,
    pub sort: Option<ItemSort>,
}

fn matches(q: &ItemQuery, item: &GroceryItem) -> bool {
    if let Some(status) = q.status {
        if item.status != status {
            return false;
        }
    }
    if let Some(category) = q.category.as_deref() {
        if item.category.as_deref() != Some(category) {
            return false;
        }
    }
    if let Some(priority) = q.priority {
        if item.priority != priority {
            return false;
        }
    }
    if let Some(section) = q.section.as_deref() {
        if item.section.as_deref() != Some(section) {
            return false;
        }
    }
    if let Some(member) = q.requested_by.as_deref() {
        if item.requested_by != member {
            return false;
        }
    }
    if let Some(member) = q.assigned_to.as_deref() {
        if item.assigned_to.as_deref() != Some(member) {
            return false;
        }
    }
    if let Some(store) = q.store.as_deref() {
        if item.store.as_deref() != Some(store) {
            return false;
        }
    }
    if q.urgent && item.priority != Priority::Urgente {
        return false;
    }
    if q.only_comments && item.comments.is_empty() {
        return false;
    }
    if q.only_photos && item.photos.is_empty() {
        return false;
    }
    if let Some(search) = q.search.as_deref() {
        let haystack = [
            item.name.as_str(),
            item.note.as_deref().unwrap_or(""),
            item.category.as_deref().unwrap_or(""),
            item.requested_by.as_str(),
        ]
        .join(" ")
        .to_lowercase();
        if !haystack.contains(&search.to_lowercase()) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::item::Priority;

    fn sample() -> GroceryItem {
        GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Ana", None, None).unwrap()
    }

    #[test]
    fn crear_listar_y_obtener() {
        let mut store = ItemStore::new();
        let a = store.create(sample());
        let b = store.create(sample());
        assert_eq!(store.list().len(), 2);
        assert_eq!(store.get(&a.id).unwrap().name, "pollo");
        assert_eq!(store.get(&b.id).unwrap().id, b.id);
    }

    #[test]
    fn obtener_desconocido_es_error() {
        let store = ItemStore::new();
        assert!(store.get("no-existe").is_err());
        assert!(store.history("no-existe").is_err());
    }

    #[test]
    fn transiciones_acumulan_historial() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        let pedido = store
            .change_status(&item.id, ItemStatus::Pedido, "Juan")
            .unwrap();
        assert_eq!(pedido.status, ItemStatus::Pedido);
        assert_eq!(pedido.history.len(), 2);
        let comprado = store
            .change_status(&item.id, ItemStatus::Comprado, "Juan")
            .unwrap();
        assert_eq!(comprado.history.len(), 3);
    }

    #[test]
    fn transicion_invalida_rechazada_sin_mutar() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        store
            .change_status(&item.id, ItemStatus::Comprado, "Juan")
            .unwrap();
        assert!(store
            .change_status(&item.id, ItemStatus::Falta, "Juan")
            .is_err());
        assert_eq!(store.get(&item.id).unwrap().status, ItemStatus::Comprado);
    }

    #[test]
    fn asignar_y_cancelar() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        let assigned = store.assign(&item.id, "Juan", "Ana").unwrap();
        assert_eq!(assigned.assigned_to.as_deref(), Some("Juan"));
        let cancelled = store
            .cancel(&item.id, "Ana", Some("ya había pollo"))
            .unwrap();
        assert_eq!(cancelled.status, ItemStatus::Cancelado);
        assert_eq!(cancelled.history.len(), 3);
        assert_eq!(store.history(&item.id).unwrap().len(), 3);
    }

    #[test]
    fn comentar_registra_en_historial() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        let comment = store
            .add_comment(&item.id, "Abuela", "que no sea el integral")
            .unwrap();
        assert_eq!(comment.by, "Abuela");
        let updated = store.get(&item.id).unwrap();
        assert_eq!(updated.comments.len(), 1);
        assert_eq!(updated.comments[0].body, "que no sea el integral");
        assert_eq!(updated.history.len(), 2);
        assert!(matches!(
            updated.history[1].kind,
            crate::domain::item::ItemEventKind::Commented { .. }
        ));
    }

    #[test]
    fn comentario_vacio_es_error() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        assert!(store.add_comment(&item.id, "Ana", "  ").is_err());
    }

    #[test]
    fn precio_y_seccion() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        store.set_price(&item.id, 12.5).unwrap();
        store.set_section(&item.id, "sec-1").unwrap();
        let updated = store.get(&item.id).unwrap();
        assert_eq!(updated.price, Some(12.5));
        assert_eq!(updated.section.as_deref(), Some("sec-1"));
    }

    #[test]
    fn query_filtra_y_busca() {
        let mut store = ItemStore::new();
        let mut pollo =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Urgente, "Ana", None, None).unwrap();
        pollo.category = Some("carnes".into());
        store.create(pollo);
        let mut leche =
            GroceryItem::new("leche", 1.0, "l", Priority::Baja, "Juan", None, None).unwrap();
        leche.category = Some("lácteos".into());
        store.create(leche);

        assert_eq!(store.list().len(), 2);
        assert_eq!(
            store
                .query(&ItemQuery {
                    search: Some("leche".into()),
                    ..Default::default()
                })
                .len(),
            1
        );
        assert_eq!(
            store
                .query(&ItemQuery {
                    urgent: true,
                    ..Default::default()
                })
                .len(),
            1
        );
        assert_eq!(
            store
                .query(&ItemQuery {
                    status: Some(ItemStatus::Falta),
                    category: Some("carnes".into()),
                    ..Default::default()
                })
                .len(),
            1
        );
        assert_eq!(
            store
                .query(&ItemQuery {
                    requested_by: Some("Juan".into()),
                    ..Default::default()
                })
                .len(),
            1
        );
    }

    #[test]
    fn editar_campos_registra_historial() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        let updated = store
            .update(&item.id, "Ana", Some("pollo entero"), None, None, None, None, None)
            .unwrap();
        assert_eq!(updated.name, "pollo entero");
        assert_eq!(updated.history.len(), 2);
        assert!(matches!(
            updated.history[1].kind,
            crate::domain::item::ItemEventKind::Updated { .. }
        ));

        let with_prio = store
            .update(
                &item.id,
                "Ana",
                None,
                Some(3.0),
                Some("kg"),
                Some(Priority::Urgente),
                Some("sin muslos"),
                None,
            )
            .unwrap();
        assert_eq!(with_prio.quantity, 3.0);
        assert_eq!(with_prio.unit, "kg");
        assert_eq!(with_prio.priority, Priority::Urgente);
        assert_eq!(with_prio.note.as_deref(), Some("sin muslos"));
    }

    #[test]
    fn editar_con_nombre_vacio_es_error() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        assert!(store
            .update(&item.id, "Ana", Some("  "), None, None, None, None, None)
            .is_err());
    }

    #[test]
    fn set_prioridad_registra_evento() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        let updated = store.set_priority(&item.id, Priority::Urgente, "Ana").unwrap();
        assert_eq!(updated.priority, Priority::Urgente);
        assert!(matches!(
            updated.history[1].kind,
            crate::domain::item::ItemEventKind::PriorityChanged { .. }
        ));
    }

    #[test]
    fn mover_arriba_y_abajo() {
        let mut store = ItemStore::new();
        let a = store.create(sample());
        let b = store.create(sample());
        let c = store.create(sample());

        // El orden inicial es por position (creación): a, b, c.
        let order = |s: &ItemStore| s.list().iter().map(|i| i.id.clone()).collect::<Vec<_>>();
        assert_eq!(order(&store), vec![a.id.clone(), b.id.clone(), c.id.clone()]);

        store.move_item(&c.id, MoveDirection::Up).unwrap();
        assert_eq!(order(&store), vec![a.id.clone(), c.id.clone(), b.id.clone()]);

        store.move_item(&a.id, MoveDirection::Down).unwrap();
        assert_eq!(order(&store), vec![c.id.clone(), a.id.clone(), b.id.clone()]);

        // En los extremos no cambia.
        store.move_item(&c.id, MoveDirection::Up).unwrap();
        assert_eq!(order(&store), vec![c.id.clone(), a.id.clone(), b.id.clone()]);
        store.move_item(&b.id, MoveDirection::Down).unwrap();
        assert_eq!(order(&store), vec![c.id.clone(), a.id.clone(), b.id.clone()]);
    }

    #[test]
    fn eliminar_quita_de_la_lista() {
        let mut store = ItemStore::new();
        let item = store.create(sample());
        assert_eq!(store.list().len(), 1);
        store.delete(&item.id).unwrap();
        assert_eq!(store.list().len(), 0);
        assert!(store.get(&item.id).is_err());
        assert!(store.delete(&item.id).is_err());
    }
}
