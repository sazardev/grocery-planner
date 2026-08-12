/**
 * Orquestador E2E headless de Grocery Planner.
 *
 * 1. Compila el binario HTTP (feature server) si hace falta.
 * 2. Arranca el backend en un puerto libre con data.json aislada en /tmp.
 * 3. Arranca `vite preview` (usa dist/ ya construida) en un puerto libre.
 * 4. Corre cada suite en scripts/e2e/*.test.mjs con el chromium del sistema.
 * 5. Mata los procesos al terminar. Exit 0 solo si todo pasó.
 *
 * Uso:
 *   node scripts/e2e/run.mjs            (asume `npm run build` ya corrido)
 *   npm run e2e                         (idem)
 *   npm run verify                      (lint + build + e2e)
 */
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const chromium = process.env.GP_CHROMIUM || '/usr/bin/chromium'

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function waitFor(url, timeoutMs) {
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
        if (res.ok) return resolve()
      } catch { /* aún no */ }
      if (Date.now() - t0 > timeoutMs) return reject(new Error(`timeout esperando ${url}`))
      setTimeout(tick, 400)
    }
    tick()
  })
}

async function main() {
  const suite = process.argv[2]
  const suites = suite
    ? [suite]
    : ['spec-core', 'live-refresh', 'design', 'spec-gaps', 'spec-realtime', 'spec-full', 'spec-hardening']

  // 1) Binario del server.
  console.log('[e2e] Compilando binario server (features=server)…')
  const build = spawnSync('cargo', ['build', '--features', 'server', '--bin', 'server'], {
    cwd: join(root, 'src-tauri'),
    stdio: 'inherit',
  })
  if (build.status !== 0) {
    console.error('[e2e] cargo build del server falló')
    process.exit(1)
  }
  const serverBin = join(root, 'src-tauri', 'target', 'debug', 'server')

  // 2) Puertos libres + data aislada.
  const apiPort = await freePort()
  const appPort = await freePort()
  const dataDir = mkdtempSync(join(tmpdir(), 'gp-e2e-'))
  console.log(`[e2e] API=${apiPort}  APP=${appPort}  data=${dataDir}`)

  // 3) Arrancar backend.
  const server = spawn(serverBin, [], {
    env: {
      ...process.env,
      GROCERY_PLANNER_PORT: String(apiPort),
      GROCERY_PLANNER_DATA: join(dataDir, 'data.json'),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  // 4) Arrancar vite preview.
  const vite = spawn('npx', ['vite', 'preview', '--port', String(appPort), '--strictPort'], {
    cwd: root,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  // Indica que los hijos viven en su propio grupo de procesos.
  server.unref()
  vite.unref()

  const killGroup = (child) => {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    try { child.kill('SIGKILL') } catch {}
  }
  const cleanup = () => {
    killGroup(server)
    killGroup(vite)
    rmSync(dataDir, { recursive: true, force: true })
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(130) })
  process.on('SIGTERM', () => { cleanup(); process.exit(143) })

  try {
    await waitFor(`http://localhost:${apiPort}/health/healthy`, 30000)
    await waitFor(`http://localhost:${appPort}`, 30000)
  } catch (e) {
    console.error('[e2e] no pudieron arrancar los servidores:', e.message)
    cleanup()
    process.exit(1)
  }

  // 5) Correr las suites.
  const env = {
    ...process.env,
    GP_API_URL: `http://localhost:${apiPort}`,
    GP_APP_URL: `http://localhost:${appPort}`,
    GP_CHROMIUM: chromium,
  }

  let allOk = true
  for (const s of suites) {
    const file = join(import.meta.dirname, `${s}.test.mjs`)
    console.log(`\n===== suite: ${s} =====`)
    const child = spawn(process.execPath, [file], { env, stdio: 'inherit' })
    const result = await new Promise((resolve) => {
      let finished = false
      const perSuiteTimeout =
        s === 'spec-full' ? 480_000
        : s === 'spec-hardening' ? 240_000
        : 180_000
      const timer = setTimeout(() => {
        if (!finished) {
          console.error(`[e2e] suite ${s} excedió el tiempo límite (${perSuiteTimeout / 1000}s); se aborta`)
          try { child.kill('SIGKILL') } catch {}
        }
      }, perSuiteTimeout)
      child.on('exit', (code) => {
        finished = true
        clearTimeout(timer)
        resolve(code)
      })
      child.on('error', () => {
        finished = true
        clearTimeout(timer)
        resolve(1)
      })
    })
    if (result !== 0) allOk = false
  }

  cleanup()
  console.log(allOk ? '\n[e2e] TODAS LAS SUITES PASAN' : '\n[e2e] HAY FALLOS')
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => { console.error('[e2e] error:', e); process.exit(1) })
