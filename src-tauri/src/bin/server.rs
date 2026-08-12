//! Servidor HTTP self-hosted (preview de fase 2).
//!
//! Comparte el mismo `AppState` (en memoria) que los commands de Tauri, así la
//! lógica de negocio es idéntica entre escritorio y web.
//!
//! Uso: `cargo run --features server --bin server` (puerto 8787 por defecto).

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::{header::AUTHORIZATION, HeaderMap, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use grocery_planner_lib::commands::auth as auth_cmd;
use grocery_planner_lib::commands::backup::BackupData;
use grocery_planner_lib::commands::health::{
    health_report, HealthInfo, HealthLevel, LiveInfo, ReadyInfo,
};
use grocery_planner_lib::commands::home as home_cmd;
use grocery_planner_lib::commands::items as items_cmd;
use grocery_planner_lib::commands::notify;
use grocery_planner_lib::commands::reports as reports_cmd;
use grocery_planner_lib::domain::chat::ChatMessage;
use grocery_planner_lib::domain::event::{Event, EventType};
use grocery_planner_lib::domain::home::{Home, Role};
use grocery_planner_lib::domain::item::{GroceryItem, ItemComment, ItemEvent, ItemStatus, Priority, QuickEntry};
use grocery_planner_lib::domain::notification::NotificationKind;
use grocery_planner_lib::domain::plan::{Plan, Recurrence};
use grocery_planner_lib::domain::presence::PresenceView;
use grocery_planner_lib::domain::rules::{HomeRules, NotificationSettings};
use grocery_planner_lib::domain::section::Section;
use grocery_planner_lib::domain::trip::{ShoppingTrip, TripStatus};
use grocery_planner_lib::error::AppError;
use grocery_planner_lib::persist;
use grocery_planner_lib::state::AppState;
use grocery_planner_lib::store;
use grocery_planner_lib::store::item::ItemSort;
use grocery_planner_lib::store::item::MoveDirection;
use grocery_planner_lib::store::section::MoveDirection as SectionMoveDirection;

type Shared = Arc<AppState>;

/// Guarda el estado a disco (best effort) tras una mutación de auth, para que
/// una sesión nueva no se pierda si el servidor se reinicia en los segundos del
/// guardado periódico.
fn persist_store(store: &grocery_planner_lib::store::AppStore) {
    let _ = persist::save(store, &persist::default_data_path());
}

/// Rutas públicas del servidor HTTP. Todo lo demás bajo `/api` exige una
/// sesión válida (`Authorization: Bearer <token>`), ver `auth_guard`.
const PUBLIC_PATHS: &[&str] = &[
    "/health",
    "/api/app-info",
    "/api/greet",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/login-pin",
    "/api/auth/has-pin",
    "/api/auth/password/reset",
    "/api/auth/host-login",
    "/api/host-mode",
];

/// Extrae el token de sesión del header `Authorization: Bearer <token>`.
fn bearer_token(headers: &HeaderMap) -> Result<String, AppError> {
    headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|t| t.trim().to_string())
        .ok_or_else(|| AppError::unauthorized("Token de sesión faltante"))
}

/// Actor autenticado (el nombre de la cuenta dueña de la sesión). Lo inyecta
/// `auth_guard` en las extensions de la request; los handlers lo usan en vez de
/// confiar en el `by` que manda el cliente (autorización real servidor→usuario).
#[derive(Clone, Debug)]
struct AuthActor(String);

impl<S: Send + Sync> axum::extract::FromRequestParts<S> for AuthActor {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthActor>()
            .cloned()
            .ok_or_else(|| AppError::unauthorized("Sesión requerida para esta acción"))
    }
}

