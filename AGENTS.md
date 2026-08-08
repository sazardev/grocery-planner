# AGENTS.md — Grocery Planner

Self-hosted family shopping planner. Tauri v2 desktop app (Rust backend) + React 19 SPA (Vite 8). Phase-1 foundation only — no shopping features yet. Product spec: `SPEC.md`, design system: `DESIGN.md`, session log: `MEMORY.md` (all in Spanish; UI copy is Spanish).

## Commands

| Task | Command |
|---|---|
| Web dev (browser) | `npm run dev` (localhost:5173) |
| Desktop dev | `npm run tauri:dev` (auto-runs `npm run dev`) |
| Backend HTTP (web/self-hosted) | `cargo run --features server --bin server` (localhost:8787) |
| Typecheck + build | `npm run build` (`tsc -b && vite build`) |
| Lint | `npm run lint` (oxlint) |
| Package desktop | `npm run tauri:build` (auto-runs `npm run build`) |
| Check Rust backend | `cargo check` in `src-tauri/` |

## Gotchas

- **Not a git repo** — no `git` commands (user decision pending).
- **Web dev needs the HTTP server running**: in the browser, `transport.ts` uses fetch
  against `http://localhost:8787` (override con `VITE_API_URL`). Arranca el backend con
  `cargo run --features server --bin server` antes de probar la UI web; sin él, HomePage
  muestra "No se pudo conectar…" (esperado). En desktop (`tauri:dev`) se usa IPC, no HTTP.
- **Adding a backend command touches two layers**: add a `#[tauri::command]` under
  `src-tauri/src/commands/`, register it in `generate_handler![]` in `src-tauri/src/lib.rs:16`,
  expose a typed client in `src/lib/api/` that calls `request()`, AND (web) mapear el
  comando a su endpoint HTTP en `ROUTES` dentro de `src/lib/api/transport.ts` (y crear el
  handler en `src-tauri/src/bin/server.rs` si no existe).
- **Server feature**: el binario HTTP (axum) está detrás de `#[cfg(feature = "server")]`
  (`required-features` en `Cargo.toml`). `cargo check`/`cargo test` por defecto NO lo
  compilan; usa `cargo check --features server --bin server` para validarlo.
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

- Frontend entry `src/main.tsx` → `App.tsx` routes (`/`, `/lists`, `/settings`) under `Layout`.
- Data layer `src/lib/api/` (transport + typed clients) consumed via TanStack Query.
- Backend (Rust, comparte la misma lógica en desktop y web):
  - `src-tauri/src/` — `lib.rs` (builder + prune de presencia), `state.rs`
    (`AppState { db_ready, store: Mutex<AppStore> }`), `error.rs` (`AppError`, con
    `to_http_status()`), `domain/` (lógica pura: ítems con máquina de estados e historial,
    mandados, presencia), `store/` (repositorios en memoria: items, trips, presence).
  - `src-tauri/src/commands/` — `app`, `health` (live/ready/healthy), `items`,
    `presence`, `trips` (IPC Tauri).
  - `src-tauri/src/bin/server.rs` — servidor HTTP axum (feature `server`), mismos
    endpoints sobre el mismo `AppState`.
- DB (sqlx/diesel), docker self-hosting, SSE/websockets en tiempo real: fase 2.

## Design system (follow `DESIGN.md` for any UI work)

Flat: no shadows, no borders-as-separators, no gradients; one brand color (green `#16A34A`). Dark mode = green-tinted backgrounds, never neutral gray. Note: current `src/index.css` tokens are slate-based placeholders that diverge from `DESIGN.md`; the doc is the authority.
