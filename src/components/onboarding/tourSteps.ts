/** Definición del tour guiado: cubre todas las pantallas y sus acciones. */

export interface TourStep {
  /** Ruta a la que navega (puede omitirse para quedarse en la actual). */
  route?: string
  /** Selector CSS del elemento a resaltar. */
  selector?: string
  /** Texto exacto a buscar (alternativa al selector). */
  text?: string
  title: string
  body: string
  /** Etiqueta corta de la píldora superior (p. ej. "Inicio"). */
  tag?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/home',
    selector: 'button[aria-label="Agregar lo que falta"]',
    tag: 'Inicio',
    title: 'Agrega lo que falta',
    body: 'Toca el botón flotante para anotar algo: escribe “pollo 2kg” en Rápido, o pasa a Detallado para marca, cantidades y alternativas si no hay.',
  },
  {
    route: '/home',
    selector: 'input[aria-label="Buscar en la lista"]',
    tag: 'Inicio',
    title: 'Busca al instante',
    body: 'Filtra por nombre, marca, nota o quién lo pidió. Combínalo con los chips de estado: Falta, Pedido, Ya lo llevo…',
  },
  {
    route: '/home',
    selector: 'input[type="checkbox"]',
    tag: 'Inicio',
    title: 'Marca «ya lo llevo»',
    body: 'En la tienda, toca la bolita de un ítem para pasarlo a “Ya lo llevo”. Si hay alternativas, aparece “No había…” para ofrecer la siguiente opción.',
  },
  {
    route: '/home',
    text: 'Ver reportes de la familia',
    tag: 'Inicio',
    title: 'Reportes y atajos',
    body: 'Aquí abajo tienes los reportes (gasto, más comprado) y los atajos a Calendario, Historial y Avisos.',
  },
  {
    route: '/trips',
    selector: '#trip-title',
    tag: 'Mandado',
    title: 'Crea un mandado',
    body: 'Dale nombre a la salida de compras con el botón flotante “Nuevo mandado”. Añade la tienda, asigna quién va y arma el plan.',
  },
  {
    route: '/trips',
    text: 'Tiendas y pasillos',
    tag: 'Mandado',
    title: 'Organiza tu mandado',
    body: 'Configura tus tiendas con pasillos y agrupa la lista en secciones para recorrer el super sin perderte.',
  },
  {
    route: '/chat',
    selector: 'textarea[aria-label="Mensaje del chat"], input[aria-label="Mensaje del chat"]',
    tag: 'Chat',
    title: 'Habla con la familia',
    body: 'Escribe “@Nombre” para mencionar a alguien, adjunta fotos, reacciona y fija mensajes importantes.',
  },
  {
    route: '/mine',
    text: 'Lo mío',
    tag: 'Lo mío',
    title: 'Todo lo que te toca',
    body: 'Aquí viven solo los ítems asignados a ti, agrupados por tienda, con tu progreso. Confirma los mandados que llegaron con “Recibido”.',
  },
  {
    route: '/family',
    text: 'Miembros',
    tag: 'Familia',
    title: 'Tu familia',
    body: 'Invita con un código corto, gestiona roles y mira quién está conectado. Reglas y calendario también viven aquí.',
  },
  {
    route: '/settings',
    text: 'Apariencia',
    tag: 'Ajustes',
    title: 'Ajusta a tu gusto',
    body: 'Elige el tema (claro/oscuro/sistema), configura tus avisos, el PIN rápido, la clave de respaldo y la cuenta.',
  },
]

/** Ubica el tooltip respecto al elemento: arriba si está en la mitad baja, si no abajo. */
export function tooltipPlacement(rect: DOMRect | null, viewport = 720): 'top' | 'bottom' {
  if (!rect) return 'bottom'
  const centerY = rect.top + rect.height / 2
  return centerY > viewport / 2 ? 'top' : 'bottom'
}