// ----- Bodies de entrada -------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateItemBody {
    name: String,
    quantity: f64,
    unit: String,
    priority: Priority,
    note: Option<String>,
    category: Option<String>,
    price: Option<f64>,
    section: Option<String>,
    store: Option<String>,
    brand: Option<String>,
    quantity_max: Option<f64>,
    #[serde(default)]
    fallbacks: Vec<grocery_planner_lib::commands::items::FallbackInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeStatusBody {
    to: ItemStatus,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssignBody {
    member: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CancelBody {
    reason: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateItemBody {
    name: Option<String>,
    quantity: Option<f64>,
    unit: Option<String>,
    priority: Option<Priority>,
    note: Option<String>,
    category: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetPriorityBody {
    priority: Priority,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveItemBody {
    direction: MoveDirection,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NameBody {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresenceHeartbeatBody {
    #[serde(default)]
    screen: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GreetBody {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransitionBody {
    from: ItemStatus,
    to: ItemStatus,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParseBody {
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidateBody {
    name: String,
    quantity: f64,
    unit: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTripBody {
    title: String,
    store: Option<String>,
    assigned_to: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TripItemBody {
    item_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TripAssignBody {
    member: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommentBody {
    body: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PriceBody {
    price: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SectionBody {
    section: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemFiltersBody {
    search: Option<String>,
    status: Option<ItemStatus>,
    category: Option<String>,
    priority: Option<Priority>,
    section: Option<String>,
    requested_by: Option<String>,
    assigned_to: Option<String>,
    store: Option<String>,
    aisle: Option<String>,
    created_from: Option<String>,
    created_to: Option<String>,
    #[serde(default)]
    urgent: bool,
    #[serde(default)]
    only_comments: bool,
    #[serde(default)]
    only_photos: bool,
    #[serde(default)]
    sort: Option<ItemSort>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomeCreateBody {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MemberBody {
    name: String,
    role: Role,
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InviteBody {
    role_granted: Role,
    expires_in_secs: Option<i64>,
    max_uses: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcceptInviteBody {
    code: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateEventBody {
    title: String,
    date: String,
    time: Option<String>,
    #[serde(default)]
    all_day: bool,
    kind: EventType,
    place: Option<String>,
    #[serde(default)]
    participants: Vec<String>,
    note: Option<String>,
    #[serde(default)]
    recurring_yearly: bool,
    #[serde(default)]
    reminder_minutes: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePlanBody {
    title: String,
    scheduled_at: String,
    store: Option<String>,
    assigned_to: Option<String>,
    note: Option<String>,
    #[serde(default)]
    recurrence: Recurrence,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSectionBody {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterBody {
    name: String,
    password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginBody {
    name: String,
    password: String,
    device: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RevokeSessionBody {
    target_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangePasswordBody {
    current_password: String,
    new_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResetPasswordBody {
    name: String,
    backup_key: String,
    new_password: String,
}

#[derive(Deserialize)]
struct RangeParams {
    start: String,
    end: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageBody {
    body: String,
    photo: Option<String>,
    item_id: Option<String>,
    #[serde(default)]
    refs: Vec<grocery_planner_lib::domain::chat::RefInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatPageParams {
    limit: Option<usize>,
    before: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatSearchParams {
    query: Option<String>,
    by: Option<String>,
    ref_kind: Option<grocery_planner_lib::domain::chat::MessageRefKind>,
    has_photo: Option<bool>,
    limit: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReactBody {
    emoji: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateRulesBody {
    name: Option<String>,
    units: Option<Vec<String>>,
    categories: Option<Vec<String>>,
    photo_limit: Option<usize>,
    host_mode: Option<bool>,
    host_pause_with_visitors: Option<bool>,
    privacy_show_photos: Option<bool>,
    privacy_show_prices: Option<bool>,
    language: Option<String>,
    timezone: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreBody {
    name: String,
    #[serde(default)]
    aisles: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameStoreBody {
    new_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AisleBody {
    aisle: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsBody {
    settings: NotificationSettings,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectionDecideBody {
    name: String,
    confirmed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhotoBody {
    photo: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreNameBody {
    store_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DirectionBody {
    direction: SectionMoveDirection,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PinBody {
    name: String,
    pin: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginPinBody {
    name: String,
    pin: String,
    device: String,
}

// ----- Health ------------------------------------------------------------

async fn live(State(state): State<Shared>) -> Result<Json<LiveInfo>, AppError> {
    Ok(Json(LiveInfo {
        status: HealthLevel::Ok,
        uptime_secs: state.uptime_secs(),
    }))
}

async fn ready(State(state): State<Shared>) -> Result<Json<ReadyInfo>, AppError> {
    let (status, checks) = health_report(&state);
    Ok(Json(ReadyInfo { status, checks }))
}

async fn healthy(State(state): State<Shared>) -> Result<Json<HealthInfo>, AppError> {
    let (status, checks) = health_report(&state);
    Ok(Json(HealthInfo {
        status,
        checks,
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: state.uptime_secs(),
    }))
}

// ----- Items -------------------------------------------------------------

/// Aplica la privacidad del hogar (SPEC §14): si no se muestran fotos/precios,
/// se redactan en las respuestas (solo lectura; el dato se conserva).
fn redact_item(item: GroceryItem, store: &grocery_planner_lib::store::AppStore) -> GroceryItem {
    store.rules.rules().redact_item(item)
}

async fn items_list(State(state): State<Shared>) -> Result<Json<Vec<GroceryItem>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(
        store
            .items
            .active()
            .into_iter()
            .map(|it| redact_item(it, &store))
            .collect(),
    ))
}

async fn item_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<CreateItemBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut item = GroceryItem::new(
        &body.name,
        body.quantity,
        &body.unit,
        body.priority,
        &actor.0,
        body.note.as_deref(),
        body.category.as_deref(),
    )?;
    if let Some(price) = body.price {
        item.set_price(price, &actor.0)?;
    }
    if let Some(section) = body.section {
        item.set_section(&section, &actor.0)?;
    }
    if let Some(store) = body.store {
        item.set_store(&store, &actor.0)?;
    }
    if let Some(brand) = body.brand {
        item.set_brand(&brand, &actor.0)?;
    }
    if let Some(max) = body.quantity_max {
        item.set_quantity_max(Some(max), &actor.0)?;
    }
    for fb in body.fallbacks {
        item.add_fallback(&fb.name, fb.quantity, &fb.unit, fb.note.as_deref(), &actor.0)?;
    }
    let mut store = store::lock(&state.store)?;
    let urgent = body.priority == Priority::Urgente;
    let item_id = item.id.clone();
    let item_name = item.name.clone();
    let actor = actor.0.clone();
    let created = store.items.create(item);
    // Alguien pidió algo URGENTE: avisa a la familia (SPEC §13).
    if urgent {
        let members: Vec<String> = store
            .home
            .get()
            .ok()
            .map(|h| h.members().into_iter().map(|m| m.name).collect())
            .unwrap_or_default();
        for m in members {
            if m != actor {
                notify::push_managed(
                    &mut store.rules,
                    &m,
                    NotificationKind::Urgent,
                    "¡Algo urgente!",
                    &format!("{actor} pidió \"{item_name}\" como urgente."),
                    Some(&format!("/items/{item_id}")),
                );
            }
        }
    }
    Ok(Json(redact_item(created, &store)))
}

async fn items_complete_batch(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<Vec<GroceryItem>>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(
        store
            .items
            .complete_carried(&actor.0)?
            .into_iter()
            .map(|it| redact_item(it, &store))
            .collect(),
    ))
}

async fn item_get(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<GroceryItem>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(redact_item(store.items.get(&id)?, &store)))
}

async fn item_change_status(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<ChangeStatusBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    let item_name = store.items.get(&id)?.name.clone();
    let changed = store.items.change_status(&id, body.to, &actor.0)?;
    // Si alguien compró algo durante un mandado activo, avisa a la familia del
    // avance (SPEC §13, con debounce por mandado).
    if body.to == ItemStatus::Comprado {
        for trip in store.trips.list() {
            if trip.status == TripStatus::Activa && trip.item_ids.contains(&id) {
                notify::maybe_notify_trip_progress(&mut store, &trip.id, &actor.0, &item_name);
                break;
            }
        }
    }
    Ok(Json(redact_item(changed, &store)))
}

async fn item_assign(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<AssignBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    // Solo se puede asignar a alguien del hogar (SPEC §6).
    grocery_planner_lib::commands::require_member(&store, &body.member)?;
    let name = store.items.get(&id)?.name.clone();
    let assigned = store.items.assign(&id, &body.member, &actor.0)?;
    if body.member != actor.0 {
        notify::push_managed(
            &mut store.rules,
            &body.member,
            NotificationKind::Assigned,
            "Te asignaron un ítem",
            &format!("{} te pidió que lleves \"{name}\" en el mandado.", actor.0),
            Some(&format!("/items/{id}")),
        );
    }
    Ok(Json(redact_item(assigned, &store)))
}

async fn item_unassign(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.unassign(&id, &actor.0)?,
        &store,
    )))
}

async fn item_cancel(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<CancelBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.cancel(&id, &actor.0, body.reason.as_deref())?,
        &store,
    )))
}

async fn item_history(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ItemEvent>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.items.history(&id)?))
}

async fn item_flows() -> Result<Json<Vec<items_cmd::StatusFlow>>, AppError> {
    Ok(Json(items_cmd::item_flows()?))
}

async fn item_transition(Json(body): Json<TransitionBody>) -> Result<Json<ItemStatus>, AppError> {
    Ok(Json(items_cmd::item_transition(body.from, body.to)?))
}

async fn parse_quick_entry(Json(body): Json<ParseBody>) -> Result<Json<QuickEntry>, AppError> {
    Ok(Json(items_cmd::parse_quick_entry(body.text)?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuggestBody {
    query: String,
}

async fn validate_new_item(Json(body): Json<ValidateBody>) -> Result<StatusCode, AppError> {
    items_cmd::validate_new_item(body.name, body.quantity, body.unit)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn items_suggest(
    State(state): State<Shared>,
    Json(body): Json<SuggestBody>,
) -> Result<Json<Vec<items_cmd::ItemSuggestion>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(items_cmd::suggest_impl(&store, &body.query)))
}

// ----- Búsqueda, comentarios, precio y secciones de ítems -----------------

async fn items_query(
    State(state): State<Shared>,
    Json(body): Json<ItemFiltersBody>,
) -> Result<Json<Vec<GroceryItem>>, AppError> {
    let store = store::lock(&state.store)?;
    let query = grocery_planner_lib::store::item::ItemQuery {
        search: body.search,
        status: body.status,
        category: body.category,
        priority: body.priority,
        section: body.section,
        requested_by: body.requested_by,
        assigned_to: body.assigned_to,
        store: body.store,
        aisle: body.aisle,
        created_from: body.created_from,
        created_to: body.created_to,
        urgent: body.urgent,
        only_comments: body.only_comments,
        only_photos: body.only_photos,
        sort: body.sort,
    };
    Ok(Json(
        store
            .items
            .query(&query)
            .into_iter()
            .map(|it| redact_item(it, &store))
            .collect(),
    ))
}

async fn item_add_comment(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<CommentBody>,
) -> Result<Json<ItemComment>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.items.add_comment(&id, &actor.0, &body.body)?))
}

async fn item_set_price(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<PriceBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_price(&id, body.price, &actor.0)?,
        &store,
    )))
}

async fn item_set_section(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<SectionBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.sections.get(&body.section)?;
    Ok(Json(redact_item(
        store.items.set_section(&id, &body.section, &actor.0)?,
        &store,
    )))
}

async fn item_update(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<UpdateItemBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.update(
            &id,
            &actor.0,
            body.name.as_deref(),
            body.quantity,
            body.unit.as_deref(),
            body.priority,
            body.note.as_deref(),
            body.category.as_deref(),
        )?,
        &store,
    )))
}

async fn item_set_priority(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<SetPriorityBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_priority(&id, body.priority, &actor.0)?,
        &store,
    )))
}

async fn item_move(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<MoveItemBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    // Reordenar es del dueño del ítem o de Organizador/Admin (SPEC §4.4).
    let item = store.items.get(&id)?;
    if item.requested_by != actor.0 {
        grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    }
    Ok(Json(redact_item(
        store.items.move_item(&id, body.direction)?,
        &store,
    )))
}

async fn item_delete(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.delete(&id, &actor.0)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn item_delete_permanent(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    let item = store.items.get(&id)?;
    if !item.deleted {
        return Err(AppError::conflict(
            "Solo se borra definitivamente un ítem que ya está en la papelera",
        ));
    }
    // Solo el dueño del ítem o un Organizador/Admin (SPEC §3.2/§4.4).
    if item.requested_by != actor.0 {
        grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    }
    for name in &item.photos {
        if !name.starts_with("data:") {
            grocery_planner_lib::commands::photo::delete_photo_file(name);
        }
    }
    store.items.delete_permanent(&id)?;
    Ok(StatusCode::NO_CONTENT)
}

// ----- Presencia ---------------------------------------------------------

async fn presence_list(State(state): State<Shared>) -> Result<Json<Vec<PresenceView>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.presence.list()))
}

async fn presence_heartbeat(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<PresenceHeartbeatBody>,
) -> Result<Json<Vec<PresenceView>>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.presence.heartbeat(&actor.0, body.screen.as_deref())?;
    Ok(Json(store.presence.list()))
}

async fn presence_leave(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<Vec<PresenceView>>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.presence.leave(&actor.0);
    Ok(Json(store.presence.list()))
}

// ----- Mandados ----------------------------------------------------------

async fn trips_list(State(state): State<Shared>) -> Result<Json<Vec<ShoppingTrip>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.trips.list()))
}

async fn trips_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<CreateTripBody>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let trip = ShoppingTrip::new(
        &body.title,
        body.store.as_deref(),
        body.assigned_to.as_deref(),
        &actor.0,
    )?;
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.trips.create(trip)))
}

async fn trips_get(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.trips.get(&id)?))
}

async fn trips_add_item(
    State(state): State<Shared>,
    Path(id): Path<String>,
    Json(body): Json<TripItemBody>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.get(&body.item_id)?;
    Ok(Json(store.trips.add_item(&id, &body.item_id)?))
}

async fn trips_remove_item(
    State(state): State<Shared>,
    Path(id): Path<String>,
    Json(body): Json<TripItemBody>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.trips.remove_item(&id, &body.item_id)?))
}

async fn trips_assign(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<TripAssignBody>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    // Solo se puede asignar a alguien del hogar (SPEC §6).
    grocery_planner_lib::commands::require_member(&store, &body.member)?;
    let title = store.trips.get(&id)?.title.clone();
    let assigned = store.trips.assign(&id, &body.member)?;
    if body.member != actor.0 {
        notify::push_managed(
            &mut store.rules,
            &body.member,
            NotificationKind::Assigned,
            "Te asignaron un mandado",
            &format!("El mandado \"{title}\" es tuyo."),
            Some(&format!("/trips/{id}")),
        );
    }
    Ok(Json(assigned))
}

async fn trips_complete(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.trips.set_status(
        &id,
        grocery_planner_lib::domain::trip::TripStatus::Completada,
    )?))
}

async fn trips_activate(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    let title = store.trips.get(&id)?.title.clone();
    let who = store
        .trips
        .get(&id)?
        .assigned_to
        .clone()
        .unwrap_or_default();
    let activated = store.trips.set_status(
        &id,
        grocery_planner_lib::domain::trip::TripStatus::Activa,
    )?;
    // Quien empieza el mandado queda como "en el mandado" en la presencia.
    store.presence.heartbeat(&actor.0, Some("mandado"))?;
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    for m in members {
        if m != who {
            let detail = if who.is_empty() {
                String::new()
            } else {
                format!(" (lo lleva {who})")
            };
            notify::push_managed(
                &mut store.rules,
                &m,
                NotificationKind::TripStarted,
                "Empezó el mandado",
                &format!("El mandado \"{title}\" está en curso{detail}."),
                Some(&format!("/trips/{id}")),
            );
        }
    }
    Ok(Json(activated))
}

async fn trips_cancel(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.trips.set_status(
        &id,
        grocery_planner_lib::domain::trip::TripStatus::Cancelada,
    )?))
}

// ----- Hogar --------------------------------------------------------------

async fn home_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<HomeCreateBody>,
) -> Result<Json<home_cmd::HomeView>, AppError> {
    let mut store = store::lock(&state.store)?;
    // SPEC §3.6: un miembro = un hogar (crear el segundo reemplazaría al primero).
    if store.auth.home_of(&actor.0).is_some() {
        return Err(AppError::conflict(
            "Ya perteneces a un hogar; un miembro solo puede estar en uno (SPEC §3.6)",
        ));
    }
    let home = Home::create(&body.name, &actor.0)?;
    let view = home_cmd::HomeView {
        id: home.id.clone(),
        name: home.name.clone(),
        created_by: home.created_by.clone(),
        created_at: home.created_at.clone(),
        backup_key: home.backup_key.clone(),
        members: home.members(),
        invitations: home.invitations(),
    };
    store.home.create(home);
    store.auth.link_home(&actor.0, &view.id);
    Ok(Json(view))
}

async fn home_info(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<home_cmd::HomeView>, AppError> {
    let store = store::lock(&state.store)?;
    let home = store.home.get()?;
    // 404 (no "401") cuando no perteneces al hogar: el 401 global del front
    // cierra la sesión y un miembro que aún no creó/un hogar se quedaría fuera
    // injustamente. 404 además no revela si el hogar existe.
    let member = home
        .member(&actor.0)
        .ok_or_else(|| AppError::not_found("Todavía no se crea el hogar"))?;
    let view = home_cmd::HomeView {
        id: home.id.clone(),
        name: home.name.clone(),
        created_by: home.created_by.clone(),
        created_at: home.created_at.clone(),
        // La clave de respaldo solo la ve el Admin (SPEC §3.2).
        backup_key: if member.role == Role::Admin {
            home.backup_key.clone()
        } else {
            String::new()
        },
        members: home.members(),
        invitations: home.invitations(),
    };
    Ok(Json(view))
}

async fn home_add_member(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<MemberBody>,
) -> Result<Json<grocery_planner_lib::domain::home::Member>, AppError> {
    let mut store = store::lock(&state.store)?;
    if !store.auth.account_exists(&body.name) {
        return Err(AppError::invalid_input(format!(
            "No existe una cuenta con el nombre {}",
            body.name
        )));
    }
    Ok(Json(store.home.add_member(&body.name, body.role, &actor.0)?))
}

async fn home_remove_member(
    State(state): State<Shared>,
    Path(name): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    store.home.remove_member(&name, &actor.0)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn home_change_role(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<MemberBody>,
) -> Result<Json<grocery_planner_lib::domain::home::Member>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.home.change_role(&body.name, body.role, &actor.0)?))
}

async fn home_invite_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<InviteBody>,
) -> Result<Json<grocery_planner_lib::domain::home::Invitation>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store
        .home
        .create_invitation(&actor.0, body.role_granted, body.expires_in_secs, body.max_uses)?))
}

