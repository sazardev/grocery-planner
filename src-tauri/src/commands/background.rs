//! Tareas de fondo que ejecutan las promesas del SPEC que no dependen de una
//! acción del usuario: recordatorios de eventos (SPEC §9.2/§13), planes
//! recurrentes automáticos (SPEC §7.1), proyección de faltas y resúmenes
//! diario/semanal (SPEC §13).

use crate::commands::notify;
use crate::domain::event::EventType;
use crate::domain::item::ItemStatus;
use crate::domain::notification::{AppNotification, NotificationKind};
use crate::domain::plan::{Plan, PlanStatus, Recurrence};
use crate::store::AppStore;

const DATETIME_FMT: &[time::format_description::FormatItem<'static>] =
    time::macros::format_description!("[year]-[month]-[day]T[hour]:[minute]");

/// Procesa una pasada del reloj (se llama desde un hilo en lib.rs y server.rs).
/// Devuelve `true` si algo cambió (para saber si conviene persistir ya).
pub fn tick(store: &mut AppStore) -> bool {
    let reminders = fire_event_reminders(store);
    let plans = advance_recurring_plans(store);
    let projection = fire_projection_notifications(store);
    let summaries = fire_summaries(store);
    reminders || plans || projection || summaries
}

/// Recordatorios de eventos: notifica a los miembros del hogar cuando faltan
/// `reminder_minutes` para el evento, una sola vez por evento (SPEC §9.2/§13).
/// Respeta los tipos de evento elegidos por cada miembro (`event_types`).
fn fire_event_reminders(store: &mut AppStore) -> bool {
    let now = time::OffsetDateTime::now_utc();
    let events = store.events.list();
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    let mut changed = false;

    for ev in &events {
        let Some(minutes) = ev.reminder_minutes else { continue };
        if minutes <= 0 || store.rules.reminders_fired.contains(&ev.id) {
            continue;
        }
        // Hora del evento (todo el día = medianoche del día).
        let event_time = event_datetime(&ev.date, ev.time.as_deref());
        let Some(event_time) = event_time else { continue };
        let reminder_at = event_time - time::Duration::minutes(minutes);
        // Ya pasó la hora del evento: limpiar la marca para poder re-avisar
        // (p. ej. en el próximo año si es recurrente).
        if now > event_time {
            store.rules.reminders_fired.retain(|id| id != &ev.id);
            continue;
        }
        // Dentro de la ventana del recordatorio → notificar una vez.
        if now >= reminder_at {
            let kind_key = event_type_key(ev.kind);
            for m in &members {
                let settings = store.rules.settings_for(m);
                if !settings.event_types.is_empty()
                    && !settings.event_types.iter().any(|t| t == &kind_key)
                {
                    continue;
                }
                notify::push_managed(
                    &mut store.rules,
                    m,
                    NotificationKind::EventReminder,
                    &format!("Recordatorio: {ev_title}", ev_title = ev.title),
                    &format!("{} está por llegar.", ev.title),
                    Some(&format!("/events/{}", ev.id)),
                );
            }
            store.rules.reminders_fired.push(ev.id.clone());
            changed = true;
        }
    }
    changed
}

/// Proyección de faltas (SPEC §13): una vez al día, avisa a quienes tienen
/// activado `on_projection` qué está por faltar (según la cadencia aprendida).
fn fire_projection_notifications(store: &mut AppStore) -> bool {
    let today = notify::today_local(&store.rules);
    if store.rules.projection_notified_on.as_deref() == Some(&today) {
        return false;
    }
    store.rules.projection_notified_on = Some(today.clone());
    let pending: Vec<String> = crate::commands::reports::compute_projection(store)
        .into_iter()
        .filter(|p| {
            !p.decided && p.est_falta_in_days.map(|d| d <= 2).unwrap_or(false)
        })
        .map(|p| p.name)
        .collect();
    if pending.is_empty() {
        return false;
    }
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    let names = pending[..pending.len().min(3)].join(", ");
    for m in &members {
        notify::push_managed(
            &mut store.rules,
            m,
            NotificationKind::Projection,
            "Pronto hará falta…",
            &format!("Según lo que consumen, pronto faltará: {names}."),
            Some("/home"),
        );
    }
    true
}

/// Resúmenes diario y semanal (SPEC §13): en la hora que eligió cada miembro
/// (`daily_summary_hour`/`weekly_summary_hour`), una vez por periodo.
fn fire_summaries(store: &mut AppStore) -> bool {
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    let mut changed = false;

    for m in &members {
        let settings = store.rules.settings_for(m);
        if settings.daily_summary {
            if let Some(hour) = settings.daily_summary_hour.as_deref() {
                if matches_hour(hour, store) {
                    let key = format!("{m}|daily|{}", notify::today_local(&store.rules));
                    if !store.rules.summaries_sent.contains_key(&key) {
                        let count = store
                            .items
                            .list()
                            .iter()
                            .filter(|i| {
                                i.status == ItemStatus::Falta || i.status == ItemStatus::Pedido
                            })
                            .count();
                        store.rules.push_notification(AppNotification::new(
                            NotificationKind::DailySummary,
                            m,
                            "Resumen del día",
                            &format!(
                                "Hoy faltan {count} {item_word} por comprar.",
                                item_word = if count == 1 { "cosa" } else { "cosas" }
                            ),
                            Some("/home"),
                        ));
                        store.rules.summaries_sent.insert(key.clone(), key);
                        changed = true;
                    }
                }
            }
        }
        if settings.weekly_summary {
            if let Some(hour) = settings.weekly_summary_hour.as_deref() {
                if matches_hour(hour, store) {
                    let key = format!(
                        "{m}|weekly|{}",
                        notify::today_local(&store.rules)
                    );
                    if !store.rules.summaries_sent.contains_key(&key) {
                        let pending: Vec<String> = crate::commands::reports::compute_projection(store)
                            .into_iter()
                            .filter(|p| p.est_falta_in_days.map(|d| d <= 7).unwrap_or(false))
                            .map(|p| p.name)
                            .take(4)
                            .collect();
                        let detail = if pending.is_empty() {
                            "Todo bajo control.".to_string()
                        } else {
                            format!("Esta semana faltará: {}.", pending.join(", "))
                        };
                        store.rules.push_notification(AppNotification::new(
                            NotificationKind::WeeklySummary,
                            m,
                            "Resumen de la semana",
                            &detail,
                            Some("/home"),
                        ));
                        store.rules.summaries_sent.insert(key.clone(), key);
                        changed = true;
                    }
                }
            }
        }
    }
    changed
}

/// ¿La hora local del hogar coincide con `HH:MM`? (la pasada del tick es cada 60 s).
fn matches_hour(hhmm: &str, store: &AppStore) -> bool {
    let mut parts = hhmm.split(':');
    let h: u32 = parts.next().and_then(|s| s.trim().parse().ok()).unwrap_or(u32::MAX);
    let m: u32 = parts.next().and_then(|s| s.trim().parse().ok()).unwrap_or(u32::MAX);
    notify::local_minutes_now(&store.rules) == h * 60 + m
}

/// Clave serde de un tipo de evento (igual que `EventType` serializa), para
/// compararla con `NotificationSettings.event_types`.
fn event_type_key(kind: EventType) -> String {
    match kind {
        EventType::Cumpleanos => "cumpleanos",
        EventType::Union => "union",
        EventType::Comida => "comida",
        EventType::Celebracion => "celebracion",
        EventType::Reunion => "reunion",
        EventType::Mandado => "mandado",
    }
    .to_string()
}

/// Planes recurrentes: cuando un plan programado quedó en el pasado y sigue
/// "planificado", se genera la siguiente instancia y la anterior se marca como
/// completada (SPEC §7.1: compra semanal/quincenal/mensual en automático).
fn advance_recurring_plans(store: &mut AppStore) -> bool {
    let now = time::OffsetDateTime::now_utc();
    let plans = store.plans.list();
    let mut changed = false;

    for p in &plans {
        if p.recurrence == Recurrence::Ninguna || p.status != PlanStatus::Planificado {
            continue;
        }
        let Ok(scheduled) = time::PrimitiveDateTime::parse(&p.scheduled_at, DATETIME_FMT) else {
            continue;
        };
        let scheduled_utc = scheduled.assume_utc();
        if scheduled_utc >= now - time::Duration::hours(1) {
            continue; // aún no toca avanzarlo (margen de 1 h)
        }
        let Some(next_date) = next_occurrence(&scheduled, p.recurrence) else {
            continue;
        };
        let next_at = format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}",
            next_date.year(),
            next_date.month() as u8,
            next_date.day(),
            scheduled.hour(),
            scheduled.minute(),
        );
        let Ok(plan) = Plan::new(
            &p.title,
            &next_at,
            p.store.as_deref(),
            p.assigned_to.as_deref(),
            p.note.as_deref(),
            p.recurrence,
            &p.created_by,
        ) else {
            continue;
        };
        let _ = store.plans.set_status(&p.id, PlanStatus::Completado);
        store.plans.create(plan);
        changed = true;
    }
    changed
}

