# AGENTS.md — Grocery Planner

Self-hosted family shopping planner. Tauri v2 desktop app (Rust backend) + React 19 SPA (Vite 8). Phase 1 **complete**: all SPEC features are implemented (items, trips, plans, events, chat, calendar, reports, home/roles, auth, presence, PIN, backup, persistence). Product spec: `SPEC.md`, design system: `DESIGN.md`, session log: `MEMORY.md` (all in Spanish; UI copy is Spanish).

## Commands

| Task | Command |
|---|---|
| Web dev (browser) | `npm run dev` (localhost:5173) |
| Desktop dev | `npm run tauri:dev` (auto-runs `npm run dev`) |
| Backend HTTP (web/self-hosted) | `cargo run --features server --bin server` (localhost:8787) |
| Seed (familia demo con sesiones reales) | `npm run seed` (usa `VITE_API_URL` o `GP_API_URL`; default `http://localhost:8787`) |
| Regenerar SEO (robots/sitemap/og-image) | `npm run seo` (también se genera solo en cada `vite build` vía plugin) |
| Typecheck + build | `npm run build` (`tsc -b && vite build`) |
| Lint | `npm run lint` (oxlint) |
| **Suite E2E headless** | `npm run e2e` (chromium del sistema; levanta backend+frente en puertos libres, data aislada en /tmp) |
| **Verificación completa** | `npm run verify` (`lint && build && e2e`) |
| Package desktop | `npm run tauri:build` (auto-runs `npm run build`) |
| Check Rust backend | `cargo check` in `src-tauri/` |
| Check HTTP server binary | `cargo check --features server --bin server` in `src-tauri/` |

> Los E2E viven en `scripts/e2e/` (`harness.mjs`, `run.mjs`, suites `spec-core`/`live-refresh`/
> `design`/`spec-gaps`). `run.mjs` compila el binario server, arranca `vite preview` y el backend en puertos
> libres con `GROCERY_PLANNER_DATA` aislada, corre las suites y mata los procesos (grupo detached).
> Requiere un chromium del sistema (default `/usr/bin/chromium`, override `GP_CHROMIUM`).
> Nota: `waitForFunction` en el harness usa `polling: 250` (el rAF por defecto no detecta
> cambios tardíos en pestañas headless).

## Gotchas

- **Git**: repo initialized (branch `main`). `git` commands are fine now.
- **E2E harness**: el `dist` se construye con `VITE_API_URL` default `localhost:8787`; el harness
  reescribe en caliente las peticiones hacia el backend real del orquestador y bloquea `sw.js`
  (el service worker de producción interfiere con los tests). El onboarding se desactiva con
  `gp-onboarding-done=1`.
- **Autorización por rol**: las acciones de organización (reglas, secciones, planes, reordenar
  ítems ajenos) exigen rol Organizador/Admin vía `Home::require_role` + `commands::require_role`
  (IPC) y el mismo check en los handlers HTTP (actor del token). Un miembro común que intente
  cambiar reglas recibe 409 "Se requiere al menos el rol Organizador…".
- **Notificaciones**: se generan con `commands/notify::push_managed` (respeta `NotificationSettings`
  de cada miembro y su horario silencioso) en: menciones, asignaciones, urgente, mandado iniciado
  y llegada. Recordatorios de evento y planes recurrentes los genera el hilo de fondo
  `commands/background::tick` (cada 60 s en Tauri y en el server HTTP).
- **Plan recurrente**: un plan `planificado` con recurrencia cuyo `scheduledAt` ya pasó genera la
  siguiente instancia y el anterior pasa a `completado` (compra semanal/quincenal/mensual automática).
- **SEO automatizado**: al terminar `vite build`, un plugin genera `robots.txt`,
  `sitemap.xml` y `og-image.png` (desde `public/og-image.svg`) en el output. La base
  usa `VITE_BASE_URL`/`GP_BASE_URL`; si no está, queda el placeholder
  `https://grocery.example`. `npm run seo` regenera las copias de `public/`.
- **Web dev needs the HTTP server running**: in the browser, `transport.ts` uses fetch
  against `http://localhost:8787` (override con `VITE_API_URL`). Arranca el backend con
  `cargo run --features server --bin server` antes de probar la UI web; sin él, HomePage
  muestra "No se pudo conectar…" (esperado). En desktop (`tauri:dev`) se usa IPC, no HTTP.
- **Adding a backend command touches several layers**: add a `#[tauri::command]` under
  `src-tauri/src/commands/`, register it in `generate_handler![]` in `src-tauri/src/lib.rs`,
  expose a typed client in `src/lib/api/` that calls `request()`, AND (web) mapear el
  comando a su endpoint HTTP en `ROUTES` dentro de `src/lib/api/transport.ts` (y crear el
  handler en `src-tauri/src/bin/server.rs` si no existe).
- **Server feature**: el binario HTTP (axum) está detrás de `#[cfg(feature = "server")]`
  (`required-features` en `Cargo.toml`). `cargo check`/`cargo test` por defecto NO lo
  compilan; usa `cargo check --features server --bin server` para validarlo.
- **Persistencia**: el estado (datos + sesiones) se guarda en disco cada ~5s y al arrancar se
  restaura. Ubicación: `GROCERY_PLANNER_DATA` → `$XDG_DATA_HOME/grocery-planner/data.json` →
  `~/.grocery-planner/data.json`. **Reiniciar el servidor ya no borra nada.** Los handlers de
  auth guardan al instante (una sesión nueva no se pierde).
- **Migración de datos**: los campos nuevos de los structs de dominio llevan `#[serde(default)]`
  para que un `data.json` de un binario viejo cargue sin romperse (ej. `GroceryItem.brand`/
  `quantity_max`/`fallbacks`). Si el archivo es ilegible, `persist::restore_into` lo mueve a
  `data.json.corrupt-<timestamp>.json` **en vez de sobrescribirlo** — nunca perder datos por
  un server nuevo con schema nuevo.