async fn home_invite_revoke(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<Json<grocery_planner_lib::domain::home::Invitation>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.home.revoke_invitation(&id, &actor.0)?))
}

async fn home_invite_accept(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<AcceptInviteBody>,
) -> Result<Json<grocery_planner_lib::domain::home::Member>, AppError> {
    let mut store = store::lock(&state.store)?;
    let home = store.home.get()?;
    let home_id = home.id.clone();
    let member = store.home.accept_invitation(&body.code, &actor.0)?;
    store.auth.link_home(&actor.0, &home_id);
    Ok(Json(member))
}

async fn home_backup_key(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<String>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.home.regenerate_backup_key(&actor.0)?))
}

// ----- Eventos ------------------------------------------------------------

async fn events_list(State(state): State<Shared>) -> Result<Json<Vec<Event>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.events.list()))
}

async fn events_list_range(
    State(state): State<Shared>,
    Query(range): Query<RangeParams>,
) -> Result<Json<Vec<Event>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.events.list_in_range(&range.start, &range.end)))
}

async fn event_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<CreateEventBody>,
) -> Result<Json<Event>, AppError> {
    let event = Event::new(
        &body.title,
        &body.date,
        body.time.as_deref(),
        body.all_day,
        body.kind,
        body.place.as_deref(),
        body.participants,
        body.note.as_deref(),
        body.recurring_yearly,
        body.reminder_minutes,
        &actor.0,
    )?;
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.events.create(event)))
}

async fn event_get(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Event>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.events.get(&id)?))
}

async fn event_delete(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    if event.created_by != actor.0 {
        grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    }
    store.events.delete(&id)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateEventBody {
    title: Option<String>,
    date: Option<String>,
    time: Option<String>,
    all_day: Option<bool>,
    kind: Option<EventType>,
    place: Option<String>,
    participants: Option<Vec<String>>,
    note: Option<String>,
    recurring_yearly: Option<bool>,
    reminder_minutes: Option<Option<i64>>,
}

async fn event_update(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<UpdateEventBody>,
) -> Result<Json<Event>, AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    if event.created_by != actor.0 {
        grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    }
    Ok(Json(store.events.update(
        &id,
        body.title.as_deref(),
        body.date.as_deref(),
        body.time.as_deref(),
        body.all_day,
        body.kind,
        body.place.as_deref(),
        body.participants.as_deref(),
        body.note.as_deref(),
        body.recurring_yearly,
        body.reminder_minutes,
        &actor.0,
    )?))
}

async fn event_add_item(
    State(state): State<Shared>,
    Path(id): Path<String>,
    Json(body): Json<TripItemBody>,
) -> Result<Json<Event>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.items.get(&body.item_id)?;
    Ok(Json(store.events.add_item(&id, &body.item_id)?))
}

async fn event_remove_item(
    State(state): State<Shared>,
    Path(id): Path<String>,
    Json(body): Json<TripItemBody>,
) -> Result<Json<Event>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.events.remove_item(&id, &body.item_id)?))
}

async fn event_merge_to_home(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Event>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.events.clear_items(&id)?))
}

async fn event_discard_list(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Event>, AppError> {
    let mut store = store::lock(&state.store)?;
    let event = store.events.get(&id)?;
    let ids = event.item_ids.clone();
    let by = event.created_by.clone();
    for item_id in &ids {
        store.items.delete(item_id, &by)?;
    }
    Ok(Json(store.events.clear_items(&id)?))
}

// ----- Planes -------------------------------------------------------------

async fn plans_list(State(state): State<Shared>) -> Result<Json<Vec<Plan>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.plans.list()))
}

async fn plan_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<CreatePlanBody>,
) -> Result<Json<Plan>, AppError> {
    let plan = Plan::new(
        &body.title,
        &body.scheduled_at,
        body.store.as_deref(),
        body.assigned_to.as_deref(),
        body.note.as_deref(),
        body.recurrence,
        &actor.0,
    )?;
    let mut store = store::lock(&state.store)?;
    // Planear compras es de Organizador/Admin (SPEC §3.2 y §7.1).
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    Ok(Json(store.plans.create(plan)))
}

