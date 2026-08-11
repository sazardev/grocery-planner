import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api'
import { ME } from '../lib/me'
import { NOTIFICATION_KIND_LABEL } from '../domain/notification'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { Button, Card, EmptyState, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { formatDateTime } from '../lib/dates.ts'
import { Bell, ArrowLeft } from 'lucide-react'
import styles from './NotificationsPage.module.css'

const NOTIF_KEY = ['notifications']

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useDocumentTitle('Avisos · Grocery Planner')

  const { data = [], isLoading } = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: () => listNotifications(ME),
    refetchInterval: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NOTIF_KEY })
    // El badge de la nav y el preview de Familia también deben actualizarse.
    queryClient.invalidateQueries({ queryKey: ['notif-unread'] })
    queryClient.invalidateQueries({ queryKey: ['family', 'notifs'] })
  }

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, ME),
    onSuccess: invalidate,
  })

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(ME),
    onSuccess: invalidate,
  })

  const unread = data.filter((n) => !n.read)

  return (
    <Stack gap="4">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <IconButton label="Volver a la familia" onClick={() => navigate('/family')}>
            <ArrowLeft size={22} strokeWidth={2} />
          </IconButton>
          <Text as="h1" variant="h1">
            Avisos
          </Text>
        </div>
        <Text as="p" variant="note" tone="secondary">
          Lo que le importa a tu familia: asignaciones, urgencias, mandados y menciones.
        </Text>
        <div className={styles.actions}>
          <Chip tone={unread.length > 0 ? 'default' : 'muted'}>{unread.length} sin leer</Chip>
          <Button variant="ghost" size="sm" onClick={() => readAllMutation.mutate()}>
            Marcar todo como leído
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
            Configurar avisos
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Stack gap="2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rect" height={76} />
          ))}
        </Stack>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} strokeWidth={2} aria-hidden="true" />}
          title="Sin avisos por ahora"
          description="Cuando alguien te asigne algo o te mencione, lo verás aquí."
        />
      ) : (
        <Stack gap="2">
          {data.map((n) => (
            <Card
              key={n.id}
              interactive
              padding="md"
              onClick={() => {
                if (!n.read) readMutation.mutate(n.id)
                if (n.link) navigate(n.link)
              }}
            >
              <div className={styles.notifRow}>
                <span
                  className={`${styles.dot} ${n.read ? styles.dotRead : ''}`}
                  aria-hidden="true"
                />
                <Stack gap="0" className={styles.notifBody}>
                  <div className={styles.notifTitle}>
                    <Text weight="medium">{n.title}</Text>
                    <Chip tone="muted">{NOTIFICATION_KIND_LABEL[n.kind]}</Chip>
                  </div>
                  <Text variant="note" tone="secondary">
                    {n.body}
                  </Text>
                  <Text variant="note" tone="tertiary">
                    {formatDateTime(n.at)}
                  </Text>
                </Stack>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
