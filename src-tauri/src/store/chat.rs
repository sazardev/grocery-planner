use serde::{Deserialize, Serialize};

use crate::domain::chat::ChatMessage;
use crate::error::AppError;

/// Repositorio en memoria de mensajes del chat del hogar (SPEC §11).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStore {
    messages: Vec<ChatMessage>,
}

impl ChatStore {
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
        }
    }

    pub fn push(&mut self, message: ChatMessage) -> ChatMessage {
        self.messages.push(message.clone());
        message
    }

    pub fn list(&self) -> Vec<ChatMessage> {
        let mut messages = self.messages.clone();
        messages.sort_by(|a, b| a.at.cmp(&b.at));
        messages
    }

    pub fn get(&self, id: &str) -> Result<ChatMessage, AppError> {
        self.messages
            .iter()
            .find(|m| m.id == id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Mensaje {id} no encontrado")))
    }

    fn get_mut(&mut self, id: &str) -> Result<&mut ChatMessage, AppError> {
        self.messages
            .iter_mut()
            .find(|m| m.id == id)
            .ok_or_else(|| AppError::not_found(format!("Mensaje {id} no encontrado")))
    }

    /// Agrega o quita una reacción de un miembro (SPEC §11.1).
    pub fn react(&mut self, id: &str, emoji: &str, by: &str) -> Result<ChatMessage, AppError> {
        let message = self.get_mut(id)?;
        message.react(emoji, by)?;
        Ok(message.clone())
    }

    /// Fija o desfija un mensaje (SPEC §11.1).
    pub fn toggle_pin(&mut self, id: &str) -> Result<ChatMessage, AppError> {
        let message = self.get_mut(id)?;
        message.toggle_pin();
        Ok(message.clone())
    }

    /// Reemplaza todo el contenido (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, messages: Vec<ChatMessage>) {
        self.messages = messages;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::chat::ChatMessage;

    fn msg(by: &str, body: &str) -> ChatMessage {
        ChatMessage::user_message(by, body, None, None, None, &[]).unwrap()
    }

    #[test]
    fn crear_y_listar_en_orden() {
        let mut store = ChatStore::new();
        store.push(msg("Ana", "primero"));
        store.push(msg("Juan", "segundo"));
        let list = store.list();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].body, "primero");
    }

    #[test]
    fn reaccionar_y_fijar() {
        let mut store = ChatStore::new();
        let m = store.push(msg("Ana", "hola"));
        store.react(&m.id, "👍", "Juan").unwrap();
        assert_eq!(store.get(&m.id).unwrap().reactions.len(), 1);
        store.toggle_pin(&m.id).unwrap();
        assert!(store.get(&m.id).unwrap().pinned);
    }

    #[test]
    fn desconocido_es_error() {
        let mut store = ChatStore::new();
        assert!(store.get("no-existe").is_err());
        assert!(store.react("no-existe", "👍", "Ana").is_err());
    }
}
