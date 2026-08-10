import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createItem, parseQuickEntry } from '../lib/api'
import { ME } from '../lib/me'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Input from '../shared/ui/form/Input.tsx'
import Field from '../shared/ui/form/Field.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import styles from './NewItemPage.module.css'

const ITEMS_KEY = ['items']

export default function NewItemPage() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('¿Qué falta? Agregar · Grocery Planner')

  const addMutation = useMutation({
    mutationFn: async (value: string) => {
      const parsed = await parseQuickEntry(value)
      return createItem({ ...parsed, priority: 'media', requestedBy: ME })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      navigate('/', { replace: true })
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'No se pudo agregar el ítem'),
  })

  const submit = () => {
    const value = text.trim()
    if (!value) return
    setError(null)
    addMutation.mutate(value)
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a la lista" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          ¿Qué falta?
        </Text>
      </header>

      <Card padding="lg">
        <Stack gap="3">
          <Text as="p" variant="note" tone="secondary">
            Escribe y se agrega al instante (ej. “pollo 2kg”, “leche 1 l”).
          </Text>
          <Field label="Qué falta">
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="leche 1 l, arroz 2kg…"
              disabled={addMutation.isPending}
              aria-label="Qué falta"
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={goBack}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={addMutation.isPending}>
              Agregar
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  )
}
