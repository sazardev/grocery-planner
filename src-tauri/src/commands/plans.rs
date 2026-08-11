use crate::commands::require_role;
use crate::domain::home::Role;
use crate::domain::plan::{Plan, PlanStatus, Recurrence};
use crate::error::AppError;
use crate::state::AppStateRef;
use crate::store;

/// Lista los planes de compra ordenados por fecha (SPEC §7.1).
#[tauri::command]
pub fn plans_list(state: AppStateRef) -> Result<Vec<Plan>, AppError> {
    let store = store::lock(&state.store)?;
    Ok(store.plans.list())
}

/// Crea un plan de compra: cuándo, a dónde y quién (SPEC §7.1).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn plan_create(
    state: AppStateRef,
    title: String,
    scheduled_at: String,
    store: Option<String>,
    assigned_to: Option<String>,
    note: Option<String>,
    recurrence: Recurrence,
    created_by: String,
) -> Result<Plan, AppError> {
    let plan = Plan::new(
        &title,
        &scheduled_at,
        store.as_deref(),
        assigned_to.as_deref(),
        note.as_deref(),
        recurrence,
        &created_by,
    )?;
    let mut store = store::lock(&state.store)?;
    // Planear compras es de Organizador/Admin (SPEC §3.2 y §7.1).
    require_role(&store, &created_by, Role::Organizador)?;
    Ok(store.plans.create(plan))
}

/// Obtiene un plan por id.
#[tauri::command]
pub fn plan_get(state: AppStateRef, id: String) -> Result<Plan, AppError> {
    let store = store::lock(&state.store)?;
    store.plans.get(&id)
}

/// Marca el plan como activo (el mandado está en curso).
#[tauri::command]
pub fn plan_activate(state: AppStateRef, id: String) -> Result<Plan, AppError> {
    let mut store = store::lock(&state.store)?;
    store.plans.set_status(&id, PlanStatus::Activo)
}

/// Marca el plan como completado.
#[tauri::command]
pub fn plan_complete(state: AppStateRef, id: String) -> Result<Plan, AppError> {
    let mut store = store::lock(&state.store)?;
    store.plans.set_status(&id, PlanStatus::Completado)
}

/// Cancela el plan.
#[tauri::command]
pub fn plan_cancel(state: AppStateRef, id: String) -> Result<Plan, AppError> {
    let mut store = store::lock(&state.store)?;
    store.plans.set_status(&id, PlanStatus::Cancelado)
}
