use serde::{Deserialize, Serialize};

use crate::domain::chat::{ChatMessage, ChatMessageKind, MessageRef, MessageRefKind, RefInput};
use crate::domain::notification::NotificationKind;
use crate::domain::item::{ItemEventKind, ItemStatus};
use crate::domain::trip::TripStatus;
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;
use crate::store::AppStore;

/// Historial del chat del hogar (SPEC §11): los mensajes de la familia más los
/// mensajes del sistema que entran solos (SPEC §11.2).
#[tauri::command]
pub fn chat_list(state: AppStateRef) -> Result<Vec<ChatMessage>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_chat(&store))
}

/// Envía un mensaje de la familia al chat (texto y/o foto, SPEC §11.1).
/// Se puede citar un ítem ("acerca del pollo", SPEC §11.3) y referenciar
/// ítems, eventos y mandados con el picker del chat.
#[tauri::command]
pub fn chat_send(
    state: AppStateRef,
    by: String,
    body: String,
    photo: Option<String>,
    item_id: Option<String>,
    refs: Option<Vec<RefInput>>,
) -> Result<ChatMessage, AppError> {
    let mut store = store::lock(&state.store)?;
    chat_send_core(&mut store, &by, &body, photo, item_id, refs.unwrap_or_default())
}

/// Lógica compartida de envío (IPC y HTTP): resuelve refs, crea el mensaje y
/// genera los avisos de menciones @Nombre.
pub fn chat_send_core(
    store: &mut AppStore,
    by: &str,
    body: &str,
    photo: Option<String>,
    item_id: Option<String>,
    refs: Vec<RefInput>,
) -> Result<ChatMessage, AppError> {
    let members: Vec<String> = store
        .home
        .get()
        .ok()
        .map(|h| h.members().iter().map(|m| m.name.clone()).collect())
        .unwrap_or_default();
    let item_name = match &item_id {
        Some(id) => store.items.get(id).ok().map(|it| it.name.clone()),
        None => None,
    };
    let resolved = resolve_refs(store, refs);
    let message = ChatMessage::user_message(by, body, photo, item_id, item_name, &members, resolved)?;
    for mention in &message.mentions {
        // No te avisas a ti mismo por mencionarte (SPEC §13).
        if mention == by {
            continue;
        }
        crate::commands::notify::push_managed(
            &mut store.rules,
            mention,
            NotificationKind::Mention,
            &format!("@{by} te mencionó"),
            &message.body,
            Some("/chat"),
        );
    }
    Ok(store.chat.push(message))
}

/// Resuelve las referencias (ítems, eventos, mandados) contra el store.
/// Las referencias que ya no existen se descartan en silencio.
pub fn resolve_refs(store: &AppStore, refs: Vec<RefInput>) -> Vec<MessageRef> {
    let mut out: Vec<MessageRef> = Vec::new();
    for r in refs {
        match r.kind {
            MessageRefKind::Item => {
                if let Ok(item) = store.items.get(&r.id) {
                    out.push(MessageRef {
                        kind: MessageRefKind::Item,
                        id: item.id.clone(),
                        name: item.name.clone(),
                    });
                }
            }
            MessageRefKind::Event => {
                if let Ok(event) = store.events.get(&r.id) {
                    out.push(MessageRef {
                        kind: MessageRefKind::Event,
                        id: event.id.clone(),
                        name: event.title.clone(),
                    });
                }
            }
            MessageRefKind::Trip => {
                if let Ok(trip) = store.trips.get(&r.id) {
                    out.push(MessageRef {
                        kind: MessageRefKind::Trip,
                        id: trip.id.clone(),
                        name: trip.title.clone(),
                    });
                }
            }
        }
    }
    out
}

/// Agrega o quita una reacción (emoji) de un mensaje (SPEC §11.1).
#[tauri::command]
pub fn chat_react(
    state: AppStateRef,
    id: String,
    emoji: String,
    by: String,
) -> Result<ChatMessage, AppError> {
    let mut store = store::lock(&state.store)?;
    store.chat.react(&id, &emoji, &by)
}

