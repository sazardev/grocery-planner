//! Fotos a disco (fase 2): las fotos de los ítems dejan de vivir como data URLs
//! dentro del `data.json` y pasan a archivos en `<data>/photos/`. En el ítem se
//! guarda el nombre del archivo; el server HTTP las sirve en `/api/photos/{file}`
//! y el escritorio las lee con el command `read_photo`. El respaldo las embebe
//! de nuevo como data URLs para seguir siendo autocontenido.

use crate::error::AppError;
use crate::persist;

/// Convierte un data URL (`data:<mime>;base64,...`) en un archivo en disco y
/// devuelve el nombre del archivo (ej. `p-<uuid>.png`).
pub fn store_photo(data_url: &str) -> Result<String, AppError> {
    let data_url = data_url.trim();
    let (mime, b64) = split_data_url(data_url)?;
    let bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        b64,
    )
    .map_err(|_| AppError::invalid_input("La foto no es un data URL válido"))?;
    if bytes.is_empty() {
        return Err(AppError::invalid_input("La foto está vacía"));
    }
    let ext = ext_for_mime(&mime);
    let name = format!("p-{}.{ext}", uuid::Uuid::new_v4());
    let dir = persist::photos_dir();
    std::fs::create_dir_all(&dir).map_err(|e| {
        AppError::internal(format!("No se pudo crear la carpeta de fotos: {e}"))
    })?;
    std::fs::write(dir.join(&name), &bytes)
        .map_err(|e| AppError::internal(format!("No se pudo guardar la foto: {e}")))?;
    Ok(name)
}

/// Devuelve los bytes de una foto por su nombre de archivo.
pub fn read_photo_bytes(name: &str) -> Result<Vec<u8>, AppError> {
    let path = persist::photos_dir().join(safe_name(name)?);
    std::fs::read(&path).map_err(|_| AppError::not_found("Foto no encontrada"))
}

/// Devuelve el data URL de una foto (para desktop y para embeder en respaldo).
pub fn photo_data_url(name: &str) -> Result<String, AppError> {
    let bytes = read_photo_bytes(name)?;
    let mime = mime_for_name(name);
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// Borra el archivo de una foto (best effort; un huérfano no rompe nada).
pub fn delete_photo_file(name: &str) {
    let _ = std::fs::remove_file(persist::photos_dir().join(safe_name(name).unwrap_or_default()));
}

/// Respaldo (SPEC §15): convierte los nombres de archivo a data URLs embebidos
/// para que el backup siga siendo autocontenido. Los data URLs legacy pasan tal
/// cual.
pub fn embed_photos(names: &[String]) -> Vec<String> {
    names
        .iter()
        .map(|n| {
            if n.starts_with("data:") {
                n.clone()
            } else {
                photo_data_url(n).unwrap_or_else(|_| n.clone())
            }
        })
        .collect()
}

/// Respaldo (SPEC §15): convierte data URLs embebidos de vuelta a archivos en
/// disco y devuelve los nombres. Los nombres legacy pasan tal cual.
pub fn extract_photos(data_urls: &[String]) -> Vec<String> {
    data_urls
        .iter()
        .map(|p| {
            if p.starts_with("data:") {
                store_photo(p).unwrap_or_else(|_| p.clone())
            } else {
                p.clone()
            }
        })
        .collect()
}

fn split_data_url(data_url: &str) -> Result<(String, &str), AppError> {
    let rest = data_url
        .strip_prefix("data:")
        .ok_or_else(|| AppError::invalid_input("La foto debe ser un data URL (data:…)"))?;
    let (meta, b64) = rest
        .split_once(',')
        .ok_or_else(|| AppError::invalid_input("Data URL mal formado"))?;
    let mime = meta
        .split(';')
        .next()
        .filter(|m| !m.is_empty())
        .unwrap_or("image/png")
        .to_string();
    Ok((mime, b64))
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" => "jpg",
        "image/jpg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/svg+xml" => "svg",
        _ => "png",
    }
}

fn mime_for_name(name: &str) -> &'static str {
    if let Some(ext) = name.rsplit('.').next() {
        match ext {
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            _ => "image/png",
        }
    } else {
        "image/png"
    }
}

/// Solo permite nombres seguros (sin rutas): `p-<uuid>.<ext>`.
fn safe_name(name: &str) -> Result<&str, AppError> {
    let name = name.trim();
    let ok = !name.is_empty()
        && name.len() <= 64
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        && !name.contains("..");
    if ok {
        Ok(name)
    } else {
        Err(AppError::invalid_input("Nombre de foto inválido"))
    }
}

/// Servir `/api/photos/{file}` (HTTP): devuelve bytes + content-type.
pub fn serve_photo(name: &str) -> Result<(String, Vec<u8>), AppError> {
    let bytes = read_photo_bytes(name)?;
    Ok((mime_for_name(name).to_string(), bytes))
}

/// Desktop: devuelve el data URL de una foto para mostrarla en la UI local
/// (el webview no puede leer el disco directamente).
#[tauri::command]
pub fn read_photo(state: crate::state::AppStateRef, name: String) -> Result<String, AppError> {
    let _store = crate::store::lock(&state.store)?;
    photo_data_url(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_png() -> String {
        // 1x1 PNG en base64.
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=".to_string()
    }

    #[test]
    fn almacena_y_lee_foto() {
        let name = store_photo(&tiny_png()).unwrap();
        assert!(name.starts_with("p-"));
        assert!(name.ends_with(".png"));
        let data_url = photo_data_url(&name).unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));
        delete_photo_file(&name);
    }

    #[test]
    fn rechaza_data_url_invalido() {
        assert!(store_photo("no-es-data-url").is_err());
        assert!(store_photo("data:image/png;base64,¡¡¡").is_err());
    }

    #[test]
    fn nombre_inseguro_se_rechaza() {
        assert!(read_photo_bytes("../etc/passwd").is_err());
        assert!(read_photo_bytes("a/b.png").is_err());
    }

    #[test]
    fn embed_y_extract_son_redondos() {
        let name = store_photo(&tiny_png()).unwrap();
        let embedded = embed_photos(&[name.clone()]);
        assert!(embedded[0].starts_with("data:image/png;base64,"));
        // Extraer crea un archivo nuevo (uuid distinto), pero el contenido debe
        // ser el mismo data URL.
        let extracted = extract_photos(&embedded);
        assert_ne!(extracted[0], name);
        assert_eq!(photo_data_url(&extracted[0]).unwrap(), embedded[0]);
        delete_photo_file(&name);
        delete_photo_file(&extracted[0]);
    }
}
