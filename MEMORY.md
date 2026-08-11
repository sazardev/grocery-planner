# Memory — Grocery Planner

Bitácora de lo hecho por sesión (primera sesión: 2026-08-07).

## Contexto del proyecto

App **planeador de compras para una familia**: self-hosted, docker, conectado entre dispositivos.
Solicitud: crear **solo la fundación** (sin funcionalidad de compras aún), pensada para correr en
Windows, Linux, macOS, web y (futuro) móvil.

Ubicación: `/home/omar/personal/grocery-planner`

## Stack elegido (confirmado con el usuario)

| Capa | Tecnología | Versión |
|---|---|---|
| UI | React | 19.2.x |
| Lenguaje front | TypeScript | 7.0.2 (latest en npm) |
| Bundler | Vite | 8.2.x |
| Router | React Router DOM | 7.11.0 (pin por advisory GHSA-qwww-vcr4-c8h2) |
| Data fetching | TanStack Query | 5.101.x |
| Shell nativo | Tauri | v2 (2.11.x) |
| Backend | Rust (integrado en Tauri) | 1.97.0 |

Decisiones tomadas por el usuario:
- React 19 + TypeScript 7 (la 7 sí existe: `typescript@7.0.2`).
- Plataformas: Desktop + Web + Móvil (móvil **cancelado** a mitad de sesión; quedó fuera).
- Backend: **Rust con Tauri** (docker self-hosted se agrega en fase 2).

## Qué se creó

### Frontend (`src/`)
- `main.tsx` — entry con `QueryClientProvider` + `BrowserRouter`.
- `App.tsx` — rutas: `/` (Inicio), `/lists` (Listas), `/settings` (Ajustes), envueltas en `Layout`.
- `components/Layout.tsx` — nav + `Outlet`.
- `pages/` — `HomePage` (conecta al backend vía `app_info`), `ListsPage`, `SettingsPage` (placeholders).
- `lib/platform.ts` — detecta `web` | `desktop` | `mobile` (`__TAURI_INTERNALS__` en window).
- `lib/api/transport.ts` — abstracción de transporte: desktop/móvil usa `invoke` de Tauri;
  web usa HTTP. El fetch al backend self-hosted queda marcado `TODO(fase 2)`.
- `lib/api/index.ts` — clientes `getAppInfo()` y `greet()`.
- `domain/item.ts` — modelo `GroceryItem`, `ItemStatus` (falta/pedido/llevo/comprado/cancelado),
  `Priority` y `STATUS_LABEL` (alineado al SPEC).

### Design system (implementado — ver `DESIGN.md` como autoridad)
- `styles/fonts.css` — General Sans (pesos 400/500/600/700) descargada desde Fontshare y
  hosteada localmente en `src/assets/fonts/*.woff2` (no está en npm).
- `styles/tokens.css` — tokens CSS: colores claro/oscuro (verde `#16A34A`, fondo humo, modo
  oscuro verde-negro `#0C1510`), escala tipográfica, espaciado base 4, radios, motion.
- `styles/base.css` — reset + base (fuente, colores, focus-ring, helper `.numeric`).
- `index.css` — solo importa fonts/tokens/base.
- `components/ui/` — design system custom (sin librería UI):
  - `Button.tsx` (+module.css) — variantes primary/secondary/ghost/danger, tamaños sm–xl,
    píldora, sin sombra/borde, scale 0.97 en press.
  - `Chip.tsx` — tones default/warning/danger/info/muted (estados del SPEC).
  - `Input.tsx` — "filled compacto": caja sólida sin borde, label arriba fijo, focus-ring.
  - `Avatar.tsx` — iniciales o foto, tamaños sm/md/lg.
  - `Checkbox.tsx` — checkbox redondo, relleno verde con check SVG al marcar.
  - `ItemRow.tsx` — la fila de ítem: checkbox + nombre + cantidad tabular + metadatos con
    avatar + chip de estado. Estados visuales: `carried` (fondo verde suave) y `done` (opacado + tachado).
- `pages/HomePage.tsx` — reescrita con el design system: título "¿Qué falta?", chips de
  filtro, lista de `ItemRow` con datos seed, botón "Falta…" grande (size xl, full).
- `pages/ListsPage.tsx` y `SettingsPage.tsx` — estilo actualizado a tokens.

### Backend Rust (`src-tauri/src/`)
- `lib.rs` — builder con plugin `tauri-plugin-log`, maneja `AppState` y registra handlers.
- `state.rs` — `AppState { db_ready: bool }` (placeholder para sqlx/DB en fase 2).
- `error.rs` — enum `AppError` serde-tagged (Database/NotFound/InvalidInput/Conflict/Internal).
- `commands/mod.rs` + `commands/app.rs` — `greet` (validación de input) y `app_info` (versión + estado DB).

### Configuración
- `src-tauri/tauri.conf.json` — identifier `com.groceryplanner.app`, productName "Grocery Planner",
  frontendDist `../dist`, devUrl `localhost:5173`.
- `src-tauri/Cargo.toml` — paquete renombrado a `grocery-planner`, lib `grocery_planner_lib`
  (renombrado de `app`/`app_lib` de la plantilla).
- `package.json` — scripts: `dev`, `build`, `lint`, `preview`, `tauri:dev`, `tauri:build`.
- `.gitignore` — agregado `src-tauri/target` y `src-tauri/gen/schemas`.

## Comandos útiles

```bash
npm run dev          # web en http://localhost:5173
npm run tauri:dev    # desktop (desarrollo)
npm run build        # typecheck (tsc -b) + build vite
npm run lint         # oxlint
npm run tauri:build  # empaquetar desktop (deb/rpm/appimage…)
```

