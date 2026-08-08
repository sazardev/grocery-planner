use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemStatus {
    Falta,
    Pedido,
    Llevo,
    Comprado,
    Cancelado,
}

impl ItemStatus {
    pub fn label(self) -> &'static str {
        match self {
            Self::Falta => "Falta",
            Self::Pedido => "Pedido",
            Self::Llevo => "Ya lo llevo",
            Self::Comprado => "Comprado",
            Self::Cancelado => "Cancelado",
        }
    }

    /// Estados a los que se puede pasar desde el actual (SPEC §3.3).
    pub fn next(self) -> &'static [Self] {
        match self {
            Self::Falta => &[Self::Pedido, Self::Llevo, Self::Comprado, Self::Cancelado],
            Self::Pedido => &[Self::Falta, Self::Llevo, Self::Comprado, Self::Cancelado],
            Self::Llevo => &[Self::Comprado, Self::Cancelado],
            Self::Comprado => &[Self::Cancelado],
            Self::Cancelado => &[Self::Falta],
        }
    }

    pub fn can_transition(self, to: Self) -> bool {
        self.next().contains(&to)
    }

    pub fn transition(self, to: Self) -> Result<Self, AppError> {
        if self.can_transition(to) {
            Ok(to)
        } else {
            Err(AppError::conflict(format!(
                "Transición no permitida: {} → {}",
                self.label(),
                to.label()
            )))
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Baja,
    Media,
    Alta,
    Urgente,
}

/// Un comentario de la familia sobre el ítem o su solicitud (SPEC §4.6 y §11.3).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemComment {
    pub id: String,
    pub at: String,
    pub by: String,
    pub body: String,
}

