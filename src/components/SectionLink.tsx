import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, Chip, Stack, Text } from '../shared/ui/index.ts'
import styles from './SectionLink.module.css'

interface SectionLinkProps {
  icon: ReactNode
  title: string
  subtitle?: string
  badge?: number
  onClick: () => void
  children?: ReactNode
}

/** Tarjeta-navegación: un icono, título y subtítulo; al tocarla lleva a su página. */
export default function SectionLink({ icon, title, subtitle, badge, onClick, children }: SectionLinkProps) {
  return (
    <Card interactive padding="lg" onClick={onClick}>
      <Stack gap="3">
        <div className={styles.header}>
          <span className={styles.icon}>{icon}</span>
          <div className={styles.title}>
            <div className={styles.titleRow}>
              <Text variant="section">{title}</Text>
              {badge ? <Chip tone="danger">{badge}</Chip> : null}
            </div>
            {subtitle && (
              <Text variant="note" tone="secondary">
                {subtitle}
              </Text>
            )}
          </div>
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        {children}
      </Stack>
    </Card>
  )
}
