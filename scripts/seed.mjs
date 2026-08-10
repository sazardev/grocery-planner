#!/usr/bin/env node
/**
 * Super seed de Grocery Planner — llena el backend con una familia realista.
 *
 * Usa la cuenta admin (bypass) para verificar el servidor y crea una cuenta real
 * por miembro; cada acción se hace con la sesión de ese miembro (el backend
 * deriva el actor del token, no confía en el `by` del cliente).
 *
 * Reinicia el hogar y siembra: 10 miembros, reglas con tiendas/pasillos,
 * secciones, ~35 ítems con estados variados, comentarios, fotos, mandados,
 * planes, eventos y chat.
 *
 * Uso:
 *   node scripts/seed.mjs
 *   VITE_API_URL=http://localhost:8787 node scripts/seed.mjs
 *
 * Nota: re-ejecutar el seed reinicia ítems/mandados/planes/eventos/chat/avisos.
 * Los datos quedan persistidos en disco (grocery-planner-data.json) por el backend.
 */

const API = process.env.VITE_API_URL || process.env.GP_API_URL || 'http://localhost:8787'

const ADMIN = { name: 'admin', password: 'admin123' }
const MEMBER_PASSWORD = 'familia123'

const MEMBERS = [
  { name: 'Papá', role: 'admin' },
  { name: 'Mamá', role: 'organizador' },
  { name: 'Ana', role: 'organizador' },
  { name: 'Juan', role: 'miembro' },
  { name: 'Luis', role: 'miembro' },
  { name: 'María', role: 'miembro' },
  { name: 'Sofía', role: 'miembro' },
  { name: 'Diego', role: 'miembro' },
  { name: 'Tía Rosa', role: 'miembro' },
  { name: 'Abuelo', role: 'miembro' },
]

// Sesiones: nombre del miembro → token.
const tokens = {}

// ---- helpers de fecha (fechas relativas a hoy para que siempre se vea fresco) ----
const pad = (n) => String(n).padStart(2, '0')
function day(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function dt(offset, hhmm) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const [h, m] = hhmm.split(':')
  d.setHours(+h, +m, 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hhmm}`
}

// ---- cliente HTTP (el actor sale del token de la sesión indicada con `as`) ----
async function api(path, { method = 'GET', body, as } = {}) {
  const token = tokens[as] ?? tokens['admin'] ?? ''
  const headers = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined
  const data = res.status === 200 ? await res.json() : null
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`
    throw new Error(`${method} ${path} (as ${as ?? 'admin'}) → ${msg}`)
  }
  return data
}
const get = (p, o) => api(p, o)
const post = (p, b, o) => api(p, { method: 'POST', body: b, ...o })
const patch = (p, b, o) => api(p, { method: 'PATCH', body: b, ...o })

// PNG 1x1 (data URL) para demostrar la sección de fotos
const TINY_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

// ============================================================================
async function login(name, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, device: 'seed' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`login ${name}: ${data?.message || res.status}`)
  return data.token
}

async function register(name, password) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  })
  if (res.status !== 409) {
    const data = await res.json()
    if (!res.ok) throw new Error(`register ${name}: ${data?.message || res.status}`)
  }
}

async function setupSessions() {
  console.log('▸ Cuentas y sesiones de los miembros…')
  // Cuenta admin para verificar que el servidor responde
  tokens['admin'] = await login(ADMIN.name, ADMIN.password)
  // Registra (si no existen) y abre sesión de cada miembro
  for (const m of MEMBERS) {
    await register(m.name, MEMBER_PASSWORD)
  }
  for (const m of MEMBERS) {
    tokens[m.name] = await login(m.name, MEMBER_PASSWORD)
  }
  console.log(`  ✔ ${MEMBERS.length} cuentas listas`)
}

// ============================================================================
async function reset() {
  console.log('▸ Reiniciando hogar y datos…')
  const rules = {
    name: 'Los Ramírez',
    stores: [],
    units: ['kg', 'g', 'l', 'pieza', 'bolsa', 'docena', 'paquete', 'tarro'],
    categories: ['frutas', 'verduras', 'carnes', 'lácteos', 'despensa', 'limpieza', 'hogar', 'farmacia'],
    photoLimit: 4,
    hostMode: false,
    hostPauseWithVisitors: false,
    privacyShowPhotos: true,
    privacyShowPrices: true,
    language: 'es',
    timezone: 'America/Mexico_City',
    notifications: {},
  }
  await post('/api/backup/import', {
    exportedAt: new Date().toISOString(),
    home: null,
    items: [],
    trips: [],
    events: [],
    plans: [],
    sections: [],
    chat: [],
    rules,
    notifications: [],
    projectionChoices: {},
  }, { as: 'Papá' })
  await post('/api/home', { name: 'Los Ramírez' }, { as: 'Papá' })
}

