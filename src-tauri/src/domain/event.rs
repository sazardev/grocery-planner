use serde::{Deserialize, Serialize};
use time::macros::format_description;
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

/// Tipo de evento familiar (SPEC §9.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Cumpleanos,
    Union,
    Comida,
    Celebracion,
    Reunion,
    Mandado,
}

impl EventType {
    pub fn label(self) -> &'static str {
        match self {
            Self::Cumpleanos => "Cumpleaños",
            Self::Union => "Unión / aniversario",
            Self::Comida => "Comida familiar",
            Self::Celebracion => "Celebración",
            Self::Reunion => "Reunión / visita",
            Self::Mandado => "Mandado / plan",
        }
    }
}

/// Un evento del calendario familiar (SPEC §9.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: String,
    pub title: String,
    /// Fecha `YYYY-MM-DD` (obligatoria).
    pub date: String,
    /// Hora opcional `HH:MM`; si no hay, es un evento "todo el día".
    pub time: Option<String>,
    pub all_day: bool,
    pub kind: EventType,
    pub place: Option<String>,
    pub participants: Vec<String>,
    pub note: Option<String>,
    /// Cumpleaños y aniversarios se repiten cada año en automático (SPEC §9.2).
    pub recurring_yearly: bool,
    pub created_by: String,
    pub created_at: String,
    /// Ítems de la lista del evento (SPEC §9.4).
    pub item_ids: Vec<String>,
}

const DATE_FMT: &[time::format_description::FormatItem<'static>] =
    format_description!("[year]-[month]-[day]");
const TIME_FMT: &[time::format_description::FormatItem<'static>] =
    format_description!("[hour]:[minute]");

impl Event {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        title: &str,
        date: &str,
        time: Option<&str>,
        all_day: bool,
        kind: EventType,
        place: Option<&str>,
        participants: Vec<String>,
        note: Option<&str>,
        recurring_yearly: bool,
        created_by: &str,
    ) -> Result<Self, AppError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(AppError::invalid_input(
                "El título del evento es obligatorio",
            ));
        }
        time::Date::parse(date.trim(), DATE_FMT)
            .map_err(|_| AppError::invalid_input(format!("Fecha inválida (se espera AAAA-MM-DD): {date}")))?;
        let time = match time {
            Some(t) => {
                let t = t.trim();
                if t.is_empty() {
                    None
                } else {
                    time::Time::parse(t, TIME_FMT)
                        .map_err(|_| AppError::invalid_input(format!("Hora inválida (se espera HH:MM): {t}")))?;
                    Some(t.to_string())
                }
            }
            None => None,
        };
        let created_by = created_by.trim();
        if created_by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién crea el evento es obligatorio",
            ));
        }
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            date: date.trim().to_string(),
            time,
            all_day,
            kind,
            place: opt_str(place),
            participants: participants
                .into_iter()
                .map(|p| p.trim().to_string())
                .filter(|p| !p.is_empty())
                .collect(),
            note: opt_str(note),
            recurring_yearly,
            created_by: created_by.to_string(),
            created_at: now_iso(),
            item_ids: Vec::new(),
        })
    }

    /// ¿Cae dentro del rango [start, end] inclusive (comparación de fechas)?
    pub fn in_range(&self, start: &str, end: &str) -> bool {
        self.date >= start.to_string() && self.date <= end.to_string()
    }
}

fn opt_str(s: Option<&str>) -> Option<String> {
    s.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crear_evento_valido() {
        let e = Event::new(
            "Cumple de Ana",
            "2026-08-20",
            Some("18:00"),
            false,
            EventType::Cumpleanos,
            Some("casa de la abuela"),
            vec!["Papá".into(), "Ana".into()],
            Some("llevar pastel"),
            true,
            "Papá",
        )
        .unwrap();
        assert_eq!(e.date, "2026-08-20");
        assert_eq!(e.time.as_deref(), Some("18:00"));
        assert!(e.recurring_yearly);
        assert_eq!(e.participants.len(), 2);
    }

    #[test]
    fn fecha_o_hora_invalidas() {
        assert!(Event::new("X", "20-08-2026", None, true, EventType::Comida, None, vec![], None, false, "Papá").is_err());
        assert!(Event::new("X", "2026-08-20", Some("18:xx"), false, EventType::Comida, None, vec![], None, false, "Papá").is_err());
    }

    #[test]
    fn rango_de_fechas() {
        let e = Event::new("X", "2026-08-20", None, true, EventType::Comida, None, vec![], None, false, "Papá").unwrap();
        assert!(e.in_range("2026-08-01", "2026-08-31"));
        assert!(!e.in_range("2026-09-01", "2026-09-30"));
    }
}
