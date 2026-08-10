import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import { Stack } from '../shared/ui/index.ts'
import { ArrowLeft } from 'lucide-react'
import styles from './SectionPage.module.css'

interface SectionPageProps {
  title: string
  subtitle?: string
  backTo: string
  backLabel?: string
  children: ReactNode
}

/** Envoltorio de página empujada (DESIGN §10.5): título + botón atrás. */
export default function SectionPage({
  title,
  subtitle,
  backTo,
  backLabel = 'Volver',
  children,
}: SectionPageProps) {
  const navigate = useNavigate()
  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label={backLabel} onClick={() => navigate(backTo)}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <div>
          <Text as="h1" variant="h1">
            {title}
          </Text>
          {subtitle && (
            <Text as="p" variant="note" tone="secondary">
              {subtitle}
            </Text>
          )}
        </div>
      </header>
      {children}
    </Stack>
  )
}