## Verificación

- `npm run build` ✓
- `npm run lint` ✓
- `cargo check` ✓ (sin warnings tras corregir import sin usar)
- `npm run tauri:build` ✓ → binario 11M + `.deb` + `.rpm` en
  `src-tauri/target/release/bundle/`
- Design system: build de Vite empaqueta las 4 fuentes `.woff2`; DOM verificado con
  headless chromium (filas carried/done, chips, avatares, filtros, botón grande).

## Problemas encontrados

1. **react-router 7.12+ vulnerable** (GHSA-qwww-vcr4-c8h2, CSRF RSC). Se fijó `react-router-dom@7.11.0`.
2. **AppImage falla** con `linuxdeploy` en Arch/CachyOS (conocido; no bloquea el build).
3. **`tauri android init` requiere Java + Android SDK** — no instalado en la máquina.
   El usuario canceló móvil por ahora.
4. **General Sans no está en npm** (es de Indian Type Foundry vía Fontshare) — se descargaron
   los woff2 al repo para funcionar offline/self-hosted.
5. **Errores de ruta en `@import` CSS** de Vite: los imports de `index.css` deben apuntar a
   `./styles/…`, no `./…`.

## Notas / deudas pendientes (fase 2+)

- Transporte HTTP real en `transport.ts` apuntando al backend self-hosted (docker).
- Inicializar DB real (sqlx/diesel) y conectar `db_ready`.
- Docker multi-plataforma para el backend Rust.
- AppImage (linuxdeploy) y builds para Windows/macOS desde CI.
- Móvil: reinstalar decisión + instalar Java/Android SDK (en CachyOS falló la firma de pacman;
  `pacman-key --init/--refresh-keys` quedó a medio correr y el usuario lo abortó).
- Repo git: **resuelto** — el proyecto quedó inicializado como repositorio git (rama `main`).

---

## Sesión backend Rust (2026-08-07, tarde)

Se extendió el backend con los módulos del SPEC (todo en `src-tauri/src/`, con tests y
endpoints HTTP en `src/bin/server.rs`). `cargo test`: **59 tests pasan**;
`cargo check --features server --bin server` sin warnings.

### Nuevo en el ítem (`domain/item.rs` + `store/item.rs` + `commands/items.rs`)
- `price: Option<f64>` (precio aprox. para reportes, §8.2) y `section: Option<String>` (§4.4).
- `comments: Vec<ItemComment>` con evento de historial `Commented` (§4.6/§11.3).
- Commands: `item_add_comment`, `item_set_price`, `item_set_section`, `items_query` (búsqueda
  y filtros combinables §4.5: search, status, category, priority, section, requestedBy,
  assignedTo, urgent, onlyComments). `item_create` ahora acepta price y section.
- Endpoints: `POST /api/items/query`, `POST /api/items/{id}/comment`,
  `PATCH /api/items/{id}/price`, `PATCH /api/items/{id}/section`.

### Hogar, miembros y roles (§3) — `domain/home.rs`, `store/home.rs`, `commands/home.rs`
- `Role` (miembro/organizador/admin), `Home` con clave de respaldo, invitaciones con
  token (enlace/QR) + código corto 6 dígitos (`492-113`), caducidad, límite de usos y revocación.
- Reglas: solo Admin gestiona; el último Admin no se expulsa/degrada.
- Commands: `home_create`, `home_info`, `home_add_member`, `home_remove_member`,
  `home_change_role`, `home_invite_create/revoke/accept`, `home_backup_key_regenerate`.
- Endpoints: `/api/home` (POST/GET), `/api/home/members` (POST),
  `/api/home/members/{name}` (DELETE), `/api/home/roles` (PATCH),
  `/api/home/invitations` (POST), `/api/home/invitations/{id}/revoke`,
  `/api/home/invitations/accept`, `/api/home/backup-key`.

### Eventos y calendario (§9) — `domain/event.rs`, `store/event.rs`, `commands/events.rs`
- `Event` con fecha (AAAA-MM-DD validada), hora opcional, all_day, tipo
  (cumpleaños/unión/comida/celebración/reunión/mandado), participantes, recurrencia anual,
  y `item_ids` (lista del evento §9.4).
- Commands: `events_list`, `events_list_range`, `event_create/get/delete`,
  `event_add_item`, `event_remove_item`.
- Endpoints: `/api/events` (GET/POST), `/api/events/range?start&end`,
  `/api/events/{id}` (GET/DELETE), `/api/events/{id}/items/add|remove`.

### Secciones (§4.4) — `domain/section.rs`, `store/section.rs`, `commands/sections.rs`
- `Section` con nombre y posición. Commands: `sections_list`, `section_create/rename/delete`.
- Endpoints: `/api/sections` (GET/POST), `/api/sections/{id}` (PATCH/DELETE).

### Planes de compra (§7.1) — `domain/plan.rs`, `store/plan.rs`, `commands/plans.rs`
- `Plan` con `scheduled_at` (AAAA-MM-DDTHH:MM validada), tienda, asignado, recurrencia
  (ninguna/semanal/quincenal/mensual), estados (planificado/activo/completado/cancelado).
- Commands: `plans_list`, `plan_create/get/activate/complete/cancel`.
- Endpoints: `/api/plans` (GET/POST), `/api/plans/{id}`, `/activate`, `/complete`, `/cancel`.

### Reportes y proyección (§8.2 y §7.2/§7.3) — `commands/reports.rs`
- Lógica pura `compute_*` compartida entre IPC y HTTP (patrón de `health_report`).
- `reports_top_products` (más comprados), `reports_spending` (suma de precios de lo
  comprado), `reports_trips_by_member`, `reports_projection` (cadencia en días + días
  estimados hasta que falte, desde los eventos "comprado" del historial).
