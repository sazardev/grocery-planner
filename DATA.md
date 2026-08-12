# DATA — Modelo de datos de Grocery Planner

Documento técnico del modelo de datos (fase 1). Define las entidades, sus
campos, los estados y la persistencia en disco. Es el espejo de los tipos Rust
en `src-tauri/src/domain/` y de sus repositorios en `src-tauri/src/store/`.

## Persistencia (fase 1)

El estado completo vive **en memoria** (`AppStore`, `src-tauri/src/store/mod.rs`)
y se **serializa a JSON** en disco:

- Se guarda cada **~5 s** en un hilo en segundo plano y **al instante** en los
  handlers de auth (sesión nueva no se pierde).
- Al arrancar se restaura desde disco en `AppState::default()`.
- Ubicación del archivo (`persist.rs`):
  1. `GROCERY_PLANNER_DATA` (ruta exacta si se define).
  2. `$XDG_DATA_HOME/grocery-planner/data.json`.
  3. `~/.grocery-planner/data.json`.
- Escritura segura: archivo temporal único (nanos) + `rename`, para que el
  guardado periódico y el inmediato no se corrompan entre sí.
- **Presencia no se persiste** (es efímera, se reconstruye con heartbeats).

La presencia (heartbeat ~30 s) y el chat de sistema derivado del historial no se
duplican en el store: `compute_chat` los genera al vuelo.

## Entidades

### `User` (auth) — cuenta de una persona

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (UUID v4) | |
| `name` | string | Único; ≤ 40 chars |
| `passwordHash` | string | Argon2id con salt aleatorio; nunca en claro |
| `pinHash` | string? | PIN rápido (argon2id), opcional |
| `alias` | string? | Ej. "la mamá de Ana" |
| `avatar` | string? | Foto de perfil como data URL (§2.1 "foto o iniciales") |
| `timezone` | string? | Zona horaria del usuario |
| `homeId` | string? | Hogar al que pertenece (un miembro = un hogar) |
| `createdAt` | ISO UTC | |

### `Session` (auth)

| Campo | Tipo | Notas |
|---|---|---|
| `token` | string (UUID v4) | Bearer de la sesión |
| `userId` | string | |
| `device` | string | "celular", "tablet", "web"… |
| `createdAt` / `lastUsedAt` | ISO UTC | |
| `revoked` | bool | Revocación manual |
| `expiresAt` | ISO UTC? | Expirado a los 30 días con **renovación deslizante** al usarse; las sesiones vencidas se rechazan (401) y se podan en el hilo de fondo |

### `Home` + `Member` + `Invitation` (hogar y roles)

- `Home`: `id`, `name`, `createdBy`, `createdAt`, `backupKey` (clave de respaldo §2.5).
- `Member`: `name`, `role` (`miembro` | `organizador` | `admin`), `addedBy`, `joinedAt`.
- `Invitation`: `id`, `token` (enlace/QR), `code` (corto, ej. `492-113`),
  `roleGranted`, `expiresAt?`, `maxUses?`, `uses`, `revoked`, `createdBy`, `createdAt`.

Regla: el último Admin no se puede expulsar ni degradar.

### `GroceryItem` (la lista de compras)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `name` | string | Ej. "pollo" |
| `quantity` | f64 | Ej. 2 |
| `unit` | string | kg, g, l, pieza, bolsa… |
| `status` | `falta` \| `pedido` \| `llevo` \| `comprado` \| `cancelado` | Máquina de estados (§4.3) |
| `priority` | `baja` \| `media` \| `alta` \| `urgente` | |
| `requestedBy` | string | Quién lo pidió |
| `assignedTo` | string? | Asignado (§6) |
| `note` | string? | |
| `category` | string? | frutas, carnes, lácteos… |
| `price` | f64? | Precio aprox. (reportes) |
| `section` | string? | Sección de la lista |
| `store` | string? | Tienda donde se consigue |
| `aisle` | string? | Pasillo dentro de la tienda (§4.1) |
| `deleted` | bool (default false) | Soft delete (§8): oculto de la lista, sigue en historial/reportes |
| `brand` | string? | Marca (ej. "la marca que nos gusta") |
| `quantityMax` | f64? | Cantidad máxima por compra |
| `fallbacks` | `ItemFallback[]` | Alternativas ("si no hay X, trae Y") |
| `photos` | string[] | Nombres de archivo en `<data>/photos/` (o data URLs legacy) |
| `position` | f64 | Orden manual/secciones |
| `createdAt` | ISO UTC | |
| `history` | `ItemEvent[]` | Línea de tiempo del ítem |
| `comments` | `ItemComment[]` | Comentarios de la familia |