/// Un evento del historial de un ítem (SPEC §6.1: nada se borra de verdad).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemEvent {
    pub at: String,
    pub by: String,
    pub kind: ItemEventKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ItemEventKind {
    Created,
    StatusChanged {
        from: ItemStatus,
        to: ItemStatus,
    },
    Assigned {
        member: String,
    },
    Cancelled {
        from: ItemStatus,
        reason: Option<String>,
    },
    Commented {
        body: String,
    },
    /// El ítem fue editado (SPEC §3.1: cualquiera puede editar su propio ítem).
    Updated {
        fields: Vec<String>,
    },
    /// La prioridad del ítem cambió.
    PriorityChanged {
        from: Priority,
        to: Priority,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroceryItem {
    pub id: String,
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    pub status: ItemStatus,
    pub priority: Priority,
    pub requested_by: String,
    pub assigned_to: Option<String>,
    pub note: Option<String>,
    pub category: Option<String>,
    /// Precio aproximado para reportes de gasto (SPEC §4.1, §8.2).
    pub price: Option<f64>,
    /// Sección de la lista a la que pertenece (SPEC §4.4).
    pub section: Option<String>,
    /// Tienda donde se consigue (SPEC §4.1 y §5.4).
    pub store: Option<String>,
    /// Fotos del ítem como data URLs (SPEC §10).
    pub photos: Vec<String>,
    /// Posición en la lista para orden manual (SPEC §3.4). A menor valor, más arriba.
    pub position: f64,
    pub created_at: String,
    pub history: Vec<ItemEvent>,
    pub comments: Vec<ItemComment>,
}

impl GroceryItem {
    pub fn new(
        name: &str,
        quantity: f64,
        unit: &str,
        priority: Priority,
        requested_by: &str,
        note: Option<&str>,
        category: Option<&str>,
    ) -> Result<Self, AppError> {
        validate_new_item(name, quantity, unit)?;
        let requested_by = requested_by.trim();
        if requested_by.is_empty() {
            return Err(AppError::invalid_input("Quién lo pide es obligatorio"));
        }
        let now = super::now_iso();
        let position = super::now_epoch_millis();
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            name: name.trim().to_string(),
            quantity,
            unit: unit.trim().to_string(),
            status: ItemStatus::Falta,
            priority,
            requested_by: requested_by.to_string(),
            assigned_to: None,
            note: note
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            category: category
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            price: None,
            section: None,
            store: None,
            photos: Vec::new(),
            position,
            created_at: now.clone(),
            history: vec![ItemEvent {
                at: now,
                by: requested_by.to_string(),
                kind: ItemEventKind::Created,
            }],
            comments: Vec::new(),
        })
    }

    /// Edita los campos editables de un ítem (SPEC §3.1) registrando qué cambió.
    /// `None` en un campo significa "no lo toques"; `Some` aplica el cambio.
    pub fn update(
        &mut self,
        by: &str,
        name: Option<&str>,
        quantity: Option<f64>,
        unit: Option<&str>,
        priority: Option<Priority>,
        note: Option<&str>,
        category: Option<&str>,
    ) -> Result<(), AppError> {
        let by = by.trim();
        if by.is_empty() {
            return Err(AppError::invalid_input("Quién edita es obligatorio"));
        }

        let mut changed: Vec<String> = Vec::new();

        if let Some(name) = name {
            let name = name.trim();
            if name.is_empty() {
                return Err(AppError::invalid_input("El nombre no puede quedar vacío"));
            }
            if name.chars().count() > 200 {
                return Err(AppError::invalid_input(
                    "El nombre no puede superar 200 caracteres",
                ));
            }
            if self.name != name {
                self.name = name.to_string();
                changed.push("name".into());
            }
        }

        if let Some(quantity) = quantity {
            if !quantity.is_finite() || quantity <= 0.0 {
                return Err(AppError::invalid_input("La cantidad debe ser mayor que 0"));
            }
            if (self.quantity - quantity).abs() > f64::EPSILON {
                self.quantity = quantity;
                changed.push("quantity".into());
            }
        }

        if let Some(unit) = unit {
            let unit = unit.trim();
            if unit.is_empty() {
                return Err(AppError::invalid_input("La unidad es obligatoria"));
            }
            if self.unit != unit {
                self.unit = unit.to_string();
                changed.push("unit".into());
            }
        }

        if let Some(priority) = priority {
            if self.priority != priority {
                let from = self.priority;
                self.priority = priority;
                self.history.push(ItemEvent {
                    at: super::now_iso(),
                    by: by.to_string(),
                    kind: ItemEventKind::PriorityChanged { from, to: priority },
                });
                changed.push("priority".into());
            }
        }

        let apply_opt = |cur: &mut Option<String>, val: &str| -> bool {
            let trimmed = val.trim();
            let next = if trimmed.is_empty() { None } else { Some(trimmed.to_string()) };
            if *cur != next {
                *cur = next;
                true
            } else {
                false
            }
        };
        if let Some(note) = note {
            if apply_opt(&mut self.note, note) {
                changed.push("note".into());
            }
        }
        if let Some(category) = category {
            if apply_opt(&mut self.category, category) {
                changed.push("category".into());
            }
        }

        if !changed.is_empty() {
            self.history.push(ItemEvent {
                at: super::now_iso(),
                by: by.to_string(),
                kind: ItemEventKind::Updated {
                    fields: changed.clone(),
                },
            });
        }
        Ok(())
    }

    /// Cambia la prioridad (SPEC §3.3) con su evento.
    pub fn set_priority(&mut self, priority: Priority, by: &str) -> Result<(), AppError> {
        if self.priority == priority {
            return Ok(());
        }
        let from = self.priority;
        self.priority = priority;
        self.history.push(ItemEvent {
            at: super::now_iso(),
            by: by.to_string(),
            kind: ItemEventKind::PriorityChanged { from, to: priority },
        });
        Ok(())
    }

    /// Fija la posición en la lista (orden manual, SPEC §3.4).
    pub fn set_position(&mut self, position: f64) {
        self.position = position;
    }

    /// Fija el precio aproximado (para reportes de gasto, SPEC §8.2).
    pub fn set_price(&mut self, price: f64) -> Result<(), AppError> {
        if !price.is_finite() || price < 0.0 {
            return Err(AppError::invalid_input(
                "El precio debe ser un número mayor o igual que 0",
            ));
        }
        self.price = Some(price);
        Ok(())
    }

    /// Mueve el ítem a una sección de la lista (SPEC §4.4).
    pub fn set_section(&mut self, section: &str) -> Result<(), AppError> {
        let section = section.trim();
        if section.is_empty() {
            return Err(AppError::invalid_input(
                "La sección del ítem es obligatoria",
            ));
        }
        self.section = Some(section.to_string());
        Ok(())
    }

    /// Fija la tienda donde se consigue el ítem (SPEC §4.1 y §5.4).
    pub fn set_store(&mut self, store: &str) -> Result<(), AppError> {
        let store = store.trim();
        if store.is_empty() {
            return Err(AppError::invalid_input(
                "La tienda del ítem es obligatoria",
            ));
        }
        self.store = Some(store.to_string());
        Ok(())
    }

    /// Agrega una foto al ítem como data URL (SPEC §10).
    pub fn add_photo(&mut self, data_url: &str, limit: usize) -> Result<(), AppError> {
        let data_url = data_url.trim();
        if data_url.is_empty() {
            return Err(AppError::invalid_input("La foto es obligatoria"));
        }
        if self.photos.len() >= limit {
            return Err(AppError::conflict(format!(
                "Límite de {limit} fotos por ítem alcanzado"
            )));
        }
        self.photos.push(data_url.to_string());
        Ok(())
    }

    /// Quita una foto por índice (SPEC §10).
    pub fn remove_photo(&mut self, index: usize) -> Result<(), AppError> {
        if index >= self.photos.len() {
            return Err(AppError::invalid_input("Índice de foto fuera de rango"));
        }
        self.photos.remove(index);
        Ok(())
    }

    /// Agrega un comentario de la familia y lo registra en el historial
    /// (SPEC §4.6 y §11.3).
    pub fn add_comment(&mut self, by: &str, body: &str) -> Result<ItemComment, AppError> {
        let by = by.trim();
        if by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién comenta es obligatorio",
            ));
        }
        let body = body.trim();
        if body.is_empty() {
            return Err(AppError::invalid_input(
                "El comentario no puede estar vacío",
            ));
        }
        if body.chars().count() > 500 {
            return Err(AppError::invalid_input(
                "El comentario no puede superar 500 caracteres",
            ));
        }
        let comment = ItemComment {
            id: Uuid::new_v4().to_string(),
            at: super::now_iso(),
            by: by.to_string(),
            body: body.to_string(),
        };
        self.history.push(ItemEvent {
            at: comment.at.clone(),
            by: by.to_string(),
            kind: ItemEventKind::Commented {
                body: body.to_string(),
            },
        });
        self.comments.push(comment.clone());
        Ok(comment)
    }

    /// Cambia de estado validando la transición y registra el evento (SPEC §3.3).
    pub fn change_status(&mut self, to: ItemStatus, by: &str) -> Result<(), AppError> {
        let from = self.status;
        self.status = self.status.transition(to)?;
        self.history.push(ItemEvent {
            at: super::now_iso(),
            by: by.to_string(),
            kind: ItemEventKind::StatusChanged {
                from,
                to: self.status,
            },
        });
        Ok(())
    }

    /// Asigna el ítem a un miembro (SPEC §5).
    pub fn assign(&mut self, member: &str, by: &str) -> Result<(), AppError> {
        let member = member.trim();
        if member.is_empty() {
            return Err(AppError::invalid_input(
                "El miembro asignado es obligatorio",
            ));
        }
        self.assigned_to = Some(member.to_string());
        self.history.push(ItemEvent {
            at: super::now_iso(),
            by: by.to_string(),
            kind: ItemEventKind::Assigned {
                member: member.to_string(),
            },
        });
        Ok(())
    }

    /// Cancela el ítem (transición a Cancelado) con motivo opcional (SPEC §3.3).
    pub fn cancel(&mut self, by: &str, reason: Option<&str>) -> Result<(), AppError> {
        let from = self.status;
        self.status = self.status.transition(ItemStatus::Cancelado)?;
        self.history.push(ItemEvent {
            at: super::now_iso(),
            by: by.to_string(),
            kind: ItemEventKind::Cancelled {
                from,
                reason: reason
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::to_string),
            },
        });
        Ok(())
    }
}

