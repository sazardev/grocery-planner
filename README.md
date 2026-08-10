<div align="center">

# 🛒 Grocery Planner

**Planeador de compras self-hosted para una familia.**

Una sola lista de compras compartida, en tiempo real, desde cualquier dispositivo
de la casa: celular, tablet, PC y web. Pensado para el día a día: uno checa la
despensa, otro va al mandado, y nadie se duplica.

</div>

![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Rust](https://img.shields.io/badge/Rust-1.77+-orange.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db.svg)
![PRs: bienvenidas](https://img.shields.io/badge/PRs-bienvenidas-brightgreen.svg)

---

## ✨ Características

- **Lista de compras compartida**: ítems con cantidad, unidad, categoría,
  prioridad, nota, fotos, precio y asignación a quién los lleva.
- **Ciclo de vida del ítem**: `falta → pedido → ya lo llevo → comprado`, con
  historial completo de quién hizo qué y cuándo.
- **Mandados y planes de compra**: quién va, a dónde, a qué hora, con recurrencia
  semanal/quincenal/mensual y confirmación de recibo.
- **Calendario familiar**: eventos (cumpleaños, comidas, celebraciones),
  mandados y planes en vista día/semana/mes/año.
- **Chat del hogar**: mensajes con fotos, menciones `@Nombre`, reacciones,
  mensajes fijados y mensajes del sistema derivados del historial.
- **Historial total y reportes**: línea de tiempo, "lo que más compramos",
  gasto aproximado, mandados por persona, proyección de faltas y "repetir compra".
- **Hogar con roles**: miembro / organizador / admin, invitaciones por enlace,
  QR y código corto, expulsión y clave de respaldo.
- **Presencia en tiempo real**: quién está conectado, en línea / hace X min.
- **Auth**: cuentas con Argon2id, sesiones múltiples y revocación remota, PIN
  rápido, recuperación por clave de respaldo.
- **Notificaciones**: menciones, llegada del mandado, ajustes por miembro.
- **Persistencia en disco**: nada se pierde al reiniciar el servidor.
- **Self-hosted**: todo vive en tu red; exportar/importar respaldo completo.

> 📖 La lógica de producto completa está en [SPEC.md](SPEC.md) y el sistema de
> diseño en [DESIGN.md](DESIGN.md). El modelo de datos en [DATA.md](DATA.md).

## 📦 Requisitos

- Node.js ≥ 20 y npm
- Rust 1.77+ (toolchain stable)
- Tauri v2: dependencias del sistema ([Linux](https://v2.tauri.app/start/prerequisites/),
  Windows, macOS)
- El navegador necesita el backend HTTP corriendo (abajo).

## 🚀 Arranque rápido

```bash
# 1) Backend HTTP self-hosted (puerto 8787) — necesario para el navegador
cd src-tauri
cargo run --features server --bin server

# 2) En otra terminal: web en el navegador
npm run dev            # http://localhost:5173

# 3) Desktop nativo (arranca el frontend solo)
npm run tauri:dev
```

### Datos de demostración

```bash
npm run seed
```

Siembra una familia demo (10 miembros, reglas, secciones, ítems, mandados,
planes, eventos y chat). Usa `VITE_API_URL` o `GP_API_URL` para apuntar al
backend (default `http://localhost:8787`).

### Entrar

En `/login` usa la cuenta de prueba `admin` / `admin123` (botón "Entrar con la
cuenta de prueba"). En **Ajustes** crea el hogar de la familia y comparte la
invitación.

> ⚠️ La cuenta `admin` es de desarrollo. Cámbiala antes de exponer el hogar a
> internet.

## 🧱 Arquitectura

| Capa | Tecnología |
|---|---|
| UI | React 19 + TypeScript + Vite 8 (SPA) |
| Data fetching | TanStack Query 5 |
| Shell nativo | Tauri v2 |
| Backend | Rust — lógica compartida entre desktop (IPC) y web (HTTP axum) |
| Persistencia | JSON en disco (fase 1); DB sqlx/diesel en fase 2 |

El mismo `AppState` alimenta los commands Tauri y el servidor HTTP:
`src-tauri/src/` → `domain/` (lógica pura), `store/` (repositorios en memoria),
`commands/` (commands IPC), `bin/server.rs` (HTTP axum con `auth_guard`).
El frontend consume todo vía `src/lib/api/` (transporte = `invoke` o `fetch`).

Detalle operativo y gotchas: [AGENTS.md](AGENTS.md).

## ✅ Verificación

```bash
npm run build                          # tsc -b + vite build
npm run lint                           # oxlint
cargo test                             # en src-tauri/ (102 tests)
cargo check --features server --bin server   # valida el binario HTTP
npm run tauri:build                    # empaqueta desktop (.deb/.rpm; AppImage no en esta máquina)
```

## 🗺️ Hoja de ruta (fase 2)

- Base de datos real (sqlx/diesel) y almacenamiento de fotos en disco.
- Docker self-hosting multi-plataforma.
- Tiempo real por SSE/websockets (presencia y chat en vivo sin polling).
- Builds para Windows/macOS y CI.
- Móvil (Tauri Android/iOS).

## 🤝 Contribuir

Las contribuciones son bienvenidas. Revisa [CONTRIBUTING.md](CONTRIBUTING.md)
para el flujo, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) para las reglas de
convivencia y [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## 📄 Licencia

[Apache-2.0](LICENSE) © 2026 Omar Flores Salazar
