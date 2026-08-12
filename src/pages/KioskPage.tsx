import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { changeItemStatus, getHostMode, presenceHeartbeat, queryItems } from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { useAuth } from '../lib/auth/useAuth.ts'
import { Button, Card, Input, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { usePresenceLeave } from '../lib/hooks/usePresenceLeave.ts'
import { KeyRound, LogOut, Plus } from 'lucide-react'
import styles from './KioskPage.module.css'

export default function KioskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status, hostSignIn } = useAuth()
  const [hostKey, setHostKey] = useState('')
  const [hostError, setHostError] = useState<string | null>(null)
  const [hostBusy, setHostBusy] = useState(false)
  useDocumentTitle('Quiosco · Grocery Planner')

  // Todos los hooks se llaman de forma incondicional (reglas de React).
  usePresenceLeave(status === 'authenticated' ? ME : '')
  const hostModeQuery = useQuery({
    queryKey: ['host-mode'],
    queryFn: getHostMode,
    enabled: status !== 'authenticated',
    retry: false,
    refetchInterval: 15_000,
  })
  const { data: items = [] } = useQuery({
    queryKey: ['kiosk', 'items'],
    queryFn: () => queryItems({ sort: 'priority' }),
    refetchInterval: 20_000,
    enabled: status === 'authenticated',
  })
  const presence = useQuery({
    queryKey: ['kiosk', 'presence'],
    queryFn: () => presenceHeartbeat(ME),
    refetchInterval: 20_000,
    enabled: status === 'authenticated',
  })
  const online = (presence.data ?? []).filter((p) => p.online)

  const rulesQuery = useQuery({
    queryKey: ['rules'],
    queryFn: () => import('../lib/api').then((m) => m.getRules()),
    staleTime: 30_000,
    enabled: status === 'authenticated',
  })
  // Modo host pausado cuando hay visita (SPEC §2.3): si la familia marcó
  // hostPauseWithVisitors, el quiosco se pausa cuando hay otra persona conectada.
  const othersOnline = online.filter((p) => p.name !== ME).length
  const paused =
    (rulesQuery.data?.hostPauseWithVisitors ?? false) && othersOnline > 0

  const toggleMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: GroceryItem['status'] }) =>
      changeItemStatus(id, to, ME),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['mine'] })
    },
  })

  if (status === 'loading') {
    return (
      <main className={styles.kiosk}>
        <Text variant="body" tone="secondary">Cargando…</Text>
      </main>
    )
  }

  if (status !== 'authenticated') {
    if (hostModeQuery.isLoading) {
      return (
        <main className={styles.kiosk}>
          <Text variant="body" tone="secondary">Cargando…</Text>
        </main>
      )
    }
    if (!hostModeQuery.data?.hostMode) {
      return (
        <main className={styles.kiosk}>
          <Button onClick={() => navigate('/login')}>Entrar con tu cuenta</Button>
        </main>
      )
    }
    const submit = async () => {
      if (!hostKey.trim()) return
      setHostBusy(true)
      setHostError(null)
      try {
        await hostSignIn(hostKey.trim())
      } catch (e) {
        setHostError(e instanceof Error ? e.message : 'Llave incorrecta')
        setHostBusy(false)
      }
    }
    return (
      <main className={styles.kiosk}>
        <Card padding="lg">
          <Stack gap="3">
            <Text as="h1" variant="h1" className={styles.title}>
              Modo host
            </Text>
            <Text as="p" variant="note" tone="secondary">
              El quiosco de la casa entra sin contraseña con la llave que configuró
              el Admin.
            </Text>
            <Input
              value={hostKey}
              onChange={(e) => setHostKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              label="Llave del modo host"
              aria-label="Llave del modo host"
            />
            {hostError && <Alert tone="danger">{hostError}</Alert>}
            <Button onClick={submit} loading={hostBusy} disabled={!hostKey.trim()}>
              <KeyRound size={16} strokeWidth={2} aria-hidden="true" /> Entrar al quiosco
            </Button>
          </Stack>
        </Card>
      </main>
    )
  }

  const pending = items.filter((i) => i.status !== 'comprado' && i.status !== 'cancelado')
  const carried = items.filter((i) => i.status === 'llevo')

  if (paused) {
    return (
      <main className={styles.kiosk}>
        <header className={styles.header}>
          <Text as="h1" variant="display" className={styles.title}>
            Modo host pausado
          </Text>
          <Text variant="body" tone="secondary">
            Hay alguien más conectado en este momento; el quiosco se pausa por
            privacidad. Se reanuda solo cuando se desconectan.
          </Text>
        </header>
      </main>
    )
  }

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
                {p.screen === 'mandado' && <Chip tone="default">mandado</Chip>}
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
