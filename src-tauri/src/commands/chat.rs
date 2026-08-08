use serde::Serialize;

use crate::domain::chat::{ChatMessage, ChatMessageKind};
use crate::domain::notification::{AppNotification, NotificationKind};
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
/// Se puede citar un ítem ("acerca del pollo", SPEC §11.3).
#[tauri::command]
pub fn chat_send(
    state: AppStateRef,
    by: String,
    body: String,
    photo: Option<String>,
    item_id: Option<String>,
) -> Result<ChatMessage, AppError> {
    let mut store = store::lock(&state.store)?;
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
    let message = ChatMessage::user_message(&by, &body, photo, item_id, item_name, &members)?;
    for mention in &message.mentions {
        store.rules.push_notification(AppNotification::new(
            NotificationKind::Mention,
            mention,
            &format!("@{by} te mencionó"),
            &message.body,
            Some("/chat"),
        ));
    }
    Ok(store.chat.push(message))
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
                _ => continue,
            };
            out.push(ChatMessage {
                id: format!("sys-{}-{}", item.id, ev.at),
                at: ev.at.clone(),
                by: ev.by.clone(),
                kind: ChatMessageKind::System,
                body,
                item_id: Some(item.id.clone()),
                item_name: Some(item.name.clone()),
                photo: None,
                mentions: Vec::new(),
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
                reactions: Vec::new(),
                pinned: false,
            });
        }
    }

    out
}

/// Formatea una cantidad sin ceros a la derecha (2.0 → "2", 1.5 → "1.5").
fn format_qty(qty: f64) -> String {
    if qty.fract() == 0.0 {
        format!("{}", qty as i64)
    } else {
        format!("{qty}")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStats {
    pub total: usize,
}

/// Cantidad de mensajes del chat (para badges, sin derivar el sistema).
#[tauri::command]
pub fn chat_count(state: AppStateRef) -> Result<usize, AppError> {
    let store = store::lock(&state.store)?;
    Ok(compute_chat(&store).len())
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
        )
        .unwrap();
        assert_eq!(msg.mentions, vec!["Juan".to_string()]);
    }
}
