# Contribuir a Grocery Planner

Gracias por querer aportar. Esto es lo que necesitas saber para contribuir con
código o reportes.

## Código de conducta

Al participar aceptas el [Código de conducta](CODE_OF_CONDUCT.md).

## Reportar bugs y pedir features

Usa las plantillas de issues (Bug report / Feature request). Antes de crear uno,
busca si ya existe. Incluye siempre: pasos para reproducir, comportamiento
esperado vs. real, y versiones (`npm run build` / `cargo test` si aplica).

## Flujo de trabajo

1. **Fork** el repo y crea tu rama desde `main`:
   ```bash
   git checkout -b feat/descripcion-corta
   ```
2. **Implementa** siguiendo las convenciones del proyecto (ver
   [AGENTS.md](AGENTS.md)): TS moderno estricto, imports con extensión
   `.ts`/`.tsx`, `import type`, un solo `AppError` en Rust.
3. **Verifica** antes de abrir el PR:
   ```bash
   npm run build
   npm run lint
   cargo test            # en src-tauri/
   cargo check --features server --bin server
   ```
4. **Commits**: Conventional Commits, sujeto en imperativo y ≤ 72 chars
   (`feat(items): add ...`, `fix(trips): ...`).
5. **Abre el PR** con la plantilla. Pequeño y enfocado: cada PR resuelve una
   cosa. Si tocas UI, describe cómo se ve en celular, desktop y modo oscuro.

## Toques finales para un cambio en el backend

Agregar un command toca varias capas (regla de oro):

1. `#[tauri::command]` en `src-tauri/src/commands/<mod>.rs`.
2. Registrarlo en `generate_handler![]` en `src-tauri/src/lib.rs`.
3. Cliente tipado en `src/lib/api/<mod>.ts` que llame `request('nombre', args)`.
4. En web: ruta en `ROUTES` de `src/lib/api/transport.ts` **y** handler en
   `src-tauri/src/bin/server.rs`.

Si el cambio altera el modelo de datos o la persistencia, actualiza también
[DATA.md](DATA.md).

## Áreas del proyecto

| Área | Dónde |
|---|---|
| UI / páginas | `src/pages/`, `src/components/`, `src/shared/ui/` |
| Clientes API / transporte | `src/lib/api/` |
| Backend (lógica pura) | `src-tauri/src/domain/` |
| Backend (repositorios) | `src-tauri/src/store/` |
| Commands Tauri | `src-tauri/src/commands/` |
| Servidor HTTP | `src-tauri/src/bin/server.rs` |
