/**
 * Suite E2E — cierres de gaps del SPEC (WS1–WS7): enlace de invitación,
 * soft-delete, bulk complete, editar/mover eventos, recurrencia anual,
 * notificaciones HTTP, presencia "en el mandado", privacidad y modo host.
 */
import { api, register, launch, newPage, goto, check, done, typeIn, clickByText } from './harness.mjs'

const suffix = Date.now().toString().slice(-6)

async function main() {
  // ── Sesión A (Admin) + hogar
  const a = await register('Admin' + suffix, 'secreto123')
  const token = a.token
  await api('/api/home', { method: 'POST', token, body: { name: 'Familia Gaps ' + suffix } })

  // ── Soft-delete: nada se borra de verdad (SPEC §8)
  const item = await api('/api/items', {
    method: 'POST', token,
    body: { name: 'leche soft', quantity: 1, unit: 'l', priority: 'media' },
  })
  const itemId = item.data.id
  const del = await api(`/api/items/${itemId}`, { method: 'DELETE', token })
  check('Soft-delete: eliminar responde 204', del.status === 204)
  const listAfter = await api('/api/items', { token })
  check('Soft-delete: ya no aparece en la lista', !(listAfter.data ?? []).some((i) => i.id === itemId))
  const timeline = await api(`/api/timeline?start=2000-01-01T00:00:00Z&end=2100-01-01T00:00:00Z`, { token })
  check('Soft-delete: sigue en el timeline', (timeline.data ?? []).some((e) => e.title?.includes('leche soft')))
  const rec = await api(`/api/items/${itemId}/recover`, { method: 'POST', token, body: {} })
  check('Soft-delete: recuperar lo vuelve a la lista', rec.status === 200)

  // ── Bulk "marcar todo lo llevado como comprado" (SPEC §5.1)
  for (const name of ['pollo bulk', 'arroz bulk']) {
    await api('/api/items', { method: 'POST', token, body: { name, quantity: 1, unit: 'kg', priority: 'media' } })
  }
  const pending = await api('/api/items/query', { method: 'POST', token, body: { status: 'falta' } })
  for (const it of pending.data) {
    await api(`/api/items/${it.id}/status`, { method: 'PATCH', token, body: { to: 'llevo' } })
  }
  const batch = await api('/api/items/complete-batch', { method: 'POST', token, body: {} })
  const leftLlevo = await api('/api/items/query', { method: 'POST', token, body: { status: 'llevo' } })
  const comprados = await api('/api/items/query', { method: 'POST', token, body: { status: 'comprado' } })
  check(
    'Bulk complete: marca todo lo llevado como comprado',
    (leftLlevo.data ?? []).length === 0 &&
      ['pollo bulk', 'arroz bulk'].every((n) => (comprados.data ?? []).some((i) => i.name === n)),
  )

  // ── Editar evento (SPEC §9.3) + recurrencia anual (SPEC §9.2)
  const ev = await api('/api/events', {
    method: 'POST', token,
    body: { title: 'Cumple original', date: '2026-08-20', kind: 'cumpleanos', recurringYearly: true, createdBy: a.name },
  })
  const evId = ev.data.id
  const updated = await api(`/api/events/${evId}`, {
    method: 'PATCH', token,
    body: { title: 'Cumple editado', date: '2026-08-21' },
  })
  check('Editar evento: cambia título y fecha (mover)', updated.status === 200 && updated.data.title === 'Cumple editado' && updated.data.date === '2026-08-21')
  const range = await api('/api/events/range?start=2027-01-01&end=2027-12-31', { token })
  check('Recurrencia anual: aparece en años futuros', (range.data ?? []).some((e) => e.id === evId))

  // ── Notificaciones HTTP al asignar ítem (SPEC §13, antes se perdían en web)
  const c = await register('Compr' + suffix, 'secreto123')
  const added = await api('/api/home/members', { method: 'POST', token, body: { name: c.name, role: 'miembro' } })
  check('Agregar miembro con cuenta existente', added.status === 200)
  await api('/api/items', { method: 'POST', token, body: { name: 'asignable', quantity: 1, unit: 'pieza', priority: 'media' } })
  const q = await api('/api/items/query', { method: 'POST', token, body: { search: 'asignable' } })
  const assigned = await api(`/api/items/${q.data[0].id}/assign`, { method: 'POST', token, body: { member: c.name } })
  check('Notificación HTTP al asignar ítem', assigned.status === 200)
  const cNotifs = await api('/api/notifications', { token: c.token })
  check('Notificación HTTP: se crea el aviso', (cNotifs.data ?? []).some((n) => n.title?.includes('Te asignaron un ítem')))

  // ── Presencia "en el mandado" (SPEC §12)
  const trip = await api('/api/trips', { method: 'POST', token, body: { title: 'Mandado gaps', by: a.name } })
  await api(`/api/trips/${trip.data.id}/activate`, { method: 'POST', token, body: {} })
  const presence = await api('/api/presence', { token })
  check('Presencia: quien activa el mandado queda "en el mandado"', (presence.data ?? []).some((p) => p.screen === 'mandado'))

  // ── Privacidad: precios ocultos (SPEC §14)
  await api('/api/rules', { method: 'PATCH', token, body: { privacyShowPrices: false } })
  const spend = await api('/api/reports/spending', { token })
  check('Privacidad: el gasto se oculta', spend.data.total === 0)
  await api('/api/rules', { method: 'PATCH', token, body: { privacyShowPrices: true } })

  // ── Modo host (SPEC §2.3): llave → login público
  await api('/api/rules', { method: 'PATCH', token, body: { hostMode: true } })
  const key = await api('/api/rules/host-key', { method: 'POST', token, body: {} })
  check('Modo host: Admin genera la llave', key.status === 200 && typeof key.data === 'string' && key.data.length > 10)
  const hostView = await api('/api/auth/host-login', { method: 'POST', body: { hostKey: key.data, device: 'quiosco' } })
  check('Modo host: login con llave devuelve sesión', hostView.status === 200 && !!hostView.data?.token)
  const badHost = await api('/api/auth/host-login', { method: 'POST', body: { hostKey: 'incorrecta', device: 'quiosco' } })
  check('Modo host: llave incorrecta rechazada', badHost.status === 401)

  // ── Enlace de invitación con #TOKEN para un usuario nuevo (SPEC §3.3)
  const inv = await api('/api/home/invitations', { method: 'POST', token, body: { roleGranted: 'miembro' } })
  const invToken = inv.data.token
  const b = await register('Invitado' + suffix, 'secreto123')
  const { browser, page, jsErrors } = await launch({ token: b.token })
  await goto(page, `/family/join#${invToken}`)
  const codeValue = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].find((x) => x.getAttribute('aria-label')?.includes('Código'))
    return el ? el.value : ''
  })
  check('Enlace de invitación: pre-carga el token en el campo', codeValue === invToken || codeValue === inv.data.code)
  await clickByText(page, 'Unirse al hogar')
  await new Promise((r) => setTimeout(r, 800))
  const homeInfo = await api('/api/home', { token: b.token })
  check('Enlace de invitación: el invitado entra al hogar', (homeInfo.data?.members ?? []).some((m) => m.name === b.name))
  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))
  await done(browser)
}

main().catch((e) => { console.error('FALLO', e); process.exit(1) })