async fn plan_get(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Plan>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.plans.get(&id)?))
}

async fn plan_activate(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Plan>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.plans.set_status(
        &id,
        grocery_planner_lib::domain::plan::PlanStatus::Activo,
    )?))
}

async fn plan_complete(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Plan>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.plans.set_status(
        &id,
        grocery_planner_lib::domain::plan::PlanStatus::Completado,
    )?))
}

async fn plan_cancel(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<Plan>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.plans.set_status(
        &id,
        grocery_planner_lib::domain::plan::PlanStatus::Cancelado,
    )?))
}

// ----- Secciones ----------------------------------------------------------

async fn sections_list(State(state): State<Shared>) -> Result<Json<Vec<Section>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.sections.list()))
}

async fn section_create(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<CreateSectionBody>,
) -> Result<Json<Section>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    Ok(Json(store.sections.create(&body.name)?))
}

async fn section_rename(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<CreateSectionBody>,
) -> Result<Json<Section>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    Ok(Json(store.sections.rename(&id, &body.name)?))
}

async fn section_delete(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    store.sections.delete(&id)?;
    Ok(StatusCode::NO_CONTENT)
}

// ----- Reportes y proyección ----------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowParam {
    window: Option<String>,
}

async fn reports_top(
    State(state): State<Shared>,
    Query(params): Query<WindowParam>,
) -> Result<Json<Vec<reports_cmd::TopProduct>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(reports_cmd::compute_top_products(&store, params.window.as_deref())))
}

async fn reports_spending(
    State(state): State<Shared>,
    Query(params): Query<WindowParam>,
) -> Result<Json<reports_cmd::SpendingReport>, AppError> {
    let store = store::lock(&state.store)?;
    let mut report = reports_cmd::compute_spending(&store, params.window.as_deref());
    // Privacidad (SPEC §14): si los precios no se muestran, el reporte de gasto no.
    if !store.rules.rules.privacy_show_prices {
        report.total = 0.0;
        report.items_count = 0;
    }
    Ok(Json(report))
}

async fn reports_trips(
    State(state): State<Shared>,
) -> Result<Json<Vec<reports_cmd::MemberTripCount>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(reports_cmd::compute_trips_by_member(&store)))
}

async fn reports_projection(
    State(state): State<Shared>,
) -> Result<Json<Vec<reports_cmd::Projection>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(reports_cmd::compute_projection(&store)))
}

async fn projection_decide(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<ProjectionDecideBody>,
) -> Result<Json<bool>, AppError> {
    let mut store = store::lock(&state.store)?;
    let ok = grocery_planner_lib::commands::reports::decide_projection_core(
        &mut store,
        &actor.0,
        &body.name,
        body.confirmed,
    )?;
    persist_store(&store);
    Ok(Json(ok))
}

// ----- Chat (SPEC §11) ----------------------------------------------------

async fn chat_list(State(state): State<Shared>) -> Result<Json<Vec<ChatMessage>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(grocery_planner_lib::commands::chat::compute_chat(&store)))
}

async fn chat_send(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<SendMessageBody>,
) -> Result<Json<ChatMessage>, AppError> {
    let mut store = store::lock(&state.store)?;
    let message = grocery_planner_lib::commands::chat::chat_send_core(
        &mut store,
        &actor.0,
        &body.body,
        body.photo,
        body.item_id,
        body.refs,
    )?;
    Ok(Json(message))
}

async fn chat_react(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<ReactBody>,
) -> Result<Json<ChatMessage>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.chat.react(&id, &body.emoji, &actor.0)?))
}

async fn chat_pin(
    State(state): State<Shared>,
    Path(id): Path<String>,
) -> Result<Json<ChatMessage>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.chat.toggle_pin(&id)?))
}

async fn chat_count(State(state): State<Shared>) -> Result<Json<usize>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(grocery_planner_lib::commands::chat::compute_chat(&store).len()))
}

async fn chat_for_item(
    State(state): State<Shared>,
    Path(item_id): Path<String>,
) -> Result<Json<Vec<ChatMessage>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.chat.for_item(&item_id)))
}

async fn chat_page_handler(
    State(state): State<Shared>,
    Query(params): Query<ChatPageParams>,
) -> Result<Json<grocery_planner_lib::commands::chat::ChatPage>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(grocery_planner_lib::commands::chat::chat_page_core(
        &store, params.limit, params.before,
    )))
}

async fn chat_search_handler(
    State(state): State<Shared>,
    Query(params): Query<ChatSearchParams>,
) -> Result<Json<grocery_planner_lib::commands::chat::ChatSearchResult>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(grocery_planner_lib::commands::chat::chat_search_core(
        &store,
        grocery_planner_lib::commands::chat::ChatSearchInput {
            query: params.query,
            by: params.by,
            ref_kind: params.ref_kind,
            has_photo: params.has_photo,
            limit: params.limit,
        },
    )))
}

// ----- Reglas de la familia (SPEC §14) -------------------------------------

async fn rules_get(State(state): State<Shared>) -> Result<Json<HomeRules>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.rules.rules()))
}

async fn rules_host_key_generate(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<String>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Admin)?;
    let key = uuid::Uuid::new_v4().simple().to_string();
    store.rules.rules.host_key = Some(key.clone());
    Ok(Json(key))
}

async fn rules_host_key_clear(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Admin)?;
    store.rules.rules.host_key = None;
    Ok(StatusCode::NO_CONTENT)
}

async fn rules_update(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<UpdateRulesBody>,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    if let Some(name) = body.name {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::invalid_input("El nombre del hogar es obligatorio"));
        }
        store.rules.rules.name = name.to_string();
    }
    if let Some(units) = body.units {
        store.rules.rules.units = units;
    }
    if let Some(categories) = body.categories {
        store.rules.rules.categories = categories;
    }
    if let Some(photo_limit) = body.photo_limit {
        if photo_limit == 0 || photo_limit > 20 {
            return Err(AppError::invalid_input("El límite de fotos debe estar entre 1 y 20"));
        }
        store.rules.rules.photo_limit = photo_limit;
    }
    if let Some(host_mode) = body.host_mode {
        store.rules.rules.host_mode = host_mode;
    }
    if let Some(pause) = body.host_pause_with_visitors {
        store.rules.rules.host_pause_with_visitors = pause;
    }
    if let Some(photos) = body.privacy_show_photos {
        store.rules.rules.privacy_show_photos = photos;
    }
    if let Some(prices) = body.privacy_show_prices {
        store.rules.rules.privacy_show_prices = prices;
    }
    if let Some(language) = body.language {
        store.rules.rules.language = language;
    }
    if let Some(timezone) = body.timezone {
        store.rules.rules.timezone = timezone;
    }
    Ok(Json(store.rules.rules()))
}

async fn rules_store_add(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<StoreBody>,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::invalid_input("El nombre de la tienda es obligatorio"));
    }
    if store.rules.rules.stores.iter().any(|s| s.name == name) {
        return Err(AppError::conflict(format!("La tienda {name} ya existe")));
    }
    let aisles: Vec<String> = body
        .aisles
        .into_iter()
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .collect();
    store.rules.rules.stores.push(grocery_planner_lib::domain::rules::StoreConfig {
        name: name.to_string(),
        aisles,
    });
    Ok(Json(store.rules.rules()))
}

async fn rules_store_rename(
    State(state): State<Shared>,
    Path(name): Path<String>,
    actor: AuthActor,
    Json(body): Json<RenameStoreBody>,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {name} no encontrada")))?;
    let new_name = body.new_name.trim();
    if new_name.is_empty() {
        return Err(AppError::invalid_input("El nombre de la tienda es obligatorio"));
    }
    store_config.name = new_name.to_string();
    Ok(Json(store.rules.rules()))
}

async fn rules_store_remove(
    State(state): State<Shared>,
    Path(name): Path<String>,
    actor: AuthActor,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    store.rules.rules.stores.retain(|s| s.name != name);
    Ok(Json(store.rules.rules()))
}

async fn rules_aisle_add(
    State(state): State<Shared>,
    Path(store_name): Path<String>,
    actor: AuthActor,
    Json(body): Json<AisleBody>,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == store_name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {store_name} no encontrada")))?;
    let aisle = body.aisle.trim();
    if aisle.is_empty() {
        return Err(AppError::invalid_input("El nombre del pasillo es obligatorio"));
    }
    if store_config.aisles.iter().any(|a| a == aisle) {
        return Err(AppError::conflict(format!(
            "El pasillo {aisle} ya existe en {store_name}"
        )));
    }
    store_config.aisles.push(aisle.to_string());
    Ok(Json(store.rules.rules()))
}

async fn rules_aisle_remove(
    State(state): State<Shared>,
    Path((store_name, aisle)): Path<(String, String)>,
    actor: AuthActor,
) -> Result<Json<HomeRules>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    let store_config = store
        .rules
        .rules
        .stores
        .iter_mut()
        .find(|s| s.name == store_name)
        .ok_or_else(|| AppError::not_found(format!("Tienda {store_name} no encontrada")))?;
    store_config.aisles.retain(|a| a != &aisle);
    Ok(Json(store.rules.rules()))
}

