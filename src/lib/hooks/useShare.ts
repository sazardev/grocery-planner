import { useCallback, useState } from 'react'

export type ShareResult = 'idle' | 'copied' | 'error'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
}

/**
 * Comparte contenido usando la Web Share API; si no está disponible
 * (escritorio/HTTP), copia el texto al portapapeles.
 */
export function useShare() {
  const [result, setResult] = useState<ShareResult>('idle')

  const share = useCallback(async ({ title, text, url }: SharePayload) => {
    const nav = navigator as Navigator & {
      share?: (data: SharePayload) => Promise<void>
    }
    try {
      if (nav.share) {
        await nav.share({ title, text, url })
        setResult('idle')
        return
      }
      const copyText = [text, url].filter(Boolean).join('\n')
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(copyText)
        setResult('copied')
      } else {
        setResult('error')
      }
    } catch {
      setResult('error')
    }
  }, [])

  const reset = useCallback(() => setResult('idle'), [])

  return { share, result, reset }
}