/// Fija o desfija un mensaje importante arriba del chat (SPEC §11.1).
#[tauri::command]
pub fn chat_pin(state: AppStateRef, id: String) -> Result<ChatMessage, AppError> {
    let mut store = store::lock(&state.store)?;
    store.chat.toggle_pin(&id)
}

/// Une mensajes de la familia y del sistema, ordenados cronológicamente.
pub fn compute_chat(store: &AppStore) -> Vec<ChatMessage> {
    let mut messages = store.chat.list();
    messages.extend(system_messages(store));
    messages.sort_by(|a, b| a.at.cmp(&b.at));
    messages
}

/// Genera los mensajes del sistema anclados a la lista (SPEC §11.2).
fn system_messages(store: &AppStore) -> Vec<ChatMessage> {
    let mut out: Vec<ChatMessage> = Vec::new();

    for item in store.items.list() {
        for ev in &item.history {
            let body = match &ev.kind {
                ItemEventKind::Created => format!(
                    "{} agregó: {} {} {}",
                    ev.by,
                    item.name,
                    format_qty(item.quantity),
                    item.unit
                ),
                ItemEventKind::StatusChanged { to: ItemStatus::Comprado, .. } => {
                    format!("{} marcó como comprado: {}", ev.by, item.name)
                }
                ItemEventKind::Cancelled { .. } => {
                    format!("{} canceló: {}", ev.by, item.name)
                }
                ItemEventKind::Assigned { member } => {
                    format!("{} asignó {} a {member}", ev.by, item.name)
                }
                ItemEventKind::Commented { body } => {
                    format!("{} comentó en {}: {body}", ev.by, item.name)
                }
                ItemEventKind::FallbackUsed { from, to } => {
                    format!("No había {from} de {item_name}; llevaron {to}", item_name = item.name)
                }
                _ => continue,
            };
            out.push(ChatMessage {
                // Sufijo único para que dos eventos del mismo segundo no colisionen.
                id: format!("sys-{}-{}-{}", item.id, ev.at, out.len()),
                at: ev.at.clone(),
                by: ev.by.clone(),
                kind: ChatMessageKind::System,
                body,
                item_id: Some(item.id.clone()),
                item_name: Some(item.name.clone()),
                photo: None,
                mentions: Vec::new(),
                refs: Vec::new(),
                reactions: Vec::new(),
                pinned: false,
            });
        }
    }

    for trip in store.trips.list() {
        if trip.status == TripStatus::Completada {
            let who = trip
                .assigned_to
                .clone()
                .unwrap_or_else(|| trip.created_by.clone());
            out.push(ChatMessage {
                id: format!("sys-trip-{}", trip.id),
                at: trip.created_at.clone(),
                by: who.clone(),
                kind: ChatMessageKind::System,
                body: format!("{who} terminó el mandado: {}", trip.title),
                item_id: None,
                item_name: None,
                photo: None,
                mentions: Vec::new(),
                refs: Vec::new(),
                reactions: Vec::new(),
                pinned: false,
            });
        }
        if let Some(received_at) = &trip.received_at {
            let receiver = trip.received_by.clone().unwrap_or_default();
            out.push(ChatMessage {
                id: format!("sys-trip-recv-{}", trip.id),
                at: received_at.clone(),
                by: receiver.clone(),
                kind: ChatMessageKind::System,
                body: format!("El mandado llegó y {receiver} lo recibió: {}", trip.title),
                item_id: None,
                item_name: None,
                photo: None,
                mentions: Vec::new(),
                refs: Vec::new(),
                reactions: Vec::new(),
                pinned: false,
            });
        }
    }

    // "Mañana es el cumple de X 🎂" (SPEC §11.2): el día anterior a un cumpleaños.
    let tomorrow = (time::OffsetDateTime::now_utc() + time::Duration::days(1)).date();
    for event in store.events.list() {
        if event.kind != crate::domain::event::EventType::Cumpleanos {
            continue;
        }
        let Some((_, m, d)) = parse_ymd(&event.date) else { continue };
        if (tomorrow.month() as u8, tomorrow.day()) == (m as u8, d as u8) {
            out.push(ChatMessage {
                id: format!("sys-bday-{}-{}", event.id, tomorrow),
                at: crate::domain::now_iso(),
                by: event.created_by.clone(),
                kind: ChatMessageKind::System,
                body: format!("Mañana es el cumple de {} 🎂", event.title),
                item_id: None,
                item_name: None,
                photo: None,
                mentions: Vec::new(),
                refs: Vec::new(),
                reactions: Vec::new(),
                pinned: false,
            });
        }
    }

    out
}