// ----- Notificaciones (SPEC §13) -------------------------------------------

async fn notifications_list(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<Vec<grocery_planner_lib::domain::notification::AppNotification>>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.rules.notifications_for(&actor.0)))
}

async fn notifications_unread(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<usize>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.rules.unread_count(&actor.0)))
}

async fn notifications_mark_read(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_read(&id, &actor.0);
    Ok(StatusCode::NO_CONTENT)
}

async fn notifications_mark_all_read(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_all_read(&actor.0);
    Ok(StatusCode::NO_CONTENT)
}

async fn notifications_mentions_unread(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<usize>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.rules.mentions_unread_count(&actor.0)))
}

async fn notifications_mentions_mark_read(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.mark_mentions_read(&actor.0);
    Ok(StatusCode::NO_CONTENT)
}

async fn notifications_settings_get(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<NotificationSettings>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.rules.settings_for(&actor.0)))
}

async fn notifications_settings_update(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<SettingsBody>,
) -> Result<Json<NotificationSettings>, AppError> {
    let mut store = store::lock(&state.store)?;
    store.rules.set_settings(&actor.0, body.settings);
    Ok(Json(store.rules.settings_for(&actor.0)))
}

// ----- Fotos, tienda y recuperación de ítems (SPEC §8, §10) -----------------

async fn item_add_photo(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<PhotoBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    let limit = store.rules.rules.photo_limit;
    // Fase 2: la foto pasa a disco y el ítem guarda el nombre del archivo.
    let name = grocery_planner_lib::commands::photo::store_photo(&body.photo)?;
    Ok(Json(redact_item(
        store.items.add_photo(&id, &name, limit, &actor.0)?,
        &store,
    )))
}

async fn item_remove_photo(
    State(state): State<Shared>,
    Path((id, index)): Path<(String, usize)>,
    actor: AuthActor,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    let removed_name = store.items.get(&id)?.photos.get(index).cloned();
    let removed = store.items.remove_photo(&id, index, &actor.0)?;
    if let Some(name) = removed_name {
        if !name.starts_with("data:") {
            grocery_planner_lib::commands::photo::delete_photo_file(&name);
        }
    }
    Ok(Json(redact_item(removed, &store)))
}

async fn item_set_store(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<StoreNameBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_store(&id, &body.store_name, &actor.0)?,
        &store,
    )))
}

async fn item_set_aisle(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<AisleBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_aisle(&id, &body.aisle, &actor.0)?,
        &store,
    )))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrandBody {
    brand: String,
}

async fn item_set_brand(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<BrandBody>,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_brand(&id, &body.brand, &actor.0)?,
        &store,
    )))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuantityMaxBody {
    max: Option<f64>,
}

async fn item_set_quantity_max(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<QuantityMaxBody>,
) -> Result<Json<GroceryItem>, AppError> {
    if let Some(m) = body.max {
        if !m.is_finite() || m < 0.0 {
            return Err(AppError::invalid_input(
                "La cantidad máxima debe ser un número positivo",
            ));
        }
    }
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.set_quantity_max(&id, body.max, &actor.0)?,
        &store,
    )))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FallbackBody {
    name: String,
    quantity: f64,
    unit: String,
    note: Option<String>,
}

async fn item_add_fallback(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<FallbackBody>,
) -> Result<Json<grocery_planner_lib::domain::item::ItemFallback>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(store.items.add_fallback(
        &id,
        &body.name,
        body.quantity,
        &body.unit,
        body.note.as_deref(),
        &actor.0,
    )?))
}

async fn item_remove_fallback(
    State(state): State<Shared>,
    Path((id, index)): Path<(String, usize)>,
    actor: AuthActor,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.remove_fallback(&id, index, &actor.0)?,
        &store,
    )))
}

async fn item_use_fallback(
    State(state): State<Shared>,
    Path((id, index)): Path<(String, usize)>,
    actor: AuthActor,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.use_fallback(&id, index, &actor.0)?,
        &store,
    )))
}

async fn item_recover(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<Json<GroceryItem>, AppError> {
    let mut store = store::lock(&state.store)?;
    Ok(Json(redact_item(
        store.items.recover(&id, &actor.0)?,
        &store,
    )))
}

async fn items_purchased_between(
    State(state): State<Shared>,
    Query(params): Query<RangeParams>,
) -> Result<Json<Vec<GroceryItem>>, AppError> {
    let store = store::lock(&state.store)?;
    let items: Vec<GroceryItem> = store
        .items
        .list()
        .into_iter()
        .filter(|item| {
            item.history.iter().any(|ev| {
                matches!(
                    &ev.kind,
                    grocery_planner_lib::domain::item::ItemEventKind::StatusChanged {
                        to: ItemStatus::Comprado,
                        ..
                    }
                ) && ev.at >= params.start && ev.at <= params.end
            })
        })
        .collect();
    Ok(Json(
        items
            .into_iter()
            .map(|it| redact_item(it, &store))
            .collect(),
    ))
}

// ----- Línea de tiempo (SPEC §8.3) -----------------------------------------

async fn timeline_get(
    State(state): State<Shared>,
    Query(params): Query<RangeParams>,
) -> Result<Json<Vec<grocery_planner_lib::commands::timeline::TimelineEntry>>, AppError> {
    let store = store::lock(&state.store)?;
    let mut entries = grocery_planner_lib::commands::timeline::compute_timeline(&store);
    entries.retain(|e| e.at >= params.start && e.at <= params.end);
    entries.sort_by(|a, b| a.at.cmp(&b.at));
    Ok(Json(entries))
}

// ----- Recepción de mandados (SPEC §6) -------------------------------------

async fn trips_confirm_received(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
) -> Result<Json<ShoppingTrip>, AppError> {
    let mut store = store::lock(&state.store)?;
    let trip = store.trips.get(&id)?;
    let buyer = trip.assigned_to.clone().unwrap_or_else(|| trip.created_by.clone());
    let title = trip.title.clone();
    let received = store.trips.confirm_received(&id, &actor.0)?;
    if buyer != actor.0 {
        notify::push_managed(
            &mut store.rules,
            &buyer,
            NotificationKind::Arrival,
            &format!("{} recibió el mandado", actor.0),
            &format!("El mandado \"{title}\" ya llegó a casa. ¡Gracias!"),
            Some(&format!("/trips/{id}")),
        );
    }
    Ok(Json(received))
}

// ----- Secciones: mover (SPEC §4.4) ----------------------------------------

async fn section_move(
    State(state): State<Shared>,
    Path(id): Path<String>,
    actor: AuthActor,
    Json(body): Json<DirectionBody>,
) -> Result<Json<Section>, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    Ok(Json(store.sections.move_section(&id, body.direction)?))
}

// ----- Respaldo exportar/importar (SPEC §15) --------------------------------

async fn backup_export(
    State(state): State<Shared>,
    actor: AuthActor,
) -> Result<Json<BackupData>, AppError> {
    let store = store::lock(&state.store)?;
    // Solo el Admin del hogar exporta todo (SPEC §15); además se respeta la
    // privacidad (§14): si no se muestran fotos/precios, salen redactados.
    Ok(Json(grocery_planner_lib::commands::backup::backup_export_core(
        &store,
        &actor.0,
    )?))
}

async fn backup_import(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(data): Json<BackupData>,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    // Importar reemplaza los datos del hogar: solo el Admin puede hacerlo.
    grocery_planner_lib::commands::backup::backup_import_core(&mut store, &actor.0, data)?;
    Ok(StatusCode::NO_CONTENT)
}

// ----- PIN rápido (SPEC §2.3) ----------------------------------------------

async fn auth_set_pin(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<PinBody>,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    auth_cmd::require_self_or_admin(&store, &actor.0, &body.name)?;
    store.auth.set_pin(&body.name, &body.pin)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

async fn auth_remove_pin(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<PinBody>,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    auth_cmd::require_self_or_admin(&store, &actor.0, &body.name)?;
    store.auth.remove_pin(&body.name)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

async fn auth_has_pin(
    State(state): State<Shared>,
    Query(params): Query<NameBody>,
) -> Result<Json<bool>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(store.auth.has_pin(&params.name)))
}

