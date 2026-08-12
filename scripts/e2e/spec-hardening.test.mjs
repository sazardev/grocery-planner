/**
 * Suite E2E spec-hardening — prueba ultra agresiva contra SPEC/DESIGN:
 * aislamiento por membresía (SPEC §15), integridad (máquina de estados §4.3,
 * roles §3.2), fuzz de inputs maliciosos (XSS/SQLi/unicode/límites), carrera
 * de mutaciones concurrentes y formularios de la UI. Objetivo: NINGÚN 5xx,
 * sin crashes, y que los datos de la familia solo se vean a sus miembros.
 *
 * Los 4xx esperados (400/401/404/409/422) son parte del contrato; el server
 * debe rechazar con gracia y nunca devolver 500 ni caerse.
 */
import {
  api, register, launch, goto, typeIn, clickByText, bodyText,
  check, checkNoUnexpected4xx, expectFailure, done,
} from './harness.mjs'

// El 404 de /api/home es por diseño para cuentas sin hogar (AGENTS.md).
expectFailure(404, '/api/home')

const suffix = Date.now().toString().slice(-6)
const A = 'HardA' + suffix
const B = 'HardB' + suffix
const G = 'HardG' + suffix
const I = 'HardI' + suffix
const PW = 'secreto123'

const is4xx = (s) => s >= 400 && s < 500