// ============================================================================
async function addMembers() {
  console.log('▸ Miembros de la familia (10)…')
  for (const m of MEMBERS) {
    if (m.name === 'Papá') continue // ya es el dueño (Admin)
    await post('/api/home/members', { name: m.name, role: m.role }, { as: 'Papá' })
  }
  console.log(`  ✔ ${MEMBERS.length} miembros en «Los Ramírez»`)
}

// ============================================================================
async function seedSections() {
  console.log('▸ Secciones de la lista…')
  const names = ['Desayunos', 'Carnes', 'Frutas y verduras', 'Lácteos', 'Despensa', 'Limpieza', 'Farmacia', 'Para el domingo']
  const ids = {}
  for (const n of names) {
    const s = await post('/api/sections', { name: n }, { as: 'Papá' })
    ids[n] = s.id
  }
  return ids
}

// ============================================================================
async function seedRules() {
  console.log('▸ Reglas: tiendas y pasillos…')
  await patch('/api/rules', {
    name: 'Los Ramírez',
    photoLimit: 4,
    hostMode: true,
    hostPauseWithVisitors: true,
    language: 'es',
    timezone: 'America/Mexico_City',
  }, { as: 'Papá' })
  const stores = [
    { name: 'Walmart', aisles: ['lácteos', 'panadería', 'carnes', 'abarrotes', 'higiene', 'frutas y verduras'] },
    { name: 'La Comer', aisles: ['carnes', 'frutas', 'verduras', 'panadería', 'abarrotes'] },
    { name: 'Frutería Don Toño', aisles: ['frutas', 'verduras'] },
    { name: 'Farmacia del Ahorro', aisles: ['medicamentos', 'higiene'] },
  ]
  for (const s of stores) {
    await post('/api/rules/stores', { name: s.name, aisles: s.aisles }, { as: 'Papá' })
  }
}