async fn auth_login_pin(
    State(state): State<Shared>,
    Json(body): Json<LoginPinBody>,
) -> Result<Json<auth_cmd::AuthView>, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.login_pin(&body.name, &body.pin, &body.device)?;
    persist_store(&store);
    Ok(Json(auth_cmd::AuthView {
        user: user_view(&user),
        token,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostLoginBody {
    host_key: String,
    device: String,
}

async fn auth_host_login(
    State(state): State<Shared>,
    Json(body): Json<HostLoginBody>,
) -> Result<Json<auth_cmd::AuthView>, AppError> {
    let mut store = store::lock(&state.store)?;
    let rules = store.rules.rules();
    if !rules.host_mode {
        return Err(AppError::conflict(
            "El modo host está desactivado en las reglas de la familia",
        ));
    }
    let valid = rules
        .host_key
        .as_deref()
        .map(|k| k == body.host_key.trim())
        .unwrap_or(false);
    if !valid {
        return Err(AppError::unauthorized("La llave del modo host no es válida"));
    }
    let (user, token) = store.auth.session_for(
        grocery_planner_lib::store::auth::DEFAULT_ACCOUNT,
        &body.device,
    )?;
    persist_store(&store);
    Ok(Json(auth_cmd::AuthView {
        user: user_view(&user),
        token,
    }))
}

/// Info pública del modo host (para que el quiosco sepa si puede entrar sin
/// credenciales, SPEC §2.3).
async fn host_mode_info(State(state): State<Shared>) -> Result<Json<HostModeInfo>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(Json(HostModeInfo {
        host_mode: store.rules.rules.host_mode,
        host_pause_with_visitors: store.rules.rules.host_pause_with_visitors,
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostModeInfo {
    host_mode: bool,
    host_pause_with_visitors: bool,
}

// ----- App ---------------------------------------------------------------

async fn greet(Json(body): Json<GreetBody>) -> Result<Json<String>, AppError> {
    Ok(Json(grocery_planner_lib::commands::app::greet(&body.name)?))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfoBody {
    name: String,
    version: String,
    db_ready: bool,
}

async fn app_info(State(state): State<Shared>) -> Result<Json<AppInfoBody>, AppError> {
    Ok(Json(AppInfoBody {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        db_ready: state.db_ready,
    }))
}

// ----- Autenticación ------------------------------------------------------

fn user_view(user: &grocery_planner_lib::domain::auth::User) -> auth_cmd::UserView {
    auth_cmd::UserView {
        id: user.id.clone(),
        name: user.name.clone(),
        alias: user.alias.clone(),
        avatar: user.avatar.clone(),
        home_id: user.home_id.clone(),
        created_at: user.created_at.clone(),
    }
}

fn session_view(session: &grocery_planner_lib::domain::auth::Session, current: bool) -> auth_cmd::SessionView {
    auth_cmd::SessionView {
        token: session.token.clone(),
        device: session.device.clone(),
        created_at: session.created_at.clone(),
        last_used_at: session.last_used_at.clone(),
        revoked: session.revoked,
        current,
        expires_at: session.expires_at.clone(),
    }
}

async fn auth_register(
    State(state): State<Shared>,
    Json(body): Json<RegisterBody>,
) -> Result<Json<auth_cmd::AuthView>, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.register(&body.name, &body.password, "este dispositivo")?;
    persist_store(&store);
    Ok(Json(auth_cmd::AuthView {
        user: user_view(&user),
        token,
    }))
}

async fn auth_login(
    State(state): State<Shared>,
    Json(body): Json<LoginBody>,
) -> Result<Json<auth_cmd::AuthView>, AppError> {
    let mut store = store::lock(&state.store)?;
    let (user, token) = store.auth.login(&body.name, &body.password, &body.device)?;
    persist_store(&store);
    Ok(Json(auth_cmd::AuthView {
        user: user_view(&user),
        token,
    }))
}

async fn auth_logout(
    State(state): State<Shared>,
    headers: HeaderMap,
) -> Result<StatusCode, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    store.auth.revoke(&token)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

async fn auth_me(
    State(state): State<Shared>,
    headers: HeaderMap,
) -> Result<Json<auth_cmd::UserView>, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    let user = store.auth.user_by_token(&token)?;
    Ok(Json(user_view(&user)))
}

async fn auth_sessions(
    State(state): State<Shared>,
    headers: HeaderMap,
) -> Result<Json<Vec<auth_cmd::SessionView>>, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    let user = store.auth.user_by_token(&token)?;
    let sessions = store
        .auth
        .sessions_of(&user.id)
        .iter()
        .map(|s| session_view(s, s.token == token))
        .collect();
    Ok(Json(sessions))
}

async fn auth_revoke_session(
    State(state): State<Shared>,
    headers: HeaderMap,
    Json(body): Json<RevokeSessionBody>,
) -> Result<Json<bool>, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    let actor = store.auth.user_by_token(&token)?;
    let target = store.auth.session(&body.target_token)?;
    if target.user_id != actor.id {
        let is_admin = store
            .home
            .get()
            .ok()
            .map(|h| {
                h.member(&actor.name)
                    .map(|m| m.role == Role::Admin)
                    .unwrap_or(false)
            })
            .unwrap_or(false);
        if !is_admin {
            return Err(AppError::conflict(
                "Solo puedes cerrar tus propias sesiones (o las de tu hogar como Admin)",
            ));
        }
    }
    let is_current = body.target_token == token;
    store.auth.revoke(&body.target_token)?;
    persist_store(&store);
    Ok(Json(is_current))
}

async fn auth_change_password(
    State(state): State<Shared>,
    headers: HeaderMap,
    Json(body): Json<ChangePasswordBody>,
) -> Result<StatusCode, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    store
        .auth
        .change_password(&token, &body.current_password, &body.new_password)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProfileBody {
    alias: Option<String>,
    avatar: Option<String>,
}

async fn auth_update_profile(
    State(state): State<Shared>,
    headers: HeaderMap,
    Json(body): Json<UpdateProfileBody>,
) -> Result<Json<auth_cmd::UserView>, AppError> {
    let token = bearer_token(&headers)?;
    let mut store = store::lock(&state.store)?;
    let user = store
        .auth
        .update_profile(&token, body.alias.as_deref(), body.avatar.as_deref())?;
    persist_store(&store);
    Ok(Json(auth_cmd::UserView {
        id: user.id.clone(),
        name: user.name.clone(),
        alias: user.alias.clone(),
        avatar: user.avatar.clone(),
        home_id: user.home_id.clone(),
        created_at: user.created_at.clone(),
    }))
}

/// Restablece la contraseña de un miembro con la clave de respaldo del hogar
/// (SPEC §2.5). Es público porque quien la usa pudo perder su sesión; la clave
/// es la credencial.
async fn auth_reset_password(
    State(state): State<Shared>,
    Json(body): Json<ResetPasswordBody>,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    let home = store.home.get()?;
    if home.backup_key != body.backup_key.trim() {
        return Err(AppError::unauthorized("La clave de respaldo no es válida"));
    }
    store.auth.reset_password(&body.name, &body.new_password)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminResetBody {
    name: String,
    new_password: String,
}

/// Regenera la contraseña de un miembro cuando no hay clave de respaldo
/// (SPEC §2.5): requiere rol Organizador/Admin.
async fn auth_admin_reset_password(
    State(state): State<Shared>,
    actor: AuthActor,
    Json(body): Json<AdminResetBody>,
) -> Result<StatusCode, AppError> {
    let mut store = store::lock(&state.store)?;
    grocery_planner_lib::commands::require_role(&store, &actor.0, Role::Organizador)?;
    store.auth.reset_password(&body.name, &body.new_password)?;
    persist_store(&store);
    Ok(StatusCode::NO_CONTENT)
}

/// Guarda de autenticación: rechaza con 401 cualquier `/api/*` que no traiga
/// un token de sesión válido, salvo las rutas públicas.
async fn auth_guard(
    State(state): State<Shared>,
    mut req: axum::extract::Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    // Solo el API exige sesión; los estáticos y la SPA pasan libre (fase 2:
    // el mismo binario sirve el frontend).
    if !path.starts_with("/api/") {
        return next.run(req).await;
    }
    // Público solo si es la ruta exacta o un sub-prefijo real (con `/`), para que
    // `/api/auth/login-pin` no deje públicas variantes como `/api/auth/login-pin-xyz`.
    let public = PUBLIC_PATHS
        .iter()
        .any(|p| path == *p || path.starts_with(&format!("{p}/")));
    if public {
        return next.run(req).await;
    }
    let token = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|t| t.trim().to_string());
    // `has_home` = la cuenta pertenece al hogar de la familia (o es la cuenta
    // host del modo quiosco). SPEC §15: los datos de la familia solo se ven a
    // los miembros; un usuario recién registrado sin hogar no debe leerlos.
    let (authorized, has_home) = match token {
        Some(tok) => match store::lock(&state.store) {
            Ok(mut s) => match s.auth.user_by_token(&tok) {
                Ok(user) => {
                    // El actor real de esta request es la cuenta del token.
                    let is_host = user.name == grocery_planner_lib::store::auth::DEFAULT_ACCOUNT;
                    let member = if is_host {
                        true
                    } else {
                        s.home
                            .get()
                            .ok()
                            .map(|h| h.member(&user.name).is_some())
                            .unwrap_or(false)
                    };
                    req.extensions_mut().insert(AuthActor(user.name));
                    (true, member)
                }
                Err(_) => (false, false),
            },
            Err(_) => (false, false),
        },
        None => (false, false),
    };
    if !authorized {
        return (
            StatusCode::UNAUTHORIZED,
            Json(AppError::Unauthorized(
                "Se requiere iniciar sesión para usar la API".into(),
            )),
        )
            .into_response();
    }
    // Las rutas de datos exigen pertenecer al hogar. Rutas "sin hogar" (auth,
    // crear/ver el propio hogar, presencia, avisos propios, el stream SSE y los
    // helpers puros) quedan exentas. 404 (no 401) para no cerrar la sesión de
    // alguien recién registrado que aún no se une a un hogar.
    let needs_home = !(path.starts_with("/api/auth/")
        || path.starts_with("/api/home")
        || path.starts_with("/api/presence")
        || path.starts_with("/api/notifications")
        || path.starts_with("/api/events-stream")
        || path.starts_with("/api/item-flows")
        || path.starts_with("/api/parse-quick-entry"));
    if needs_home && !has_home {
        return (
            StatusCode::NOT_FOUND,
            Json(AppError::NotFound("No perteneces a un hogar".into())),
        )
            .into_response();
    }
    next.run(req).await
}

// ----- Tiempo real (fase 2): SSE de cambios --------------------------------

/// Sirve una foto guardada en disco (fase 2). Bajo `/api/` → requiere sesión.
async fn photo_get(Path(file): Path<String>) -> Result<Response, AppError> {
    let (mime, bytes) = grocery_planner_lib::commands::photo::serve_photo(&file)?;
    Ok((
        [(axum::http::header::CONTENT_TYPE, mime)],
        bytes,
    )
        .into_response())
}

/// ¿Qué dominio(s) cambió con una mutación del API? Solo POST/PATCH/DELETE/PUT
/// con respuesta 2xx publican. Las rutas de solo lectura que usan POST se
/// excluyen para no provocar un bucle de refetch (query/suggest/transition/
/// validate). Una mutación puede afectar varios dominios: las que además crean
/// avisos (push_managed) publican también `notifications` para que el badge de
/// cualquier dispositivo se refresque al instante (SPEC §13).
fn change_kinds_for(path: &str) -> &'static [&'static str] {
    if path == "/api/backup" || path == "/api/backup/import" {
        return &["all"];
    }
    if path == "/api/events-stream" {
        return &[];
    }
    if path.starts_with("/api/items/query")
        || path.starts_with("/api/items/suggest")
        || path.starts_with("/api/items/transition")
        || path.starts_with("/api/items/validate")
        || path == "/api/parse-quick-entry"
    {
        return &[];
    }
    // Descartar la lista de un evento BORRA ítems → hay que refrescar la lista
    // además del calendario (antes solo se emitía `events` y la lista quedaba
    // vieja hasta el siguiente poll).
    if path.ends_with("/discard") && path.starts_with("/api/events/") {
        return &["events", "items"];
    }
    if path.starts_with("/api/items") {
        // Crear un ítem urgente, cambiarlo a comprado dentro de un mandado y
        // asignarlo generan avisos (SPEC §13) además de tocar la lista.
        if path == "/api/items"
            || path == "/api/items/complete-batch"
            || path.ends_with("/status")
            || path.ends_with("/assign")
        {
            return &["items", "notifications"];
        }
        return &["items"];
    }
    if path.starts_with("/api/chat") {
        // Enviar un mensaje puede mencionar a alguien (@Nombre) → aviso.
        if path == "/api/chat" {
            return &["chat", "notifications"];
        }
        return &["chat"];
    }
    if path.starts_with("/api/plans") {
        return &["plans"];
    }
    if path.starts_with("/api/events") {
        return &["events"];
    }
    if path.starts_with("/api/trips") {
        // Asignar un mandado, empezarlo y confirmar la llegada generan avisos.
        if path.ends_with("/assign") || path.ends_with("/activate") || path.ends_with("/received") {
            return &["trips", "notifications"];
        }
        return &["trips"];
    }
    if path.starts_with("/api/home") {
        return &["home"];
    }
    if path.starts_with("/api/sections") {
        return &["sections"];
    }
    if path.starts_with("/api/rules") || path.starts_with("/api/host-mode") {
        return &["rules"];
    }
    if path.starts_with("/api/notifications") {
        return &["notifications"];
    }
    // La presencia NO se emite por SSE: el heartbeat es un query que refetchea
    // y emitirlo provocaría un bucle heartbeat→invalidate→heartbeat. El poll de
    // 15 s de cada pantalla es suficiente para "quién está conectado".
    if path.starts_with("/api/reports") {
        return &["reports"];
    }
    if path.starts_with("/api/timeline") {
        return &["timeline"];
    }
    &[]
}

/// Publica un evento de cambio por cada mutación exitosa del API. Corre por
/// fuera de `auth_guard`; al emitir solo en 2xx, una request sin sesión (401)
/// nunca llega a publicar.
async fn realtime_emit(
    State(state): State<Shared>,
    req: axum::extract::Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    let method = req.method().clone();
    let resp = next.run(req).await;
    if method != Method::GET && resp.status().is_success() {
        for kind in change_kinds_for(&path) {
            let _ = state
                .changes
                .send(serde_json::json!({ "kind": kind }).to_string());
        }
    }
    resp
}

/// Flujo SSE de cambios en tiempo real (fase 2): el cliente se suscribe y cada
/// mutación le llega al instante, sin polling. Autenticado por el header Bearer
/// (fetch con headers; los eventos se parsean como `data: {...}`).
async fn events_stream(
    State(state): State<Shared>,
) -> Sse<impl futures_util::Stream<Item = Result<SseEvent, std::convert::Infallible>>> {
    let rx = state.changes.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx).filter_map(|item| async {
        match item {
            Ok(payload) => Some(Ok(SseEvent::default().data(payload))),
            Err(_) => None, // lagged/closed: se silencia y se sigue
        }
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("GROCERY_PLANNER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let state: Shared = Arc::new(AppState::default());
    // Carpeta del frontend compilado (fase 2: el mismo binario sirve la SPA).
    let dist_dir = std::env::var("GROCERY_PLANNER_DIST").unwrap_or_else(|_| "dist".to_string());
    let dist_index = std::path::Path::new(&dist_dir).join("index.html");

    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
            loop {
                interval.tick().await;
                if let Ok(mut store) = state.store.lock() {
                    store.presence.prune();
                    store.auth.prune_expired_sessions();
                }
            }
        });
    }

    // Guardado en segundo plano: los datos y sesiones sobreviven al reinicio.
    persist::spawn_saver(state.clone(), std::time::Duration::from_secs(5));

    // Tareas de fondo: recordatorios de eventos y planes recurrentes
    // (SPEC §7.1, §9.2 y §13).
    {
        let state = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                let changed = if let Ok(mut store) = state.store.lock() {
                    let changed = grocery_planner_lib::commands::background::tick(&mut store);
                    if changed {
                        let _ = persist::save(&store, &persist::default_data_path());
                    }
                    changed
                } else {
                    false
                };
                // El tick crea avisos (recordatorios, proyección, resúmenes) y
                // avanza planes recurrentes SIN pasar por una request HTTP, así
                // que el SSE debe emitirlo aquí para que el badge y el
                // calendario de todos los dispositivos se refresquen al instante.
                if changed {
                    for kind in ["notifications", "plans"] {
                        let _ = state
                            .changes
                            .send(serde_json::json!({ "kind": kind }).to_string());
                    }
                }
            }
        });
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route("/health/healthy", get(healthy))
        .route("/api/app-info", get(app_info))
        .route("/api/greet", post(greet))
        .route("/api/auth/register", post(auth_register))
        .route("/api/auth/login", post(auth_login))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/auth/me", get(auth_me))
        .route("/api/auth/sessions", get(auth_sessions))
        .route("/api/auth/sessions/revoke", post(auth_revoke_session))
        .route("/api/auth/password", post(auth_change_password))
        .route("/api/auth/profile", post(auth_update_profile))
        .route("/api/auth/password/reset", post(auth_reset_password))
        .route(
            "/api/auth/password/regenerate",
            post(auth_admin_reset_password),
        )
        .route("/api/auth/pin", post(auth_set_pin).delete(auth_remove_pin))
        .route("/api/auth/has-pin", get(auth_has_pin))
        .route("/api/auth/login-pin", post(auth_login_pin))
        .route("/api/auth/host-login", post(auth_host_login))
        .route("/api/chat", get(chat_list).post(chat_send))
        .route("/api/chat/page", get(chat_page_handler))
        .route("/api/chat/search", get(chat_search_handler))
        .route("/api/chat/count", get(chat_count))
        .route("/api/chat/item/{item_id}", get(chat_for_item))
        .route("/api/chat/{id}/react", post(chat_react))
        .route("/api/chat/{id}/pin", post(chat_pin))
        .route("/api/rules", get(rules_get).patch(rules_update))
        .route("/api/rules/host-key", post(rules_host_key_generate).delete(rules_host_key_clear))
        .route("/api/host-mode", get(host_mode_info))
        .route("/api/rules/stores", post(rules_store_add))
        .route("/api/rules/stores/{name}", patch(rules_store_rename).delete(rules_store_remove))
        .route("/api/rules/stores/{store_name}/aisles", post(rules_aisle_add))
        .route(
            "/api/rules/stores/{store_name}/aisles/{aisle}",
            delete(rules_aisle_remove),
        )
        .route("/api/notifications", get(notifications_list))
        .route("/api/notifications/unread", get(notifications_unread))
        .route("/api/notifications/read-all", post(notifications_mark_all_read))
        .route("/api/notifications/mentions/unread", get(notifications_mentions_unread))
        .route("/api/notifications/mentions/read", post(notifications_mentions_mark_read))
        .route("/api/notifications/{id}/read", post(notifications_mark_read))
        .route("/api/notifications/settings", get(notifications_settings_get).put(notifications_settings_update))
        .route("/api/items", get(items_list).post(item_create))
        .route("/api/items/transition", post(item_transition))
        .route("/api/items/validate", post(validate_new_item))
        .route("/api/items/suggest", post(items_suggest))
        .route("/api/items/query", post(items_query))
        .route("/api/items/complete-batch", post(items_complete_batch))
        .route("/api/item-flows", get(item_flows))
        .route("/api/parse-quick-entry", post(parse_quick_entry))
        .route("/api/items/{id}", get(item_get).patch(item_update).delete(item_delete))
        .route("/api/items/{id}/permanent", delete(item_delete_permanent))
        .route("/api/items/{id}/status", patch(item_change_status))
        .route("/api/items/{id}/assign", post(item_assign))
        .route("/api/items/{id}/assign", delete(item_unassign))
        .route("/api/items/{id}/cancel", post(item_cancel))
        .route("/api/items/{id}/history", get(item_history))
        .route("/api/items/{id}/comment", post(item_add_comment))
        .route("/api/items/{id}/price", patch(item_set_price))
        .route("/api/items/{id}/section", patch(item_set_section))
        .route("/api/items/{id}/priority", patch(item_set_priority))
        .route("/api/items/{id}/move", post(item_move))
        .route("/api/items/{id}/store", patch(item_set_store))
        .route("/api/items/{id}/aisle", patch(item_set_aisle))
        .route("/api/items/{id}/brand", patch(item_set_brand))
        .route("/api/items/{id}/quantity-max", patch(item_set_quantity_max))
        .route("/api/items/{id}/fallbacks", post(item_add_fallback))
        .route(
            "/api/items/{id}/fallbacks/{index}",
            delete(item_remove_fallback),
        )
        .route(
            "/api/items/{id}/fallbacks/{index}/use",
            post(item_use_fallback),
        )
        .route("/api/items/{id}/photos", post(item_add_photo))
        .route("/api/items/{id}/photos/{index}", delete(item_remove_photo))
        .route("/api/items/{id}/recover", post(item_recover))
        .route("/api/items/purchased", get(items_purchased_between))
        .route("/api/presence", get(presence_list))
        .route("/api/presence/heartbeat", post(presence_heartbeat))
        .route("/api/presence/leave", post(presence_leave))
        .route("/api/trips", get(trips_list).post(trips_create))
        .route("/api/trips/{id}", get(trips_get))
        .route("/api/trips/{id}/items/add", post(trips_add_item))
        .route("/api/trips/{id}/items/remove", post(trips_remove_item))
        .route("/api/trips/{id}/assign", post(trips_assign))
        .route("/api/trips/{id}/activate", post(trips_activate))
        .route("/api/trips/{id}/complete", post(trips_complete))
        .route("/api/trips/{id}/cancel", post(trips_cancel))
        .route("/api/trips/{id}/received", post(trips_confirm_received))
        .route("/api/home", post(home_create).get(home_info))
        .route("/api/home/members", post(home_add_member))
        .route("/api/home/members/{name}", delete(home_remove_member))
        .route("/api/home/roles", patch(home_change_role))
        .route("/api/home/invitations", post(home_invite_create))
        .route("/api/home/invitations/{id}/revoke", post(home_invite_revoke))
        .route("/api/home/invitations/accept", post(home_invite_accept))
        .route("/api/home/backup-key", post(home_backup_key))
        .route("/api/events", get(events_list).post(event_create))
        .route("/api/events/range", get(events_list_range))
        .route("/api/events/{id}", get(event_get).patch(event_update).delete(event_delete))
        .route("/api/events/{id}/items/add", post(event_add_item))
        .route("/api/events/{id}/items/remove", post(event_remove_item))
        .route("/api/events/{id}/merge", post(event_merge_to_home))
        .route("/api/events/{id}/discard", post(event_discard_list))
        .route("/api/plans", get(plans_list).post(plan_create))
        .route("/api/plans/{id}", get(plan_get))
        .route("/api/plans/{id}/activate", post(plan_activate))
        .route("/api/plans/{id}/complete", post(plan_complete))
        .route("/api/plans/{id}/cancel", post(plan_cancel))
        .route("/api/sections", get(sections_list).post(section_create))
        .route("/api/sections/{id}", patch(section_rename).delete(section_delete))
        .route("/api/sections/{id}/move", post(section_move))
        .route("/api/reports/top-products", get(reports_top))
        .route("/api/reports/spending", get(reports_spending))
        .route("/api/reports/trips-by-member", get(reports_trips))
        .route("/api/reports/projection", get(reports_projection))
        .route("/api/reports/projection/decide", post(projection_decide))
        .route("/api/timeline", get(timeline_get))
        .route("/api/backup", get(backup_export))
        .route("/api/backup/import", post(backup_import))
        // Tiempo real (fase 2): SSE de cambios por dominio.
        .route("/api/events-stream", get(events_stream))
        // Fotos a disco (fase 2): el frontend las sirve desde aquí.
        .route("/api/photos/{file}", get(photo_get))
        .layer(middleware::from_fn_with_state(state.clone(), auth_guard))
        .layer(middleware::from_fn_with_state(state.clone(), realtime_emit))
        .layer(cors)
        .fallback_service(ServeDir::new(dist_dir.clone()).not_found_service(ServeFile::new(dist_index)))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("no se pudo abrir el puerto del servidor");
    println!("Grocery Planner server escuchando en http://{addr}");
    axum::serve(listener, app)
        .await
        .expect("error del servidor");
}

