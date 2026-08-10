---
name: grocery-planner
description: "Levantar y operar el proyecto Grocery Planner: app familiar de compras (Tauri v2 + React 19 + backend Rust). Cuándo usarla: arrancar el backend HTTP o la app desktop/web, entrar al sistema (cuenta de bypass admin/admin123), levantar los servidores de dev, correr verificación (cargo test / build / lint) o solucionar problemas de conexión/auth. Triggers: 'levantar la app', 'arrancar el server', 'cómo entro', 'admin', 'puerto 8787', 'VITE_API_URL', 'bypass', 'grocery planner'."
version: 1.0.0
---

# Grocery Planner — Levantar y operar el proyecto

> App self-hosted de lista de compras familiar. Frontend React 19 + Vite, shell Tauri v2,
> backend Rust con lógica compartida entre desktop (IPC) y web (HTTP axum).

## Contexto rápido

- **Dos transportes, misma lógica**: los `#[tauri::command]` de `src-tauri/src/commands/` se
  llaman por IPC en desktop (`tauri:dev`) y por HTTP en web (binario `server`). El transporte
  se abstrae en `src/lib/api/transport.ts` (`currentTransport()` detecta `__TAURI_INTERNALS__`).
- **Persistencia en disco**: el estado (datos + sesiones) se guarda cada ~5s y se restaura al
  arrancar (`GROCERY_PLANNER_DATA` → `$XDG_DATA_HOME/grocery-planner/data.json` →
  `~/.grocery-planner/data.json`). **Reiniciar el backend ya no borra nada** (solo se siembra la
  cuenta de bypass `admin` cuando no existe). Si un cambio "se pierde" tras reiniciar, el
  binario es viejo → recompilar.
- **El API HTTP exige sesión**: todo `/api/*` responde 401 sin `Authorization: Bearer <token>`
  salvo `PUBLIC_PATHS` (health, app-info, greet, `auth/register`, `auth/login`,
  `auth/login-pin`, `auth/has-pin`). El actor de cada request se deriva del token, no de `by`.

## Levantar los servidores

Hay que tener **dos procesos** para probar en el navegador: backend HTTP + Vite dev.

```bash
# 1) Backend HTTP self-hosted (puerto 8787, o GROCERY_PLANNER_PORT=<puerto>)
cargo run --features server --bin server        # en src-tauri/

# 2) Frontend web (localhost:5173)
npm run dev                                     # en la raíz

# 3) Desktop (arranca también el frontend automáticamente)
npm run tauri:dev
```

- Sin backend corriendo, las páginas web muestran "No se pudo conectar…" (esperado).
- La URL del backend web se sobreescribe con `VITE_API_URL` (default `http://localhost:8787`).

## Entrar al sistema (autenticación)

No hay registro previo: el backend siembra una **cuenta fija de bypass** al arrancar.

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `admin123` |

O en `/login` usa el botón **"Entrar con la cuenta de prueba"**. En Ajustes puedes crear
el hogar de la familia (quedas como Admin) e invitar miembros.

> ⚠️ **Si el login da 401** con `admin/admin123`, el server en :8787 es un binario viejo
> (previo al seed). Reinícialo recompilando: `cargo run --features server --bin server`.
> `Admin` no tiene hogar hasta que lo crees en Ajustes.

## Verificación

| Comando | Qué valida |
|---|---|
| `cargo test` (en `src-tauri/`) | Tests de dominio/store/commands |
| `cargo check --features server --bin server` | Compila el binario HTTP (no lo valida `cargo check` a secas) |
| `npm run build` | `tsc -b` + `vite build` |
| `npm run lint` | oxlint |
| `npm run tauri:build` | Empaqueta desktop (AppImage falla en esta máquina; `.deb`/`.rpm` sí) |

## Estructura relevante

```
src-tauri/src/
├── domain/       # Lógica pura (auth, home, item, trip, plan, event, section, presence)
├── store/        # Repositorios en memoria (AppStore en store/mod.rs)
├── commands/     # #[tauri::command] (IPC desktop + base de los handlers HTTP)
├── bin/server.rs # Servidor axum (feature "server"), con middleware auth_guard
├── error.rs      # AppError serde-tagged { type, message } + to_http_status
├── persist.rs    # Guardado/restauración JSON a disco (cada ~5s + auth al instante)
└── state.rs      # AppState { store: Mutex<AppStore>, ... } — siembra la cuenta admin
src/
├── lib/api/      # Clientes tipados + transport.ts (invoke o fetch + Bearer)
├── lib/auth/     # AuthProvider, RequireAuth, storage del token, useAuth
└── pages/auth/   # LoginPage / RegisterPage
```

## Agregar un command (regla de oro: toca 3 capas + 1)

1. `#[tauri::command]` en `src-tauri/src/commands/<mod>.rs` (con `AppError`).
2. Registrarlo en `generate_handler![]` en `src-tauri/src/lib.rs`.
3. Cliente tipado en `src/lib/api/<mod>.ts` que llame `request('nombre', args)`.
4. En web: ruta en `ROUTES` de `src/lib/api/transport.ts` **y** handler en
   `src-tauri/src/bin/server.rs` (si no existe).

## Gotchas

- **Auth**: el server HTTP deriva el actor del token (`AuthActor` en `auth_guard`); no confía
  en el `by` del cliente. Tauri IPC sí recibe `by` (app local de confianza). La autorización
  por rol (Admin) vive en `domain/home.rs`.
- **Token sin expiración**: se revoca manualmente (Ajustes → Dispositivos conectados).
- **react-router-dom fijado en 7.11.0** (advisory GHSA-qwww-vcr4-c8h2). No subir.
- **`cargo check` por defecto NO compila el binario `server`** (feature `server`). Usa el
  flag explícito.
- La cuenta de bypass es para desarrollo: cámbiala antes de exponer el hogar a internet
  (constantes en `src-tauri/src/store/auth.rs`).
