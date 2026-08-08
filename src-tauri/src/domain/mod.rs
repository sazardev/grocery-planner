pub mod auth;
pub mod chat;
pub mod event;
pub mod home;
pub mod item;
pub mod notification;
pub mod plan;
pub mod presence;
pub mod rules;
pub mod section;
pub mod trip;

use time::OffsetDateTime;

pub fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

pub(crate) fn now_epoch_millis() -> f64 {
    OffsetDateTime::now_utc().unix_timestamp_nanos() as f64 / 1_000_000.0
}