- Endpoints: `/api/reports/top-products`, `/spending`, `/trips-by-member`, `/projection`.

### Verificación
- `cargo test`: 59 passed. `cargo check --features server --bin server`: ok.
- Smoke test HTTP en puerto 8899: hogar → invitación → aceptar (código corto) → sección →
  ítem con precio/sección → comentar → comprado → evento+ítem → plan → reports →
  query urgentes → 404. Todo responde como se espera.

---

## Conexión frontend ↔ backend (2026-08-07, noche)

Se conectó el frontend con todos los commands del backend (capas: dominio TS → clientes
API → transporte web → páginas). `npm run build` ✓, `npm run lint` ✓, smoke test con
Vite dev + servidor HTTP ✓.

### Tipos de dominio (`src/domain/`)
- `item.ts`: + `price`, `section`, `comments: ItemComment[]` y evento `commented` (alineado al Rust).
- Nuevos: `home.ts` (Role/Member/Invitation/HomeView + `ROLE_LABEL`), `event.ts`
  (Event/EventType + `EVENT_TYPE_LABEL`), `plan.ts` (Plan/Recurrence/PlanStatus +
  `RECURRENCE_LABEL`), `section.ts`, `report.ts` (TopProduct/SpendingReport/
  MemberTripCount/Projection).

### Clientes API (`src/lib/api/`)
- `items.ts`: + `price`/`section` en `CreateItemInput` y `createItem`; nuevas funciones
  `queryItems`, `addItemComment`, `setItemPrice`, `setItemSection`.
- Nuevos: `home.ts` (createHome/getHome/addHomeMember/removeHomeMember/changeHomeRole/
  createInvitation/revokeInvitation/acceptInvitation/regenerateBackupKey), `events.ts`
  (list/listInRange/create/get/delete/addItem/removeItem), `plans.ts` (list/create/get/
  activate/complete/cancel), `sections.ts` (list/create/rename/delete), `reports.ts`
  (top/spending/tripsByMember/projection).
- `index.ts`: exporta todos los clientes.

### Transporte web (`src/lib/api/transport.ts`)
- ~35 rutas nuevas en `ROUTES` (items_query, comment, price, section, home*, events*,
  plans*, sections*, reports*). `item_create` ahora manda `price` y `section`.

### Páginas conectadas
- **HomePage**: datos reales con `useQuery(listItems)` + invalidation con
  `useMutation(changeItemStatus)` para el toggle, y `parseQuickEntry → createItem` para
  el botón "Falta…". Estados de carga (Skeleton) y error (Alert). Filtros en cliente.
- **ListsPage**: crea y lista mandados y planes de compra reales.
- **SettingsPage**: crea el hogar si no existe, muestra miembros con roles, clave de
  respaldo y crea invitaciones (muestra el código corto).
- `src/lib/me.ts`: `ME = 'Ana'` — placeholder del usuario actual (sin auth, fase 2).

### Verificación
- `tsc -b` ✓, `oxlint` ✓, `vite build` ✓ (1930 módulos).
- Backend en 8787 + Vite dev: endpoints de las páginas responden (home 404→create,
  items, query urgentes, trips/plans/sections vacíos), módulos TSX transforman sin error.

---

## Re-levantar servidor + prueba E2E completa (2026-08-07, tarde/noche)

Se levantó de nuevo `http://localhost:5173` (Vite dev) + backend HTTP en 8787 y se
verificó end-to-end con **chromium headless + puppeteer-core** (`/tmp/opencode/ui-test/`):
**78/78 checks pasan** (UI real + capa de datos completa importando `/src/lib/api/index.ts`
en la página).

### Trabajo sobre el WIP del usuario (ItemSheet)
El usuario estaba a medias con `src/pages/ItemSheet.tsx` (editor de ítems) y agregó por su
cuenta al backend/cliente: `item_update`, `item_set_priority`, `item_move`, `item_delete`
(+ `updateItem`/`setItemPriority`/`moveItem`/`deleteItem`/`MoveDirection` en `src/lib/api/items.ts`),
rutas en `transport.ts`, handlers en `server.rs` y wiring en `HomePage`.
Se completó lo que faltaba para compilar:
- `src/shared/ui/primitives/IconButton.tsx`: se agregó `'danger'` a `IconButtonVariant`
  (el CSS `.danger` ya existía).
- `src-tauri/src/bin/server.rs` + `src/lib/api/transport.ts`: se agregó el endpoint
  `/api/greet` (POST) — era el único command sin ruta HTTP (rompía `app.greet` en web).

### Cobertura del test E2E (78 checks)
- **UI**: conexión al backend, agregar ítems por texto libre ("pollo 2kg", "leche 1 l"),
  toggle "ya lo llevo", filtro por estado, ItemSheet completo (abrir, renombrar y guardar,
  cambiar estado a comprado, eliminar), crear mandado, crear plan, crear hogar + ver miembros
  y clave de respaldo, invitación con código corto (`746-595`).
- **Capa de datos (todo el SPEC)**: health (live/ready/healthy), app (appInfo/greet), items
  (flows, parse, validate, transition, create/get/update/setPriority/move/comment/price/
  section/changeStatus/history/query/list/delete + reglas de guard 409), sections CRUD,
  trips (create/addItem/assign/complete/list + guard), plans (create/get/activate/complete),
  events (create/get/list/range/items/delete), home (get/addMember/changeRole/invite/
  accept/revoke/remove/backupKey + guard último Admin), reports (top/spending/trips/
  projection), presencia (heartbeat/list/leave).

