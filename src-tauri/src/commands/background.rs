//! Tareas de fondo que ejecutan las promesas del SPEC que no dependen de una
//! acción del usuario: recordatorios de eventos (SPEC §9.2/§13) y planes
//! recurrentes automáticos (SPEC §7.1).

use crate::domain::notification::NotificationKind;
use crate::domain::plan::{Plan, PlanStatus, Recurrence};
use crate::store::AppStore;

const DATETIME_FMT: &[time::format_description::FormatItem<'static>] =
    time::macros::format_description!("[year]-[month]-[day]T[hour]:[minute]");

/// Procesa una pasada del reloj (se llama desde un hilo en lib.rs y server.rs).
/// Devuelve `true` si algo cambió (para saber si conviene persistir ya).
pub fn tick(store: &mut AppStore) -> bool {
    let reminders = fire_event_reminders(store);
    let plans = advance_recurring_plans(store);
    reminders || plans
}

/// Recordatorios de eventos: notifica a los miembros del hogar cuando faltan
/// `reminder_minutes` para el evento, una sola vez por evento (SPEC §9.2/§13).
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
            for m in &members {
                crate::commands::notify::push_managed(
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
