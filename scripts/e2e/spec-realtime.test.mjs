/**
 * Suite E2E — tiempo real por SSE ("la UI refresca al momento").
 *
 * Es la única prueba del claim estrella de fase 2: una mutación en un cliente
 * llega AL INSTANTE a los demás por `/api/events-stream`, no por el polling de
 * respaldo (los polls son de 12–20 s; aquí se exige <5 s en el transporte y
 * <15 s en la UI, siempre por debajo del poll de la lista de 20 s).
 *
 * Se lee el stream directamente en la página (fetch + Bearer, igual que hace
 * src/lib/realtime.ts) y se verifica que cada dominio llega con su kind.
 */
import { api, register, launch, goto, check, checkNoUnexpected4xx, done, API } from './harness.mjs'

const suffix = Date.now().toString().slice(-6)

/** Espera a que la página recibiera un evento SSE con `kind`; devuelve ms. */
async function waitKind(page, kind, timeoutMs = 8000) {
  const t0 = Date.now()
  for (;;) {
    const seen = await page.evaluate((k) => {
      const evs = window.__sseEvents || []
      return evs.some((e) => e.kind === k)
    }, kind)
    if (seen) return Date.now() - t0
    if (Date.now() - t0 > timeoutMs) return -1
    await new Promise((r) => setTimeout(r, 100))
  }
}

async function main() {
  const me = await register('RT' + suffix, 'secreto123')
  const token = me.token
  await api('/api/home', { method: 'POST', token, body: { name: 'Familia RT ' + suffix } })
  const comp = await register('RTComp' + suffix, 'secreto123')
  await api('/api/home/members', { method: 'POST', token, body: { name: comp.name, role: 'miembro' } })

  const { browser, page, jsErrors, badResponses } = await launch({ token })
  await goto(page, '/home', { waitFor: '¿Qué falta?' })

  // Abre su propio stream SSE (igual que realtime.ts) y guarda los kinds.
  // Usa la base real del orquestador (API), no una URL hardcodeada, para que no
  // dependa de cómo se compiló `dist`.
  await page.evaluate((base) => { window.__GP_API__ = base }, API)
  const sseOk = await page.evaluate(() => new Promise((resolve) => {
    window.__sseEvents = []
    const tk = localStorage.getItem('grocery-planner.auth.token') || ''
    fetch(window.__GP_API__ + '/api/events-stream', {
      headers: { Authorization: `Bearer ${tk}` },
    }).then((res) => {
      if (!res.ok || !res.body) { resolve(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue
            try {
              const ev = JSON.parse(line.slice(5).trim())
              if (ev.kind) window.__sseEvents.push(ev)
            } catch { /* malformado */ }
          }
        }
      }
      pump()
      resolve(true)
    }).catch(() => resolve(false))
  }))
  check('SSE: el stream se abre autenticado', sseOk)

  // ── 1) Crear un ítem → kind `items` (+ `notifications` por la ruta) ────────
  await api('/api/items', {
    method: 'POST', token,
    body: { name: 'leche realtime', quantity: 1, unit: 'l', priority: 'urgente' },
  })
  const tItems = await waitKind(page, 'items')
  check('SSE: crear ítem publica "items"', tItems >= 0, `${tItems}ms`)
  check('SSE: "items" llega en <5 s (no por poll de 20 s)', tItems >= 0 && tItems < 5000, `${tItems}ms`)
  const tNotif = await waitKind(page, 'notifications', 6000)
  check('SSE: ítem urgente publica "notifications" (badge al momento)', tNotif >= 0, `${tNotif}ms`)

  // ── 2) Asignar a otro miembro → `notifications` (aviso real) ───────────────
  const q = await api('/api/items/query', { method: 'POST', token, body: { search: 'leche realtime' } })
  const itemId = q.data?.[0]?.id
  await api(`/api/items/${itemId}/assign`, { method: 'POST', token, body: { member: comp.name } })
  const tAssign = await waitKind(page, 'notifications', 6000)
  check('SSE: asignar un ítem publica "notifications"', tAssign >= 0, `${tAssign}ms`)

  // ── 3) Chat con mención → kind `chat` ──────────────────────────────────────
  await api('/api/chat', { method: 'POST', token, body: { body: `hola @${comp.name}` } })
  const tChat = await waitKind(page, 'chat')
  check('SSE: mensaje de chat publica "chat"', tChat >= 0, `${tChat}ms`)

  // ── 4) Evento nuevo → kind `events` ────────────────────────────────────────
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
  await api('/api/events', { method: 'POST', token, body: { title: 'BBQ realtime', date: tomorrow, kind: 'comida' } })
  const tEvents = await waitKind(page, 'events')
  check('SSE: crear evento publica "events"', tEvents >= 0, `${tEvents}ms`)

  // ── 5) Mandado activo → kind `trips` ───────────────────────────────────────
  const trip = await api('/api/trips', { method: 'POST', token, body: { title: 'Mandado realtime' } })
  await api(`/api/trips/${trip.data.id}/activate`, { method: 'POST', token })
  const tTrips = await waitKind(page, 'trips')
  check('SSE: activar mandado publica "trips"', tTrips >= 0, `${tTrips}ms`)

  // ── 6) Reglas → kind `rules` ───────────────────────────────────────────────
  await api('/api/rules', { method: 'PATCH', token, body: { language: 'es' } })
  const tRules = await waitKind(page, 'rules')
  check('SSE: tocar reglas publica "rules"', tRules >= 0, `${tRules}ms`)

  // ── 7) La UI refleja el ítem creado por OTRO cliente en <15 s (SSE→TanStack→UI)
  const tUI0 = Date.now()
  await page.waitForFunction(
    () => document.body.innerText.includes('leche realtime'),
    { timeout: 15000, polling: 250 },
  ).then(() => {}).catch(() => {})
  const tUI = Date.now() - tUI0
  check(
    'SSE→UI: la lista muestra el ítem ajeno en <15 s (antes del poll de 20 s)',
    tUI < 15000,
    `${tUI}ms`,
  )

  // ── 8) `event_discard_list` debe publicar también `items` ──────────────────
  const ev2 = await api('/api/events', { method: 'POST', token, body: { title: 'Lista descartable', date: tomorrow, kind: 'reunion' } })
  await api(`/api/events/${ev2.data.id}/items/add`, { method: 'POST', token, body: { itemId } })
  await api(`/api/events/${ev2.data.id}/discard`, { method: 'POST', token })
  const tDiscardItems = await waitKind(page, 'items', 6000)
  check('SSE: descartar lista de evento publica "items" (la lista se refresca)', tDiscardItems >= 0, `${tDiscardItems}ms`)
  // El ítem fue descartado (borrado): la lista ya no lo muestra.
  await page.waitForFunction(
    () => !document.body.innerText.includes('leche realtime'),
    { timeout: 15000, polling: 250 },
  ).then(() => {}).catch(() => {})
  check(
    'SSE→UI: el ítem descartado desaparece de la lista en <15 s',
    !(await page.evaluate(() => document.body.innerText.includes('leche realtime'))),
  )

  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))
  checkNoUnexpected4xx(badResponses)

  await done(browser)
}

main().catch((e) => { console.error('FALLO', e); process.exit(1) })