#[cfg(test)]
mod tests {
    use super::change_kinds_for;

    #[test]
    fn mapea_dominios_de_cambio() {
        assert_eq!(change_kinds_for("/api/items/abc/status"), &["items", "notifications"]);
        assert_eq!(change_kinds_for("/api/chat"), &["chat", "notifications"]);
        assert_eq!(change_kinds_for("/api/plans"), &["plans"]);
        assert_eq!(change_kinds_for("/api/events/abc/merge"), &["events"]);
        assert_eq!(
            change_kinds_for("/api/events/abc/discard"),
            &["events", "items"],
            "descartar la lista de un evento también borra ítems"
        );
        assert_eq!(
            change_kinds_for("/api/trips/abc/activate"),
            &["trips", "notifications"]
        );
        assert_eq!(change_kinds_for("/api/home/members"), &["home"]);
        assert_eq!(change_kinds_for("/api/sections"), &["sections"]);
        assert_eq!(change_kinds_for("/api/rules/stores"), &["rules"]);
        assert_eq!(
            change_kinds_for("/api/notifications/read-all"),
            &["notifications"]
        );
        assert_eq!(change_kinds_for("/api/backup/import"), &["all"]);
        // La presencia no se emite (evitaría un bucle de heartbeat).
        assert!(change_kinds_for("/api/presence/heartbeat").is_empty());
    }