### Errores del test corregidos (selectores/expectativas, no del código)
- El placeholder del quick-add es "leche 1 l, arroz 2kg…" (no "pollo 2kg").
- `waitText` coincidía con el texto aún escrito en inputs → se espera el aria-label del FAB
  ("Agregar lo que falta") que solo aparece cuando el form cerró.
- En SettingsPage, al crearse el hogar el input se DESMONTA → esperar a que desaparezca,
  no a que se vacíe.
- En el ItemSheet, cambiar estado NO cierra el dialog (por diseño) → cerrar con "Cerrar".
- Los 409 de las pruebas de reglas de negocio aparecen como errores de recurso en consola
  → se filtran de la comprobación "sin errores JS".

### Estado final
- `cargo test`: 59 passed. `cargo check --features server --bin server` ✓, `npm run build` ✓,
  `npm run lint` ✓.
- Servidores arriba: Vite en `http://localhost:5173`, backend en `:8787` (store limpio).
- Pendiente (fuera de alcance de esta sesión): DB real (fase 2), auth real, docker.

---

## Páginas de detalle + E2E completo (2026-08-07, tarde/noche)

### Trabajo sobre el WIP del usuario
El usuario construyó en paralelo las páginas de detalle y reescrituras:
- `HomePage`: FAB → `/items/new`, fila → `/items/:id` (ya no usa el modal ItemSheet; se eliminó).
- Nuevas páginas: `ItemDetailPage` (editar/prioridad/estado/mover/eliminar), `NewItemPage`
  (captura rápida), `TripDetailPage` (asignar/empezar/completar/cancelar), `PlanDetailPage`
  (activar/completar/cancelar), `NotFoundPage`, `ShareButton` + hooks `useDocumentTitle`,
  `useMeta`, `useShare`.

### Lo que completé / arreglé
- **`trips_activate` faltante**: el botón "Empezar mandado" llamaba `completeTrip` (bug).
  Agregué el comando de activación completo: `commands/trips.rs` (`trips_activate`),
  registrado en `lib.rs`, endpoint HTTP `POST /api/trips/{id}/activate` en `server.rs`,
  `activateTrip()` en `src/lib/api/trips.ts` y ruta `trips_activate` en `transport.ts`.
- **`src/lib/hooks/useShare.ts`** (faltaba): Web Share API con fallback a portapapeles;
  devuelve `{ share, result, reset }` con `result: 'idle' | 'copied' | 'error'`.
- **`ShareButton.tsx`**: import de `useShare` con ruta incorrecta (`../../lib` → resuelve a
  `src/shared/lib`); corregido a `../../../lib/hooks/useShare.ts`.
- **`ItemRow.tsx`**: `stopPropagation` en el checkbox para que "ya lo llevo" no dispare la
  navegación al detalle.

### Verificación
- `cargo test`: **64 passed** (agregué tests del nuevo comando). `cargo check --features server` ✓.
- `npm run build` ✓, `npm run lint` ✓.
- **E2E con chromium headless: 87/87 checks** cubriendo:
  - HomePage + `/items/new` (agregar por texto libre), toggle "ya lo llevo", filtros.
  - `ItemDetailPage` (`/items/:id`): abrir, editar y guardar, cambiar estado, eliminar.
  - Nav inferior (Inicio · Mandado · Plan · Ajustes).
  - `TripsPage` + `TripDetailPage`: crear, asignarse, empezar mandado (activa), completar.
  - `PlansPage` + `PlanDetailPage`: crear, activar, completar.
  - `SettingsPage`: crear hogar + invitación con código corto.
  - `NotFoundPage`: ruta inexistente.
  - Capa de datos completa (todo el SPEC) + reglas de guard (409).
- Nota de infraestructura: el backend (binario `server`) debe arrancarse en un comando de
  shell separado del test E2E; si se arranca y se corre el test en el mismo comando, el grupo
  de procesos se mata al terminar (el server cae a mitad del test).

---

## Implementación de las funciones que solo estaban en backend (2026-08-07, noche)

Se llevaron a la UI todas las funciones del SPEC que solo existían en la API. `cargo test`
64 ✓, `npm run build` ✓, `npm run lint` ✓, E2E **97/97 checks**.

### HomePage (`/`)
- Búsqueda instantánea + filtros avanzados vía `queryItems` (§4.5): texto, estado
  (pestañas Todas/Falta/Pedido/Llevo/Comprado), chips "Solo urgente" y "Con comentarios".
- Tarjeta de **presencia** (quién está conectado, §12) con heartbeat cada 15s.
- Tarjeta de **proyección** "Pronto hará falta…" (§7.2, estFaltaInDays ≤ 3).
- Botón "Ver reportes de la familia" → `/reports`.

### ItemDetailPage (`/items/:id`)
- Formulario extendido: **categoría y precio aprox.** (se guardan con `updateItem`/`setItemPrice`).
- Select **"Quién lo lleva"** (asignar a un miembro del hogar, §6).
- Select **"Sección de la lista"** (asignar a una sección existente, §4.4).
- Sección **Comentarios de la familia** (§4.6/§11.3): lista + agregar.
- Sección **Historial** del ítem (§8.1) con línea de tiempo.

### SettingsPage (`/settings`)
- **Gestión de miembros** (§3.5): select de rol (cambio), botón Expulsar con confirmación
  de 2 pasos ("¿Seguro?"), sin permitir expulsarse a uno mismo (el backend guarda el último Admin).
- **Invitaciones activas**: listado con usos y botón Revocar; chip "REVOCADA".
- **Unirse con invitación** (§3.3): aceptar un código corto + nombre.

