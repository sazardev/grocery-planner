import { useGoBack } from '../lib/hooks/useGoBack.ts'
import Text from '../shared/ui/primitives/Text.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { Stack } from '../shared/ui/index.ts'
import RulesSection from '../components/settings/RulesSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { ArrowLeft } from 'lucide-react'
import styles from './RulesPage.module.css'

export default function RulesPage() {
  const goBack = useGoBack('/')
  useDocumentTitle('Reglas de la familia · Grocery Planner')

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          Reglas de la familia
        </Text>
      </header>
      <RulesSection />
    </Stack>
  )
}
