use serde::Serialize;

use crate::domain::item::{ItemEventKind, ItemStatus};
use crate::domain::plan::PlanStatus;
use crate::domain::trip::TripStatus;
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
    TripCreated,
    TripCompleted,
    PlanCreated,
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

/// Línea de tiempo con todo lo que pasó entre `start` y `end` (días
/// `AAAA-MM-DD`, inclusivo): compras, mandados, eventos, comentarios y cambios.
#[tauri::command]
pub fn timeline_get(state: AppStateRef, start: String, end: String) -> Result<Vec<TimelineEntry>, AppError> {
    let store = store::lock(&state.store)?;
    let mut entries = compute_timeline(&store);
    entries.retain(|e| {
        let day = &e.at[..e.at.len().min(10)];
        day >= start.as_str() && day <= end.as_str()
    });
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
                _ => continue,
            };
            entries.push(entry);
        }
    }

    for trip in store.trips.list() {
        let kind = match trip.status {
            TripStatus::Completada => TimelineKind::TripCompleted,
            _ => TimelineKind::TripCreated,
        };
        entries.push(TimelineEntry {
            at: trip.created_at.clone(),
            kind,
            by: trip
                .assigned_to
                .clone()
                .unwrap_or_else(|| trip.created_by.clone()),
            title: format!("Mandado: {}", trip.title),
        });
    }

    for plan in store.plans.list() {
        entries.push(TimelineEntry {
            at: plan.created_at.clone(),
            kind: if plan.status == PlanStatus::Completado {
                TimelineKind::TripCompleted
            } else {
                TimelineKind::PlanCreated
            },
            by: plan.created_by.clone(),
            title: format!("Plan: {}", plan.title),
        });
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
