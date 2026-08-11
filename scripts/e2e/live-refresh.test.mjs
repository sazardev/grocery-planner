/**
 * Suite E2E — "la UI refresca al momento": dos pestañas con la misma sesión,
 * un cambio en una debe aparecer en la otra sin recargar (vía polling).
 */
import { api, register, launch, newPage, goto, typeIn, clickByText, check, done } from './harness.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const suffix = Date.now().toString().slice(-6)

async function main() {
  const me = await register('Live' + suffix, 'secreto123')
  const token = me.token
  await api('/api/home', { method: 'POST', token, body: { name: 'Familia Live ' + suffix } })

  // Dos páginas con la misma sesión.
  const { browser, page: pageA, jsErrors } = await launch({ token })
  const { page: pageB } = await newPage(browser, { token })

  await goto(pageA, '/home', { waitFor: '¿Qué falta?' })
  await goto(pageB, '/home', { waitFor: '¿Qué falta?' })
  check('Dos pestañas en /home', true)

  // Línea base: un ítem previo vía API para que ambas pestañas tengan caché.
  const seedItem = await api('/api/items', {
    method: 'POST',
    token,
    body: { name: 'item previo', quantity: 1, unit: 'pieza', priority: 'media' },
  })
  check('Ítem previo sembrado', seedItem.status === 200)

  // Espera a que página B vea el ítem previo (primer polling/re-fetch).
  await pageB.waitForFunction(() => document.body.innerText.includes('item previo'), { timeout: 20000, polling: 250 })
  check('Página B ve ítem previo sin recargar', true)

  // Página A agrega un ítem nuevo por la UI (patrón probado: click + respiro).
  await goto(pageA, '/items/new')
  await typeIn(pageA, 'Qué falta', 'fruta fresca live')
  await sleep(300)
  await clickByText(pageA, 'Agregar', { selector: 'button' })
  await sleep(2000)
  await pageA.waitForFunction(() => location.pathname === '/home', { timeout: 25000, polling: 250 })

  // Página B debe verlo SOLA (sin recarga, gracias al polling de la lista).
  const t0 = Date.now()
  await pageB.waitForFunction(() => document.body.innerText.includes('fruta fresca live'), {
    timeout: 30000,
    polling: 250,
  })
  const elapsed = Date.now() - t0
  check('Página B ve el ítem nuevo al momento (≤30s)', true, `${elapsed}ms`)

  // Página A marca "ya lo llevo"; página B ve el estado cambiar.
  await pageA.evaluate(() => {
    const box = document.querySelector('[aria-label*="fruta fresca live"]')
    if (!box) throw new Error('checkbox "ya lo llevo" no encontrado')
    box.click()
  })
  await pageB.waitForFunction(
    () =>
      [...document.querySelectorAll('*')].some(
        (x) =>
          x.textContent?.includes('fruta fresca live') && x.textContent.includes('Ya lo llevo'),
      ),
    { timeout: 30000, polling: 250 },
  )
  check('Página B ve el estado "ya lo llevo" sin recargar', true)

  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))

  await done(browser)
}

main().catch((e) => { console.error('FALLO', e); process.exit(1) })
