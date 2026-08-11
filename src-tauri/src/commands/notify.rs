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

/// Fecha local `YYYY-MM-DD` del hogar (para resúmenes y proyecciones diarias).
pub fn today_local(rules: &RulesStore) -> String {
    let tz: Tz = rules.rules.timezone.parse().unwrap_or(chrono_tz::UTC);
    let now = chrono::Utc::now().with_timezone(&tz);
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
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
