import { useEffect, useState } from 'react'
import { IS_TAURI } from '../../../lib/platform.ts'
import { getAuthToken, webApiUrl } from '../../../lib/api/transport.ts'
import { readPhoto } from '../../../lib/api/photos.ts'

interface ItemPhotoProps {
  /** Data URL (legacy) o nombre de archivo de foto a disco (fase 2). */
  src: string
  alt: string
  className?: string
}

/**
 * Muestra una foto de ítem.
 * - Data URL legacy: se muestra directo.
 * - Archivo a disco (fase 2): en web se descarga con el Bearer del API (el
 *   `<img>` no puede mandar headers) y se muestra como blob URL; en desktop se
 *   lee del disco vía IPC.
 */
export default function ItemPhoto({ src, alt, className }: ItemPhotoProps) {
  const isData = src.startsWith('data:')
  const [resolved, setResolved] = useState<string | null>(isData ? src : null)

  useEffect(() => {
    if (isData || resolved) return
    let cancelled = false
    let objectUrl: string | null = null
    const cleanup = () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    if (IS_TAURI) {
      readPhoto(src)
        .then((url) => {
          if (!cancelled) setResolved(url)
        })
        .catch(() => {
          /* foto sin archivo: no se muestra */
        })
    } else {
      const token = getAuthToken()
      fetch(webApiUrl('/api/photos/' + encodeURIComponent(src)), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob && !cancelled) {
            objectUrl = URL.createObjectURL(blob)
            setResolved(objectUrl)
          }
        })
        .catch(() => {
          /* sin red: no se muestra */
        })
    }
    return cleanup
  }, [src, isData, resolved])

  if (!resolved) return null
  return <img src={resolved} alt={alt} className={className} />
}
