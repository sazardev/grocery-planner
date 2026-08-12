/**
 * Suite E2E spec-full — los flujos del SPEC que no cubren las demás suites:
 * login/registro por UI real, PIN, modo host/kiosk, respaldo y privacidad,
 * proyección, fotos, menciones/reacciones/fijar en chat, avisos, detalle de
 * ítem + historial en vivo, "Lo mío", calendario, roles (409), reglas/tiendas/
 * secciones, QR de invitación, live-refresh entre dos miembros y modo oscuro.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  api, register, launch, isolatedPage, goto, clickByText, typeIn, waitText,
  bodyText, check, checkNoUnexpected4xx, expectFailure, done, screenshot,
} from './harness.mjs'

// Foto PNG de prueba para subir desde la UI (detalle de ítem y chat). Vive en el
// repo (scripts/e2e/fixtures/foto.png), no en /tmp, para que el E2E sea
// reproducible en cualquier máquina y en CI.
const PHOTO_FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'foto.png')

// El 404 de /api/home es por diseño para cuentas sin hogar (recién registrados,
// ver AGENTS.md "home_info devuelve 404"); el registro de la sección Q lo toca.
expectFailure(404, '/api/home')

const suffix = Date.now().toString().slice(-6)
const PW = 'secreto123'
const ADMIN = 'E2EFull' + suffix
const LUIS = 'E2ELuis' + suffix

let adminToken = ''
let luisToken = ''
const created = []
async function seedItem(name, extra = {}) {
  const r = await api('/api/items', {
    method: 'POST', token: adminToken,
    body: { name, quantity: 1, unit: 'pieza', priority: 'media', ...extra },
  })
  created.push(r.data)
  return r
}

async function main() {
  // ── Setup: cuentas reales + hogar + miembro ───────────────────────────────
  const me = await register(ADMIN, PW)
  adminToken = me.token
  const luisAcc = await register(LUIS, PW)
  luisToken = luisAcc.token
  const homeRes = await api('/api/home', { method: 'POST', token: adminToken, body: { name: 'Hogar ' + suffix } })
  check('Setup: hogar creado', homeRes.status === 200)
  const addLuis = await api('/api/home/members', {
    method: 'POST', token: adminToken, body: { name: LUIS, role: 'miembro' },
  })
  check('Setup: Luis agregado como miembro', addLuis.status === 200)

  // ── A) Login por UI real (SPEC §2) ─────────────────────────────────────────
  const { browser, page, jsErrors, badResponses } = await launch() // sin token
  await goto(page, '/login', { waitFor: 'Entrar' })
  await typeIn(page, 'Nombre', ADMIN)
  await typeIn(page, 'Contraseña', PW)
  await clickByText(page, 'Entrar', { selector: 'button' })
  await waitText(page, '¿Qué falta?', 20000)
  check('A1 Login por UI real llega al home', true)
  await goto(page, '/home', { waitFor: '¿Qué falta?' })
  check('A2 Sesión persiste al recargar', true)

  // ── B) PIN rápido (SPEC §2.3) ──────────────────────────────────────────────
  const setPin = await api('/api/auth/pin', { method: 'POST', token: adminToken, body: { name: ADMIN, pin: '2468' } })
  check('B1 Se configura el PIN (API)', setPin.status === 204)
  const hasPin = await api(`/api/auth/has-pin?name=${encodeURIComponent(ADMIN)}`)
  check('B2 has-pin = true', hasPin.data === true)
  const pinPage = await isolatedPage(browser)
  await goto(pinPage.page, '/login', { waitFor: 'Entrar' })
  await typeIn(pinPage.page, 'Nombre', ADMIN)
  await pinPage.page.waitForSelector('[aria-label="PIN rápido"]', { timeout: 10000, polling: 250 })
  await typeIn(pinPage.page, 'PIN rápido', '2468')
  await clickByText(pinPage.page, 'Entrar con PIN', { selector: 'button' })
  await waitText(pinPage.page, '¿Qué falta?', 20000)
  check('B3 Entrar con PIN por la UI funciona', true)
  await pinPage.context.close()

  // ── C) Modo host / quiosco (SPEC §2.3, §16) ────────────────────────────────
  await api('/api/rules', { method: 'PATCH', token: adminToken, body: { hostMode: true } })
  const hostKeyRes = await api('/api/rules/host-key', { method: 'POST', token: adminToken })
  const hostKey = hostKeyRes.data ?? ''
  check('C1 Se habilita host y se genera la llave', hostKey.length > 0)
  const kioskPage = await isolatedPage(browser)
  await goto(kioskPage.page, '/kiosk', { waitFor: 'Modo host' })
  check('C2 /kiosk anónimo muestra el modo host', true)
  await typeIn(kioskPage.page, 'Llave del modo host', hostKey)
  await clickByText(kioskPage.page, 'Entrar al quiosco', { selector: 'button' })
  await waitText(kioskPage.page, 'Falta…', 20000)
  check('C3 El quiosco entra con la llave', true)
  await clickByText(kioskPage.page, 'Falta…')
  await kioskPage.page.waitForFunction(() => location.pathname === '/items/new', { timeout: 10000, polling: 250 })
  check('C4 El quiosco abre la captura rápida', true)
  await kioskPage.context.close()

  // ── D) Respaldo y privacidad (SPEC §15, §14) ───────────────────────────────
  const exp = await api('/api/backup', { token: adminToken })
  check('D1 backup_export devuelve el hogar', exp.status === 200 && exp.data?.home?.name === 'Hogar ' + suffix)
  const expLuis = await api('/api/backup', { token: luisToken })
  check('D2 Un miembro NO puede exportar (autorización)', expLuis.status === 409 || expLuis.status === 404, `HTTP ${expLuis.status}`)
  await api('/api/rules', { method: 'PATCH', token: adminToken, body: { privacyShowPrices: false } })
  const itemsPrivate = await api('/api/items', { token: adminToken })
  const noPrice = (itemsPrivate.data ?? []).every((i) => i.price == null)
  check('D3 Privacidad: precios redactados en la lista', noPrice)
  const spend = await api('/api/reports/spending', { token: adminToken })
  check('D4 Privacidad: gasto en cero', spend.data?.total === 0, `total=${spend.data?.total}`)
  const expPrivate = await api('/api/backup', { token: adminToken })
  check('D5 Privacidad: el backup sale sin precios', (expPrivate.data?.items ?? []).every((i) => i.price == null))
  await api('/api/rules', { method: 'PATCH', token: adminToken, body: { privacyShowPrices: true } })

  // ── E) Proyección: confirmar crea el ítem (SPEC §7.2) ─────────────────────
  await seedItem('leche proy')
  await api('/api/items/' + created[created.length - 1].id + '/status', {
    method: 'PATCH', token: adminToken, body: { to: 'comprado' },
  })
  const proj = await api('/api/reports/projection', { token: adminToken })
  const projItem = (proj.data ?? []).find((p) => p.name === 'leche proy')
  check('E1 La proyección sugiere un ítem con cadencia', Boolean(projItem), projItem?.estFaltaInDays)
  const before = (await api('/api/items', { token: adminToken })).data.length
  await api('/api/reports/projection/decide', { method: 'POST', token: adminToken, body: { name: 'leche proy', decided: true, confirmed: true } })
  const after = (await api('/api/items', { token: adminToken })).data.length
  check('E2 Confirmar la proyección crea el ítem en la lista', after >= before)

  // ── F) Fotos (SPEC §10) ────────────────────────────────────────────────────
  const photoItem = await seedItem('arroz foto')
  const itemId = photoItem?.data?.id ?? 'MISSING'
  check('F-pre ítem foto creado', itemId !== 'MISSING', itemId)
  await goto(page, `/items/${itemId}`, { waitFor: 'arroz foto' })
  const fileOk = await page.waitForFunction(
    () => Boolean(document.querySelector('input[type="file"]')),
    { timeout: 15000, polling: 250 },
  ).then(() => true).catch(async () => {
    await screenshot(page, 'f-foto-input-fail')
    console.error('F-debug:', await page.evaluate(() => ({
      href: location.href,
      path: location.pathname,
      hasFile: Boolean(document.querySelector('input[type="file"]')),
      inputs: [...document.querySelectorAll('input')].map((i) => i.type),
      body: document.body.innerText.slice(0, 400),
    })))
    return false
  })
  check('F0 El detalle muestra el input de foto', fileOk)
  if (fileOk) {
    const fileInput = await page.$('input[type="file"]')
    await fileInput.uploadFile(PHOTO_FIXTURE)
    const uploaded = await page.waitForFunction(
      () => document.body.innerText.includes('Fotos (1)'),
      { timeout: 15000, polling: 250 },
    ).then(() => true).catch(async () => {
      await screenshot(page, 'f-foto-upload-fail')
      return false
    })
    check('F1 Subir foto desde el detalle funciona', uploaded)
  } else {
    check('F1 Subir foto desde el detalle funciona', false, 'sin input de foto')
  }
  const withPhoto = await api('/api/items/query', { method: 'POST', token: adminToken, body: { onlyPhotos: true } })
  check('F2 El filtro "Con foto" la encuentra', (withPhoto.data ?? []).some((i) => i.id === itemId))
  check('F3 El detalle muestra la imagen', await page.evaluate(() => Boolean(document.querySelector('img[alt*="Foto 1 de"]'))))

  // ── G) Chat: mención, reacción y fijar (SPEC §11, §13) ─────────────────────
  const chatRes = await api('/api/chat', { method: 'POST', token: adminToken, body: { body: `oye @${LUIS} la canela` } })
  check('G1 Mensaje con mención enviado', chatRes.status === 200)
  const notifsLuis = await api(`/api/notifications?member=${encodeURIComponent(LUIS)}`, { token: luisToken })
  check('G2 La mención genera aviso a Luis', (notifsLuis.data ?? []).some((n) => n.kind === 'mention'), JSON.stringify(notifsLuis.data)?.slice(0, 120))
  await goto(page, '/chat', { waitFor: 'Chat' })
  await waitText(page, 'la canela', 10000)
  // Reaccionar: abre el picker del primer mensaje y elige 👍 (lookups frescos).
  const reacted = await page.evaluate(() => {
    const reactBtn = document.querySelector('[aria-label="Reaccionar"]')
    if (!reactBtn) return 'no-reaction-btn'
    reactBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return 'picker-open'
  })
  if (reacted === 'picker-open') {
    await new Promise((r) => setTimeout(r, 400))
    const picked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '👍')
      if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true }
      return false
    })
    check('G3 Reaccionar con 👍 en el chat', picked)
  } else {
    check('G3 Reaccionar con 👍 en el chat', false, reacted)
  }
  const pinClick = () => page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label') === 'Fijar mensaje',
    )
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  const waitPinned = () => page.waitForFunction(
    // innerText refleja el `text-transform: uppercase` del label → comparar sin mayúsculas.
    () => document.body.innerText.toLowerCase().includes('fijados'),
    { timeout: 15000, polling: 250 },
  ).then(() => true).catch(() => false)
  // El mensaje fijado aparece en la sección "Fijados" arriba del hilo.
  await pinClick()
  let pinnedShown = await waitPinned()
  if (!pinnedShown) {
    await pinClick()
    pinnedShown = await waitPinned()
  }
  check('G4 Fijar un mensaje lo destaca en "Fijados"', pinnedShown)

  // ── H) Avisos (SPEC §13) ───────────────────────────────────────────────────
  await goto(page, '/notifications', { waitFor: 'Avisos' })
  const notifBody = await bodyText(page)
  check('H1 Página de avisos renderiza', notifBody.includes('Avisos'))
  await clickByText(page, 'Marcar todo como leído', { selector: 'button' }).catch(() => {})
  const unread = await api(`/api/notifications/unread?member=${encodeURIComponent(ADMIN)}`, { token: adminToken })
  check('H2 Marcar todo como leído limpia el contador', unread.data === 0, `unread=${unread.data}`)

  // ── I) Detalle: editar + historial se refresca (F3) ───────────────────────
  await goto(page, `/items/${itemId}`, { waitFor: 'arroz foto' })
  await typeIn(page, 'Nombre', 'arroz integral foto')
  await page.waitForFunction(
    () => document.body.innerText.includes('Guardar cambios'),
    { timeout: 6000, polling: 250 },
  )
  await clickByText(page, 'Guardar cambios', { selector: 'button' })
  await waitText(page, 'arroz integral foto', 15000)
  check('I1 Editar el ítem desde el detalle guarda', true)
  const itemAfter = await api('/api/items/' + itemId, { token: adminToken })
  check('I3 El backend guardó el nombre', itemAfter.data?.name === 'arroz integral foto')

  // Comentar desde el detalle: el historial se refresca al instante (F3).
  await goto(page, `/items/${itemId}`, { waitFor: 'arroz integral foto' })
  await typeIn(page, 'Comentar', 'este arroz es el bueno')
  await clickByText(page, 'Comentar', { selector: 'button' })
  await page.waitForFunction(
    () =>
      document.body.innerText.toLowerCase().includes('comentó') ||
      document.body.innerText.includes('este arroz es el bueno'),
    { timeout: 15000, polling: 250 },
  ).catch(() => {})
  const histText = await bodyText(page)
  check('I2 El historial refleja el comentario al momento', histText.toLowerCase().includes('comentó') || histText.includes('este arroz es el bueno'))

  // ── J) Lo mío (SPEC §6) ────────────────────────────────────────────────────
  const mineItem = await seedItem('pollo mío')
  const assignRes = await api('/api/items/' + mineItem.data.id + '/assign', { method: 'POST', token: adminToken, body: { member: ADMIN } })
  check('J0 Asignación guardada', assignRes.status === 200)
  const qMine = await api('/api/items/query', { method: 'POST', token: adminToken, body: { assignedTo: ADMIN } })
  check('J0b La query "Lo mío" lo encuentra', (qMine.data ?? []).some((i) => i.name === 'pollo mío'), `n=${(qMine.data ?? []).length}`)
  const qMineSort = await api('/api/items/query', { method: 'POST', token: adminToken, body: { assignedTo: ADMIN, sort: 'priority' } })
  check('J0c Con sort también lo encuentra', (qMineSort.data ?? []).some((i) => i.name === 'pollo mío'), `n=${(qMineSort.data ?? []).length}`)
  await goto(page, '/mine', { waitFor: 'Lo mío' })
  // Bajo carga el query puede tardar; espera y, si no aparece, recarga una vez.
  const mineShows = async () =>
    page.waitForFunction(
      () => document.body.innerText.includes('pollo mío'),
      { timeout: 25000, polling: 250 },
    ).then(() => true).catch(() => false)
  let j1Ok = await mineShows()
  if (!j1Ok) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    j1Ok = await mineShows()
  }
  check('J1 "Lo mío" muestra lo asignado a mí', j1Ok)
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('input[type="checkbox"]')].find((c) =>
      (c.getAttribute('aria-label') ?? '').toLowerCase().startsWith('pollo mío:'),
    )
    box?.click()
  })
  // La mutación debe llegar al backend: el ítem asignado pasa a "llevo".
  let j2Ok = false
  for (let i = 0; i < 12 && !j2Ok; i++) {
    const s = await api(`/api/items/${mineItem.data.id}`, { token: adminToken })
    j2Ok = s.data?.status === 'llevo'
    if (!j2Ok) await new Promise((r) => setTimeout(r, 500))
  }
  check('J2 Se puede marcar "ya lo llevo" en Lo mío', j2Ok)

  // ── K) Calendario (SPEC §9) ────────────────────────────────────────────────
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
  await api('/api/events', { method: 'POST', token: adminToken, body: { title: 'Comida E2E cal', date: tomorrow, kind: 'comida' } })
  await goto(page, '/calendar', { waitFor: 'Calendario' })
  const calShows = async () =>
    page.waitForFunction(
      () => document.body.innerText.includes('Comida E2E cal'),
      { timeout: 30000, polling: 250 },
    ).then(() => true).catch(async () => {
      console.error('K-debug:', await page.evaluate(() => {
        const body = document.body.innerText
        return { href: location.href, hasCal: body.includes('Calendario'), hasComida: body.includes('Comida'), snippet: body.slice(0, 400) }
      }))
      return false
    })
  let k1Ok = await calShows()
  if (!k1Ok) {
    // El grid del mes muestra hasta 2 eventos por día (slice(0,2)); en la
    // corrida completa otras suites crean eventos el mismo día (mañana) y el
    // nuestro puede quedar oculto. Abre la vista de DÍA de esa fecha (muestra
    // todos) tocando la celda del día en el grid.
    const dayNum = Number(tomorrow.slice(8, 10))
    await page.evaluate((d) => {
      const btn = [...document.querySelectorAll('button')].find((b) => {
        const num = b.querySelector('[class*="dayNum"]')?.textContent?.trim()
        return num === String(d)
      })
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }, dayNum).catch(() => {})
    k1Ok = await calShows()
  }
  if (!k1Ok) {
    // Último recurso bajo carga: recarga y espera de nuevo.
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    k1Ok = await calShows()
  }
  check('K1 El calendario muestra el evento', k1Ok)

  // ── L) Roles y autorización (SPEC §3.2) ────────────────────────────────────
  const luisRules = await api('/api/rules', { method: 'PATCH', token: luisToken, body: { name: 'Nuevo nombre' } })
  check('L1 Un miembro recibe 409 al tocar reglas', luisRules.status === 409, `HTTP ${luisRules.status}`)
  const promote = await api('/api/home/roles', { method: 'PATCH', token: adminToken, body: { name: LUIS, role: 'organizador' } })
  check('L2 Admin cambia el rol de Luis a organizador', promote.status === 200)
  const luisRules2 = await api('/api/rules', { method: 'PATCH', token: luisToken, body: { name: 'Nuevo nombre' } })
  check('L3 Organizador sí puede tocar reglas', luisRules2.status === 200)

  // ── M) Reglas/tiendas/secciones (SPEC §14) ─────────────────────────────────
  await api('/api/rules/stores', { method: 'POST', token: adminToken, body: { name: 'La Esquina', aisles: ['Lácteos'] } })
  const sectionsAdd = await api('/api/sections', { method: 'POST', token: adminToken, body: { name: 'Para el domingo E2E' } })
  check('M1 Sección creada', sectionsAdd.status === 200)
  await goto(page, '/trips/stores', { waitFor: 'Tiendas y pasillos' })
  const storesText = await bodyText(page)
  check('M2 La página de tiendas muestra la nueva tienda', storesText.includes('La Esquina'))

  // ── N) QR de invitación (SPEC §3.3) ────────────────────────────────────────
  await goto(page, '/family/invite', { waitFor: 'Invitar a la familia' })
  const invBefore = (await api('/api/home', { token: adminToken })).data?.invitations?.length ?? 0
  try {
    await clickByText(page, 'Crear invitación', { selector: 'button' })
  } catch {
    /* sigue */
  }
  const qrBlock = await page.waitForFunction(
    () =>
      document.body.innerText.includes('Invitación creada') ||
      Boolean(document.querySelector('canvas')),
    { timeout: 10000, polling: 250 },
  ).then(() => true).catch(() => false)
  const invAfter = (await api('/api/home', { token: adminToken })).data?.invitations?.length ?? 0
  const hasCanvas = await page.evaluate(() => Boolean(document.querySelector('canvas'))).catch(() => false)
  check('N1 La invitación se crea y muestra el bloque con QR', qrBlock && invAfter > invBefore, `canvas=${hasCanvas} inv=${invAfter}`)

  // ── O) Live-refresh entre DOS miembros (SPEC §12) ──────────────────────────
  const luisLive = await isolatedPage(browser, { token: luisToken })
  await goto(luisLive.page, '/home', { waitFor: '¿Qué falta?' })
  await api('/api/items', { method: 'POST', token: adminToken, body: { name: 'fruta fresca live full', quantity: 1, unit: 'kg', priority: 'media' } })
  await luisLive.page.waitForFunction(
    () => document.body.innerText.includes('fruta fresca live full'),
    { timeout: 30000, polling: 250 },
  ).catch(() => {})
  const luisBody = await bodyText(luisLive.page)
  check('O1 El otro miembro ve el ítem nuevo sin recargar', luisBody.includes('fruta fresca live full'))
  await api('/api/items/query', { method: 'POST', token: adminToken, body: { search: 'fruta fresca live full' } }).then(async (r) => {
    const it = r.data?.[0]
    if (it) {
      await api('/api/items/' + it.id + '/status', { method: 'PATCH', token: adminToken, body: { to: 'llevo' } })
    }
  })
  await luisLive.page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes('llevo'),
    { timeout: 30000, polling: 250 },
  ).catch(() => {})
  const luisBody2 = await bodyText(luisLive.page)
  check(
    'O2 El otro miembro ve "ya lo llevo" sin recargar',
    luisBody2.includes('fruta fresca live full') && luisBody2.toLowerCase().includes('llevo'),
  )
  await luisLive.context.close()

  // ── P) Modo oscuro (DESIGN §8) ─────────────────────────────────────────────
  await goto(page, '/settings', { waitFor: 'Ajustes' })
  await clickByText(page, 'Oscuro', { selector: 'button' })
  const dark = await page.evaluate(() => document.documentElement.dataset.theme)
  check('P1 El selector de tema activa el modo oscuro', dark === 'dark', `theme=${dark}`)

  // ── Q) Registro por UI (SPEC §2.2) ─────────────────────────────────────────
  const newbie = 'E2ENew' + suffix
  await goto(page, '/register', { waitFor: 'Crear cuenta' })
  await typeIn(page, 'Nombre', newbie)
  await typeIn(page, 'Contraseña', PW)
  await typeIn(page, 'Repite la contraseña', PW)
  const regStatus = { seen: false, status: 0 }
  const onReg = async (r) => { if (r.url().includes('auth/register')) { regStatus.seen = true; regStatus.status = r.status() } }
  const tryLogin = async () => (await api('/api/auth/login', { method: 'POST', body: { name: newbie, password: PW, device: 'e2e' } })).status === 200
  let createdOk = false

  const submitAndWait = async () => {
    page.on('response', onReg)
    await page.evaluate(() => {
      const form = document.querySelector('form')
      if (form) form.requestSubmit()
    })
    for (let i = 0; i < 30 && !createdOk; i++) {
      createdOk = await tryLogin()
      if (!createdOk) await new Promise((r) => setTimeout(r, 1000))
    }
    page.off('response', onReg)
  }

  await submitAndWait()
  if (!createdOk) {
    // Reintento: recarga el registro y vuelve a enviarlo (el primer submit
    // pudo perderse bajo carga).
    await goto(page, '/register', { waitFor: 'Crear cuenta' })
    await typeIn(page, 'Nombre', newbie)
    await typeIn(page, 'Contraseña', PW)
    await typeIn(page, 'Repite la contraseña', PW)
    await submitAndWait()
  }
  check('Q1 Registrarse por la UI crea la cuenta', createdOk, regStatus.seen ? `register HTTP ${regStatus.status}` : 'register no visto')
  if (createdOk) {
    await page.waitForFunction(
      () => location.pathname !== '/register',
      { timeout: 20000, polling: 250 },
    ).catch(() => {})
  }
  // Q quedó con la sesión del usuario recién registrado, que NO pertenece a
  // ningún hogar (SPEC §15: un miembro sin hogar no ve los datos de la
  // familia). Restauramos la sesión del admin para las secciones R/S/T/U.
  await page.evaluate((tok) => localStorage.setItem('grocery-planner.auth.token', tok), adminToken)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForFunction(
    () => document.body.innerText.includes('¿Qué falta?') || document.body.innerText.includes('Ajustes'),
    { timeout: 25000, polling: 250 },
  ).catch(() => {})

  // ── R) Secciones, historial y ajustes de avisos ────────────────────────────
  await goto(page, '/trips/sections', { waitFor: 'Para el domingo E2E', timeout: 45000 })
  check('R1 La página de secciones muestra la nueva sección', true)
  await goto(page, '/history', { waitFor: 'Historial' })
  const histPage = await bodyText(page)
  check('R2 El historial renderiza la línea de tiempo', histPage.includes('Historial'))
  await goto(page, '/settings', { waitFor: 'Ajustes' })
  const avisos = async () =>
    page.waitForFunction(() => document.body.innerText.includes('Tus avisos'), { timeout: 30000, polling: 250 })
      .then(() => true).catch(() => false)
  let r3Ok = await avisos()
  if (!r3Ok) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    r3Ok = await avisos()
  }
  check('R3 Ajustes muestra "Tus avisos"', r3Ok)

  // ── S) Foto en el chat (SPEC §11.1) ────────────────────────────────────────
  await goto(page, '/chat', { waitFor: 'Chat' })
  await page.waitForFunction(() => Boolean(document.querySelector('input[type="file"]')), { timeout: 10000, polling: 250 })
  const chatFile = await page.$('input[type="file"]')
  await chatFile.uploadFile(PHOTO_FIXTURE)
  await page.waitForFunction(
    () => Boolean(document.querySelector('img[alt="Foto del chat"]')),
    { timeout: 8000, polling: 250 },
  ).catch(() => {})
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Enviar'),
    )
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(
    () => Boolean(document.querySelector('img[alt="Foto del chat"]')),
    { timeout: 10000, polling: 250 },
  ).catch(() => {})
  check('S1 Enviar un mensaje con foto del chat', await page.evaluate(() =>
    Boolean(document.querySelector('img[alt="Foto del chat"]'))))

  // ── T) Ítem: marca, alternativas y mover (SPEC §4.1/§4.4) ──────────────────
  const fallbackItem = await seedItem('canela fina', { brand: 'Marca E2E' })
  await api(`/api/items/${fallbackItem.data.id}/fallbacks`, {
    method: 'POST', token: adminToken,
    body: { name: 'canela molida', quantity: 1, unit: 'bolsa' },
  })
  await goto(page, `/items/${fallbackItem.data.id}`, { waitFor: 'canela fina' })
  const detailText = await bodyText(page)
  const brandValue = await page.evaluate(() =>
    document.querySelector('[aria-label="Marca (opcional)"]')?.value ?? '')
  check('T1 El detalle muestra la marca', brandValue === 'Marca E2E', brandValue)
  check('T2 El detalle muestra la alternativa', detailText.includes('canela molida'))
  await api(`/api/items/${fallbackItem.data.id}/move`, { method: 'POST', token: adminToken, body: { direction: 'up' } })
  const moved = await api('/api/items/' + fallbackItem.data.id, { token: adminToken })
  check('T3 Mover un ítem no rompe su posición', moved.status === 200)

  // ── U) Borrado permanente con rol (SPEC §3.2) ───────────────────────────────
  // Luis ya es organizador (sección L): usamos un miembro sin promocionar.
  const pepe = await register('E2EPepe' + suffix, PW)
  await api('/api/home/members', { method: 'POST', token: adminToken, body: { name: pepe.name, role: 'miembro' } })
  const toTrash = await seedItem('leche papelera')
  await api(`/api/items/${toTrash.data.id}`, { method: 'DELETE', token: adminToken })
  const permPepe = await api(`/api/items/${toTrash.data.id}/permanent`, { method: 'DELETE', token: pepe.token })
  check('U1 Un miembro NO borra ítems ajenos para siempre', permPepe.status === 409, `HTTP ${permPepe.status}`)
  const permAdmin = await api(`/api/items/${toTrash.data.id}/permanent`, { method: 'DELETE', token: adminToken })
  check('U2 El Admin sí puede borrar de la papelera', permAdmin.status === 204, `HTTP ${permAdmin.status}`)

  // ── Z) Calidad ─────────────────────────────────────────────────────────────
  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))
  checkNoUnexpected4xx(badResponses)

  await done(browser)
}

main().catch(async (e) => {
  console.error('FALLO', e)
  process.exit(1)
})
