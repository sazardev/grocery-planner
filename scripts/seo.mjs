/**
 * Generación automática de SEO / marketing en cada build.
 *
 * Produce (a partir de una sola config + `VITE_BASE_URL`):
 *   - robots.txt      con la URL del sitemap y las zonas no indexables.
 *   - sitemap.xml     con las rutas públicas del hogar y lastmod de hoy.
 *   - og-image.png    la imagen Open Graph (1200×630) renderizada desde
 *                     `public/og-image.svg` (con placeholders `{{title}}`…).
 *
 * Se ejecuta como plugin de Vite (en `vite.config.ts`) al terminar `vite build`,
 * escribiendo en el directorio de salida. También se puede correr a mano con
 * `npm run seo` para regenerar las copias de `public/` (paridad en dev).
 *
 * Variables:
 *   VITE_BASE_URL / GP_BASE_URL   dominio base (default https://grocery.example)
 *   OG_TITLE, OG_TAGLINE1, OG_TAGLINE2, OG_CTA   texto de la imagen OG
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_BASE_URL = 'https://grocery.example'

const OG_DEFAULTS = {
  title: 'Grocery Planner',
  tagline1: '¿Qué falta? La lista de compras de tu familia,',
  tagline2: 'en tiempo real y en todos tus dispositivos.',
  cta: '+ Falta…',
}

/** Rutas públicas indexables (las de detalle son dinámicas y van detrás del login). */
const SITEMAP_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/home', priority: '0.9', changefreq: 'daily' },
  { path: '/items/new', priority: '0.9', changefreq: 'daily' },
  { path: '/trips', priority: '0.8', changefreq: 'daily' },
  { path: '/trips/stores', priority: '0.6', changefreq: 'weekly' },
  { path: '/trips/sections', priority: '0.6', changefreq: 'weekly' },
  { path: '/plans', priority: '0.8', changefreq: 'daily' },
  { path: '/plans/new', priority: '0.7', changefreq: 'weekly' },
  { path: '/events', priority: '0.7', changefreq: 'weekly' },
  { path: '/calendar', priority: '0.7', changefreq: 'weekly' },
  { path: '/mine', priority: '0.8', changefreq: 'daily' },
  { path: '/history', priority: '0.5', changefreq: 'weekly' },
  { path: '/reports', priority: '0.5', changefreq: 'weekly' },
  { path: '/chat', priority: '0.6', changefreq: 'daily' },
  { path: '/family', priority: '0.6', changefreq: 'weekly' },
  { path: '/rules', priority: '0.4', changefreq: 'monthly' },
  { path: '/settings', priority: '0.4', changefreq: 'monthly' },
]

export function resolveBaseUrl() {
  return (process.env.VITE_BASE_URL || process.env.GP_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function robotsTxt(base) {
  return [
    '# /robots.txt — generado por scripts/seo.mjs (no edites a mano)',
    'User-agent: *',
    'Allow: /',
    '',
    '# Zonas de la app: el API y las rutas de sesión no se indexan.',
    'Disallow: /api/',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /kiosk',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}

function sitemapXml(base, lastmod) {
  const urls = SITEMAP_ROUTES.map(
    ({ path, priority, changefreq }) =>
      `  <url>\n    <loc>${base}${path === '/' ? '/' : path}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  ).join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

function fillTemplate(svg, values) {
  return svg.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? OG_DEFAULTS[key] ?? '')
}

function ogValues() {
  return {
    title: process.env.OG_TITLE || OG_DEFAULTS.title,
    tagline1: process.env.OG_TAGLINE1 || OG_DEFAULTS.tagline1,
    tagline2: process.env.OG_TAGLINE2 || OG_DEFAULTS.tagline2,
    cta: process.env.OG_CTA || OG_DEFAULTS.cta,
  }
}

/** Renderiza public/og-image.svg → og-image.png (1200×630) con sharp. */
export async function renderOgImage(outDir) {
  const template = await readFile(join(ROOT, 'public', 'og-image.svg'), 'utf8')
  const svg = fillTemplate(template, ogValues())
  const png = await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer()
  await writeFile(join(outDir, 'og-image.png'), png)
}

/** Genera robots.txt, sitemap.xml y og-image.png en cada directorio indicado. */
export async function generateSeoAssets(...outDirs) {
  const base = resolveBaseUrl()
  const lastmod = todayIso()
  if (base === DEFAULT_BASE_URL) {
    console.warn(
      `[seo] VITE_BASE_URL no definido → usando placeholder ${DEFAULT_BASE_URL}. ` +
        'Define VITE_BASE_URL (o GP_BASE_URL) para el dominio real de tu hogar.',
    )
  }
  for (const outDir of outDirs) {
    await mkdir(outDir, { recursive: true })
    await Promise.all([
      writeFile(join(outDir, 'robots.txt'), robotsTxt(base)),
      writeFile(join(outDir, 'sitemap.xml'), sitemapXml(base, lastmod)),
      renderOgImage(outDir),
    ])
    console.log(`[seo] robots.txt, sitemap.xml y og-image.png generados en ${outDir} (base: ${base})`)
  }
}

// Ejecución directa: `npm run seo` regenera las copias de public/.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  generateSeoAssets(join(ROOT, 'public')).catch((err) => {
    console.error('[seo] error:', err)
    process.exit(1)
  })
}
