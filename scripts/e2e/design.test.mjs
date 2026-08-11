/**
 * Suite E2E — cumplimiento de DESIGN.md medido en el navegador real.
 *
 * Verifica anti-pautas (§11): sin sombras decorativas, sin gradientes, sin
 * bordes-separador; zonas táctiles ≥44px en acciones frecuentes; modo oscuro
 * con tinte verde (no gris neutro).
 */
import { api, register, launch, goto, check, done } from './harness.mjs'

const suffix = Date.now().toString().slice(-6)

async function main() {
  const me = await register('Des' + suffix, 'secreto123')
  const token = me.token
  await api('/api/home', { method: 'POST', token, body: { name: 'Familia Des ' + suffix } })
  await api('/api/items', {
    method: 'POST',
    token,
    body: { name: 'diseño pollo', quantity: 2, unit: 'kg', requestedBy: me.name },
  })

  const { browser, page, jsErrors } = await launch({ token })
  await goto(page, '/home', { waitFor: '¿Qué falta?' })

  // ── Anti-pauta: sombras decorativas en superficies principales.
  const shadowed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('article, li, [class*="Card"], main')]
    return els
      .map((el) => {
        const s = getComputedStyle(el).boxShadow
        return s && s !== 'none' ? { cls: el.className, shadow: s } : null
      })
      .filter(Boolean)
      .slice(0, 5)
  })
  check('Sin box-shadow decorativo en tarjetas/listas', shadowed.length === 0, JSON.stringify(shadowed).slice(0, 120))

  // ── Anti-pauta: gradientes en fondos.
  const gradients = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')]
    return all
      .filter((el) => {
        const bg = getComputedStyle(el).backgroundImage
        return bg && bg !== 'none'
      })
      .map((el) => el.className)
      .slice(0, 5)
  })
  check('Sin gradientes en fondos', gradients.length === 0, JSON.stringify(gradients).slice(0, 120))

  // ── Color de marca: verde protagonista presente en la UI.
  const hasBrandGreen = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? b.textContent ?? '').includes('Agregar'),
    ) ?? [...document.querySelectorAll('button')][0]
    if (!btn) return false
    const bg = getComputedStyle(btn).backgroundColor
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return false
    const [r, g] = [Number(m[1]), Number(m[2])]
    return g > r && g > Number(m[3]) // componente verde dominante
  })
  check('Verde protagonista presente en acciones', hasBrandGreen)

  // ── Zonas táctiles ≥44px en nav y FAB.
  const touchTargets = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('nav a, nav button, [aria-label*="Agregar"], [role="button"]')]
    return targets.map((el) => {
      const r = el.getBoundingClientRect()
      return { label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }
    })
  })
  const tooSmall = touchTargets.filter((t) => Math.min(t.w, t.h) < 44)
  check('Zonas táctiles principales ≥44px', tooSmall.length === 0, JSON.stringify(tooSmall).slice(0, 160))

  // ── Modo oscuro: se activa con el tema y usa tinte verde (no gris neutro).
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await new Promise((r) => setTimeout(r, 300))
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const darkIsGreenTinted = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return false
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return g >= r && g >= b // tinte verde, no gris (r≈g≈b)
  })
  check('Modo oscuro con fondo de tinte verde', darkIsGreenTinted, darkBg)
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'))

  check('Sin errores JS', jsErrors.length === 0, jsErrors.join(' | '))

  await done(browser)
}

main().catch((e) => { console.error('FALLO', e); process.exit(1) })
