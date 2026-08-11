import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getTimeline,
  listEventsInRange,
  listNotifications,
  listPlans,
  presenceHeartbeat,
} from '../lib/api'
import { ME } from '../lib/me'
import { NOTIFICATION_KIND_LABEL } from '../domain/notification'
import type { AppNotification } from '../domain/notification'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { EmptyState, Stack } from '../shared/ui/index.ts'
import SectionLink from '../components/SectionLink.tsx'
import PresenceStrip from '../components/PresenceStrip.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { usePresenceLeave } from '../lib/hooks/usePresenceLeave.ts'
import {
  addDays,
  formatDate,
  formatDateTime,
  localWindowRangeISO,
  todayISO,
} from '../lib/dates.ts'
import {
  Bell,
  CalendarDays,
  History,
  Link2,
  Settings2,
  UserPlus,
  Users,
} from 'lucide-react'
import styles from './FamilyPage.module.css'

export default function FamilyPage() {
  const navigate = useNavigate()
  useDocumentTitle('Familia · Grocery Planner')
  usePresenceLeave(ME)

  const eventsQuery = useQuery({
    queryKey: ['family', 'events'],
    queryFn: () => listEventsInRange(todayISO(), addDays(todayISO(), 30)),
    refetchInterval: 15_000,
  })
  const plansQuery = useQuery({ queryKey: ['family', 'plans'], queryFn: listPlans, refetchInterval: 15_000 })
  const notifsQuery = useQuery({
    queryKey: ['family', 'notifs'],
    queryFn: () => listNotifications(ME),
    refetchInterval: 20_000,
  })
  const timelineQuery = useQuery({
    queryKey: ['family', 'timeline'],
    queryFn: () => {
      const range = localWindowRangeISO(addDays(todayISO(), -7), todayISO())
      return getTimeline(range.start, range.end)
    },
    refetchInterval: 20_000,
  })
  const presence = useQuery({
    queryKey: ['family', 'presence'],
    queryFn: () => presenceHeartbeat(ME),
    refetchInterval: 15_000,
  })

  const presenceUsers = presence.data ?? []
  const online = presenceUsers.filter((p) => p.online)

  const upcoming = useMemo(() => {
    const today = todayISO()
    const items: { title: string; date: string; href: string }[] = [
      ...(eventsQuery.data ?? [])
        .filter((e) => e.date >= today)
        .map((e) => ({ title: e.title, date: e.date, href: `/events/${e.id}` })),
      ...(plansQuery.data ?? [])
        .filter((p) => p.scheduledAt.slice(0, 10) >= today)
        .map((p) => ({
          title: p.title,
          date: p.scheduledAt.slice(0, 10),
          href: `/plans/${p.id}`,
        })),
    ]
    items.sort((a, b) => a.date.localeCompare(b.date))
    return items.slice(0, 3)
  }, [eventsQuery.data, plansQuery.data])

  const recent = useMemo(() => {
    const entries = [...(timelineQuery.data ?? [])]
    return entries
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 3)
  }, [timelineQuery.data])

  const notifications: AppNotification[] = notifsQuery.data ?? []
  const unread = notifications.filter((n) => !n.read)
  const notifPreview = [...unread].concat(notifications.filter((n) => n.read)).slice(0, 3)

  return (
    <Stack gap="6">
      <header>
        <div className={styles.headerRow}>
          <div>
            <Text as="h1" variant="h1">
              Familia
            </Text>
            <Text as="p" variant="note" tone="secondary">
              El día a día del hogar: qué viene, qué pasó y quién está conectado.
            </Text>
          </div>
          <Users size={24} strokeWidth={2} aria-hidden="true" />
        </div>
        {online.length > 0 && (
          <div className={styles.presence}>
            <PresenceStrip users={presenceUsers} />
          </div>
        )}
      </header>

      <SectionLink
        icon={<CalendarDays size={22} strokeWidth={2} aria-hidden="true" />}
        title="Calendario"
        subtitle="Eventos, planes y mandados"
        onClick={() => navigate('/calendar')}
      >
        {eventsQuery.isLoading ? (
          <Skeleton variant="rect" height={48} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Nada próximo"
            description="No hay eventos ni planes en los próximos 30 días."
          />
        ) : (
          <Stack gap="1">
            {upcoming.map((u) => (
              <div key={`${u.href}`} className={styles.miniRow}>
                <Text variant="note" tone="secondary" className={styles.miniDate}>
                  {formatDate(u.date)}
                </Text>
                <Text variant="item" truncate>
                  {u.title}
                </Text>
              </div>
            ))}
          </Stack>
        )}
      </SectionLink>

      <SectionLink
        icon={<History size={22} strokeWidth={2} aria-hidden="true" />}
        title="Historial"
        subtitle="Lo que ha pasado esta semana"
        onClick={() => navigate('/history')}
      >
        {timelineQuery.isLoading ? (
          <Skeleton variant="rect" height={48} />
        ) : recent.length === 0 ? (
          <EmptyState
            title="Sin actividad"
            description="Compras, mandados y comentarios aparecerán aquí."
          />
        ) : (
          <Stack gap="1">
            {recent.map((r, i) => (
              <Text key={`${r.at}-${i}`} variant="note" tone="secondary" truncate>
                {formatDateTime(r.at)} · {r.title}
              </Text>
            ))}
          </Stack>
        )}
      </SectionLink>

      <SectionLink
        icon={<Bell size={22} strokeWidth={2} aria-hidden="true" />}
        title="Avisos"
        subtitle={
          unread.length > 0 ? `${unread.length} sin leer` : 'Nada pendiente por ahora'
        }
        badge={unread.length}
        onClick={() => navigate('/notifications')}
      >
        {notifsQuery.isLoading ? (
          <Skeleton variant="rect" height={48} />
        ) : notifications.length === 0 ? (
          <EmptyState
            title="Sin avisos"
            description="Asignaciones, urgencias y menciones aparecerán aquí."
          />
        ) : (
          <Stack gap="1">
            {notifPreview.map((n) => (
              <div key={n.id} className={styles.miniRow}>
                <Chip tone={n.read ? 'muted' : 'default'}>
                  {NOTIFICATION_KIND_LABEL[n.kind]}
                </Chip>
                <Text variant="note" truncate tone={n.read ? 'secondary' : 'default'}>
                  {n.title}
                </Text>
              </div>
            ))}
          </Stack>
        )}
      </SectionLink>

      <Text as="h2" variant="section">
        La familia
      </Text>
      <SectionLink
        icon={<Users size={22} strokeWidth={2} aria-hidden="true" />}
        title="Miembros"
        subtitle="Quiénes integran el hogar y su rol"
        onClick={() => navigate('/family/members')}
      />
      <SectionLink
        icon={<UserPlus size={22} strokeWidth={2} aria-hidden="true" />}
        title="Invitar a la familia"
        subtitle="Suma a alguien con un código corto"
        onClick={() => navigate('/family/invite')}
      />
      <SectionLink
        icon={<Link2 size={22} strokeWidth={2} aria-hidden="true" />}
        title="Unirse con invitación"
        subtitle="Acepta un código para entrar al hogar"
        onClick={() => navigate('/family/join')}
      />
      <SectionLink
        icon={<Settings2 size={22} strokeWidth={2} aria-hidden="true" />}
        title="Reglas de la familia"
        subtitle="Tiendas, pasillos, unidades y privacidad"
        onClick={() => navigate('/rules')}
      />
    </Stack>
  )
}
