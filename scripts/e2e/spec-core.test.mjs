/**
 * Suite E2E core — flujos principales del SPEC a través de la UI real.
 *
 * Cubre: registro, hogar, ítems (rápido/detallado), toggle "ya lo llevo",
 * búsqueda, mandado, plan, evento, chat, reportes, presencia e invitación.
 */
import { api, register, launch, goto, clickByText, typeIn, bodyText, check, done } from './harness.mjs'

const suffix = Date.now().toString().slice(-6)
const MEMBER_PW = 'secreto123'
const tomorrow = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})()

async function main() {
  // ── Sesión: cuenta real + hogar (auth vía API para aislar el resto en UI)
  const me = await register('E2E' + suffix, MEMBER_PW)
  const token = me.token
  const homeRes = await api('/api/home', { method: 'POST', token, body: { name: 'Familia E2E ' + suffix } })
  check('Crear hogar', homeRes.status === 200)

  const { browser, page, jsErrors } = await launch({ token })

  // ── Home: título + conectado
  await goto(page, '/home', { waitFor: '¿Qué falta?' })
  check('Home muestra "¿Qué falta?"', true)
  const homeText = await bodyText(page)
  check('Home no muestra error de conexión', !homeText.includes('No se pudo conectar'))
  await page.waitForFunction(
    () => document.querySelector('[aria-label*="persona conectada"]'),
    { timeout: 15000 },
  ).catch(() => {})
  check('Home muestra presencia (alguien conectado)', await page.evaluate(() =>
    Boolean(document.querySelector('[aria-label*="persona conectada"]'))))

  // ── Ítem rápido por texto libre
  await clickByText(page, 'Falta…')
  await page.waitForFunction(() => location.pathname === '/items/new', { timeout: 10000 })
  await typeIn(page, 'Qué falta', 'pollo 2kg')
  await clickByText(page, 'Agregar', { selector: 'button' })
  await page.waitForFunction(
    () => document.body.innerText.includes('pollo'),
    { timeout: 15000 },
  )
  check('Ítem "pollo 2kg" agregado por texto libre', true)

  // ── Ítem detallado (categoría + nota)
  await goto(page, '/items/new')
  await clickByText(page, 'Detallado')
  await typeIn(page, 'Producto', 'arroz integral')
  await typeIn(page, 'Cantidad deseada', '2')
  await typeIn(page, 'Unidad', 'kg')
  await typeIn(page, 'Categoría', 'despensa')
  await clickByText(page, 'Agregar ítem', { selector: 'button' })
  await page.waitForFunction(
    () => document.body.innerText.includes('arroz'),
    { timeout: 15000 },
  )
  check('Ítem detallado "arroz integral 2kg" agregado', true)

  // ── Toggle "ya lo llevo" desde la fila del checkbox
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')]
    const target = labels.find((l) => l.textContent?.toLowerCase().includes('pollo'))
    const box = target?.querySelector('input[type="checkbox"]') ?? target
    box?.click()
  })
  await new Promise((r) => setTimeout(r, 600))
  const afterToggle = await bodyText(page)
  check('Marcar "ya lo llevo" cambia el estado en la fila', afterToggle.includes('llevo') || afterToggle.includes('carrito'))

  // ── Búsqueda instantánea
  await typeIn(page, 'Buscar', 'arroz')
  await new Promise((r) => setTimeout(r, 500))
  const searchText = await bodyText(page)
  check('Búsqueda filtra (pollo oculto)', !searchText.toLowerCase().includes('pollo'))
  check('Búsqueda muestra arroz', searchText.includes('arroz'))

  // ── Mandado (form inline en /trips)
  await goto(page, '/trips', { waitFor: 'Mandado' })
  await typeIn(page, 'Título del mandado', 'Mandado sábado E2E')
  await clickByText(page, 'Crear mandado', { selector: 'button' })
  await page.waitForFunction(
    () => document.body.innerText.includes('Mandado sábado E2E'),
    { timeout: 10000 },
  )
  check('Mandado creado desde /trips', true)

  // ── Plan: crear vía API y verlo en /plans
  const plan = await api('/api/plans', {
    method: 'POST',
    token,
    body: { title: 'Plan sábado E2E', scheduledAt: `${tomorrow}T10:00`, createdBy: me.name },
  })
  check('Plan creado vía API', plan.status === 200, JSON.stringify(plan.data)?.slice(0, 60))
  await goto(page, '/plans', { waitFor: 'Planes' })
  const plansText = await bodyText(page)
  check('Plan visible en /plans', plansText.includes('Plan sábado E2E'))

  // ── Evento (form inline en /events)
  await goto(page, '/events', { waitFor: 'Eventos' })
  await typeIn(page, 'Nombre del evento', 'BBQ domingo E2E')
  await page.evaluate((d) => {
    const input = document.querySelector('input[type="date"]')
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    setter.call(input, d)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, tomorrow)
  await clickByText(page, 'Crear evento', { selector: 'button' })
  await page.waitForFunction(
    () => document.body.innerText.includes('BBQ domingo E2E'),
    { timeout: 10000 },
  )
  check('Evento creado desde /events', true)

  // ── Chat: enviar mensaje y ver reacción
  await goto(page, '/chat', { waitFor: 'Chat' })
  await page.waitForSelector('[aria-label="Mensaje del chat"]', { timeout: 10000 })
  await page.evaluate(() => {
    const input = document.querySelector('[aria-label="Mensaje del chat"]')
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    setter.call(input, 'Hola familia E2E')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').toLowerCase().includes('enviar'),
    )
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(() => document.body.innerText.includes('Hola familia E2E'), { timeout: 10000 })
  check('Mensaje de chat enviado y visible', true)

  // ── Reportes renderizan
  await goto(page, '/reports', { waitFor: 'Reportes' })
  const reportsText = await bodyText(page)
  check('Reportes renderiza secciones', reportsText.includes('más') || reportsText.includes('Proyección') || reportsText.includes('faltará'))

  // ── Presencia: la sesión aparece en línea
  const presence = await api('/api/presence', { token })
  const online = (presence.data ?? []).filter((p) => p.online).length
  check('Presencia: sesión en línea', online >= 1, `${online} en línea`)

  // ── Invitación: segundo usuario acepta por código corto
  const inv = await api('/api/home/invitations', { method: 'POST', token, body: { roleGranted: 'miembro' } })
  check('Invitación creada', inv.status === 200 && inv.data?.code, inv.data?.code)
  const other = await register('E2Eb' + suffix, MEMBER_PW)
  const accept = await api('/api/home/invitations/accept', {
    method: 'POST',
    token: other.token,
    body: { code: inv.data.code, member: other.name },
  })
  check('Segundo usuario acepta invitación por código', accept.status === 200)
  const homeAfter = await api('/api/home', { token })
  const members = homeAfter.data?.members ?? []
  check('Hogar tiene 2 miembros', members.length >= 2, `${members.length}`)

  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))

  await done(browser)
}

main().catch((e) => { console.error('FALLO', e); process.exit(1) })
