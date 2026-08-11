use serde::Serialize;

use crate::domain::item::{ItemEventKind, ItemStatus};
use crate::domain::plan::PlanStatus;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;
use crate::store::AppStore;

/// Línea de tiempo histórica de la familia (SPEC §8.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TimelineKind {
    ItemCreated,
    ItemPurchased,
    ItemCancelled,
    ItemCommented,
    ItemAssigned,
    ItemEdited,
    ItemPriorityChanged,
    ItemPriceChanged,
    ItemSectionChanged,
    ItemStoreChanged,
    ItemPhotosChanged,
    ItemFallbackUsed,
    ItemDeleted,
    ItemRecovered,
    TripCreated,
    TripCompleted,
    TripReceived,
    PlanCreated,
    PlanCompleted,
    EventCreated,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEntry {
    pub at: String,
    pub kind: TimelineKind,
    pub title: String,
    pub by: String,
}

/// Línea de tiempo con todo lo que pasó entre `start` y `end` (marcas ISO
/// RFC3339 UTC, inclusivo): compras, mandados, eventos, comentarios y cambios.
#[tauri::command]
pub fn timeline_get(state: AppStateRef, start: String, end: String) -> Result<Vec<TimelineEntry>, AppError> {
    let store = store::lock(&state.store)?;
    let mut entries = compute_timeline(&store);
    entries.retain(|e| e.at >= start && e.at <= end);
    entries.sort_by(|a, b| a.at.cmp(&b.at));
    Ok(entries)
}

/// Construye la línea de tiempo desde todos los repositorios (SPEC §8.3).
pub fn compute_timeline(store: &AppStore) -> Vec<TimelineEntry> {
    let mut entries: Vec<TimelineEntry> = Vec::new();

    for item in store.items.list() {
        for ev in &item.history {
            let entry = match &ev.kind {
                ItemEventKind::Created => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemCreated,
                    by: ev.by.clone(),
                    title: format!(
                        "Se pidió: {} ({} {})",
                        item.name,
                        format_qty(item.quantity),
                        item.unit
                    ),
                },
                ItemEventKind::StatusChanged { to: ItemStatus::Comprado, .. } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemPurchased,
                    by: ev.by.clone(),
                    title: format!("Se compró: {}", item.name),
                },
                ItemEventKind::Cancelled { .. } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemCancelled,
                    by: ev.by.clone(),
                    title: format!("Se canceló: {}", item.name),
                },
                ItemEventKind::Commented { body } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemCommented,
                    by: ev.by.clone(),
                    title: format!("Comentario en {}: {body}", item.name),
                },
                ItemEventKind::Assigned { member } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemAssigned,
                    by: ev.by.clone(),
                    title: format!("{} se asignó a {member}", item.name),
                },
                ItemEventKind::Updated { .. } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemEdited,
                    by: ev.by.clone(),
                    title: format!("Se editó: {}", item.name),
                },
                ItemEventKind::PriorityChanged { to, .. } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemPriorityChanged,
                    by: ev.by.clone(),
                    title: format!("{} ahora es prioridad {}", item.name, priority_label(*to)),
                },
                ItemEventKind::PriceChanged { price } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemPriceChanged,
                    by: ev.by.clone(),
                    title: format!("Precio de {}: {price}", item.name),
                },
                ItemEventKind::SectionChanged { section } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemSectionChanged,
                    by: ev.by.clone(),
                    title: format!("{} a la sección {section}", item.name),
                },
                ItemEventKind::StoreChanged { store } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemStoreChanged,
                    by: ev.by.clone(),
                    title: format!("{} se consigue en {store}", item.name),
                },
                ItemEventKind::PhotosChanged => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemPhotosChanged,
                    by: ev.by.clone(),
                    title: format!("Fotos de {} actualizadas", item.name),
                },
                ItemEventKind::FallbackUsed { to, .. } => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemFallbackUsed,
                    by: ev.by.clone(),
                    title: format!("No había {}; llevaron {to}", item.name),
                },
                ItemEventKind::Deleted => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemDeleted,
                    by: ev.by.clone(),
                    title: format!("Se quitó de la lista: {}", item.name),
                },
                ItemEventKind::Recovered => TimelineEntry {
                    at: ev.at.clone(),
                    kind: TimelineKind::ItemRecovered,
                    by: ev.by.clone(),
                    title: format!("Volvió a la lista: {}", item.name),
                },
                _ => continue,
            };
            entries.push(entry);
        }
    }

    for trip in store.trips.list() {
        let assigned = trip.assigned_to.clone().unwrap_or_else(|| trip.created_by.clone());
        entries.push(TimelineEntry {
            at: trip.created_at.clone(),
            kind: TimelineKind::TripCreated,
            by: assigned.clone(),
            title: format!("Mandado: {}", trip.title),
        });
        if let Some(completed_at) = trip.completed_at.clone() {
            entries.push(TimelineEntry {
                at: completed_at,
                kind: TimelineKind::TripCompleted,
                by: assigned.clone(),
                title: format!("Mandado completado: {}", trip.title),
            });
        }
        if let Some(received_at) = trip.received_at.clone() {
            entries.push(TimelineEntry {
                at: received_at,
                kind: TimelineKind::TripReceived,
                by: trip.received_by.clone().unwrap_or_default(),
                title: format!("Llegó el mandado: {}", trip.title),
            });
        }
    }

    for plan in store.plans.list() {
        entries.push(TimelineEntry {
            at: plan.created_at.clone(),
            kind: TimelineKind::PlanCreated,
            by: plan.created_by.clone(),
            title: format!("Plan: {}", plan.title),
        });
        if plan.status == PlanStatus::Completado {
            entries.push(TimelineEntry {
                at: plan.scheduled_at.clone(),
                kind: TimelineKind::PlanCompleted,
                by: plan.created_by.clone(),
                title: format!("Plan cumplido: {}", plan.title),
            });
        }
    }

    for event in store.events.list() {
        entries.push(TimelineEntry {
            at: event.created_at.clone(),
            kind: TimelineKind::EventCreated,
            by: event.created_by.clone(),
            title: format!("Evento: {}", event.title),
        });
    }

    entries
}

fn format_qty(qty: f64) -> String {
    if qty.fract() == 0.0 {
        format!("{}", qty as i64)
    } else {
        format!("{qty}")
    }
}

fn priority_label(p: crate::domain::item::Priority) -> &'static str {
    match p {
        crate::domain::item::Priority::Baja => "baja",
        crate::domain::item::Priority::Media => "media",
        crate::domain::item::Priority::Alta => "alta",
        crate::domain::item::Priority::Urgente => "urgente",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::item::GroceryItem;

    #[test]
    fn timeline_incluye_compras_y_mandados() {
        let mut store = AppStore::new();
        let mut item = GroceryItem::new("pollo", 2.0, "kg", crate::domain::item::Priority::Alta, "Ana", None, None).unwrap();
        item.change_status(ItemStatus::Comprado, "Juan").unwrap();
        store.items.create(item);

        let entries = compute_timeline(&store);
        assert!(entries.iter().any(|e| e.kind == TimelineKind::ItemCreated));
        assert!(entries.iter().any(|e| e.kind == TimelineKind::ItemPurchased));
    }
}