// ============================================================================
async function seedItems(sections) {
  console.log('▸ ítems de la lista (~35, estados variados)…')
  const items = [
    ['pollo', 2, 'kg', 'carnes', 'alta', 'Mamá', 'pechugas, no muslos', 120, 'Carnes', 'falta'],
    ['leche', 3, 'l', 'lácteos', 'urgente', 'Ana', 'la deslactosada nos cae mejor', 81, 'Lácteos', 'falta'],
    ['huevo', 30, 'piezas', 'despensa', 'alta', 'Papá', 'que sean blancos', 55, 'Desayunos', 'falta'],
    ['pan de caja', 2, 'piezas', 'despensa', 'media', 'Diego', 'el integral para los niños', 56, 'Desayunos', 'falta'],
    ['manzanas', 1, 'kg', 'frutas', 'media', 'Sofía', '', 35, 'Frutas y verduras', 'comprado'],
    ['plátanos', 2, 'kg', 'frutas', 'media', 'María', '', 40, 'Frutas y verduras', 'falta'],
    ['arroz', 2, 'kg', 'despensa', 'media', 'Mamá', 'blanco, para el arroz rojo', 38, 'Despensa', 'falta'],
    ['frijol', 3, 'kg', 'despensa', 'alta', 'Papá', 'el negro de olla', 60, 'Despensa', 'falta'],
    ['café', 500, 'g', 'despensa', 'alta', 'Abuelo', 'de grano, molido medio', 120, 'Desayunos', 'falta'],
    ['azúcar', 2, 'kg', 'despensa', 'media', 'Mamá', '', 40, 'Despensa', 'comprado'],
    ['pañales talla M', 1, 'paquete', 'hogar', 'urgente', 'Ana', 'ya no había en la tienda', 210, 'Para el domingo', 'pedido'],
    ['carne molida', 1, 'kg', 'carnes', 'media', 'Mamá', 'para los domingos', 160, 'Carnes', 'pedido'],
    ['bistec de res', 1.5, 'kg', 'carnes', 'alta', 'Papá', 'delgado para asar', 240, 'Carnes', 'pedido'],
    ['queso panela', 2, 'piezas', 'lácteos', 'media', 'Sofía', '', 45, 'Lácteos', 'llevo'],
    ['yogurt', 12, 'piezas', 'lácteos', 'media', 'Diego', 'de fresa y natural', 84, 'Desayunos', 'llevo'],
    ['tomate', 2, 'kg', 'verduras', 'media', 'Mamá', 'maduro para la salsa', 50, 'Frutas y verduras', 'llevo'],
    ['cebolla', 1, 'kg', 'verduras', 'media', 'Mamá', '', 30, 'Frutas y verduras', 'llevo'],
    ['aguacate', 1, 'kg', 'frutas', 'alta', 'Ana', 'para el guacamole del domingo', 70, 'Frutas y verduras', 'falta'],
    ['tortillas', 3, 'kg', 'despensa', 'alta', 'Papá', 'de maíz, del molino', 66, 'Para el domingo', 'falta'],
    ['chiles serranos', 250, 'g', 'verduras', 'media', 'Mamá', '', 15, 'Frutas y verduras', 'falta'],
    ['piña', 1, 'pieza', 'frutas', 'baja', 'Sofía', '', 25, 'Frutas y verduras', 'falta'],
    ['detergente', 3, 'kg', 'limpieza', 'alta', 'Mamá', 'el de romero y lavanda', 165, 'Limpieza', 'falta'],
    ['cloro', 2, 'l', 'limpieza', 'media', 'Tía Rosa', '', 30, 'Limpieza', 'falta'],
    ['jabón para trastes', 2, 'piezas', 'limpieza', 'media', 'Tía Rosa', '', 28, 'Limpieza', 'falta'],
    ['bolsas de basura', 2, 'paquetes', 'limpieza', 'media', 'Tía Rosa', 'las grandes y las chicas', 64, 'Limpieza', 'falta'],
    ['papel higiénico', 4, 'paquetes', 'hogar', 'alta', 'Papá', '', 220, 'Limpieza', 'comprado'],
    ['champú', 2, 'piezas', 'farmacia', 'media', 'María', 'el anti-caspa', 90, 'Farmacia', 'falta'],
    ['pasta de dientes', 3, 'piezas', 'farmacia', 'media', 'Luis', '', 60, 'Farmacia', 'falta'],
    ['gel antibacterial', 2, 'piezas', 'farmacia', 'urgente', 'María', 'para la escuela', 40, 'Farmacia', 'falta'],
    ['acetaminofén', 1, 'caja', 'farmacia', 'media', 'Mamá', 'para la fiebre de Ana', 35, 'Farmacia', 'falta'],
    ['cereal', 2, 'cajas', 'despensa', 'media', 'Juan', '', 90, 'Desayunos', 'comprado'],
    ['atún', 6, 'latas', 'despensa', 'media', 'Luis', '', 96, 'Despensa', 'falta'],
    ['avena', 1, 'kg', 'despensa', 'media', 'Abuelo', 'en hojuelas', 28, 'Desayunos', 'falta'],
    ['refresco', 6, 'latas', 'despensa', 'baja', 'Diego', '', 78, 'Para el domingo', 'cancelado'],
    ['galletas', 4, 'paquetes', 'despensa', 'baja', 'Sofía', '', 60, 'Desayunos', 'cancelado'],
  ]

  const ids = {}
  let n = 0
  for (const [name, qty, unit, category, priority, requestedBy, note, price, section, status] of items) {
    const created = await post('/api/items', {
      name, quantity: qty, unit, priority,
      note: note || undefined,
      category, price,
      section: sections[section],
    }, { as: requestedBy })
    ids[name] = created.id
    if (status === 'pedido' || status === 'llevo' || status === 'comprado') {
      await patch(`/api/items/${created.id}/status`, { to: status }, { as: requestedBy })
    } else if (status === 'cancelado') {
      await post(`/api/items/${created.id}/cancel`, { reason: 'ya no se necesita' }, { as: requestedBy })
    }
    n++
  }

  // asignaciones para los que van al mandado
  await post(`/api/items/${ids['bistec de res']}/assign`, { member: 'Papá' }, { as: 'Mamá' })
  await post(`/api/items/${ids['carne molida']}/assign`, { member: 'Papá' }, { as: 'Mamá' })
  await post(`/api/items/${ids['pañales talla M']}/assign`, { member: 'Juan' }, { as: 'Ana' })
  await post(`/api/items/${ids['queso panela']}/assign`, { member: 'Ana' }, { as: 'Mamá' })
  await post(`/api/items/${ids['yogurt']}/assign`, { member: 'Ana' }, { as: 'Diego' })

  // tienda de algunos ítems (para la vista "Lo mío" agrupada por tienda)
  const storeByItem = {
    'bistec de res': 'Walmart',
    'carne molida': 'Walmart',
    'leche': 'Walmart',
    'queso panela': 'La Comer',
    'yogurt': 'La Comer',
    'tomate': 'Frutería Don Toño',
    'aguacate': 'Frutería Don Toño',
    'pañales talla M': 'Farmacia del Ahorro',
    'acetaminofén': 'Farmacia del Ahorro',
  }
  for (const [item, store] of Object.entries(storeByItem)) {
    if (ids[item]) await patch(`/api/items/${ids[item]}/store`, { storeName: store }, { as: 'Papá' })
  }

  // comentarios reales de la familia
  await post(`/api/items/${ids['leche']}/comment`, { body: 'no compres la entera, la deslactosada nos cae mejor' }, { as: 'Mamá' })
  await post(`/api/items/${ids['pollo']}/comment`, { body: 'que sea entero, para la sopa del domingo' }, { as: 'Abuelo' })
  await post(`/api/items/${ids['arroz']}/comment`, { body: '¿el de 2 kg es para la semana o para el pastel?' }, { as: 'Ana' })
  await post(`/api/items/${ids['aguacate']}/comment`, { body: 'los aguacates blanditos, porfa' }, { as: 'Sofía' })
  await post(`/api/items/${ids['café']}/comment`, { body: 'esta marca es la buena' }, { as: 'Mamá' })

  // fotos de ejemplo (filtro "Con foto")
  await post(`/api/items/${ids['pollo']}/photos`, { photo: TINY_PHOTO }, { as: 'Mamá' })
  await post(`/api/items/${ids['detergente']}/photos`, { photo: TINY_PHOTO }, { as: 'Mamá' })
  await post(`/api/items/${ids['leche']}/photos`, { photo: TINY_PHOTO }, { as: 'Mamá' })

  // comprar un par de veces lo mismo (para que la proyección tenga cadencia)
  const repeat = ['leche', 'huevo', 'pan de caja']
  for (const name of repeat) {
    const id = ids[name]
    for (let ciclo = 0; ciclo < 2; ciclo++) {
      await patch(`/api/items/${id}/status`, { to: 'comprado' }, { as: 'Mamá' })
      await post(`/api/items/${id}/cancel`, {}, { as: 'Mamá' })
      await post(`/api/items/${id}/recover`, {}, { as: 'Mamá' })
    }
  }

  console.log(`  ✔ ${n} ítems creados`)
  return ids
}

