export type ListViewMode = 'list' | 'grid' | 'kanban'

const STORAGE_KEY = 'gp-view'

const VALID: ListViewMode[] = ['list', 'grid', 'kanban']

/** Lee la preferencia guardada de vista (validada contra los modos reales). */
export function loadViewMode(): ListViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (VALID as string[]).includes(saved)) return saved as ListViewMode
  } catch {
    /* almacenamiento no disponible */
  }
  return 'list'
}

/** Guarda la preferencia de vista. */
export function saveViewMode(view: ListViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, view)
  } catch {
    /* almacenamiento no disponible */
  }
}
