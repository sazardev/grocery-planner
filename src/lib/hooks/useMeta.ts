import { useEffect } from 'react'

/**
 * Fija el título del documento, el canonical y las etiquetas Open Graph
 * (og:title, og:description, og:url) por página. Clave para SEO y para que
 * los enlaces compartidos se vean bien en WhatsApp/redes.
 *
 * El dominio base se configura con `VITE_BASE_URL` (opcional). Si no está
 * definido, se usa el origen real del navegador (self-hosted), así el
 * canonical y og:url siempre son absolutos.
 */
export function useMeta(opts: {
  title: string
  description?: string
  path?: string
}) {
  useEffect(() => {
    const configured = import.meta.env.VITE_BASE_URL as string | undefined
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const base = (configured ?? origin).replace(/\/$/, '')
    const path = opts.path ?? ''
    const url = path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base

    document.title = opts.title

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    const setMeta = (prop: string, content?: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`)
      if (!content) {
        if (el) el.remove()
        return
      }
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', prop)
        document.head.appendChild(el)
      }
      el.content = content
    }

    setMeta('og:title', opts.title)
    setMeta('og:description', opts.description)
    setMeta('og:url', url)

    const previous = document.title
    return () => {
      document.title = previous
    }
  }, [opts.title, opts.description, opts.path])
}
