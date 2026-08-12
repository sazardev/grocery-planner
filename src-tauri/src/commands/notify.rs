use chrono::{Datelike, Timelike};
use chrono_tz::Tz;

use crate::domain::notification::{AppNotification, NotificationKind};
use crate::domain::rules::NotificationSettings;
use crate::store::rules::RulesStore;
use crate::store::AppStore;

/// ¿Estamos dentro del horario silencioso del miembro? (SPEC §13). Soporta
/// rangos que cruzan la medianoche (22:00–07:00).
fn in_silent_window(settings: &NotificationSettings, now: &str) -> bool {
    let (Some(from), Some(to)) = (&settings.silent_from, &settings.silent_to) else {
        return false;
    };
    if from.is_empty() || to.is_empty() {
        return false;
    }
    let Some(from_m) = hhmm_to_minutes(from) else { return false };
    let Some(to_m) = hhmm_to_minutes(to) else { return false };
    let Some(now_m) = hhmm_to_minutes(now) else { return false };
    if from_m == to_m {
        return false;
    }
    if from_m < to_m {
        now_m >= from_m && now_m < to_m
    } else {
        // Rango que cruza medianoche.
        now_m >= from_m || now_m < to_m
    }
}

fn hhmm_to_minutes(hhmm: &str) -> Option<u32> {
    let mut parts = hhmm.split(':');
    let h: u32 = parts.next()?.trim().parse().ok()?;
    let m: u32 = parts.next()?.trim().parse().ok()?;
    Some(h * 60 + m)
}

fn kind_enabled(settings: &NotificationSettings, kind: NotificationKind) -> bool {
    match kind {
        NotificationKind::Assigned => settings.on_assigned,
        NotificationKind::Urgent => settings.on_urgent,
        NotificationKind::TripStarted => settings.on_trip_started,
        NotificationKind::Arrival => settings.on_arrival,
        NotificationKind::Mention => settings.on_mention,
        NotificationKind::EventReminder => settings.on_event_reminder,
        NotificationKind::Projection => settings.on_projection,
        NotificationKind::DailySummary => settings.daily_summary,
        NotificationKind::WeeklySummary => settings.weekly_summary,
    }
}

/// Genera un aviso para un miembro SOLO si su configuración lo permite y no está
/// en horario silencioso (SPEC §13). La hora local se calcula en la zona horaria
/// del hogar (SPEC §14: `HomeRules.timezone`).
pub fn push_managed(
    rules: &mut RulesStore,
    member: &str,
    kind: NotificationKind,
    title: &str,
    body: &str,
    link: Option<&str>,
) {
    let settings = rules.settings_for(member);
    if !kind_enabled(&settings, kind) {
        return;
    }
    let now = now_hhmm_local(rules);
    if in_silent_window(&settings, &now) {
        return;
    }
    rules.push_notification(AppNotification::new(kind, member, title, body, link));
}

/// Hora local `HH:MM` del hogar (SPEC §14). Si la zona no se reconoce, se usa UTC.
fn now_hhmm_local(rules: &RulesStore) -> String {
    let tz: Tz = rules.rules.timezone.parse().unwrap_or(chrono_tz::UTC);
    let now = chrono::Utc::now().with_timezone(&tz);
    format!("{:02}:{:02}", now.hour(), now.minute())
}

/// Zona horaria del hogar (SPEC §14). Si no se reconoce, se usa UTC.
pub fn home_tz(rules: &RulesStore) -> Tz {
    rules.rules.timezone.parse().unwrap_or(chrono_tz::UTC)
}

/// Fecha local `YYYY-MM-DD` del hogar (para resúmenes y proyecciones diarias).
pub fn today_local(rules: &RulesStore) -> String {
    let tz = home_tz(rules);
    let now = chrono::Utc::now().with_timezone(&tz);
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
}

/// Semana ISO `YYYY-Www` local del hogar (clave única del resumen semanal,
/// SPEC §13: una vez por semana, no una vez por día).
pub fn week_local(rules: &RulesStore) -> String {
    let tz = home_tz(rules);
    let now = chrono::Utc::now().with_timezone(&tz);
    let iso = now.iso_week();
    format!("{:04}-W{:02}", iso.year(), iso.week())
}

/// Convierte `YYYY-MM-DD[ HH:MM]` (hora local del hogar, SPEC §14) a un
/// instante UTC. Sin hora = medianoche local.
pub fn local_datetime_utc(
    rules: &RulesStore,
    date: &str,
    hhmm: Option<&str>,
) -> Option<chrono::DateTime<chrono::Utc>> {
    let tz = home_tz(rules);
    let nd = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let nt = match hhmm {
        Some(h) => chrono::NaiveTime::parse_from_str(h, "%H:%M").ok()?,
        None => chrono::NaiveTime::from_hms_opt(0, 0, 0)?,
    };
    nd.and_time(nt)
        .and_local_timezone(tz)
        .earliest()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

/// Convierte `YYYY-MM-DDTHH:MM` (local del hogar) a un instante UTC.
pub fn plan_datetime_utc(
    rules: &RulesStore,
    scheduled_at: &str,
) -> Option<chrono::DateTime<chrono::Utc>> {
    let tz = home_tz(rules);
    let nd = chrono::NaiveDateTime::parse_from_str(scheduled_at, "%Y-%m-%dT%H:%M").ok()?;
    nd.and_local_timezone(tz)
        .earliest()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

/// Minutos transcurridos desde medianoche local del hogar.
pub fn local_minutes_now(rules: &RulesStore) -> u32 {
    let tz: Tz = rules.rules.timezone.parse().unwrap_or(chrono_tz::UTC);
    let now = chrono::Utc::now().with_timezone(&tz);
    now.hour() * 60 + now.minute()
}

/// Cuando el que compra marca un ítem como comprado durante un mandado activo,
/// avisa a la familia del avance (SPEC §13). Debounce ~10 min por mandado para
/// no saturar con un aviso por cada ítem.
pub fn maybe_notify_trip_progress(
    store: &mut AppStore,
    trip_id: &str,
    actor: &str,
    item_name: &str,
) {
    if !store.rules.trip_progress_allowed(trip_id) {
        return;
    }
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    for m in members {
        if m != actor {
            push_managed(
                &mut store.rules,
                &m,
                NotificationKind::TripStarted,
                "Va avanzando el mandado",
                &format!("{actor} marcó comprado: {item_name}."),
                Some(&format!("/trips/{trip_id}")),
            );
        }
    }
    store.rules.mark_trip_progress(trip_id);
}