    #[test]
    fn no_emite_en_lecturas_ni_stream() {
        // POSTs de solo lectura: no provocan refetch.
        assert!(change_kinds_for("/api/items/query").is_empty());
        assert!(change_kinds_for("/api/items/suggest").is_empty());
        assert!(change_kinds_for("/api/items/transition").is_empty());
        assert!(change_kinds_for("/api/items/validate").is_empty());
        assert!(change_kinds_for("/api/parse-quick-entry").is_empty());
        // El stream SSE no se publica a sí mismo.
        assert!(change_kinds_for("/api/events-stream").is_empty());
        // Rutas sin dominio conocido.
        assert!(change_kinds_for("/api/auth/login").is_empty());
        assert!(change_kinds_for("/health/live").is_empty());
    }

    #[test]
    fn solo_mutaciones_que_avisan_generan_notificaciones() {
        assert_eq!(change_kinds_for("/api/items"), &["items", "notifications"]);
        assert_eq!(
            change_kinds_for("/api/items/complete-batch"),
            &["items", "notifications"]
        );
        assert_eq!(
            change_kinds_for("/api/items/abc/assign"),
            &["items", "notifications"]
        );
        // Un comentario no crea avisos → solo la lista.
        assert_eq!(change_kinds_for("/api/items/abc/comment"), &["items"]);
        assert_eq!(
            change_kinds_for("/api/trips/abc/received"),
            &["trips", "notifications"]
        );
        // Completar un mandado no avisa → solo mandados.
        assert_eq!(change_kinds_for("/api/trips/abc/complete"), &["trips"]);
    }
}