pub fn validate_new_item(name: &str, quantity: f64, unit: &str) -> Result<(), AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::invalid_input("El nombre del ítem es obligatorio"));
    }
    if name.chars().count() > 200 {
        return Err(AppError::invalid_input(
            "El nombre no puede superar 200 caracteres",
        ));
    }
    if !quantity.is_finite() || quantity <= 0.0 {
        return Err(AppError::invalid_input("La cantidad debe ser mayor que 0"));
    }
    if unit.trim().is_empty() {
        return Err(AppError::invalid_input("La unidad es obligatoria"));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickEntry {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
}

/// Parsea entrada de texto libre tipo "pollo 2kg" / "leche 1 l" (SPEC §3.2).
/// En fases posteriores el historial de la familia refina la sugerencia.
pub fn parse_quick_entry(text: &str) -> Result<QuickEntry, AppError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::invalid_input("Escribe qué falta"));
    }

    let (name, rest) = match text.find(|c: char| c.is_ascii_digit()) {
        Some(idx) => (text[..idx].trim(), &text[idx..]),
        None => (text, ""),
    };

    if name.is_empty() {
        return Err(AppError::invalid_input(
            "Falta el nombre del ítem (ej. \"pollo 2kg\")",
        ));
    }

    let (quantity, unit) = match split_number_unit(rest) {
        Some((qty, unit)) if !unit.is_empty() => (qty, unit),
        Some((qty, _)) => (qty, "pieza"),
        None => (1.0, "pieza"),
    };

    validate_new_item(name, quantity, unit)?;

    Ok(QuickEntry {
        name: name.to_string(),
        quantity,
        unit: unit.to_string(),
    })
}