// ============================================================================
async function seedTrips(itemIds) {
  console.log('▸ Mandados…')
  const mk = (title, store, assigned, by) =>
    post('/api/trips', { title, store, assignedTo: assigned }, { as: by })

  const t1 = await mk('Mandado de la semana', 'Walmart', 'Papá', 'Papá')
  for (const name of ['bistec de res', 'carne molida', 'detergente', 'papel higiénico', 'frijol']) {
    if (itemIds[name]) await post(`/api/trips/${t1.id}/items/add`, { itemId: itemIds[name] }, { as: 'Papá' })
  }
  await post(`/api/trips/${t1.id}/complete`, {}, { as: 'Papá' })
  await post(`/api/trips/${t1.id}/received`, {}, { as: 'Mamá' })

  const t2 = await mk('Frutería y lácteos', 'La Comer', 'Ana', 'Mamá')
  for (const name of ['queso panela', 'yogurt', 'tomate', 'aguacate']) {
    if (itemIds[name]) await post(`/api/trips/${t2.id}/items/add`, { itemId: itemIds[name] }, { as: 'Mamá' })
  }
  await post(`/api/trips/${t2.id}/activate`, {}, { as: 'Mamá' })

  const t3 = await mk('Urgencias: leche y pañales', 'Walmart', 'Juan', 'Ana')
  for (const name of ['leche', 'pañales talla M']) {
    if (itemIds[name]) await post(`/api/trips/${t3.id}/items/add`, { itemId: itemIds[name] }, { as: 'Ana' })
  }
  await post(`/api/trips/${t3.id}/complete`, {}, { as: 'Ana' })
  await post(`/api/trips/${t3.id}/received`, {}, { as: 'Ana' })

  await mk('Mandado del domingo', 'Walmart', 'Mamá', 'Papá')
  const t5 = await mk('Reposición de limpieza', 'La Comer', 'Luis', 'Mamá')
  await post(`/api/trips/${t5.id}/cancel`, {}, { as: 'Mamá' })
  console.log('  ✔ 5 mandados')
}