### Eventos (`/events` y `/events/:id`) — nuevo (antes solo backend)
- Crear evento (nombre, fecha, hora, tipo, lugar, nota, todo el día, recurrencia anual).
- Lista separada "Próximos / Ya pasaron".
- Detalle: info, **lista del evento** (agregar ítems desde la lista, quitar), borrar, compartir.
- Nav inferior: Inicio · Mandado · Plan · **Eventos** · Ajustes.

### Reportes (`/reports`) — nuevo
- **Próximas faltas** (cadencia + días estimados, §7.2/§7.3), **Lo que más compramos**
  (§8.2), **Gasto aproximado** (suma de precios, moneda es-MX), **Mandados por persona**.

### Verificación
- E2E ampliado a 97 checks: búsqueda, comentario/precio/categoría en detalle, eventos
  (crear/agregar ítem/borrar), reportes, gestión de miembros (aceptar invitación, cambiar
  rol, revocar, expulsar), nav con 5 ítems, capa de datos completa.
- `cargo test` 64 ✓ · `npm run build` ✓ · `npm run lint` ✓.

---

## Autenticación, sesiones y protección de rutas (2026-08-07, noche)

Implementado el apartado §2 del SPEC (crear cuenta, iniciar sesión, sesiones, revocación),
protección de rutas en React y autenticación real del API HTTP. `cargo test` **76 passed**,
`cargo check --features server --bin server` ✓, `npm run build` ✓, `npm run lint` ✓,
**E2E auth 20/20 + regresión 4/4** (chromium headless, puerto 8787 + Vite).

### Backend Rust
- **`error.rs`**: nueva variante `Unauthorized` (HTTP 401, serde `unauthorized`).
- **`domain/auth.rs`** (nuevo): `User` (nombre único, `password_hash` **argon2id** con salt
  aleatorio vía `argon2 0.5` — dep añadida; la contraseña nunca viaja/guarda en claro, §15) y
  `Session` (token UUID v4, dispositivo, creado/último uso, revocada). Validaciones: nombre
  ≤ 40 chars, password ≥ 6.
- **`store/auth.rs`** (nuevo): cuentas indexadas por id + índice nombre→id, sesiones por token;
  `register`, `login`, `user_by_token`, `revoke`, `sessions_of`, `change_password`, `link_home`.
- **`commands/auth.rs`** (nuevo, registrado en `lib.rs`): `auth_register`, `auth_login` (con
  `device`), `auth_logout`, `auth_me`, `auth_sessions` (marca la sesión actual), 
  `auth_revoke_session` (la propia siempre; la ajena solo si el actor es Admin del hogar),
  `auth_change_password`.
- **`commands/home.rs`**: `home_create` y `home_invite_accept` ahora **ligan la cuenta al hogar**
  (`user.home_id`), para que `auth_me` exponga a qué hogar perteneces.
- **`bin/server.rs`**:
  - Endpoints: `POST /api/auth/register`, `POST /api/auth/login` (públicos) y `logout`/`me`/
    `sessions`/`sessions/revoke`/`password` (autenticados).
  - **Middleware `auth_guard`**: todo `/api/*` exige `Authorization: Bearer <token>` salvo
    `PUBLIC_PATHS` (`/health`, `/api/app-info`, `/api/greet`, `/api/auth/register|login`).
    Capa CORS queda por fuera para no bloquear preflight OPTIONS.

### Frontend React
- **`domain/auth.ts`** + **`lib/api/auth.ts`** (nuevos): tipos `User/AuthView/Session` y
  clientes `registerAccount/login/logout/me/listSessions/revokeSession/changePassword`.
- **`transport.ts`**: rutas HTTP de auth; **inyección del header Bearer** en web
  (`setAuthToken/getAuthToken`) y callback global **`onUnauthorized`** (ante 401 limpia sesión
  → la UI redirige a /login).
- **`lib/auth/`** (nuevo): `storage.ts` (token en localStorage, key `grocery-planner.auth.token`),
  `AuthProvider.tsx` (contexto: valida el token guardado al abrir la app con `auth_me`;
  `signIn/signUp/signOut`; registra `onUnauthorized`), `useAuth.ts`, `RequireAuth.tsx`
  (redirige a `/login` guardando `state.from` para volver).
- **`lib/me.ts`**: ahora es un binding vivo (`export let ME` + `setMe()`) alimentado por la
  sesión — sustituye al `ME = 'Ana'` estático; las páginas siguen igual sin refactor.
- **Páginas**: `pages/auth/LoginPage.tsx` y `RegisterPage.tsx` (+`AuthShell`) con el design
  system. **`App.tsx`**: `AuthProvider` envuelve las rutas; `/login` y `/register` públicas;
  todo lo demás bajo `<RequireAuth>`.
- **`SettingsPage.tsx`**: tarjeta "Tu cuenta" (siempre visible) con nombre, **Cerrar sesión** y
  **Dispositivos conectados** (lista de sesiones, "este dispositivo", cerrar sesiones remotas §2.4).
- **Rutas faltantes conectadas** (las construyó el usuario sin registrarlas): `/plans/new`,
  `/events`, `/events/:id`, `/reports`.

### Verificación
- `cargo test`: **76 passed** (12 nuevos de auth). `cargo check` 0 warnings.
- E2E auth (20 checks): redirección sin sesión, registro, crear hogar, recarga conserva sesión,
  logout, login, lista/revocación de sesiones vía API, 401 → redirección + limpieza, nombre
  repetido, password incorrecta, validación de password corta.
- Regresión (4 checks) con sesión: crear ítem, mandado y plan.
- Smoke HTTP directo: sin token 401; register/login/me/sessions/revoke/change-password y
  `homeId` ligado tras crear hogar.