/// Suma un periodo a la fecha de un plan según su recurrencia.
fn next_occurrence(scheduled: &time::PrimitiveDateTime, rec: Recurrence) -> Option<time::Date> {
    let date = scheduled.date();
    match rec {
        Recurrence::Semanal => date.checked_add(time::Duration::days(7)),
        Recurrence::Quincenal => date.checked_add(time::Duration::days(14)),
        Recurrence::Mensual => {
            let month_num = date.month() as u8;
            let (y, m) = if month_num == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), month_num + 1)
            };
            time::Month::try_from(m)
                .ok()
                .and_then(|month| time::Date::from_calendar_date(y, month, date.day()).ok())
        }
        Recurrence::Ninguna => None,
    }
}

/// Hora del evento: `YYYY-MM-DD` + hora `HH:MM` opcional (todo el día = 00:00).
fn event_datetime(date: &str, time: Option<&str>) -> Option<time::OffsetDateTime> {
    let d = time::Date::parse(date, &time::macros::format_description!("[year]-[month]-[day]")).ok()?;
    let t = match time {
        Some(hhmm) => time::Time::parse(hhmm, &time::macros::format_description!("[hour]:[minute]")).ok()?,
        None => time::Time::MIDNIGHT,
    };
    Some(d.with_time(t).assume_utc())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::event::{Event, EventType};
    use crate::store::AppStore;

    fn iso_date(days: i64) -> String {
        let d = (time::OffsetDateTime::now_utc() + time::Duration::days(days)).date();
        format!("{:04}-{:02}-{:02}", d.year(), d.month() as u8, d.day())
    }

    #[test]
    fn plan_recurrente_vencido_genera_instancia_futura() {
        let mut store = AppStore::new();
        let past = format!("{}T09:00", iso_date(-10));
        let plan = Plan::new(
            "Mandado semanal",
            &past,
            None,
            None,
            None,
            Recurrence::Semanal,
            "Papá",
        )
        .unwrap();
        store.plans.create(plan);
        let changed = advance_recurring_plans(&mut store);
        assert!(changed, "debería avanzar el plan vencido");
        let plans = store.plans.list();
        assert_eq!(plans.len(), 2, "deberían existir 2 planes");
        let old = plans.iter().find(|p| p.status == PlanStatus::Completado).unwrap();
        let future = plans.iter().find(|p| p.status == PlanStatus::Planificado).unwrap();
        assert!(future.scheduled_at > old.scheduled_at, "la siguiente instancia debe ser futura");
    }

    #[test]
    fn recordatorio_de_evento_se_dispara_una_vez() {
        use crate::domain::home::Home;
        let mut store = AppStore::new();
        store
            .home
            .create(Home::create("Los Ramírez", "Papá").unwrap());
        let tomorrow = iso_date(1);
        let event = Event::new(
            "Cumple de Ana",
            &tomorrow,
            None,
            true,
            EventType::Cumpleanos,
            None,
            vec![],
            None,
            true,
            Some(1440), // recuerda 1 día antes
            "Papá",
        )
        .unwrap();
        store.events.create(event);
        assert!(fire_event_reminders(&mut store), "debe disparar el recordatorio");
        assert!(
            store.rules.notifications.iter().any(|n| n.kind == NotificationKind::EventReminder),
            "debe generar al menos un aviso de recordatorio"
        );
        assert!(
            !fire_event_reminders(&mut store),
            "no debe repetir el mismo recordatorio"
        );
    }
}
