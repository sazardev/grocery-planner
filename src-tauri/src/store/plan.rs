use std::collections::HashMap;

use crate::domain::plan::{Plan, PlanStatus};
use crate::error::AppError;

/// Repositorio en memoria de planes de compra (SPEC §7.1).
pub struct PlanStore {
    plans: HashMap<String, Plan>,
}

impl PlanStore {
    pub fn new() -> Self {
        Self {
            plans: HashMap::new(),
        }
    }

    pub fn create(&mut self, plan: Plan) -> Plan {
        self.plans.insert(plan.id.clone(), plan.clone());
        plan
    }

    pub fn list(&self) -> Vec<Plan> {
        let mut plans: Vec<Plan> = self.plans.values().cloned().collect();
        plans.sort_by(|a, b| a.scheduled_at.cmp(&b.scheduled_at));
        plans
    }

    pub fn get(&self, id: &str) -> Result<Plan, AppError> {
        self.plans
            .get(id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("Plan {id} no encontrado")))
    }

    pub fn set_status(&mut self, id: &str, status: PlanStatus) -> Result<Plan, AppError> {
        let plan = self
            .plans
            .get_mut(id)
            .ok_or_else(|| AppError::not_found(format!("Plan {id} no encontrado")))?;
        if matches!(plan.status, PlanStatus::Completado | PlanStatus::Cancelado) {
            return Err(AppError::conflict(format!(
                "El plan ya está {}, no se puede modificar",
                match plan.status {
                    PlanStatus::Completado => "completado",
                    PlanStatus::Cancelado => "cancelado",
                    _ => unreachable!(),
                }
            )));
        }
        plan.status = status;
        Ok(plan.clone())
    }

    /// Reemplaza todos los planes (restauración de respaldo, SPEC §15).
    pub fn replace_all(&mut self, plans: Vec<Plan>) {
        self.plans = plans.into_iter().map(|p| (p.id.clone(), p)).collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Plan {
        Plan::new(
            "Mandado del sábado",
            "2026-08-15T09:00",
            Some("Walmart"),
            Some("Ana"),
            None,
            crate::domain::plan::Recurrence::Ninguna,
            "Papá",
        )
        .unwrap()
    }

    #[test]
    fn crear_listar_y_obtener() {
        let mut store = PlanStore::new();
        let plan = store.create(sample());
        assert_eq!(store.list().len(), 1);
        assert_eq!(store.get(&plan.id).unwrap().title, "Mandado del sábado");
    }

    #[test]
    fn completado_no_es_modificable() {
        let mut store = PlanStore::new();
        let plan = store.create(sample());
        store.set_status(&plan.id, PlanStatus::Completado).unwrap();
        assert!(store.set_status(&plan.id, PlanStatus::Activo).is_err());
    }
}