### Deudas / notas (fase 2)
- El **actor de los commands** (`by`) aún lo manda el cliente; con auth conviene derivarlo del
  token (autorización real servidor→usuario). La autorización por **rol** ya está en
  `domain/home.rs` (Admin gana sobre miembro). Aceptado como deuda de fase 1.
- Token sin expiración en esta fase (revocación manual); mover a keyring + expiración en fase 2.
- El middleware HTTP rechaza todo `/api/*` sin token: los scripts E2E viejos (sin login)
  ya no funcionan; los nuevos usan el flujo con sesión.

---

## Login confirmado + cuenta de bypass + skill del proyecto (2026-08-07, cierre)

- **Login confirmado en el navegador**: el usuario entra con `admin` / `admin123` (botón
  "Entrar con la cuenta de prueba" en `/login`, o escribiendo las credenciales).
- **El 401 inicial era un binario viejo**: el server de :8787 corriendo era previo al seed
  de `admin`; se reinició recompilado y el login quedó OK. **Regla**: si `admin` no entra,
  reiniciar el backend (el seed se siembra en `AppState::default()`).
- **Cuenta fija de bypass**: `admin`/`admin123`, sembrada en `AuthStore::seed_default_account`
  (solo si no existe; sin sesión). El usuario decidió **no** agregar una cuenta fija "María".
  Botón de acceso rápido en `LoginPage` (`src/lib/auth/defaultAccount.ts`).
- **Fix UI**: los warnings de React por props SVG (`stroke-width` → `strokeWidth`) en el logo
  de `AuthShell.tsx` quedaron corregidos.
- **Skill creada**: `.agents/skills/grocery-planner/SKILL.md` — cómo levantar el proyecto
  (backend HTTP + Vite, desktop), entrar al sistema, verificación y gotchas.
- `cargo test` 77 ✓ · `cargo check --features server` ✓ · `npm run build` ✓ · `npm run lint` ✓.

---

## Feature completa de SPEC (chat, fotos, calendario, lo mío, historial, PIN, reglas, respaldo) (2026-08-07)

Se implementaron en la UI todos los apartados del SPEC que faltaban (antes solo backend o nada).
`cargo test` **96 passed** · `cargo check --features server` ✓ · `npm run build` ✓ ·
`npm run lint` ✓ · **smoke HTTP 31/31** · **E2E headless 19/19**.

### Backend (`src-tauri/src/`)
- **Chat (§11)** — `domain/chat.rs` + `store/chat.rs` + `commands/chat.rs`: mensajes de la
  familia con fotos, **menciones `@Nombre`** (detectadas contra los miembros), **reacciones**
  (toggle por miembro) y **fijados**. Los **mensajes del sistema** se derivan del historial
  de ítems/mandados en `compute_chat` (no se duplican en el store). Las menciones generan avisos.
- **Reglas de la familia (§14)** — `domain/rules.rs` + `store/rules.rs` + `commands/rules.rs`:
  `HomeRules` (nombre, tiendas+pasillos, unidades, categorías, límite de fotos, modo host,
  privacidad de fotos/precios, idioma, zona horaria, preferencias de notificación por miembro).
- **Notificaciones (§13)** — `domain/notification.rs`: avisos por miembro (`AppNotification`,
  kind, leída, link). Se generan en `chat_send` (menciones) y `trips_confirm_received`.
  Commands: list/unread/mark-read/mark-all-read/settings-get/settings-update.
- **Fotos de ítem (§10)** — `GroceryItem.photos: Vec<String>` (data URLs), `item_add_photo`
  (respeta `photo_limit` de reglas), `item_remove_photo`; filtro `only_photos` en `ItemQuery`.
- **Proyección confirmar/descartar (§7.2)** — `projection_decide`; `Projection` incluye
  `decided`/`confirmed` (decisiones en `RulesStore.projection_choices`).
- **Recuperar ítem cancelado (§8.2)** — `item_recover` (solo desde Cancelado → Falta).
- **Repetir compra (§8.2)** — `items_purchased_between(start, end)` (rango ISO).
- **Timeline (§8.3)** — `commands/timeline.rs` + endpoint `/api/timeline?start&end` (ISO).
- **Confirmar recibo (§6)** — `ShoppingTrip.received_at/received_by` + `trips_confirm_received`
  (notifica al que compró).
- **Orden §4.4** — `ItemSort` (manual/priority/name/category/requestedBy/price/store) en
  `ItemQuery`; `store` en el ítem (`item_set_store`); `section_move` (subir/bajar secciones).
- **PIN rápido (§2.3)** — `User.pin_hash` (argon2id), `auth_set_pin/remove_pin/has_pin/login_pin`
  (público: `/api/auth/has-pin`, `/api/auth/login-pin`).
- **Respaldo (§15)** — `commands/backup.rs` `backup_export/import` (JSON completo del hogar).

### Frontend
- `domain/`: `chat.ts`, `rules.ts`, `notification.ts`, `timeline.ts`; `item.ts` (+photos/store/
  event kinds), `report.ts` (+decided/confirmed), `trip.ts` (+receivedAt/receivedBy).
- `lib/api/`: `chat.ts`, `rules.ts` (reglas+notificaciones+proyección), `timeline.ts`,
  `backup.ts`; items/trips/sections/auth/reports ampliados. `lib/dates.ts` nuevo (helpers de
  fecha y **conversión local→UTC** para el historial).
- **Páginas nuevas**: `ChatPage` (burbujas, reacciones, fijar, adjuntar foto), `CalendarPage`
  (día/semana/mes/año con eventos+planes+mandados), `MinePage` ("Lo mío" agrupado por tienda +
  confirmar recibo + barra de progreso), `HistoryPage` (línea de tiempo con ventanas), 
  `NotificationsPage`, `KioskPage` (host con botón gigante + presencia).
