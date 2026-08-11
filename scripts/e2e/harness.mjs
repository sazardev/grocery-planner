/**
 * Harness E2E headless para Grocery Planner.
 *
 * Usa puppeteer-core + chromium del sistema (sin descargar binarios). Cada suite
 * levanta su propio browser; el orquestador `run.mjs` arranca backend + frontend.
 *
 * Variables de entorno:
 *   GP_API_URL   backend HTTP (default http://localhost:8787)
 *   GP_APP_URL   frontend (default http://localhost:5173)
 *   GP_CHROMIUM  ruta del binario chromium (default /usr/bin/chromium)
 */
import puppeteer from 'puppeteer-core'

export const API = process.env.GP_API_URL || 'http://localhost:8787'
export const APP = process.env.GP_APP_URL || 'http://localhost:5173'
export const CHROMIUM = process.env.GP_CHROMIUM || '/usr/bin/chromium'

// El build de dist usa el default http://localhost:8787 como base del backend
// (transport.ts, salvo VITE_API_URL). En el E2E reescribimos en caliente las
// peticiones a esa base hacia el backend real del orquestador, sin recompilar.
const BUILT_IN_API = 'http://localhost:8787'

export const results = []

/** Registra el resultado de un check. */
export function check(name, ok, detail = '') {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  return ok
}

/** Cliente HTTP contra el backend (con token opcional). */
export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

/** Crea una cuenta y devuelve { token, name }. */
export async function register(name, password = 'secreto123') {
  const r = await api('/api/auth/register', { method: 'POST', body: { name, password } })
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`register ${name}: HTTP ${r.status} ${JSON.stringify(r.data)}`)
  }
  return { token: r.data.token, name: r.data.user?.name ?? name }
}

/** Prepara una pestaña: intercepción del backend, sin SW, token y onboarding off. */
export async function newPage(browser, { token } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))
  if (BUILT_IN_API !== API) {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('sw.js')) {
        req.abort()
      } else if (url.startsWith(BUILT_IN_API)) {
        req.continue({ url: API + url.slice(BUILT_IN_API.length) })
      } else {
        req.continue()
      }
    })
  }
  if (token) {
    await page.evaluateOnNewDocument(
      (t) => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister()))
        }
        localStorage.setItem('grocery-planner.auth.token', t)
        localStorage.setItem('gp-onboarding-done', '1')
      },
      token,
    )
  }
  return { page, jsErrors }
}

/** Lanza chromium headless con el token de sesión pre-cargado. */
export async function launch({ token } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const { page, jsErrors } = await newPage(browser, { token })
  return { browser, page, jsErrors }
}

/** Navega a una ruta y espera que aparezca un texto (o el fin de red). */
export async function goto(page, route, { waitFor, timeout = 20000 } = {}) {
  await page.goto(APP + route, { waitUntil: 'networkidle0', timeout })
  if (waitFor) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 250 }, waitFor)
  }
}

/** Click en el primer elemento que contiene texto/aria-label (prefiere exacto). */
export async function clickByText(page, text, { selector = 'button, a, [role="button"]' } = {}) {
  await page.evaluate(
    (args) => {
      const [sel, txt] = args
      const all = [...document.querySelectorAll(sel)]
      const hit = (x) => x.textContent?.includes(txt) || x.getAttribute('aria-label')?.includes(txt)
      const exact = all.find((x) => x.textContent?.trim() === txt || x.getAttribute('aria-label')?.trim() === txt)
      const el = exact ?? all.find(hit)
      if (!el) throw new Error(`no se encontró elemento con "${txt}" en ${sel}`)
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    },
    [selector, text],
  )
}

export async function typeIn(page, label, value) {
  try {
    await page.waitForFunction(
      (lbl) =>
        [...document.querySelectorAll('input, textarea')].some((x) =>
          x.getAttribute('aria-label')?.includes(lbl) ||
          x.placeholder?.includes(lbl) ||
          [...(x.labels ?? [])].some((l) => l.textContent?.includes(lbl)),
        ),
      { timeout: 8000, polling: 250 },
      label,
    )
  } catch {
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('input, textarea')].map((x) => ({
        aria: x.getAttribute('aria-label'),
        ph: x.placeholder,
        label: [...(x.labels ?? [])].map((l) => l.textContent),
      })),
    )
    throw new Error(`no se encontró input con "${label}". Inputs: ${JSON.stringify(found)}`)
  }
  const setValue = () =>
    page.evaluate(
      (args) => {
        const [lbl, v] = args
        const el = [...document.querySelectorAll('input, textarea')].find(
          (x) =>
            x.getAttribute('aria-label')?.includes(lbl) ||
            x.placeholder?.includes(lbl) ||
            [...(x.labels ?? [])].some((l) => l.textContent?.includes(lbl)),
        )
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      [label, value],
    )
  await setValue()
  // Asegura que React commiteó el valor antes de continuar (reintenta si el
  // estado controlado no se reflejó todavía).
  const committed = await page.waitForFunction(
    (args) => {
      const [lbl, v] = args
      const el = [...document.querySelectorAll('input, textarea')].find(
        (x) =>
          x.getAttribute('aria-label')?.includes(lbl) ||
          x.placeholder?.includes(lbl) ||
          [...(x.labels ?? [])].some((l) => l.textContent?.includes(lbl)),
      )
      return el ? el.value === v : false
    },
    { timeout: 4000, polling: 250 },
    [label, value],
  ).catch(() => false)
  if (!committed) await setValue()
  await new Promise((r) => setTimeout(r, 150))
}

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText)
}

/** Cierra con salida exitosa según todos los checks. */
export async function done(browser) {
  await browser.close()
  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} checks`)
  process.exit(passed === results.length ? 0 : 1)
}
