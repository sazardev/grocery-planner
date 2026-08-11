import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { changeItemStatus, presenceHeartbeat, queryItems } from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import { Button } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { usePresenceLeave } from '../lib/hooks/usePresenceLeave.ts'
import { LogOut, Plus } from 'lucide-react'
import styles from './KioskPage.module.css'

export default function KioskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useDocumentTitle('Quiosco · Grocery Planner')
  usePresenceLeave(ME)

  const { data: items = [] } = useQuery({
    queryKey: ['kiosk', 'items'],
    queryFn: () => queryItems({ sort: 'priority' }),
    refetchInterval: 10_000,
  })

  const presence = useQuery({
    queryKey: ['kiosk', 'presence'],
    queryFn: () => presenceHeartbeat(ME),
    refetchInterval: 10_000,
  })
  const online = (presence.data ?? []).filter((p) => p.online)

  const toggleMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: GroceryItem['status'] }) =>
      changeItemStatus(id, to, ME),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kiosk'] }),
  })

  const pending = items.filter((i) => i.status !== 'comprado' && i.status !== 'cancelado')
  const carried = items.filter((i) => i.status === 'llevo')

  return (
    <main className={styles.kiosk}>
      <button
        type="button"
        className={styles.exit}
        onClick={() => navigate('/home')}
        aria-label="Salir del quiosco"
      >
        <LogOut size={20} strokeWidth={2} aria-hidden="true" />
        Salir
      </button>
      <header className={styles.header}>
        <div>
          <Text as="h1" variant="display" className={styles.title}>
            ¿Qué falta en casa?
          </Text>
          <Text variant="body" tone="secondary">
            {pending.length} pendientes · {carried.length} en el carrito
          </Text>
        </div>
        <div className={styles.presence}>
          {online.length === 0 ? (
            <Chip tone="muted">Nadie conectado</Chip>
          ) : (
            online.map((p) => (
              <span key={p.name} className={styles.user}>
                <Avatar name={p.name} size="md" />
                <Text variant="body" className={styles.userName}>
                  {p.name}
                </Text>
              </span>
            ))
          )}
        </div>
      </header>

      <Button
        size="xl"
        full
        className={styles.bigBtn}
        onClick={() => navigate('/items/new')}
      >
        <Plus size={32} strokeWidth={2.5} aria-hidden="true" /> Falta…
      </Button>

      <ul className={styles.list}>
        {pending.map((item) => (
          <li key={item.id} className={styles.row}>
            <button
              type="button"
              className={styles.check}
              onClick={() =>
                toggleMutation.mutate({
                  id: item.id,
                  to: item.status === 'llevo' ? 'falta' : 'llevo',
                })
              }
              aria-label={item.status === 'llevo' ? `Quitar ${item.name} del carrito` : `Ya llevo ${item.name}`}
            >
              {item.status === 'llevo' ? '✓' : ''}
            </button>
            <button
              type="button"
              className={styles.rowBody}
              onClick={() => navigate(`/items/${item.id}`)}
            >
              <span className={styles.name}>{item.name}</span>
              <span className={styles.qty}>
                {item.quantity} {item.unit}
              </span>
            </button>
            {item.status === 'llevo' && <Chip tone="default">en el carrito</Chip>}
          </li>
        ))}
      </ul>
    </main>
  )
}