- **Settings**: secciones nuevas como componentes (`components/settings/`): RulesSection,
  StoresSection, SectionsSection, NotificationsSection, PinSection, BackupSection.
- **HomePage**: selector de orden, filtro "Con foto", decisiones de proyección ("Sí, falta"/"No"),
  accesos rápidos a Calendario/Historial/Avisos.
- **ItemDetailPage**: sección de fotos (subir/ver/quitar), tienda, botón "Recuperar" en cancelados.
- **ReportsPage**: tarjeta "Repetir compra" (elige día → recrea la lista).
- **Login**: entrada con **PIN rápido** (detecta `hasPin` al escribir el nombre).
- **Rutas**: `/chat`, `/calendar`, `/mine`, `/history`, `/notifications`, `/kiosk`.
  **Nav** según DESIGN §10.5: Inicio · Mandado · Chat · Lo mío · Ajustes (badge de avisos sin leer
  en Ajustes). Plan/Eventos quedan accesibles desde Calendario; Historial/Reportes desde Inicio.

### Fix importante
- **UTC vs local**: el backend guarda `at` en UTC; `timeline_get` e `items_purchased_between`
  ahora comparan **rangos ISO RFC3339 completos** (no prefijo de fecha). El frontend convierte
  el día local a límites UTC con `localDayRangeISO`/`localWindowRangeISO` en `lib/dates.ts`.

### Deudas / notas
- Los avisos se generan solo donde hay touchpoints (menciones, recibo). Faltan generadores para
  urgentes/asignaciones/eventos y los **push reales** (WebSocket/fase 2); la bandeja y la
  configuración ya están.
- La biometría (§2.3) queda como decisión de dispositivo (WebAuthn/nativo) — no implementada.
- Fotos en memoria como data URLs (fase 1); en fase 2 pasan a disco/DB.
- `pkill` con `-f` y el patrón "target/debug/server" mata al propio shell del tool (el patrón
  aparece en su propia línea de comandos): usar `target/debug/serve[r]` para matar el server.

---

## Endurecimiento: vuelta determinista, persistencia y actor real (2026-08-10)

### Vuelta determinista (UI)
- Nuevo hook `useGoBack(fallback)` en `src/lib/hooks/useGoBack.ts`: vuelve atrás en el historial
  y si la página se abrió directo navega al destino por defecto. Aplicado a las páginas que
  usaban `navigate(-1)` sin fallback (NewItemPage, NewPlanPage, RulesPage). Los detalles ya lo
  tenían.

### Persistencia en disco (backend)
- **`src-tauri/src/persist.rs`** (nuevo): el estado completo (auth+datos, sin presencia) se
  serializa a JSON y se guarda en disco. El servidor **carga** al arrancar (en `AppState::default()`)
  y **guarda cada 5s** en un hilo en segundo plano (en `lib.rs` y `server.rs`).
- **Ubicación estable**: `GROCERY_PLANNER_DATA`, luego `$XDG_DATA_HOME/grocery-planner/data.json`,
  luego `~/.grocery-planner/data.json` (ya no depende del directorio actual). Los handlers de auth
  (register/login/pin/logout/revoke/change-password/pin) guardan **al instante** para no perder
  una sesión nueva si el server se reinicia en el intervalo.
- **Escritura segura**: archivo temporal único por escritor (nanos) + `rename`, para que el
  guardado periódico y el inmediato no corrompan el archivo.
- **Respaldo completo**: `BackupData` ahora incluye `notifications` y `projectionChoices`, así el
  seed/reset limpia también los avisos.
- Resultado: **reiniciar el servidor ya no borra datos ni sesiones**. `grocery-planner-data.json`
  se agregó a `.gitignore`.

### Actor derivado del token (seguridad)
- **HTTP**: ya no se confía en el `by`/`owner`/`member`/`createdBy` que manda el cliente. Se
  eliminaron esos campos de los body structs del server; `auth_guard` resuelve la cuenta del token
  e inyecta `AuthActor(name)` en la request; los ~20 handlers de mutación usan `actor.0`.
- **Tauri IPC** queda igual (app local de confianza; el cliente manda `by` = usuario de la sesión).
- **Seed** (`scripts/seed.mjs`) reescrito: crea cuenta real por miembro y cada acción se hace con
  la **sesión de ese miembro** (el actor sale del token, no de `by`). Además reinicia avisos.

### Verificación
- `cargo test` **102 passed** · `cargo check --features server --bin server` sin warnings ·
  `npm run build` ✓ · `npm run lint` ✓.
- Persistencia comprobada en vivo: sesión creada antes de reiniciar sigue válida (200) tras
  restart; ítems/hogar intactos; sin `.tmp` residuales.
- Actor: ítem/evento creados por la UI se atribuyen al usuario de la sesión (Papá), aunque el
  cliente mande otro nombre.
- E2E final: **7/7** (lista+proyección, crear ítem → actor correcto, toggle → historial correcto,
  tiles Familia/Mandado navegan y vuelven).

---

## Auditoría completa + tiempo real + cierre de gaps SPEC/DESIGN (2026-08-10)

Se hizo una revisión integral del repo contra SPEC/DESIGN/DATA/AGENTS y se cerraron los gaps
más importantes. `cargo test` **107 passed** · `cargo check --features server --bin server` ✓ ·
`npm run build` ✓ · `npm run lint` ✓ · **suite E2E headless reproducible: 32/32**.

