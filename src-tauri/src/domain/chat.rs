use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::now_iso;
use crate::error::AppError;

/// Tipo de mensaje del chat del hogar (SPEC §11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChatMessageKind {
    /// Escrito por un miembro de la familia.
    User,
    /// Mensaje del sistema anclado a la lista (SPEC §11.2).
    System,
}

/// Una reacción (emoji) a un mensaje del chat (SPEC §11.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reaction {
    pub emoji: String,
    pub by: String,
    pub at: String,
}

/// Un mensaje del chat compartido del hogar (SPEC §11.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub at: String,
    pub by: String,
    pub kind: ChatMessageKind,
    pub body: String,
    /// Ítem citado ("acerca del pollo", SPEC §11.3).
    pub item_id: Option<String>,
    pub item_name: Option<String>,
    /// Foto opcional como data URL (SPEC §10/§11.1).
    pub photo: Option<String>,
    /// Miembros mencionados con @Nombre (SPEC §11.1).
    pub mentions: Vec<String>,
    pub reactions: Vec<Reaction>,
    /// Mensajes importantes fijados arriba del chat (SPEC §11.1).
    pub pinned: bool,
}

impl ChatMessage {
    /// Crea un mensaje de la familia, detectando menciones @Nombre.
    #[allow(clippy::too_many_arguments)]
    pub fn user_message(
        by: &str,
        body: &str,
        photo: Option<String>,
        item_id: Option<String>,
        item_name: Option<String>,
        members: &[String],
    ) -> Result<Self, AppError> {
        let by = by.trim();
        if by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién envía el mensaje es obligatorio",
            ));
        }
        let body = body.trim();
        if body.is_empty() && photo.is_none() {
            return Err(AppError::invalid_input("El mensaje no puede estar vacío"));
        }
        if body.chars().count() > 1000 {
            return Err(AppError::invalid_input(
                "El mensaje no puede superar 1000 caracteres",
            ));
        }
        let photo = photo
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty());
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            at: now_iso(),
            by: by.to_string(),
            kind: ChatMessageKind::User,
            body: body.to_string(),
            item_id: item_id.filter(|i| !i.trim().is_empty()),
            item_name: item_name.filter(|n| !n.trim().is_empty()),
            photo,
            mentions: extract_mentions(&body, members),
            reactions: Vec::new(),
            pinned: false,
        })
    }

    /// Agrega o quita una reacción del miembro (toggle, SPEC §11.1).
    pub fn react(&mut self, emoji: &str, by: &str) -> Result<(), AppError> {
        let emoji = emoji.trim();
        if emoji.is_empty() {
            return Err(AppError::invalid_input("La reacción es obligatoria"));
        }
        let by = by.trim();
        if by.is_empty() {
            return Err(AppError::invalid_input(
                "Quién reacciona es obligatorio",
            ));
        }
        if let Some(idx) = self
            .reactions
            .iter()
            .position(|r| r.emoji == emoji && r.by == by)
        {
            self.reactions.remove(idx);
            return Ok(());
        }
        self.reactions.push(Reaction {
            emoji: emoji.to_string(),
            by: by.to_string(),
            at: now_iso(),
        });
        Ok(())
    }

    /// Fija o desfija un mensaje importante (SPEC §11.1).
    pub fn toggle_pin(&mut self) {
        self.pinned = !self.pinned;
    }
}

/// Detecta menciones `@Nombre` en el texto contra los miembros del hogar.
fn extract_mentions(body: &str, members: &[String]) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for member in members {
        let member = member.trim();
        if member.is_empty() {
            continue;
        }
        let mention = format!("@{member}");
        let mentioned = body
            .split_whitespace()
            .any(|w| w.trim_end_matches([',', '.', '!', '?', ';', ':']) == mention);
        if mentioned {
            found.push(member.to_string());
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn members() -> Vec<String> {
        vec!["Ana".into(), "Juan".into(), "Abuela".into()]
    }

    #[test]
    fn crear_mensaje_valido() {
        let msg = ChatMessage::user_message(
            "Ana",
            "  ¿quién lleva el pollo?  ",
            None,
            None,
            None,
            &members(),
        )
        .unwrap();
        assert_eq!(msg.by, "Ana");
        assert_eq!(msg.body, "¿quién lleva el pollo?");
        assert_eq!(msg.kind, ChatMessageKind::User);
        assert!(!msg.pinned);
        assert!(msg.reactions.is_empty());
    }

    #[test]
    fn mensaje_vacio_invalido_sin_foto() {
        assert!(ChatMessage::user_message("Ana", "  ", None, None, None, &members()).is_err());
    }

    #[test]
    fn foto_sin_texto_es_valida() {
        let msg = ChatMessage::user_message("Ana", " ", Some("data:image/png;base64,xxx".into()), None, None, &members()).unwrap();
        assert_eq!(msg.body, "");
        assert!(msg.photo.is_some());
    }

    #[test]
    fn detecta_menciones() {
        let msg = ChatMessage::user_message(
            "Ana",
            "Hola @Juan, ¿hay leche? @Ana",
            None,
            None,
            None,
            &members(),
        )
        .unwrap();
        assert!(msg.mentions.contains(&"Juan".to_string()));
        assert!(msg.mentions.contains(&"Ana".to_string()));
        assert!(!msg.mentions.contains(&"Abuela".to_string()));
    }

    #[test]
    fn reacciones_toggle() {
        let mut msg = ChatMessage::user_message("Ana", "hola", None, None, None, &members()).unwrap();
        msg.react("👍", "Juan").unwrap();
        assert_eq!(msg.reactions.len(), 1);
        msg.react("👍", "Abuela").unwrap();
        assert_eq!(msg.reactions.len(), 2);
        msg.react("👍", "Juan").unwrap();
        assert_eq!(msg.reactions.len(), 1);
        assert!(msg.reactions[0].by == "Abuela");
    }

    #[test]
    fn pin_toggle() {
        let mut msg = ChatMessage::user_message("Ana", "hola", None, None, None, &members()).unwrap();
        assert!(!msg.pinned);
        msg.toggle_pin();
        assert!(msg.pinned);
        msg.toggle_pin();
        assert!(!msg.pinned);
    }
}