// ============================================================================
async function seedPlans() {
  console.log('▸ Planes de compra…')
  const plans = [
    { title: 'Mandado grande del sábado', scheduledAt: dt(6, '09:00'), store: 'Walmart', assignedTo: 'Papá', recurrence: 'semanal', note: 'comprar para toda la semana' },
    { title: 'Ir a la frutería', scheduledAt: dt(2, '11:00'), store: 'Frutería Don Toño', assignedTo: 'Ana', recurrence: 'ninguna', note: 'frutas y verduras frescas' },
    { title: 'Súper + farmacia', scheduledAt: dt(9, '17:30'), store: 'Walmart', assignedTo: 'Mamá', recurrence: 'ninguna', note: 'aprovechar el horario con menos gente' },
    { title: 'Mandado grande del sábado (anterior)', scheduledAt: dt(-6, '09:00'), store: 'Walmart', assignedTo: 'Papá', recurrence: 'semanal' },
  ]
  for (const p of plans) {
    const created = await post('/api/plans', {
      title: p.title,
      scheduledAt: p.scheduledAt,
      store: p.store,
      assignedTo: p.assignedTo,
      note: p.note,
      recurrence: p.recurrence,
    }, { as: 'Papá' })
    if (p.scheduledAt.startsWith(dt(-6, '09:00').slice(0, 10))) {
      await post(`/api/plans/${created.id}/complete`, {}, { as: 'Papá' })
    }
  }
  console.log('  ✔ 4 planes')
}

// ============================================================================
async function seedEvents() {
  console.log('▸ Eventos del calendario familiar…')
  const events = [
    { title: 'Comida del domingo', date: day(4), time: '14:00', allDay: false, kind: 'comida', place: 'casa de los Ramírez', participants: ['Papá', 'Mamá', 'Ana', 'Juan', 'Sofía', 'Abuelo'], note: 'carne asada, somos 12 personas', recurringYearly: false, by: 'Papá' },
    { title: 'Viene la abuela', date: day(6), allDay: true, kind: 'reunion', place: 'su cuarto', participants: ['Mamá'], note: 'preparar el cuarto y comprar su café', recurringYearly: false, by: 'Mamá' },
    { title: 'Cumple de Ana', date: day(18), time: '18:00', allDay: false, kind: 'cumpleanos', place: 'la casa', participants: ['Papá', 'Mamá', 'Juan', 'María', 'Sofía', 'Diego', 'Tía Rosa', 'Abuelo'], note: 'pastel de chocolate, no avisarle', recurringYearly: true, by: 'Mamá' },
    { title: 'Cena de Año Nuevo', date: day(30), allDay: false, kind: 'celebracion', place: 'casa', participants: ['Papá', 'Mamá', 'Ana', 'Juan', 'Luis', 'María', 'Sofía', 'Diego', 'Tía Rosa', 'Abuelo'], note: 'uvas y algo para las 12', recurringYearly: true, by: 'Papá' },
    { title: 'Aniversario de Papá y Mamá', date: day(-40), allDay: true, kind: 'union', participants: ['Papá', 'Mamá'], note: 'cenar afuera', recurringYearly: true, by: 'Papá' },
    { title: 'Graduación de Sofía', date: day(-20), allDay: false, kind: 'celebracion', place: 'auditorio de la prepa', participants: ['Sofía', 'Papá', 'Mamá'], note: 'llegar temprano por los asientos', recurringYearly: false, by: 'Papá' },
  ]
  for (const e of events) {
    await post('/api/events', {
      title: e.title,
      date: e.date,
      time: e.time,
      allDay: e.allDay,
      kind: e.kind,
      place: e.place,
      participants: e.participants,
      note: e.note,
      recurringYearly: e.recurringYearly,
    }, { as: e.by })
  }
  // la comida del domingo genera su lista
  const allEvents = await get('/api/events', { as: 'Papá' })
  const comidaEv = allEvents.find((e) => e.title === 'Comida del domingo')
  if (comidaEv) {
    const items = await get('/api/items', { as: 'Papá' })
    const paraElDomingo = items.filter((i) => i.category === 'carnes' || i.name === 'tortillas').slice(0, 3)
    for (const it of paraElDomingo) {
      await post(`/api/events/${comidaEv.id}/items/add`, { itemId: it.id }, { as: 'Papá' })
    }
  }
  console.log(`  ✔ ${events.length} eventos`)
}

