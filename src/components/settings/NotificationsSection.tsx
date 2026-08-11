import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotificationSettings, updateNotificationSettings } from '../../lib/api'
import { ME } from '../../lib/me'
import type { NotificationSettings } from '../../domain/rules'
import { EVENT_TYPE_LABEL, type EventType } from '../../domain/event'
import Text from '../../shared/ui/primitives/Text.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import Chip from '../../shared/ui/primitives/Chip.tsx'
import { Button, Card, Input, Stack, Switch } from '../../shared/ui/index.ts'
import { BellRing } from 'lucide-react'

const SETTINGS_KEY = ['notif-settings', ME]

const SWITCHES: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'onAssigned', label: 'Cuando me asignan algo' },
  { key: 'onUrgent', label: 'Cuando piden algo urgente' },
  { key: 'onTripStarted', label: 'Cuando alguien empieza el mandado' },
  { key: 'onArrival', label: 'Cuando llega el mandado' },
  { key: 'onMention', label: 'Cuando me mencionan (@María)' },
  { key: 'onEventReminder', label: 'Recordatorios de eventos' },
  { key: 'onProjection', label: 'Proyección de faltas' },
  { key: 'dailySummary', label: 'Resumen diario (lo que falta hoy)' },
  { key: 'weeklySummary', label: 'Resumen semanal (lo que faltará)' },
]

const EVENT_TYPES: EventType[] = ['cumpleanos', 'union', 'comida', 'celebracion', 'reunion', 'mandado']

export default function NotificationsSection() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: settings, isLoading } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => getNotificationSettings(ME),
  })

  const update = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      updateNotificationSettings(ME, { ...(settings ?? {}), ...patch } as NotificationSettings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })

  if (isLoading) return <Skeleton variant="rect" height={200} />
  if (!settings) return null

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <BellRing size={18} aria-hidden="true" /> Tus avisos
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Qué notificaciones quieres recibir (los avisos viven dentro de la app, sin correos).
        </Text>
        <Button variant="secondary" size="sm" onClick={() => navigate('/notifications')}>
          Ver avisos ahora
        </Button>

        {update.isError && <Alert tone="danger">No se pudo guardar tu configuración.</Alert>}

        <Stack gap="3">
          {SWITCHES.map(({ key, label }) => (
            <Switch
              key={key}
              checked={Boolean(settings[key])}
              label={label}
              onChange={(v) => update.mutate({ [key]: v })}
            />
          ))}
        </Stack>

        {settings.dailySummary && (
          <Input
            type="time"
            label="Hora del resumen diario"
            value={settings.dailySummaryHour ?? ''}
            onChange={(e) => update.mutate({ dailySummaryHour: e.target.value || undefined })}
          />
        )}
        {settings.weeklySummary && (
          <Input
            type="time"
            label="Hora del resumen semanal"
            value={settings.weeklySummaryHour ?? ''}
            onChange={(e) => update.mutate({ weeklySummaryHour: e.target.value || undefined })}
          />
        )}

        <div className="switchRow" style={{ display: 'flex', gap: 'var(--gp-space-3)' }}>
          <Input
            type="time"
            label="No molestar desde"
            value={settings.silentFrom ?? ''}
            onChange={(e) =>
              update.mutate({ silentFrom: e.target.value || undefined })
            }
          />
          <Input
            type="time"
            label="No molestar hasta"
            value={settings.silentTo ?? ''}
            onChange={(e) =>
              update.mutate({ silentTo: e.target.value || undefined })
            }
          />
        </div>

        <Stack gap="2">
          <Text as="p" variant="note" tone="secondary">
            Recibir recordatorios de (vacío = todos):
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gp-space-2)' }}>
            {EVENT_TYPES.map((t) => {
              const active = settings.eventTypes.length === 0 || settings.eventTypes.includes(t)
              return (
                <Chip
                  key={t}
                  tone={active ? 'default' : 'muted'}
                  onClick={() => {
                    const next = active
                      ? settings.eventTypes.filter((x) => x !== t)
                      : [...settings.eventTypes, t]
                    update.mutate({ eventTypes: next })
                  }}
                >
                  {EVENT_TYPE_LABEL[t]}
                </Chip>
              )
            })}
          </div>
        </Stack>
      </Stack>
    </Card>
  )
}