async function main() {
  // ── Setup: hogar + miembro + cuentas dedicadas ──────────────────────────
  const admin = await register(A, PW)
  const aTok = admin.token
  const member = await register(B, PW)
  const bTok = member.token
  const gTok = (await register(G, PW)).token
  const iTok = (await register(I, PW)).token
  const home = await api('/api/home', { method: 'POST', token: aTok, body: { name: 'Hogar Hard ' + suffix } })
  check('setup: hogar creado', home.status === 200)
  const addB = await api('/api/home/members', { method: 'POST', token: aTok, body: { name: B, role: 'miembro' } })
  check('setup: B miembro', addB.status === 200)
  // G e I quedan SIN hogar (aislamiento §15). G se usará para aceptar una
  // invitación; I quedará siempre fuera del hogar para las pruebas de privacidad.

  // ═══ 1) Aislamiento por membresía (SPEC §15) ═════════════════════════════
  await api('/api/items', { method: 'POST', token: aTok, body: { name: 'secreto familia', quantity: 1, unit: 'pieza', priority: 'media' } })
  check('sin hogar: no lee ítems → 404', (await api('/api/items', { token: iTok })).status === 404)
  check('sin hogar: no lee reglas → 404', (await api('/api/rules', { token: iTok })).status === 404)
  check('sin hogar: no lee chat → 404', (await api('/api/chat', { token: iTok })).status === 404)
  check('sin hogar: no lee timeline → 404', (await api('/api/timeline', { token: iTok })).status === 404)
  check('sin hogar: no exporta respaldo → 404', (await api('/api/backup', { token: iTok })).status === 404)
  check('sin hogar: no lee fotos → 404', (await api('/api/photos/x.png', { token: iTok })).status === 404)
  check('sin hogar: sí ve sus avisos → 200', (await api('/api/notifications', { token: iTok })).status === 200)
  check('sin hogar: sí manda presencia → 200', (await api('/api/presence/heartbeat', { method: 'POST', token: iTok, body: { screen: 'home' } })).status === 200)
  check('sin hogar: sí ve su cuenta → 200', (await api('/api/auth/me', { token: iTok })).status === 200)
  check('familiar: sigue leyendo ítems → 200', (await api('/api/items', { token: aTok })).status === 200)

  // ═══ 2) Auth: rechazos correctos ═════════════════════════════════════════
  check('register vacío → 400', (await api('/api/auth/register', { method: 'POST', body: { name: '', password: PW } })).status === 400)
  check('register 41 chars → 400', (await api('/api/auth/register', { method: 'POST', body: { name: 'x'.repeat(41), password: PW } })).status === 400)
  check('register pw corta → 400', (await api('/api/auth/register', { method: 'POST', body: { name: 'HardShort', password: '12345' } })).status === 400)
  check('register duplicado → 409', (await api('/api/auth/register', { method: 'POST', body: { name: A, password: PW } })).status === 409)
  check('login pw mala → 401', (await api('/api/auth/login', { method: 'POST', body: { name: A, password: 'mala', device: 'p' } })).status === 401)
  check('me sin token → 401', (await api('/api/auth/me')).status === 401)
  check('me token basura → 401', (await api('/api/auth/me', { token: 'basura' })).status === 401)
  check('reset pw clave mala → 401', (await api('/api/auth/password/reset', { method: 'POST', body: { name: B, backupKey: 'mala', newPassword: 'nueva123' } })).status === 401)
  check('regenerar pw por miembro → 409', (await api('/api/auth/password/regenerate', { method: 'POST', token: bTok, body: { name: B, newPassword: 'nueva123' } })).status === 409)

  // ═══ 3) Máquina de estados (SPEC §4.3) ═══════════════════════════════════
  const mkItem = async (name, over = {}) => (await api('/api/items', { method: 'POST', token: aTok, body: { name, quantity: 1, unit: 'pieza', priority: 'media', ...over } })).data
  const s = await mkItem('estado hard')
  const st = async (id, to) => (await api(`/api/items/${id}/status`, { method: 'PATCH', token: aTok, body: { to } })).status
  check('falta→pedido → 200', (await st(s.id, 'pedido')) === 200)
  check('pedido→llevo → 200', (await st(s.id, 'llevo')) === 200)
  check('llevo→comprado → 200', (await st(s.id, 'comprado')) === 200)
  check('comprado→falta → 409', (await st(s.id, 'falta')) === 409)
  check('comprado→llevo → 409', (await st(s.id, 'llevo')) === 409)
  check('comprado→cancelado → 200', (await st(s.id, 'cancelado')) === 200)
  check('cancelado→falta → 200', (await st(s.id, 'falta')) === 200)
  const c = await mkItem('cancelado hard')
  check('falta→cancelado → 200', (await st(c.id, 'cancelado')) === 200)
  check('cancelado→llevo → 409', (await st(c.id, 'llevo')) === 409)
  check('cancelado→comprado → 409', (await st(c.id, 'comprado')) === 409)
  check('status valor inválido → 422', (await st(s.id, 'noexiste')) === 422)
  check('status ítem inexistente → 404', (await st('no-existe', 'pedido')) === 404)

  // ═══ 4) Inputs de ítem e integridad ══════════════════════════════════════
  check('item nombre vacío → 400', (await api('/api/items', { method: 'POST', token: aTok, body: { name: '', quantity: 1, unit: 'pieza', priority: 'media' } })).status === 400)
  check('item qty negativa → 400', (await api('/api/items', { method: 'POST', token: aTok, body: { name: 'x', quantity: -1, unit: 'pieza', priority: 'media' } })).status === 400)
  check('item qty cero → 400', (await api('/api/items', { method: 'POST', token: aTok, body: { name: 'x', quantity: 0, unit: 'pieza', priority: 'media' } })).status === 400)
  check('item prioridad inválida → 422', (await api('/api/items', { method: 'POST', token: aTok, body: { name: 'x', quantity: 1, unit: 'pieza', priority: 'critica' } })).status === 422)
  const asg = await mkItem('asignar hard')
  check('asignar a miembro → 200', (await api(`/api/items/${asg.id}/assign`, { method: 'POST', token: aTok, body: { member: B } })).status === 200)
  check('asignar a fantasma → 400', (await api(`/api/items/${asg.id}/assign`, { method: 'POST', token: aTok, body: { member: 'quien_no_es' } })).status === 400)
  check('precio negativo → 400', (await api(`/api/items/${asg.id}/price`, { method: 'PATCH', token: aTok, body: { price: -1 } })).status === 400)
  check('quantity-max negativo → 400', (await api(`/api/items/${asg.id}/quantity-max`, { method: 'PATCH', token: aTok, body: { max: -2 } })).status === 400)
  check('move dirección inválida → 422', (await api(`/api/items/${asg.id}/move`, { method: 'POST', token: aTok, body: { direction: 'lateral' } })).status === 422)
  check('sección inexistente → 404', (await api(`/api/items/${asg.id}/section`, { method: 'PATCH', token: aTok, body: { section: 'NoExiste' } })).status === 404)
  check('comentar vacío → 400', (await api(`/api/items/${asg.id}/comment`, { method: 'POST', token: aTok, body: { body: '' } })).status === 400)
  check('delete permanent activo → 409', (await api(`/api/items/${asg.id}/permanent`, { method: 'DELETE', token: aTok })).status === 409)
  check('foto inválida → 400', (await api(`/api/items/${asg.id}/photos`, { method: 'POST', token: aTok, body: { photo: 'no-soy-data-url' } })).status === 400)
  check('fallback vacío → 400', (await api(`/api/items/${asg.id}/fallbacks`, { method: 'POST', token: aTok, body: { name: '', quantity: 1, unit: 'pieza' } })).status === 400)
  check('parse quick entry vacío → 400', (await api('/api/parse-quick-entry', { method: 'POST', token: aTok, body: { text: '' } })).status === 400)

  // ═══ 5) Roles (SPEC §3.2) ════════════════════════════════════════════════
  check('miembro PATCH rules → 409', (await api('/api/rules', { method: 'PATCH', token: bTok, body: { name: 'Hack' } })).status === 409)
  check('miembro crea sección → 409', (await api('/api/sections', { method: 'POST', token: bTok, body: { name: 'X' } })).status === 409)
  check('miembro crea plan → 409', (await api('/api/plans', { method: 'POST', token: bTok, body: { title: 'P', scheduledAt: '2026-12-01T10:00' } })).status === 409)
  const ajeno = await mkItem('ajeno hard')
  check('miembro mueve ítem ajeno → 409', (await api(`/api/items/${ajeno.id}/move`, { method: 'POST', token: bTok, body: { direction: 'up' } })).status === 409)
  check('miembro backup export → 409', (await api('/api/backup', { token: bTok })).status === 409)
  check('miembro cambia rol → 409', (await api('/api/home/roles', { method: 'PATCH', token: bTok, body: { name: B, role: 'admin' } })).status === 409)
  check('miembro expulsa → 409', (await api(`/api/home/members/${B}`, { method: 'DELETE', token: bTok })).status === 409)
  check('miembro host-key → 409', (await api('/api/rules/host-key', { method: 'POST', token: bTok })).status === 409)
  check('eliminar último admin → 409', (await api(`/api/home/members/${A}`, { method: 'DELETE', token: aTok })).status === 409)
  check('rol inválido → 422', (await api('/api/home/roles', { method: 'PATCH', token: aTok, body: { name: B, role: 'superuser' } })).status === 422)
  check('segundo hogar (mismo miembro) → 409', (await api('/api/home', { method: 'POST', token: aTok, body: { name: 'Otro' } })).status === 409)
  check('miembro sin cuenta → 400', (await api('/api/home/members', { method: 'POST', token: aTok, body: { name: 'sin_cuenta_xyz', role: 'miembro' } })).status === 400)

  // ═══ 6) Invitaciones ═════════════════════════════════════════════════════
  const inv1 = await api('/api/home/invitations', { method: 'POST', token: aTok, body: { roleGranted: 'miembro', expiresInSecs: 3600, maxUses: 1 } })
  check('invitación usos=1 creada', inv1.status === 200)
  check('código 6 dígitos', typeof inv1.data?.code === 'string' && inv1.data.code.replace('-', '').length === 6)
  check('maxUses negativo → 422', (await api('/api/home/invitations', { method: 'POST', token: aTok, body: { roleGranted: 'miembro', expiresInSecs: 3600, maxUses: -5 } })).status === 422)
  check('aceptar código erróneo → 404', (await api('/api/home/invitations/accept', { method: 'POST', token: gTok, body: { code: '000-000' } })).status === 404)
  const acc1 = await api('/api/home/invitations/accept', { method: 'POST', token: gTok, body: { code: inv1.data.code } })
  const acc2 = await api('/api/home/invitations/accept', { method: 'POST', token: gTok, body: { code: inv1.data.code } })
  check('aceptar usos=1 1ª vez → 200', acc1.status === 200)
  check('aceptar usos=1 2ª vez → 409', acc2.status === 409)
  const rev = await api(`/api/home/invitations/${inv1.data.id}/revoke`, { method: 'POST', token: aTok })
  check('revocar invitación → 200', rev.status === 200)

  // ═══ 7) Trips / plans / eventos ══════════════════════════════════════════
  const trip = await api('/api/trips', { method: 'POST', token: aTok, body: { title: 'M1' } })
  check('trip creada → 200', trip.status === 200)
  check('trip recibido sin completar → 409', (await api(`/api/trips/${trip.data.id}/received`, { method: 'POST', token: aTok })).status === 409)
  check('trip asignar fantasma → 400', (await api(`/api/trips/${trip.data.id}/assign`, { method: 'POST', token: aTok, body: { member: 'fantasma' } })).status === 400)
  check('trip activar → 200', (await api(`/api/trips/${trip.data.id}/activate`, { method: 'POST', token: aTok })).status === 200)
  check('trip completar → 200', (await api(`/api/trips/${trip.data.id}/complete`, { method: 'POST', token: aTok })).status === 200)
  check('trip activar completada → 409', (await api(`/api/trips/${trip.data.id}/activate`, { method: 'POST', token: aTok })).status === 409)
  check('trip add ítem a completada → 409', (await api(`/api/trips/${trip.data.id}/items/add`, { method: 'POST', token: aTok, body: { itemId: asg.id } })).status === 409)
  check('plan fecha inválida → 400', (await api('/api/plans', { method: 'POST', token: aTok, body: { title: 'P', scheduledAt: 'ayer' } })).status === 400)
  check('plan recurrencia inválida → 422', (await api('/api/plans', { method: 'POST', token: aTok, body: { title: 'P', scheduledAt: '2026-12-01T10:00', recurrence: 'diaria' } })).status === 422)
  check('evento 2026-02-30 → 400', (await api('/api/events', { method: 'POST', token: aTok, body: { title: 'E', date: '2026-02-30', kind: 'comida' } })).status === 400)
  check('evento kind inválido → 422', (await api('/api/events', { method: 'POST', token: aTok, body: { title: 'E', date: '2026-12-01', kind: 'fiesta' } })).status === 422)
  check('evento range sin fechas → 400', (await api('/api/events/range', { token: aTok })).status === 400)
  const ev = await api('/api/events', { method: 'POST', token: aTok, body: { title: 'Ev', date: '2026-12-24', kind: 'celebracion' } })
  check('evento creado → 200', ev.status === 200)
  check('miembro elimina evento ajeno → 409', (await api(`/api/events/${ev.data.id}`, { method: 'DELETE', token: bTok })).status === 409)

  // ═══ 8) Chat / SSE / fotos ═══════════════════════════════════════════════
  check('chat vacío → 400', (await api('/api/chat', { method: 'POST', token: aTok, body: { body: '' } })).status === 400)
  check('chat foto inválida → 400', (await api('/api/chat', { method: 'POST', token: aTok, body: { body: 'x', photo: 'data:image/png;base64,@@@' } })).status === 400)
  const msg = await api('/api/chat', { method: 'POST', token: aTok, body: { body: 'hola' } })
  check('chat enviado → 200', msg.status === 200)
  check('react inexistente → 404', (await api('/api/chat/no-existe/react', { method: 'POST', token: aTok, body: { emoji: '👍' } })).status === 404)
  check('pin inexistente → 404', (await api('/api/chat/no-existe/pin', { method: 'POST', token: aTok })).status === 404)
  check('SSE sin token → 401', (await api('/api/events-stream')).status === 401)
  check('foto traversal → 4xx', is4xx((await api('/api/photos/..%2F..%2Fetc%2Fpasswd', { token: aTok })).status))

  // ═══ 9) Concurrencia: dos sesiones mutando el mismo ítem ══════════════════
  const raceItem = await mkItem('carrera hard')
  const ops = [
    api(`/api/items/${raceItem.id}/status`, { method: 'PATCH', token: aTok, body: { to: 'pedido' } }),
    api(`/api/items/${raceItem.id}/status`, { method: 'PATCH', token: bTok, body: { to: 'llevo' } }),
    api(`/api/items/${raceItem.id}/assign`, { method: 'POST', token: aTok, body: { member: B } }),
    api(`/api/items/${raceItem.id}/status`, { method: 'PATCH', token: aTok, body: { to: 'comprado' } }),
    api(`/api/items/${raceItem.id}/price`, { method: 'PATCH', token: bTok, body: { price: 12.5 } }),
    api(`/api/items/${raceItem.id}/comment`, { method: 'POST', token: bTok, body: { body: 'desde la carrera' } }),
  ]
  const raced = await Promise.all(ops)
  const statuses = raced.map((r) => r.status)
  check('carrera: ningún 5xx', statuses.every((s) => s < 500), statuses.join(','))
  const finalItem = (await api(`/api/items/${raceItem.id}`, { token: aTok })).data
  check('carrera: estado final válido', ['pedido', 'llevo', 'comprado', 'falta', 'cancelado'].includes(finalItem?.status), `status=${finalItem?.status}`)
  check('carrera: comentario guardado', (finalItem?.comments ?? []).length === 1)
  const aliveAfterRace = await api('/health/healthy')
  check('carrera: server vivo', aliveAfterRace.status < 500)

  // ═══ 10) Fuzz de texto malicioso (XSS/SQLi) en la API ════════════════════
  const payloads = [
    '<script>window.__xssExec=1</script>',
    '<img src=x onerror="window.__xssImg=1">',
    "'; DROP TABLE items; --",
    'javascript:alert(1)',
    '日本 🇲🇽 émojis 🧃',
  ]
  let fuzz5xx = 0
  for (const p of payloads) {
    const r = await api('/api/items', { method: 'POST', token: aTok, body: { name: `hard_${p.slice(0, 10)}`, quantity: 1, unit: 'pieza', priority: 'media', note: p } })
    if (r.status >= 500) fuzz5xx++
  }
  check('fuzz ítems: sin 5xx', fuzz5xx === 0, `5xx=${fuzz5xx}`)
  for (const [label, make] of [
    ['evento', () => api('/api/events', { method: 'POST', token: aTok, body: { title: payloads[0], date: '2026-12-01', kind: 'comida' } })],
    ['chat', () => api('/api/chat', { method: 'POST', token: aTok, body: { body: payloads[1] } })],
    ['sección', () => api('/api/sections', { method: 'POST', token: aTok, body: { name: payloads[0] } })],
  ]) {
    const r = await make()
    check(`fuzz ${label}: sin 5xx (${r.status})`, r.status < 500)
  }

  // ═══ 11) La UI escapa los payloads (React los pinta como texto) ═══════════
  const evil = await api('/api/items', { method: 'POST', token: aTok, body: { name: '<script>window.__xssExec=1</script>', quantity: 1, unit: 'pieza', priority: 'media', note: '<img src=x onerror="window.__xssImg=1">' } })
  check('XSS ítem malvado creado', evil.status === 200)
  const { browser, page, jsErrors, badResponses } = await launch({ token: aTok })
  await goto(page, '/home', { waitFor: '¿Qué falta?' })
  await goto(page, `/items/${evil.data.id}`, { waitFor: '__xssExec' })
  await new Promise((r) => setTimeout(r, 1500))
  const ui = await page.evaluate(() => ({
    exec: window.__xssExec,
    img: window.__xssImg,
    injected: Boolean(document.querySelector('img[src="x"], script[src="x"]')),
    hasScript: document.body.innerText.includes('<script>window.__xssExec=1</script>'),
  }))
  check('XSS UI: no se ejecutó nada', !ui.exec && !ui.img && !ui.injected, JSON.stringify(ui))
  check('XSS UI: payload visible como texto', ui.hasScript)

  // ═══ 12) Formularios de la UI en profundidad ══════════════════════════════
  const itemExists = async (name) => {
    for (let i = 0; i < 24; i++) {
      const items = await api('/api/items', { token: aTok })
      if ((items.data ?? []).some((it) => it.name === name)) return true
      await new Promise((r) => setTimeout(r, 500))
    }
    return false
  }
  const planExists = async (title) => {
    for (let i = 0; i < 24; i++) {
      const plans = await api('/api/plans', { token: aTok })
      if ((plans.data ?? []).some((p) => p.title === title)) return true
      await new Promise((r) => setTimeout(r, 500))
    }
    return false
  }
  const eventExists = async (title) => {
    for (let i = 0; i < 24; i++) {
      const events = await api('/api/events', { token: aTok })
      if ((events.data ?? []).some((e) => e.title === title)) return true
      await new Promise((r) => setTimeout(r, 500))
    }
    return false
  }

  // NewItem detallado (form + categoría + cantidad).
  await goto(page, '/items/new', { waitFor: 'Qué falta' })
  await clickByText(page, 'Detallado').catch(() => {})
  check('UI: form detallado visible', await page.evaluate(() => Boolean(document.querySelector('[aria-label="Producto"]'))))
  await typeIn(page, 'Producto', 'pasta de dientes hard')
  await typeIn(page, 'Cantidad deseada', '2')
  await typeIn(page, 'Unidad', 'piezas')
  await clickByText(page, 'Agregar ítem', { selector: 'button' })
  check('UI: crear ítem detallado', await itemExists('pasta de dientes hard'))

  // NewPlan por UI (título + fecha preseleccionada + hora con el picker propio).
  await goto(page, '/plans/new?date=2026-08-20', { waitFor: 'Nuevo plan' })
  await typeIn(page, 'Título del plan', 'Plan UI hard')
  const clickAny = (label) => page.evaluate((l) => {
    const all = [...document.querySelectorAll('button')]
    const exact = all.find((b) => (b.getAttribute('aria-label') ?? '').trim() === l)
    const hit = exact ?? all.find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(l))
    if (hit) { hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true }
    return false
  }, label)
  const opened = await clickAny('Hora')
  await new Promise((r) => setTimeout(r, 700))
  await clickAny('10 horas')
  await clickAny('00 minutos')
  const timeDone = await clickAny('Listo')
  check('UI: picker de hora del plan', opened && timeDone)
  await clickByText(page, 'Crear plan', { selector: 'button' })
  check('UI: crear plan', await planExists('Plan UI hard'))

  // NewEvent por UI (nombre + fecha).
  await goto(page, '/events', { waitFor: 'Eventos' })
  await typeIn(page, 'Nombre del evento', 'Evento UI hard')
  await page.evaluate(() => {
    const date = document.querySelector('input[type="date"]')
    if (date) {
      const s = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(date), 'value').set
      s.call(date, '2026-08-21')
      date.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await clickByText(page, 'Crear evento', { selector: 'button' })
  check('UI: crear evento', await eventExists('Evento UI hard'))

  // PIN por UI (Ajustes → Entrar rápido con PIN).
  await goto(page, '/settings', { waitFor: 'Ajustes' })
  await typeIn(page, 'PIN de 4 dígitos', '4321')
  await typeIn(page, 'Confirmar PIN', '4321')
  await clickByText(page, 'Guardar PIN', { selector: 'button' })
  await new Promise((r) => setTimeout(r, 1500))
  const pinText = await bodyText(page)
  check('UI: guardar PIN', pinText.includes('PIN guardado') || pinText.includes('PIN activo'), pinText.slice(0, 80))

  // Recuperar contraseña y respaldo: las secciones renderizan.
  await goto(page, '/settings', { waitFor: 'Ajustes' })
  const sett = await bodyText(page)
  check('UI: sección recuperar contraseña', sett.includes('Recuperar contraseña'))
  check('UI: sección respaldo', sett.includes('Exportar respaldo'))

  check('Sin errores JS', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '))
  checkNoUnexpected4xx(badResponses)

  await done(browser)
}

main().catch((err) => {
  console.error('FALLO', err)
  process.exit(1)
})
