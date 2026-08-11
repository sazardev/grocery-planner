import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addAisle,
  addStore,
  getRules,
  removeAisle,
  removeStore,
  renameStore,
} from '../../lib/api'
import { ME } from '../../lib/me'
import Text from '../../shared/ui/primitives/Text.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Chip from '../../shared/ui/primitives/Chip.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Button, Card, Input, Stack } from '../../shared/ui/index.ts'
import { Store } from 'lucide-react'
import styles from './StoresSection.module.css'

const RULES_KEY = ['rules']

export default function StoresSection() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [aisleName, setAisleName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: rules, isLoading } = useQuery({ queryKey: RULES_KEY, queryFn: getRules })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: RULES_KEY })
    setError(null)
  }

  const addMutation = useMutation({
    mutationFn: () =>
      addStore(name.trim(), aisleName.trim() ? [aisleName.trim()] : [], ME),
    onSuccess: () => {
      setName('')
      setAisleName('')
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo agregar la tienda'),
  })

  const aisleMutation = useMutation({
    mutationFn: ({ storeName, aisle }: { storeName: string; aisle: string }) =>
      addAisle(storeName, aisle, ME),
    onSuccess: () => {
      setAisleName('')
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo agregar el pasillo'),
  })

  const removeAisleMutation = useMutation({
    mutationFn: ({ storeName, aisle }: { storeName: string; aisle: string }) =>
      removeAisle(storeName, aisle, ME),
    onSuccess: invalidate,
  })

  const removeStoreMutation = useMutation({
    mutationFn: (name: string) => removeStore(name, ME),
    onSuccess: invalidate,
  })

  const renameMutation = useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      renameStore(name, newName, ME),
    onSuccess: invalidate,
  })

  if (isLoading) return <Skeleton variant="rect" height={160} />
  if (!rules) return null

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <Store size={18} aria-hidden="true" /> Tiendas y pasillos
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Las tiendas donde hace el mandado la familia y sus pasillos.
        </Text>

        {error && <Alert tone="danger" title="No se pudo guardar">{error}</Alert>}

        <div className={styles.addRow}>
          <Input
            label="Tienda"
            placeholder="Walmart, frutería…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nombre de la tienda"
          />
          <Input
            label="Pasillo (opcional)"
            placeholder="lácteos"
            value={aisleName}
            onChange={(e) => setAisleName(e.target.value)}
            aria-label="Pasillo inicial"
          />
          <Button onClick={() => addMutation.mutate()} loading={addMutation.isPending} disabled={!name.trim()}>
            Agregar
          </Button>
        </div>

        {rules.stores.length === 0 ? (
          <Text variant="note" tone="secondary">
            Aún no hay tiendas guardadas.
          </Text>
        ) : (
          rules.stores.map((store) => (
            <Stack key={store.name} gap="1">
              <div className={styles.storeLine}>
                <Text weight="medium">{store.name}</Text>
                <div className={styles.actions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = window.prompt('Nuevo nombre de la tienda', store.name)
                      if (next?.trim()) renameMutation.mutate({ name: store.name, newName: next.trim() })
                    }}
                  >
                    Renombrar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStoreMutation.mutate(store.name)}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
              {store.aisles.length > 0 && (
                <div className={styles.aisles}>
                  {store.aisles.map((aisle) => (
                    <Chip
                      key={aisle}
                      tone="default"
                      onClick={() => removeAisleMutation.mutate({ storeName: store.name, aisle })}
                    >
                      {aisle} ×
                    </Chip>
                  ))}
                </div>
              )}
              <div className={styles.addAisle}>
                <Input
                  size="md"
                  placeholder="Agregar pasillo…"
                  value={aisleName}
                  onChange={(e) => setAisleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && aisleName.trim()) {
                      aisleMutation.mutate({ storeName: store.name, aisle: aisleName.trim() })
                    }
                  }}
                  aria-label={`Pasillo para ${store.name}`}
                />
              </div>
            </Stack>
          ))
        )}
      </Stack>
    </Card>
  )
}
