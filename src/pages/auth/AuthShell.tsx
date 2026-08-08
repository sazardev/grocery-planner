import type { ReactNode } from 'react'
import { Stack } from '../../shared/ui/index.ts'
import Text from '../../shared/ui/primitives/Text.tsx'
import styles from './AuthShell.module.css'

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Stack gap="6" className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} role="img" aria-label="Grocery Planner — ¿Qué falta?">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <title>Grocery Planner</title>
              <rect width="512" height="512" rx="120" fill="#16A34A" />
              <rect x="128" y="120" width="256" height="272" rx="48" fill="#FFFFFF" />
              <rect x="176" y="196" width="132" height="28" rx="14" fill="#BBF7D0" />
              <rect x="176" y="264" width="160" height="24" rx="12" fill="#DCFCE7" />
              <rect x="176" y="320" width="112" height="24" rx="12" fill="#DCFCE7" />
              <circle cx="340" cy="210" r="34" fill="#16A34A" />
              <path d="M326 210l10 10 20-22" fill="none" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <Text as="h1" variant="h2" align="center">
            Grocery Planner
          </Text>
          <Text as="p" variant="note" tone="secondary" align="center">
            La lista de compras de la familia, para todos.
          </Text>
        </div>
        {children}
      </Stack>
    </div>
  )
}