- **Actor real en HTTP**: el servidor HTTP deriva el actor del token (no confía en `by` del
  cliente); los body structs ya no incluyen `by`/`owner`/`member`/`createdBy`. El seed
  (`npm run seed`) crea cuenta por miembro y actúa con la sesión de cada uno. Tauri IPC sigue
  recibiendo `by` (app local de confianza).
- **Auth**: todo `/api/*` exige `Authorization: Bearer <token>` salvo `PUBLIC_PATHS` en
  `src-tauri/src/bin/server.rs` (health, app-info, greet, auth register/login/login-pin/has-pin,
  **host-login**, **host-mode**). La llave del modo host la genera el Admin en Reglas y permite
  entrar al quiosco sin credenciales (SPEC §2.3); `hostPauseWithVisitors` pausa el quiosco si hay
  otra persona conectada.
  Cuenta de bypass de desarrollo: `admin` / `admin123` (sembrada en `AuthStore::seed_default_account`).
  Si el login da 401, el server en :8787 es un binario viejo → recompilar y reiniciar.
- **Privacidad (§14)**: `privacyShowPhotos`/`privacyShowPrices` se aplican en el server HTTP
  (`redact_item` en `server.rs`): si no se muestran, las fotos/precios se redactan en list/get/query
  y el reporte de gasto se pone en cero. El dato se conserva.
- **Soft-delete (§8)**: `item_delete` marca `GroceryItem.deleted` (la lista lo oculta, el historial
  y los reportes lo conservan); `item_delete_permanent` borra de verdad (solo ítems en la papelera);
  `item_recover` trae de vuelta un ítem eliminado o cancelado → Falta.
- **react-router-dom pinned at 7.11.0** (GHSA-qwww-vcr4-c8h2, CSRF advisory). Do not bump.
- **AppImage bundle fails** on this machine (linuxdeploy on Arch/CachyOS); `.deb`/`.rpm`
  and the raw binary build fine. Known, non-blocking.
- **Mobile cancelled**: `tauri android init` needs Java + Android SDK (not installed). Don't
  add mobile scaffolding.
- **Capabilities**: `src-tauri/capabilities/default.json` grants only `core:default`. New
  plugin/IPC permissions must be added there.

## Conventions

- **Strict modern TS**: `erasableSyntaxOnly` (no enums/namespaces/parameter properties), `verbatimModuleSyntax` (use `import type`), imports carry `.tsx`/`.ts` extensions.
- **Errors**: single `AppError` enum (`src-tauri/src/error.rs`), serde-tagged `{ type, message }` camelCase; commands return `Result<_, AppError>`.
- **Platform**: detected via `__TAURI_INTERNALS__` in `src/lib/platform.ts`; `mobile` path is dormant.
- Crate naming: package `grocery-planner`, lib `grocery_planner_lib` (see `src-tauri/src/main.rs`).

## Architecture (phase 1)

- Frontend entry `src/main.tsx` → `App.tsx`: `AuthProvider` envuelve las rutas; `/login` y
  `/register` públicas, `/kiosk` autenticada sin `Layout`; todo lo demás bajo `<RequireAuth>`
  + `Layout` (nav inferior). Rutas: `/`, `/items/new`, `/items/:id`, `/trips`, `/trips/:id`,
  `/trips/stores`, `/trips/sections`, `/plans`, `/plans/new`, `/plans/:id`, `/events`,
  `/events/:id`, `/reports`, `/chat`, `/calendar`, `/mine`, `/history`, `/notifications`,
  `/family`, `/family/members`, `/family/invite`, `/family/join`, `/rules`, `/settings`.
- Data layer `src/lib/api/` (transport + typed clients) consumed via TanStack Query.
- Design system en `src/shared/ui/` (tokens, primitivas, form, layout, navigation,
  data-display, feedback); `src/index.css` solo importa `styles/{fonts,tokens,base,scrollbar}.css`.
- Backend (Rust, comparte la misma lógica en desktop y web):
  - `src-tauri/src/` — `lib.rs` (builder + prune de presencia + saver en segundo plano),
    `state.rs` (`AppState { db_ready, store: Mutex<AppStore> }`), `error.rs` (`AppError`,
    con `to_http_status()`), `persist.rs` (guardado/restauración JSON), `domain/` (lógica pura:
    auth, home, item, trip, plan, event, section, presence, chat, rules, notification),
    `store/` (repositorios en memoria: auth, items, trips, presence, home, events, sections,
    plans, chat, rules).
  - `src-tauri/src/commands/` — `app`, `auth`, `health` (live/ready/healthy), `items`,
    `presence`, `trips`, `home`, `events`, `plans`, `sections`, `reports`, `rules`, `chat`,
    `timeline`, `backup` (IPC Tauri).
  - `src-tauri/src/bin/server.rs` — servidor HTTP axum (feature `server`), mismos endpoints
    sobre el mismo `AppState`, con `auth_guard` (deriva el actor del token).
- DB (sqlx/diesel), docker self-hosting, SSE/websockets en tiempo real: fase 2.

## Design system (follow `DESIGN.md` for any UI work)

Flat: no shadows, no borders-as-separators, no gradients; one brand color (green `#16A34A`). Dark mode = green-tinted backgrounds, never neutral gray. Tokens in `src/shared/ui/styles/tokens.css` implement `DESIGN.md` (verde protagonista, neutros, semáforo, escala fluida con `clamp()`, modo oscuro, safe areas, `data-mode="tv"` para 10-foot). `DESIGN.md` is the authority.
