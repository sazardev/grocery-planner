use serde::Serialize;

use crate::error::AppError;
use crate::state::{AppState, AppStateRef};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthLevel {
    Ok,
    Degraded,
    Down,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheck {
    pub name: String,
    pub level: HealthLevel,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveInfo {
    pub status: HealthLevel,
    pub uptime_secs: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadyInfo {
    pub status: HealthLevel,
    pub checks: Vec<HealthCheck>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthInfo {
    pub status: HealthLevel,
    pub checks: Vec<HealthCheck>,
    pub version: String,
    pub uptime_secs: u64,
}

fn core_check() -> HealthCheck {
    HealthCheck {
        name: "core".into(),
        level: HealthLevel::Ok,
        message: "Núcleo de la app operativo".into(),
    }
}

fn db_check(state: &AppState) -> HealthCheck {
    if state.db_ready {
        HealthCheck {
            name: "db".into(),
            level: HealthLevel::Ok,
            message: "Base de datos conectada".into(),
        }
    } else {
        HealthCheck {
            name: "db".into(),
            level: HealthLevel::Degraded,
            message: "Base de datos pendiente (fase 2)".into(),
        }
    }
}

fn overall(checks: &[HealthCheck]) -> HealthLevel {
    if checks.iter().any(|c| c.level == HealthLevel::Down) {
        HealthLevel::Down
    } else if checks.iter().any(|c| c.level == HealthLevel::Degraded) {
        HealthLevel::Degraded
    } else {
        HealthLevel::Ok
    }
}

/// Reporte de salud compartido entre IPC y el servidor HTTP.
pub fn health_report(state: &AppState) -> (HealthLevel, Vec<HealthCheck>) {
    let checks = vec![core_check(), db_check(state)];
    let status = overall(&checks);
    (status, checks)
}

/// Liveness: el proceso responde. Debería estar siempre ok mientras la app corre.
#[tauri::command]
pub fn live(state: AppStateRef) -> Result<LiveInfo, AppError> {
    Ok(LiveInfo {
        status: HealthLevel::Ok,
        uptime_secs: state.uptime_secs(),
    })
}

/// Readiness: la app está lista para servir trabajo real.
#[tauri::command]
pub fn ready(state: AppStateRef) -> Result<ReadyInfo, AppError> {
    let (status, checks) = health_report(&state);
    Ok(ReadyInfo { status, checks })
}

/// Healthy: reporte completo de salud con detalle por componente.
#[tauri::command]
pub fn healthy(state: AppStateRef) -> Result<HealthInfo, AppError> {
    let (status, checks) = health_report(&state);
    Ok(HealthInfo {
        status,
        checks,
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: state.uptime_secs(),
    })
}
