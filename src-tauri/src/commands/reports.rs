use serde::Serialize;

use crate::domain::item::{GroceryItem, ItemEventKind, ItemStatus};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;
use crate::store::AppStore;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopProduct {
    pub name: String,
    pub times_bought: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendingReport {
    pub total: f64,
    pub items_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberTripCount {
    pub member: String,
    pub trips: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Projection {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    /// Última vez que se marcó como comprado (ISO).
    pub last_bought_at: Option<String>,
    /// Días promedio entre compras; `None` si no hay historial suficiente.
    pub cadence_days: Option<i64>,
    /// Días estimados hasta que vuelva a faltar; negativo si ya debió faltar.
    pub est_falta_in_days: Option<i64>,
    /// ¿La familia ya decidió sobre esta sugerencia? (SPEC §7.2)
    pub decided: bool,
    /// Si la decidió, ¿la confirmó o la descartó?
    pub confirmed: Option<bool>,
}

/// Productos más comprados, según el historial (SPEC §8.2), en la ventana.
#[tauri::command]
pub fn reports_top_products(
    state: AppStateRef,
    window: Option<String>,
) -> Result<Vec<TopProduct>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_top_products(&store, window.as_deref()))
}

/// Gasto aproximado de lo comprado (precio registrado, SPEC §8.2), en la ventana.
/// Suma los precios de las compras reales del historial (no solo el estado actual).
#[tauri::command]
pub fn reports_spending(
    state: AppStateRef,
    window: Option<String>,
) -> Result<SpendingReport, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_spending(&store, window.as_deref()))
}

/// Cuántos mandados completados hizo cada quien (SPEC §8.2).
#[tauri::command]
pub fn reports_trips_by_member(state: AppStateRef) -> Result<Vec<MemberTripCount>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_trips_by_member(&store))
}

/// Proyección de faltas: según el historial, estima en cuántos días volverá a
/// hacer falta cada ítem y cada cuánto se compra (SPEC §7.2 y §7.3).
#[tauri::command]
pub fn reports_projection(state: AppStateRef) -> Result<Vec<Projection>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_projection(&store))
}

/// Ventana de tiempo para los reportes (SPEC §7.3/§8.2). `None` = todo.
/// Devuelve `(desde, hasta)` en UTC.
fn window_range(window: Option<&str>) -> Option<(time::OffsetDateTime, time::OffsetDateTime)> {
    use time::{Date, Month, OffsetDateTime};
    let now = OffsetDateTime::now_utc();
    let start = |d: Date| d.with_time(time::Time::MIDNIGHT).assume_utc();
    let end = |d: Date| -> Option<time::OffsetDateTime> {
        let t = time::Time::from_hms(23, 59, 59).ok()?;
        Some(d.with_time(t).assume_utc())
    };
    match window.unwrap_or("") {
        "" => None,
        "hoy" => Some((start(now.date()), end(now.date())?)),
        "7d" => Some((start(now.date() - time::Duration::days(6)), now)),
        "30d" => Some((start(now.date() - time::Duration::days(29)), now)),
        "semana" => {
            let today = now.date();
            let monday = today - time::Duration::days(today.weekday().number_from_monday() as i64 - 1);
            Some((start(monday), now))
        }
        "mes" => {
            let today = now.date();
            let first = Date::from_calendar_date(today.year(), today.month(), 1).ok()?;
            Some((start(first), now))
        }
        "anio" => {
            let today = now.date();
            let first = Date::from_calendar_date(today.year(), Month::January, 1).ok()?;
            Some((start(first), now))
        }
        _ => None,
    }
}

pub fn compute_top_products(store: &AppStore, window: Option<&str>) -> Vec<TopProduct> {
    let range = window_range(window);
    let mut counts: Vec<TopProduct> = store
        .items
        .list()
        .iter()
        .map(|item| TopProduct {
            name: item.name.clone(),
            times_bought: bought_count(item, range),
        })
        .filter(|p| p.times_bought > 0)
        .collect();
    counts.sort_by(|a, b| b.times_bought.cmp(&a.times_bought).then(a.name.cmp(&b.name)));
    counts
}

