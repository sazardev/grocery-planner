# Grocery Planner

Planeador de compras **self-hosted** para una familia: lista de compras compartida,
mandados, planes, calendario, chat, historial y reportes. Todo en español.

- **Stack**: React 19 + TypeScript + Vite (SPA), Tauri v2 (desktop) y backend Rust
  compartido entre desktop (IPC) y web (HTTP axum self-hosted).
- **Documentos**: producto `SPEC.md`, diseño `DESIGN.md`, bitácora `MEMORY.md`,
  guía para agentes `AGENTS.md`.

## Quickstart

```bash
# Backend HTTP (necesario para probar en el navegador)
cargo run --features server --bin server   # en src-tauri/ → http://localhost:8787

# Web en el navegador
npm run dev                                 # http://localhost:5173

# Desktop
npm run tauri:dev

# Datos de demostración (familia con sesiones reales)
npm run seed
```

Entra con la cuenta de prueba `admin` / `admin123` (o el botón en `/login`).
Los datos se persisten en disco y sobreviven al reinicio del servidor.

## Verificación

```bash
npm run build        # tsc -b + vite build
npm run lint         # oxlint
cargo test           # en src-tauri/ (102 tests)
cargo check --features server --bin server   # en src-tauri/ (valida el binario HTTP)
```

## Alcance

Fase 1 completa (todos los apartados del SPEC en UI + API). Fase 2 (fuera de alcance
por ahora): DB real (sqlx/diesel), docker self-hosting, tiempo real por SSE/websockets.
