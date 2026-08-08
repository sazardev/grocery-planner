import { Share2, Check, Copy } from 'lucide-react'
import Button from '../primitives/Button.tsx'
import { useShare } from '../../../lib/hooks/useShare.ts'

interface ShareButtonProps {
  title: string
  text: string
  url: string
  variant?: 'primary' | 'secondary' | 'ghost'
  full?: boolean
}

export default function ShareButton({
  title,
  text,
  url,
  variant = 'secondary',
  full = false,
}: ShareButtonProps) {
  const { share, result, reset } = useShare()

  const label =
    result === 'copied' ? '¡Enlace copiado!' : result === 'error' ? 'No se pudo compartir' : 'Compartir'

  const icon =
    result === 'copied' ? (
      <Check size={16} strokeWidth={2} />
    ) : result === 'error' ? (
      <Copy size={16} strokeWidth={2} />
    ) : (
      <Share2 size={16} strokeWidth={2} />
    )

  return (
    <Button
      variant={variant}
      full={full}
      iconLeft={icon}
      onClick={() => {
        reset()
        void share({ title, text, url })
      }}
      onBlur={reset}
    >
      {label}
    </Button>
  )
}