// ============================================================================
async function seedChat() {
  console.log('▸ Chat de la familia…')
  const send = (by, body) => post('/api/chat', { body, photo: null, itemId: null }, { as: by })
  const m1 = await send('Mamá', 'no había canela, ¿la compro de otra marca?')
  const m2 = await send('Papá', 'compré la leche, ya va en camino 🥛')
  const m3 = await send('Ana', '¡gracias! 🧡')
  await send('Juan', '@Papá ¿ya pagaste el súper?')
  const m5 = await send('María', '¿quién lleva los pañales? en la tienda ya no había talla M')
  await send('Sofía', 'yo quiero el yogurt de fresa, no el natural 🙏')

  await post(`/api/chat/${m2.id}/react`, { emoji: '👍' }, { as: 'Ana' })
  await post(`/api/chat/${m2.id}/react`, { emoji: '❤️' }, { as: 'Mamá' })
  await post(`/api/chat/${m3.id}/react`, { emoji: '❤️' }, { as: 'Papá' })
  await post(`/api/chat/${m5.id}/react`, { emoji: '😂' }, { as: 'Luis' })

  await post(`/api/chat/${m1.id}/pin`, {}, { as: 'Mamá' })
  console.log('  ✔ 6 mensajes + reacciones + 1 fijado')
}

// ============================================================================
async function summary() {
  const home = await get('/api/home', { as: 'Papá' })
  const items = await get('/api/items', { as: 'Papá' })
  const trips = await get('/api/trips', { as: 'Papá' })
  const plans = await get('/api/plans', { as: 'Papá' })
  const events = await get('/api/events', { as: 'Papá' })
  const chat = await get('/api/chat', { as: 'Papá' })
  const sections = await get('/api/sections', { as: 'Papá' })
  const rules = await get('/api/rules', { as: 'Papá' })
  const notifs = await get('/api/notifications?member=Papá', { as: 'Papá' })

  console.log('\n============ RESULTADO DEL SEED ============')
  console.log(`Hogar:        «${home.name}» · ${home.members.length} miembros`)
  console.log(`Miembros:     ${home.members.map((m) => m.name).join(', ')}`)
  console.log(`Ítems:        ${items.length} · ${items.filter((i) => i.status === 'falta').length} faltan, ${items.filter((i) => i.status === 'llevo').length} en el carrito`)
  console.log(`Mandados:     ${trips.length} · ${trips.filter((t) => t.status === 'completada').length} completados`)
  console.log(`Planes:       ${plans.length}`)
  console.log(`Eventos:      ${events.length}`)
  console.log(`Secciones:    ${sections.length}`)
  console.log(`Tiendas:      ${rules.stores.map((s) => s.name).join(', ')}`)
  console.log(`Chat:         ${chat.filter((c) => c.kind === 'user').length} mensajes de la familia`)
  console.log(`Avisos Papá:  ${notifs.length} (${notifs.filter((n) => !n.read).length} sin leer)`)
  console.log('\nCUENTAS (entra con cualquiera, contraseña ' + MEMBER_PASSWORD + '):')
  console.log('  ' + home.members.map((m) => m.name).join('  ·  '))
  console.log('  admin / admin123  (cuenta de bypass)')
  console.log('Sugerencia: entra como «Papá» (Admin del hogar) o «Mamá» para ver la familia completa.\n')
}

// ============================================================================
async function main() {
  await setupSessions()
  await reset()
  await addMembers()
  const sections = await seedSections()
  await seedRules()
  const itemIds = await seedItems(sections)
  await seedTrips(itemIds)
  await seedPlans()
  await seedEvents()
  await seedChat()
  await summary()
}

main().catch((err) => {
  console.error('\n✗ Seed falló:', err.message)
  process.exit(1)
})
