import { useEffect, useState } from 'react'
import { Sparkles, ChevronRight, X, ArrowUp, ArrowDown } from 'lucide-react'
import { useOnboarding } from './onboarding.ts'
import { tooltipPlacement } from './tourSteps.ts'
import Button from '../../shared/ui/primitives/Button.tsx'
import IconButton from '../../shared/ui/primitives/IconButton.tsx'
import Text from '../../shared/ui/primitives/Text.tsx'
import Chip from '../../shared/ui/primitives/Chip.tsx'
import ProgressBar from '../../shared/ui/primitives/ProgressBar.tsx'
import { Card, Stack } from '../../shared/ui/index.ts'
import styles from './TourOverlay.module.css'

/**
 * Superposición del tour: oscurece el resto, "recorta" un spotlight sobre el
 * elemento real de la página y muestra una tarjeta-tooltip con componentes del
 * design system. Todo animado (spotlight, anillo de atención, tarjeta, check).
 */
export default function TourOverlay() {
  const { active, step, next, stop } = useOnboarding()
  const [entered, setEntered] = useState(false)

  // Re-anima la tarjeta en cada paso.
  useEffect(() => {
    if (!active || !step) return
    setEntered(false)
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [active, step])

  // Tecla Escape para salir.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
      if (e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, stop, next])

  if (!active || !step) return null

  const { rect, step: def, index, total } = step
  const placement = tooltipPlacement(rect)
  const last = index === total - 1

  const spotlightStyle: React.CSSProperties = rect
    ? {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    : { left: '50%', top: '40%', transform: 'translateX(-50%)' }

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Guía de Grocery Planner">
      {/* Spotlight recortado sobre el elemento real */}
      <div className={styles.spotlight} style={spotlightStyle} />
      <div className={`${styles.ring} ${entered ? styles.ringIn : ''}`} style={spotlightStyle} />

      {/* Tarjeta del paso */}
      <div
        className={`${styles.card} ${placement === 'top' ? styles.cardTop : styles.cardBottom} ${entered ? styles.cardIn : ''}`}
        style={
          rect
            ? placement === 'top'
              ? { bottom: `calc(100vh - ${rect.top}px + 12px)` }
              : { top: `calc(${rect.bottom}px + 12px)` }
            : {}
        }
      >
        <Card padding="lg">
          <Stack gap="3">
            <div className={styles.cardHead}>
              <Chip tone="default">
                <Sparkles size={14} strokeWidth={2} aria-hidden="true" /> {def.tag ?? 'Guía'}
              </Chip>
              <IconButton label="Cerrar la guía" onClick={stop} variant="ghost">
                <X size={18} strokeWidth={2} />
              </IconButton>
            </div>
            <div>
              <Text as="h2" variant="section">
                {def.title}
              </Text>
              <Text as="p" variant="body" tone="secondary">
                {def.body}
              </Text>
            </div>
            <ProgressBar value={index + 1} max={total} showValue label={`Paso ${index + 1} de ${total}`} />
            <div className={styles.cardActions}>
              <Button variant="ghost" size="sm" onClick={stop}>
                Omitir
              </Button>
              <Button size="sm" onClick={next} iconRight={!last ? <ChevronRight size={16} strokeWidth={2} /> : undefined}>
                {last ? '¡Entendido!' : 'Siguiente'}
              </Button>
            </div>
          </Stack>
        </Card>
      </div>

      {/* Flecha que apunta al elemento */}
      {rect && (
        <div className={`${styles.arrow} ${placement === 'top' ? styles.arrowTop : styles.arrowBottom} ${entered ? styles.arrowIn : ''}`}>
          {placement === 'top' ? <ArrowDown size={20} strokeWidth={2.5} aria-hidden="true" /> : <ArrowUp size={20} strokeWidth={2.5} aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
