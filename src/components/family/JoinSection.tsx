import { Card, EmptyState, Stack } from '../../shared/ui/index.ts'
import Text from '../../shared/ui/primitives/Text.tsx'
import { Link2 } from 'lucide-react'

/** Unirse con invitación: por ahora vacío (ya estás dentro del hogar). */
export default function JoinSection() {
  return (
    <Card padding="lg">
      <Stack gap="2">
        <Text as="h2" variant="section">
          <Link2 size={18} aria-hidden="true" /> Unirse con invitación
        </Text>
        <EmptyState
          icon={<Link2 size={28} strokeWidth={2} aria-hidden="true" />}
          title="Ya eres parte del hogar"
          description="El flujo de unirse con un código aplica cuando creas una cuenta nueva y alguien te comparte la invitación de la familia."
        />
      </Stack>
    </Card>
  )
}
