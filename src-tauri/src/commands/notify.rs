use crate::domain::notification::{AppNotification, NotificationKind};
use crate::domain::rules::NotificationSettings;
use crate::store::rules::RulesStore;

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
    }
}

/// Genera un aviso para un miembro SOLO si su configuración lo permite y no está
/// en horario silencioso (SPEC §13). `now_hhmm` = hora local `HH:MM` (la zona
/// horaria del hogar); si se omite, se usa la hora actual del servidor.
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
    let now = now_hhmm_utc();
    if in_silent_window(&settings, &now) {
        return;
    }
    rules.push_notification(AppNotification::new(kind, member, title, body, link));
}

/// Hora local `HH:MM` (UTC por ahora; la zona horaria del hogar es de fase 2).
fn now_hhmm_utc() -> String {
    let now = time::OffsetDateTime::now_utc();
    format!("{:02}:{:02}", now.hour(), now.minute())
}
