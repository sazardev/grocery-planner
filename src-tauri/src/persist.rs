use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::store::{AppStore, auth, chat, event, home, item, plan, rules, section, trip};

/// Estado persistido del hogar (todo excepto presencia, que es transitoria).
/// Fase 1: se guarda como JSON en disco y se vuelve a cargar al arrancar, así
/// reiniciar el servidor no pierde datos ni sesiones.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    pub auth: auth::AuthStore,
    pub items: item::ItemStore,
    pub trips: trip::TripStore,
    pub home: home::HomeStore,
    pub events: event::EventStore,
    pub sections: section::SectionStore,
    pub plans: plan::PlanStore,
    pub chat: chat::ChatStore,
    pub rules: rules::RulesStore,
}

/// Ruta del archivo de datos. Prioridad: variable `GROCERY_PLANNER_DATA`, luego
/// `$XDG_DATA_HOME/grocery-planner/data.json`, luego `$HOME/.grocery-planner/data.json`,
/// y como último recurso el directorio actual. Estable sin importar desde dónde
/// se arranque el servidor.
pub fn default_data_path() -> PathBuf {
    if let Some(p) = std::env::var_os("GROCERY_PLANNER_DATA") {
        return PathBuf::from(p);
    }
    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
        let dir = PathBuf::from(xdg).join("grocery-planner");
        if dir.exists() || std::env::var_os("HOME").is_some() {
            return dir.join("data.json");
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".grocery-planner")
            .join("data.json");
    }
    PathBuf::from("grocery-planner-data.json")
}

pub fn load(path: &Path) -> Result<PersistedState, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| format!("No se pudo leer {path:?}: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Respaldo de datos inválido: {e}"))
}

/// Guarda el estado actual. Escribe a un archivo temporal único (para no chocar
/// con el guardado periódico en segundo plano) y lo renombra, de modo que nunca
/// quede un archivo a medias.
pub fn save(store: &AppStore, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("No se pudo crear {parent:?}: {e}"))?;
        }
    }
    let state = PersistedState {
        auth: store.auth.clone(),
        items: store.items.clone(),
        trips: store.trips.clone(),
        home: store.home.clone(),
        events: store.events.clone(),
        sections: store.sections.clone(),
        plans: store.plans.clone(),
        chat: store.chat.clone(),
        rules: store.rules.clone(),
    };
    let raw = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("No se pudo serializar el estado: {e}"))?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = path.with_extension(format!("{nanos}.tmp"));
    std::fs::write(&tmp, raw).map_err(|e| format!("No se pudo escribir {tmp:?}: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("No se pudo guardar {path:?}: {e}"))
}

/// Hilo en segundo plano: guarda el estado cada `interval` segundos. Ignora
/// errores (es un guardado "best effort" de fase 1).
pub fn spawn_saver(store: std::sync::Arc<crate::state::AppState>, interval: std::time::Duration) {
    std::thread::spawn(move || {
        let path = default_data_path();
        loop {
            std::thread::sleep(interval);
            if let Ok(guard) = store.store.lock() {
                if let Err(e) = save(&guard, &path) {
                    eprintln!("persist: {e}");
                }
            }
        }
    });
}

/// Restaura un estado guardado sobre el `AppStore` (si existe el archivo).
///
/// Devuelve `Ok(true)` si se cargó, `Ok(false)` si no había archivo, y
/// `Err(backup_path)` si el archivo existía pero era inválido: en ese caso se
/// **mueve a un respaldo** (`data.json.corrupt-<timestamp>`) en vez de dejar que
/// el guardado en segundo plano lo sobrescriba y destruya los datos.
pub fn restore_into(store: &mut AppStore, path: &Path) -> Result<bool, PathBuf> {
    match load(path) {
        Ok(state) => {
            store.auth = state.auth;
            store.items = state.items;
            store.trips = state.trips;
            store.home = state.home;
            store.events = state.events;
            store.sections = state.sections;
            store.plans = state.plans;
            store.chat = state.chat;
            store.rules = state.rules;
            Ok(true)
        }
        Err(e) => {
            if path.exists() {
                eprintln!("persist: no se pudo cargar los datos: {e}");
                // Respalda el archivo original antes de que el saver lo pise.
                let nanos = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0);
                let backup = path.with_extension(format!("corrupt-{nanos}.json"));
                if std::fs::rename(path, &backup).is_ok() {
                    eprintln!("persist: el archivo inválido se movió a {backup:?}");
                    return Err(backup);
                }
                return Err(path.to_path_buf());
            }
            Ok(false)
        }
    }
}