`ItemEvent`: `at`, `by`, `kind` (creado, estado cambiado, asignado, cancelado,
comentado, editado, foto, precio, sección, tienda, recuperado…).
`ItemComment`: `id`, `at`, `by`, `body`.

Reglas de estado: un ítem comprado solo vuelve a `falta` pasando por pendiente;
un cancelado se recupera con `item_recover` (→ `falta`).

### `ShoppingTrip` (mandado)

`id`, `title`, `store?`, `assignedTo?`, `createdBy`, `createdAt`,
`status` (`planificado` | `activo` | `completada` | `cancelada`), `itemIds[]`,
`receivedAt?`, `receivedBy?` (confirmación de recibo §6), `completedAt?` (cuándo se completó, §8.1).

### `Plan` (plan de compra §7.1)

`id`, `title`, `scheduledAt` (AAAA-MM-DDTHH:MM), `store?`, `assignedTo?`,
`note?`, `recurrence` (`ninguna` | `semanal` | `quincenal` | `mensual`),
`createdBy`, `createdAt`, `status` (`planificado` | `activo` | `completado` | `cancelado`).

### `Event` (calendario §9)

`id`, `title`, `date` (AAAA-MM-DD), `time?`, `allDay`, `kind`
(`cumpleaños` | `unión` | `comida` | `celebración` | `reunión` | `mandado`),
`place?`, `participants[]`, `note?`, `recurringYearly`, `reminderMinutes?`
(minutos antes para avisar, SPEC §9.2; `None` = sin recordatorio),
`createdBy`, `createdAt`, `itemIds[]` (lista del evento §9.4).

### `Section` (§4.4)

`id`, `name`, `position`.

### `ChatMessage` (§11)

`id`, `at`, `by`, `kind` (`user` | `system`), `body`, `itemId?`, `itemName?`,
`photo?` (data URL), `mentions[]` (`@Nombre`), `refs[]` (referencia a
item/evento/trip), `reactions[]` (emoji + quién + cuándo), `pinned`.

Los mensajes del sistema se derivan del historial (no se guardan).

### `HomeRules` (reglas §14) + `NotificationSettings` (§13)

- `HomeRules`: `name`, `stores[]` (cada una con `name` + `aisles[]`), `units[]`,
  `categories[]`, `photoLimit`, `hostMode`, `hostPauseWithVisitors`, `hostKey?`
  (llave del modo host §2.3), `privacyShowPhotos`, `privacyShowPrices`, `language`,
  `timezone`, `notifications` (por miembro).
- `NotificationSettings`: `onAssigned`, `onUrgent`, `onTripStarted`, `onArrival`,
  `onMention`, `onEventReminder`, `onProjection`, `dailySummary`, `weeklySummary`,
  `dailySummaryHour?`, `weeklySummaryHour?` (hora local `HH:MM` del resumen, §13),
  `silentFrom?`, `silentTo?`, `eventTypes[]`.

### `AppNotification` (§13)

`id`, `at`, `kind`, `forMember`, `title`, `body`, `read`, `link?`. Se generan en
`chat_send` (menciones), `trips_confirm_received` (llegada), y vía
`commands/notify::push_managed` en asignaciones (ítem/mandado), urgente,
mandado iniciado y recordatorios de evento — siempre respetando los
`NotificationSettings` del miembro y su horario silencioso. El hilo de fondo
`commands/background::tick` (cada 60 s) dispara recordatorios de evento (una
vez por evento, marcados en `RulesStore.reminders_fired`) y adelanta planes
recurrentes vencidos.

### `PresenceView` (§12) — no persistida

`name`, `online`, `lastSeen`, `screen?`. El flag `online` se apaga a los ~30 s sin
heartbeat; las entradas se podan a las 24 h en el hilo de fondo (10 s).

## Respaldo (`backup_export` / `backup_import`, §15)

Un único JSON con: `home`, `items`, `trips`, `events`, `plans`, `sections`,
`chat`, `rules`, `notifications`, `projectionChoices`, `users` (hashes de
contraseña/PIN y vínculo al hogar de cada cuenta) y `exportedAt`. Las **fotos a
disco se embeben** (archivo → data URL) al exportar y se **extraen** (data URL →
archivo) al importar, así el respaldo es autocontenido. Importarlo reemplaza el
estado del hogar (los datos de la máquina destino se pierden).

## Notas de fase 2

- DB real (sqlx/diesel) en lugar de memoria + JSON.
- Keyring para el token en desktop.
- Biometría (nativa/dispositivo) para desbloquear sesión local.

> Ya implementado (fase 2 parcial): tiempo real por SSE (`/api/events-stream`),
> fotos a disco (`<data>/photos/`), tokens con expiración (30 días deslizante) y
> Docker self-hosting. El modelo actual es memoria + JSON en disco (persistencia
> cada ~5 s + al instante en auth).
