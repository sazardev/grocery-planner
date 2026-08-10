import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { generateSeoAssets } from './scripts/seo.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    seoPlugin(),
  ],
})

/**
 * SEO automatizado: al terminar `vite build` genera robots.txt, sitemap.xml y
 * og-image.png (renderizada desde public/og-image.svg) en el directorio de salida.
 */
function seoPlugin() {
  let outDir = 'dist'
  return {
    name: 'grocery-seo',
    apply: 'build',
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      await generateSeoAssets(outDir)
    },
  }
}