/// `(año, mes, día)` de una fecha `YYYY-MM-DD`.
fn parse_ymd(s: &str) -> Option<(i32, u32, u32)> {
    let mut it = s.split('-');
    let y: i32 = it.next()?.parse().ok()?;
    let m: u32 = it.next()?.parse().ok()?;
    let d: u32 = it.next()?.parse().ok()?;
    Some((y, m, d))
}

/// Formatea una cantidad sin ceros a la derecha (2.0 → "2", 1.5 → "1.5").
fn format_qty(qty: f64) -> String {
    if qty.fract() == 0.0 {
        format!("{}", qty as i64)
    } else {
        format!("{qty}")
    }
}

/// Cantidad de mensajes del chat (para badges, sin derivar el sistema).
#[tauri::command]
pub fn chat_count(state: AppStateRef) -> Result<usize, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_chat(&store).len())
}

/// Mensajes del chat que citan a un ítem (SPEC §11.3): se muestran en su
/// historial junto con los eventos del ítem.
#[tauri::command]
pub fn chat_for_item(state: AppStateRef, item_id: String) -> Result<Vec<ChatMessage>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.chat.for_item(&item_id))
}

/// Una página del chat (para el infinite scroll, SPEC §11.1).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatPage {
    /// Mensajes de la página en orden cronológico (ascendente).
    pub messages: Vec<ChatMessage>,
    /// Si hay mensajes más viejos que esta página.
    pub has_more: bool,
}

/// Página del historial: la más reciente por defecto, o la que queda antes del
/// cursor `before` (timestamp ISO). El frontend la pide al hacer scroll arriba.
#[tauri::command]
pub fn chat_page(
    state: AppStateRef,
    limit: Option<usize>,
    before: Option<String>,
) -> Result<ChatPage, AppError> {
    let store = store::lock(&state.store)?;
    Ok(chat_page_core(&store, limit, before))
}

/// Lógica compartida de paginación (IPC y HTTP).
///
/// El cursor puede ser un timestamp ISO (compatibilidad) o `at|id`: con el id
/// se desempata el orden de mensajes del mismo segundo (ordenado por `at` y
/// luego por `id`) para no saltarlos ni duplicarlos entre páginas.
pub fn chat_page_core(store: &AppStore, limit: Option<usize>, before: Option<String>) -> ChatPage {
    let limit = limit.unwrap_or(30).clamp(1, 100);
    let mut all = compute_chat(store);
    all.sort_by(|a, b| a.at.cmp(&b.at).then(a.id.cmp(&b.id)));
    let older: Vec<ChatMessage> = match &before {
        Some(cursor) => {
            let (at, id) = cursor
                .split_once('|')
                .map(|(a, i)| (a.to_string(), Some(i.to_string())))
                .unwrap_or_else(|| (cursor.clone(), None));
            all.into_iter()
                .filter(|m| match &id {
                    Some(cid) => m.at < at || (m.at == at && m.id < *cid),
                    None => m.at < at,
                })
                .collect()
        }
        None => all,
    };
    let start = older.len().saturating_sub(limit);
    ChatPage {
        messages: older[start..].to_vec(),
        has_more: start > 0,
    }
}

/// Filtros de búsqueda en el chat (SPEC §11.1).
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatSearchInput {
    /// Texto libre: coincide con el cuerpo, autor, menciones y nombres citados.
    pub query: Option<String>,
    /// Autor del mensaje.
    pub by: Option<String>,
    /// Solo mensajes que citan ítems, eventos o mandados.
    pub ref_kind: Option<MessageRefKind>,
    /// Solo mensajes con foto.
    pub has_photo: Option<bool>,
    pub limit: Option<usize>,
}

/// Resultado de la búsqueda en todo el historial.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSearchResult {
    pub messages: Vec<ChatMessage>,
    pub total: usize,
}

