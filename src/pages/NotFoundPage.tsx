import { useNavigate } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import { Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function NotFoundPage() {
  const navigate = useNavigate()
  useDocumentTitle('Página no encontrada · Grocery Planner')

  return (
    <Stack gap="4">
      <EmptyState
        icon={<SearchX size={28} strokeWidth={2} aria-hidden="true" />}
        title="Página no encontrada"
        description="Esa dirección no existe en Grocery Planner."
      />
      <Button variant="secondary" full onClick={() => navigate('/home')}>
        Volver a la lista
      </Button>
    </Stack>
  )
}