/// Separa "<cantidad><unidad>" del resto de la entrada, p. ej. "2kg", "1 l", "2,5kg".
fn split_number_unit(rest: &str) -> Option<(f64, &str)> {
    let rest = rest.trim_start();
    if rest.is_empty() {
        return None;
    }

    let bytes = rest.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }

    if i == bytes.len() {
        let qty = rest.parse::<f64>().ok()?;
        return Some((qty, ""));
    }

    if (bytes[i] == b'.' || bytes[i] == b',')
        && i + 1 < bytes.len()
        && bytes[i + 1].is_ascii_digit()
    {
        i += 1;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
    }

    let qty = rest[..i].replace(',', ".").parse::<f64>().ok()?;
    let unit = rest[i..].trim();
    Some((qty, unit))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transiciones_validas() {
        assert!(ItemStatus::Falta.can_transition(ItemStatus::Pedido));
        assert!(ItemStatus::Falta.can_transition(ItemStatus::Llevo));
        assert!(ItemStatus::Pedido.can_transition(ItemStatus::Comprado));
        assert!(ItemStatus::Llevo.can_transition(ItemStatus::Comprado));
        assert!(ItemStatus::Cancelado.can_transition(ItemStatus::Falta));
        assert_eq!(
            ItemStatus::Falta.transition(ItemStatus::Pedido).unwrap(),
            ItemStatus::Pedido
        );
    }

    #[test]
    fn transiciones_invalidas() {
        assert!(!ItemStatus::Comprado.can_transition(ItemStatus::Falta));
        assert!(!ItemStatus::Llevo.can_transition(ItemStatus::Pedido));
        assert!(ItemStatus::Comprado.transition(ItemStatus::Falta).is_err());
    }

    #[test]
    fn parseo_con_cantidad_y_unidad() {
        let e = parse_quick_entry("pollo 2kg").unwrap();
        assert_eq!(e.name, "pollo");
        assert_eq!(e.quantity, 2.0);
        assert_eq!(e.unit, "kg");

        let e = parse_quick_entry("leche 1 l").unwrap();
        assert_eq!(e.name, "leche");
        assert_eq!(e.unit, "l");

        let e = parse_quick_entry("arroz 1,5kg").unwrap();
        assert_eq!(e.quantity, 1.5);
    }

    #[test]
    fn parseo_sin_cantidad_usa_default() {
        let e = parse_quick_entry("pollo").unwrap();
        assert_eq!(e.name, "pollo");
        assert_eq!(e.quantity, 1.0);
        assert_eq!(e.unit, "pieza");
    }

    #[test]
    fn parseo_invalido() {
        assert!(parse_quick_entry("").is_err());
        assert!(parse_quick_entry("2kg").is_err());
    }

    #[test]
    fn validacion_de_input() {
        assert!(validate_new_item("pollo", 2.0, "kg").is_ok());
        assert!(validate_new_item("", 2.0, "kg").is_err());
        assert!(validate_new_item("pollo", 0.0, "kg").is_err());
        assert!(validate_new_item("pollo", -1.0, "kg").is_err());
        assert!(validate_new_item("pollo", 2.0, "").is_err());
    }

    #[test]
    fn nuevo_item_con_evento_creado() {
        let item = GroceryItem::new(
            "pollo",
            2.0,
            "kg",
            Priority::Alta,
            "Ana",
            Some("  sin muslos  "),
            None,
        )
        .unwrap();
        assert_eq!(item.name, "pollo");
        assert_eq!(item.status, ItemStatus::Falta);
        assert_eq!(item.requested_by, "Ana");
        assert_eq!(item.note.as_deref(), Some("sin muslos"));
        assert_eq!(item.history.len(), 1);
        assert!(matches!(item.history[0].kind, ItemEventKind::Created));
        assert!(!item.id.is_empty());
        assert!(!item.created_at.is_empty());
    }

    #[test]
    fn nuevo_item_requiere_quien_lo_pide() {
        assert!(GroceryItem::new("pollo", 2.0, "kg", Priority::Media, "", None, None).is_err());
    }

    #[test]
    fn cambiar_estado_registra_evento() {
        let mut item =
            GroceryItem::new("leche", 1.0, "l", Priority::Baja, "Ana", None, None).unwrap();
        item.change_status(ItemStatus::Pedido, "Juan").unwrap();
        item.assign("Juan", "Ana").unwrap();
        assert_eq!(item.status, ItemStatus::Pedido);
        assert_eq!(item.assigned_to.as_deref(), Some("Juan"));
        assert_eq!(item.history.len(), 3);
        assert!(matches!(
            item.history[1].kind,
            ItemEventKind::StatusChanged { .. }
        ));
        assert!(matches!(
            item.history[2].kind,
            ItemEventKind::Assigned { .. }
        ));
    }

    #[test]
    fn cancelar_con_motivo() {
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Ana", None, None).unwrap();
        item.cancel("Ana", Some("ya había")).unwrap();
        assert_eq!(item.status, ItemStatus::Cancelado);
        assert_eq!(item.history.len(), 2);
        match &item.history[1].kind {
            ItemEventKind::Cancelled { from, reason } => {
                assert_eq!(*from, ItemStatus::Falta);
                assert_eq!(reason.as_deref(), Some("ya había"));
            }
            _ => panic!("evento esperado: Cancelled"),
        }
    }

    #[test]
    fn no_se_puede_cancelar_un_cancelado() {
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Ana", None, None).unwrap();
        item.cancel("Ana", None).unwrap();
        assert!(item.cancel("Ana", None).is_err());
    }

    #[test]
    fn comentar_valida_y_registra() {
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Ana", None, None).unwrap();
        let comment = item.add_comment("Abuela", "  el integral no  ").unwrap();
        assert_eq!(comment.body, "el integral no");
        assert_eq!(item.comments.len(), 1);
        assert_eq!(item.history.len(), 2);
        assert!(matches!(item.history[1].kind, ItemEventKind::Commented { .. }));
        assert!(item.add_comment("  ", "hola").is_err());
        assert!(item.add_comment("Ana", "").is_err());
    }

    #[test]
    fn precio_y_seccion_validan() {
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", Priority::Alta, "Ana", None, None).unwrap();
        item.set_price(12.5).unwrap();
        assert_eq!(item.price, Some(12.5));
        assert!(item.set_price(-1.0).is_err());
        item.set_section("Carnes").unwrap();
        assert_eq!(item.section.as_deref(), Some("Carnes"));
        assert!(item.set_section("  ").is_err());
    }
}
