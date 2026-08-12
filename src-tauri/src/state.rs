use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

use crate::persist;
use crate::store::AppStore;

/// Número de suscriptores del canal de cambios en tiempo real (fase 2: SSE).
const CHANGE_CHANNEL_CAPACITY: usize = 256;

pub struct AppState {
    /// Base de datos local (self-hosted). Se inicializará con sqlx/diesel en la
    /// siguiente fase. Por ahora queda como placeholder tipado.
    pub db_ready: bool,
    /// Momento en que arrancó la app (para el uptime de los health checks).
    started_at: Instant,
    /// Repositorios en memoria (ítems, mandados, presencia). Persistencia en fase 2.
    pub store: Mutex<AppStore>,
    /// Canal de difusión de cambios (fase 2): cada mutación del server HTTP
    /// publica el dominio afectado y los clientes conectados por SSE invalidan
    /// sus consultas al instante (tiempo real entre dispositivos).
    pub changes: tokio::sync::broadcast::Sender<String>,
}

impl AppState {
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

impl Default for AppState {
    fn default() -> Self {
        let mut store = AppStore::new();
        // Restaura el estado guardado (datos + sesiones) si existe. Si el archivo
        // era inválido se respalda y se arranca limpio (persist::restore_into).
        match persist::restore_into(&mut store, &persist::default_data_path()) {
            Ok(_) => {}
            Err(_backup) => eprintln!("state: se arrancó con estado limpio (el archivo de datos se respaldó)"),
        }
        // Cuenta fija de desarrollo para entrar sin registrar (ver store::auth).
        store.auth.seed_default_account();
        let (changes, _) = tokio::sync::broadcast::channel(CHANGE_CHANNEL_CAPACITY);
        Self {
            db_ready: false,
            started_at: Instant::now(),
            store: Mutex::new(store),
            changes,
        }
    }
}

pub type AppStateRef<'a> = State<'a, AppState>;
