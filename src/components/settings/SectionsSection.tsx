import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSection,
  deleteSection,
  listSections,
  moveSection,
  renameSection,
} from '../../lib/api'
import type { Section } from '../../domain/section'
import { ME } from '../../lib/me'
import Text from '../../shared/ui/primitives/Text.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Button, Card, Input, Stack } from '../../shared/ui/index.ts'
import { ListTree, ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import styles from './SectionsSection.module.css'

const SECTIONS_KEY = ['sections']

export default function SectionsSection() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: sections = [], isLoading } = useQuery({
    queryKey: SECTIONS_KEY,
    queryFn: listSections,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: SECTIONS_KEY })
    queryClient.invalidateQueries({ queryKey: ['items'] })
    setError(null)
  }

  const createMutation = useMutation({
    mutationFn: () => createSection(name.trim(), ME),
    onSuccess: () => {
      setName('')
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear la sección'),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      moveSection(id, direction, ME),
    onSuccess: invalidate,
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      renameSection(id, newName, ME),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id, ME),
    onSuccess: invalidate,
  })

  if (isLoading) return <Skeleton variant="rect" height={120} />

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <ListTree size={18} aria-hidden="true" /> Secciones de la lista
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Agrupa la lista para el mandado: Desayunos, Carnes, Limpieza…
        </Text>

        {error && <Alert tone="danger" title="No se pudo guardar">{error}</Alert>}

        <div className={styles.addRow}>
          <Input
            label="Nueva sección"
            placeholder="Desayunos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMutation.mutate()}
            aria-label="Nombre de la sección"
          />
          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!name.trim()}>
            Crear
          </Button>
        </div>

        {sections.length === 0 ? (
          <Text variant="note" tone="secondary">
            Aún no hay secciones.
          </Text>
        ) : (
          sections.map((s: Section, idx: number) => (
            <div key={s.id} className={styles.sectionLine}>
              <Text weight="medium">{s.name}</Text>
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={idx === 0}
                  onClick={() => moveMutation.mutate({ id: s.id, direction: 'up' })}
                  aria-label={`Subir sección ${s.name}`}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={idx === sections.length - 1}
                  onClick={() => moveMutation.mutate({ id: s.id, direction: 'down' })}
                  aria-label={`Bajar sección ${s.name}`}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = window.prompt('Nuevo nombre', s.name)
                    if (next?.trim()) renameMutation.mutate({ id: s.id, newName: next.trim() })
                  }}
                >
                  Renombrar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(s.id)}
                  aria-label={`Borrar sección ${s.name}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Stack>
    </Card>
  )
}