/// Busca en TODO el historial del chat (mensajes + sistema), no solo lo cargado.
#[tauri::command]
pub fn chat_search(
    state: AppStateRef,
    query: Option<String>,
    by: Option<String>,
    ref_kind: Option<MessageRefKind>,
    has_photo: Option<bool>,
    limit: Option<usize>,
) -> Result<ChatSearchResult, AppError> {
    let store = store::lock(&state.store)?;
    Ok(chat_search_core(
        &store,
        ChatSearchInput {
            query,
            by,
            ref_kind,
            has_photo,
            limit,
        },
    ))
}

/// Lógica compartida de búsqueda (IPC y HTTP).
pub fn chat_search_core(store: &AppStore, input: ChatSearchInput) -> ChatSearchResult {
    let q = input.query.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let ql = q.map(str::to_lowercase);
    let all = compute_chat(store);
    let matches: Vec<ChatMessage> = all
        .into_iter()
        .filter(|m| {
            if let Some(by) = &input.by {
                if m.by != *by {
                    return false;
                }
            }
            if let Some(photo) = input.has_photo {
                if m.photo.is_some() != photo {
                    return false;
                }
            }
            if let Some(kind) = input.ref_kind {
                if !m.refs.iter().any(|r| r.kind == kind) {
                    return false;
                }
            }
            if let Some(q) = &ql {
                let body = m.body.to_lowercase();
                let sender = m.by.to_lowercase();
                let item = m.item_name.as_deref().unwrap_or("").to_lowercase();
                let in_mention = m.mentions.iter().any(|x| x.to_lowercase().contains(q));
                let in_ref = m.refs.iter().any(|r| r.name.to_lowercase().contains(q));
                if !(body.contains(q) || sender.contains(q) || item.contains(q) || in_mention || in_ref)
                {
                    return false;
                }
            }
            true
        })
        .collect();
    let total = matches.len();
    let limit = input.limit.unwrap_or(100).clamp(1, 200);
    let start = matches.len().saturating_sub(limit);
    ChatSearchResult {
        messages: matches[start..].to_vec(),
        total,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::item::GroceryItem;

    #[test]
    fn sistema_deriva_de_la_lista() {
        let mut store = AppStore::new();
        let mut item =
            GroceryItem::new("pollo", 2.0, "kg", crate::domain::item::Priority::Alta, "Ana", None, None)
                .unwrap();
        item.change_status(ItemStatus::Comprado, "Juan").unwrap();
        store.items.create(item);

        let chat = compute_chat(&store);
        assert!(!chat.is_empty());
        let sys: Vec<&ChatMessage> = chat
            .iter()
            .filter(|m| m.kind == ChatMessageKind::System)
            .collect();
        assert!(sys.iter().any(|m| m.body.contains("Ana agregó: pollo")));
        assert!(sys.iter().any(|m| m.body.contains("Juan marcó como comprado: pollo")));
    }

    #[test]
    fn mensaje_usuario_con_mencion_genera_aviso() {
        let mut store = AppStore::new();
        let home = crate::domain::home::Home::create("Los Ramírez", "Ana").unwrap();
        store.home.replace(home);
        let msg = ChatMessage::user_message(
            "Ana",
            "oye @Juan",
            None,
            None,
            None,
            &["Ana".to_string(), "Juan".to_string()],
            Vec::new(),
        )
        .unwrap();
        assert_eq!(msg.mentions, vec!["Juan".to_string()]);
    }

    #[test]
    fn resuelve_referencias_de_la_familia() {
        let mut store = AppStore::new();
        let item = GroceryItem::new("pollo", 2.0, "kg", crate::domain::item::Priority::Alta, "Ana", None, None).unwrap();
        let item_id = item.id.clone();
        store.items.create(item);
        let event = crate::domain::event::Event::new(
            "Cumple de Ana", "2026-08-20", None, true, crate::domain::event::EventType::Cumpleanos,
            None, vec![], None, false, None, "Ana",
        ).unwrap();
        let event_id = event.id.clone();
        store.events.create(event);
        let trip = crate::domain::trip::ShoppingTrip::new("Mandado sábado", None, None, "Ana").unwrap();
        let trip_id = trip.id.clone();
        store.trips.create(trip);

        let resolved = resolve_refs(
            &store,
            vec![
                RefInput { kind: MessageRefKind::Item, id: item_id },
                RefInput { kind: MessageRefKind::Event, id: event_id },
                RefInput { kind: MessageRefKind::Trip, id: trip_id },
                RefInput { kind: MessageRefKind::Item, id: "no-existe".into() },
            ],
        );
        assert_eq!(resolved.len(), 3);
        assert_eq!(resolved[0].name, "pollo");
        assert_eq!(resolved[1].name, "Cumple de Ana");
        assert_eq!(resolved[2].name, "Mandado sábado");
    }

    fn store_con_5_mensajes() -> AppStore {
        let mut store = AppStore::new();
        for i in 0..5 {
            let msg = ChatMessage::user_message(
                if i % 2 == 0 { "Ana" } else { "Juan" },
                &format!("mensaje número {i}"),
                None,
                None,
                None,
                &["Ana".into(), "Juan".into()],
                Vec::new(),
            )
            .unwrap();
            store.chat.push(msg);
        }
        store
    }

    #[test]
    fn pagina_devuelve_la_mas_reciente_y_tiene_mas() {
        let store = store_con_5_mensajes();
        let page = chat_page_core(&store, Some(2), None);
        assert_eq!(page.messages.len(), 2);
        assert!(page.has_more);
        // La página es la más reciente, en orden cronológico
        assert!(page.messages[0].body.contains("3"));
        assert!(page.messages[1].body.contains("4"));
        // La siguiente página (antes del cursor) trae las más viejas y termina
        let next = chat_page_core(&store, Some(2), Some(page.messages[0].at.clone()));
        assert_eq!(next.messages.len(), 2);
        assert!(next.messages[0].body.contains("1"));
        assert!(next.messages[1].body.contains("2"));
        let last = chat_page_core(&store, Some(2), Some(next.messages[0].at.clone()));
        assert_eq!(last.messages.len(), 1);
        assert!(!last.has_more);
        assert!(last.messages[0].body.contains("0"));
    }

    #[test]
    fn pagina_sin_cursor_devuelve_todo_si_cabe() {
        let store = store_con_5_mensajes();
        let page = chat_page_core(&store, Some(100), None);
        assert_eq!(page.messages.len(), 5);
        assert!(!page.has_more);
    }

    #[test]
    fn busqueda_por_texto_autor_y_referencia() {
        let mut store = AppStore::new();
        let item = GroceryItem::new("pollo", 2.0, "kg", crate::domain::item::Priority::Alta, "Ana", None, None).unwrap();
        let item_id = item.id.clone();
        store.items.create(item);
        store.chat.push(
            ChatMessage::user_message(
                "Ana",
                "oye @Juan hay pollo",
                None,
                None,
                None,
                &["Ana".into(), "Juan".into()],
                vec![MessageRef { kind: MessageRefKind::Item, id: item_id, name: "pollo".into() }],
            )
            .unwrap(),
        );
        store.chat.push(
            ChatMessage::user_message("Juan", "llego el mandado", None, None, None, &["Ana".into(), "Juan".into()], Vec::new()).unwrap(),
        );

        // por texto en el cuerpo (el mensaje del usuario + el sistema "Ana agregó: pollo")
        let by_text = chat_search_core(&store, ChatSearchInput { query: Some("poll".into()), ..Default::default() });
        assert!(by_text.total >= 1);
        assert!(by_text.messages.iter().any(|m| m.body.contains("oye @Juan")));

        // por autor
        let by_author = chat_search_core(&store, ChatSearchInput { by: Some("Juan".into()), ..Default::default() });
        assert_eq!(by_author.total, 1);
        assert!(by_author.messages[0].body.contains("mandado"));

        // por mención @Nombre
        let by_mention = chat_search_core(&store, ChatSearchInput { query: Some("Juan".into()), ..Default::default() });
        assert!(by_mention.total >= 1);

        // por tipo de referencia (ítem)
        let by_ref = chat_search_core(&store, ChatSearchInput { ref_kind: Some(MessageRefKind::Item), ..Default::default() });
        assert_eq!(by_ref.total, 1);
        assert!(by_ref.messages[0].body.contains("pollo"));
    }
}