pub fn compute_spending(store: &AppStore, window: Option<&str>) -> SpendingReport {
    let range = window_range(window);
    let (total, items_count) = store
        .items
        .list()
        .iter()
        .fold((0.0, 0u32), |(total, count), it| {
            let buys = buy_times(it, range);
            let n = buys.len();
            if n > 0 {
                if let Some(price) = it.price {
                    (total + price * n as f64, count + n as u32)
                } else {
                    (total, count + n as u32)
                }
            } else {
                (total, count)
            }
        });
    SpendingReport {
        total,
        items_count,
    }
}

pub fn compute_trips_by_member(store: &AppStore) -> Vec<MemberTripCount> {
    let mut counts: Vec<MemberTripCount> = Vec::new();
    for trip in store.trips.list() {
        if trip.status != crate::domain::trip::TripStatus::Completada {
            continue;
        }
        let member = trip
            .assigned_to
            .clone()
            .unwrap_or_else(|| trip.created_by.clone());
        match counts.iter_mut().find(|c| c.member == member) {
            Some(entry) => entry.trips += 1,
            None => counts.push(MemberTripCount { member, trips: 1 }),
        }
    }
    counts.sort_by(|a, b| b.trips.cmp(&a.trips).then(a.member.cmp(&b.member)));
    counts
}

pub fn compute_projection(store: &AppStore) -> Vec<Projection> {
    let now = time::OffsetDateTime::now_utc();
    let mut projections: Vec<Projection> = store
        .items
        .list()
        .iter()
        .filter_map(|item| project(item, now, store))
        .collect();
    // Los que se acaban antes van primero.
    projections.sort_by_key(|p| p.est_falta_in_days.unwrap_or(i64::MAX));
    projections
}

/// Calcula la proyección de un ítem a partir de sus eventos de "comprado".
fn project(
    item: &GroceryItem,
    now: time::OffsetDateTime,
    store: &AppStore,
) -> Option<Projection> {
    let buys: Vec<time::OffsetDateTime> = item
        .history
        .iter()
        .filter_map(|ev| match &ev.kind {
            ItemEventKind::StatusChanged { to: ItemStatus::Comprado, .. } => {
                time::OffsetDateTime::parse(
                    &ev.at,
                    &time::format_description::well_known::Rfc3339,
                )
                .ok()
            }
            _ => None,
        })
        .collect();
    let last = *buys.iter().max()?;
    let cadence = if buys.len() >= 2 {
        let mut intervals: Vec<i64> = buys
            .windows(2)
            .map(|w| (w[1] - w[0]).whole_days().max(0))
            .collect();
        intervals.sort_unstable();
        intervals.first().copied()
    } else {
        None
    };
    let est = cadence.map(|c| c - (now - last).whole_days());
    let decision = store.rules.projection_decision(&item.name);
    Some(Projection {
        name: item.name.clone(),
        quantity: item.quantity,
        unit: item.unit.clone(),
        last_bought_at: last.format(&time::format_description::well_known::Rfc3339).ok(),
        cadence_days: cadence,
        est_falta_in_days: est,
        decided: decision.is_some(),
        confirmed: decision,
    })
}

/// Fechas en las que el ítem se compró dentro de la ventana (opcional).
fn buy_times(
    item: &GroceryItem,
    range: Option<(time::OffsetDateTime, time::OffsetDateTime)>,
) -> Vec<time::OffsetDateTime> {
    item.history
        .iter()
        .filter_map(|ev| match &ev.kind {
            ItemEventKind::StatusChanged { to: ItemStatus::Comprado, .. } => {
                let t = time::OffsetDateTime::parse(
                    &ev.at,
                    &time::format_description::well_known::Rfc3339,
                )
                .ok()?;
                if let Some((from, to)) = range {
                    if t < from || t > to {
                        return None;
                    }
                }
                Some(t)
            }
            _ => None,
        })
        .collect()
}

fn bought_count(item: &GroceryItem, range: Option<(time::OffsetDateTime, time::OffsetDateTime)>) -> u32 {
    buy_times(item, range).len() as u32
}