### F0 — Verificación reproducible
- **Suite E2E en el repo** (`scripts/e2e/`): `harness.mjs` (chromium headless, reescribe el
  backend en caliente, sin service worker, onboarding off), `run.mjs` (compila server, puertos
  libres, data aislada en /tmp, timeout por suite) y 3 suites:
  `spec-core` (20 checks), `live-refresh` (6: dos pestañas ven cambios al momento), `design` (6:
  sin sombras/gradientes/bordes-separador, verde protagonista, zonas táctiles ≥44, modo oscuro
  verde). Scripts npm: `npm run e2e` y `npm run verify` (`lint && build && e2e`).
- `Cargo.toml`: `time` ahora declara `formatting`, `parsing` y `macros` explícitos (antes solo
  `formatting`; compilaba por unificación, frágil).

### F1 — "La UI refresca al momento" (lo más pedido)
- **`src/lib/queryKeys.ts`**: claves de TanStack Query centralizadas (la proyección comparte clave
  en Home y Reportes; avisos/badge/familia invalidan juntos).
- **Polling agresivo**: HomePage ítems **10 s** (antes nada), Mine 10 s, Calendar/Family/Trips/
  Plans/Events y detalles 15 s, Reports/History 20 s. Chat 8 s y Kiosko 10 s ya existían.
- `refetchOnWindowFocus: true` (antes `false`); `queryClient.clear()` en signIn/signOut/
  onUnauthorized y tras importar respaldo (anti fuga de datos entre cuentas y caché obsoleta);
  leer avisos invalida también el badge de la nav; `usePresenceLeave` (pagehide/visibilitychange)
  para irse al instante (adiós fantasmas de 30 s).

### F2 — Gaps de SPEC con UI faltante
- **Unirse con invitación real**: `JoinSection` (antes stub vacío) acepta código corto o
  `#TOKEN` desde la URL (`/family/join#TOKEN`); banner "no estás en un hogar" en Home con CTA.
- **Invitación completa** (§3.3): caducidad (24 h/7 d/nunca), límite de usos (1/5/∞), rol,
  **QR** (dependencia `qrcode`, self-hosted, canvas) y enlace compartible con botón copiar.
- **Botón regenerar clave de respaldo** en Ajustes (cliente ya existía).
- **Form de plan completo** (§7.1): tienda, quién lo lleva, recurrencia y nota (antes solo
  título+fecha). **TripDetail**: asignar a cualquier miembro + retomar, y resuelve nombres de
  ítems (antes mostraba ids crudos).
- **Recordatorio de evento** (§9.2): `Event.reminder_minutes` (`#[serde(default)]`, migración
  segura) + selector en el form de eventos.
- **Fusionar/descartar lista de evento** (§5.3/§9.4): commands `event_merge_to_home` y
  `event_discard_list` (+ endpoints) y botones en el detalle.
- **Recuperar contraseña con clave de respaldo** (§2.5): `auth_reset_password` (IPC + endpoint
  `POST /api/auth/password/reset`) + sección en Ajustes.

### F3 — Cierres de backend
- **Autorización por rol** (§3.2/§4.4/§14): `Home::require_role` + helper `commands::require_role`
  aplicado a reglas, secciones, planes (crear) y reordenar ítems (dueño u Organizador), en IPC y
  HTTP (los handlers HTTP usan el actor del token).
- **Generadores de notificaciones** (§13): helper `commands/notify::push_managed` que respeta
  `NotificationSettings` por miembro y el **horario silencioso** (con rango que cruza medianoche).
  Se generan avisos por: asignación (ítem/mandado), urgente (al crear ítem urgente), mandado
  iniciado, llegada del mandado y menciones.
- **Recordatorios de eventos y planes recurrentes automáticos** (§7.1/§9.2): `commands/background.rs`
  con `tick()` (un evento se notifica una vez; un plan semanal/quincenal/mensual vencido genera la
  siguiente instancia). Hilo cada 60 s en `lib.rs` (Tauri) y `server.rs` (HTTP).
- **Historial de ítem completo** (§8.1): `set_price`/`set_section`/`set_store`/`add_photo`/
  `remove_photo` ahora escriben `ItemEvent` (kinds `PriceChanged`/`SectionChanged`/`StoreChanged`/
  `PhotosChanged`).
- **Auth IPC guarda al instante** (igual que HTTP): los commands de auth de Tauri llaman
  `persist::save` tras mutar. **`PUBLIC_PATHS`** ahora hace match exacto/`prefijo/` (antes
  `starts_with` dejaba públicas variantes de `/api/auth/login-pin`).

### F4 — Cumplimiento DESIGN
- Quitadas anti-pautas: gradiente del ProgressBar (sheen), 3 `border-top` separadores
  (Landing/FilterMenu/Mine), `#fff` hardcodeado en FilterMenu → `--gp-text-inverse`, y el token
  inexistente `--gp-radius-full` → `--gp-radius-pill`.
- Zonas táctiles del chat y pickers subidas a **≥44 px** (searchClear, searchChip, quickBtn,
  refChip, refRemove, close de MentionPicker y PickerModal).
- **Modo TV activado**: `src/lib/tvMode.ts` detecta sin-hover-y-sin-touch (remoto/D-pad) y aplica
  `data-mode="tv"` + oscuro (CSS 10-foot ya existía pero era código muerto); forzable con
  `?tv=1` o localStorage `gp-tv`.
- `prefers-reduced-motion` global en `base.css`.

### Estado final
- `npm run e2e` = 32/32 checks (spec-core 20, live-refresh 6, design 6). `npm run verify` pasa.
- Pendiente (fase 2): DB real, docker, SSE/websockets (hoy polling), fotos a disco, biometría,
  AppImage en CI.





