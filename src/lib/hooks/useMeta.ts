import { useEffect } from 'react'

/**
 * Fija por página el título, la descripción, el canonical, Open Graph, Twitter
 * Card y meta robots. Clave para SEO y para que los enlaces compartidos se vean
 * bien en WhatsApp/redes.
 *
 * El dominio base se configura con `VITE_BASE_URL` (opcional). Si no está
 * definido, se usa el origen real del navegador (self-hosted), así el
 * canonical, og:url y og:image siempre son absolutos.
 */
export function useMeta(opts: {
  title: string
  description?: string
  path?: string
  image?: string
}) {
  useEffect(() => {
    const configured = import.meta.env.VITE_BASE_URL as string | undefined
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const base = (configured ?? origin).replace(/\/$/, '')
    const path = opts.path ?? ''
    const url = path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base
    const image = opts.image ? (opts.image.startsWith('http') ? opts.image : `${base}${opts.image.startsWith('/') ? opts.image : `/${opts.image}`}`) : `${base}/og-image.png`

    document.title = opts.title

    const setCanonical = () => {
      let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!el) {
        el = document.createElement('link')
        el.rel = 'canonical'
        document.head.appendChild(el)
      }
      el.href = url
    }
    setCanonical()

    const setProp = (attr: 'property' | 'name', key: string, content?: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
      if (!content) {
        if (el) el.remove()
        return
      }
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.content = content
    }

    // La descripción solo se pisa si la página da la suya; si no, se conserva
    // la descripción general del index.html (marketing/landing).
    if (opts.description) {
      setProp('name', 'description', opts.description)
      setProp('property', 'og:description', opts.description)
      setProp('name', 'twitter:description', opts.description)
    }
    setProp('property', 'og:title', opts.title)
    setProp('property', 'og:url', url)
    setProp('property', 'og:type', 'website')
    setProp('property', 'og:image', image)
    setProp('property', 'og:image:width', '1200')
    setProp('property', 'og:image:height', '630')
    setProp('property', 'og:image:alt', opts.title)
    setProp('name', 'twitter:card', 'summary_large_image')
    setProp('name', 'twitter:title', opts.title)
    setProp('name', 'twitter:image', image)
    setProp('name', 'robots', 'index, follow, max-image-preview:large')

    const previous = document.title
    return () => {
      document.title = previous
    }
  }, [opts.title, opts.description, opts.path, opts.image])
}
