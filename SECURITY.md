# Política de seguridad

Grocery Planner es una aplicación **self-hosted** pensada para correr en la red
local de una familia. Aun así, tomamos la seguridad en serio.

## Reportar una vulnerabilidad

**No** abras un issue público para problemas de seguridad. Escríbenos a
`cerberusprogrammer@gmail.com` (PGP on request) con:

- Tipo de vulnerabilidad y vector de ataque.
- Pasos para reproducirla (incluyendo versión del servidor y configuración).
- Impacto posible y, si la tienes, una sugerencia de mitigación.

Te responderemos lo antes posible y coordinaremos la divulgación. Las
vulnerabilidades confirmadas se corrigen en privado antes de anunciarse.

## Alcance

- Servidor HTTP (`cargo run --features server --bin server`).
- Commands Tauri y autenticación (`src-tauri/src/domain/auth.rs`, `store/auth.rs`).
- Middleware `auth_guard` y rutas públicas del servidor.

## Buenas prácticas para desplegar

- Cambia la cuenta de desarrollo `admin`/`admin123` antes de exponer el hogar.
- Si expones el servidor a internet, usa HTTPS (recomendado un proxy reverso) y
  un firewall; el servidor escucha en `0.0.0.0` por diseño para la LAN.
- Mantén los datos sensibles (fotos, precios) protegidos: la privacidad se
  configura en Reglas (§14 del SPEC).
- La biometría nunca viaja al servidor; solo desbloquea una sesión local.

## Divulgación responsable

Si trabajas en seguridad y encuentras algo, reporta primero; agradecemos la
coordinación antes de publicar.
