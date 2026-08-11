import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { changeHomeRole, getHome, getPresence, removeHomeMember } from '../../lib/api'
import { ME } from '../../lib/me'
import { ROLE_LABEL, type Role } from '../../domain/home'
import type { PresenceView } from '../../domain/presence'
import Text from '../../shared/ui/primitives/Text.tsx'
import Avatar from '../../shared/ui/primitives/Avatar.tsx'
import Chip from '../../shared/ui/primitives/Chip.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import EmptyState from '../../shared/ui/feedback/EmptyState.tsx'
import Select from '../../shared/ui/form/Select.tsx'
import { Button, Card, Stack } from '../../shared/ui/index.ts'
import { Ban, Users } from 'lucide-react'
import styles from './MembersSection.module.css'

const ROLES: Role[] = ['miembro', 'organizador', 'admin']

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function presenceLabel(p: PresenceView | undefined): { text: string; tone: 'default' | 'muted' | 'warning' } {
  if (!p) return { text: 'desconectado', tone: 'muted' }
  if (p.online && p.screen === 'mandado') return { text: 'en el mandado', tone: 'warning' }
  if (p.online) return { text: 'en línea', tone: 'default' }
  const mins = Math.max(0, Math.floor((Date.now() - new Date(p.lastSeen).getTime()) / 60_000))
  if (mins < 60) return { text: `hace ${mins} min`, tone: 'muted' }
  const hours = Math.floor(mins / 60)
  if (hours < 24) return { text: `hace ${hours} h`, tone: 'muted' }
  return { text: 'desconectado', tone: 'muted' }
}

/** Quiénes integran el hogar, sus roles, su última conexión y expulsión (solo Admin). */
export default function MembersSection() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmKick, setConfirmKick] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: home, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    retry: false,
  })

  const presence = useQuery({
    queryKey: ['home', 'presence'],
    queryFn: getPresence,
    refetchInterval: 15_000,
  })
  const byName = new Map((presence.data ?? []).map((p) => [p.name, p]))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['home'] })

  const roleMutation = useMutation({
    mutationFn: ({ name, role }: { name: string; role: Role }) =>
      changeHomeRole(name, role, ME),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo cambiar el rol')),
  })

  const kickMutation = useMutation({
    mutationFn: (name: string) => removeHomeMember(name, ME),
    onSuccess: () => {
      invalidate()
      setConfirmKick(null)
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo expulsar al miembro')),
  })

  if (isLoading) return <Skeleton variant="rect" height={160} />
  if (!home) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<Users size={28} strokeWidth={2} aria-hidden="true" />}
          title="Aún no hay hogar"
          description="Crea el hogar de tu familia en Ajustes para empezar."
          action={
            <Button variant="secondary" onClick={() => navigate('/settings')}>
              Ir a Ajustes
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card padding="lg">
      <Stack gap="3">
        <div className={styles.line}>
          <Text as="h2" variant="section">
            <Users size={18} aria-hidden="true" /> Miembros
          </Text>
          <Chip tone="default">{home.members.length}</Chip>
        </div>
        <Text as="p" variant="note" tone="secondary">
          Quiénes están en «{home.name}» y qué rol tienen.
        </Text>

        {error && <Alert tone="danger">{error}</Alert>}

        <Stack gap="2">
          {home.members.map((m) => (
            <div key={m.name} className={styles.memberRow}>
              <span className={styles.member}>
                <Avatar name={m.name} size="sm" />
                <Text variant="item">{m.name}</Text>
                {m.name === ME && <Chip tone="default">eres tú</Chip>}
                <Chip tone={presenceLabel(byName.get(m.name)).tone}>
                  {presenceLabel(byName.get(m.name)).text}
                </Chip>
              </span>
              <div className={styles.memberActions}>
                <Select
                  aria-label={`Rol de ${m.name}`}
                  value={m.role}
                  onChange={(e) => roleMutation.mutate({ name: m.name, role: e.target.value as Role })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
                {m.name !== ME &&
                  (confirmKick === m.name ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => kickMutation.mutate(m.name)}
                    >
                      ¿Seguro?
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Ban size={14} strokeWidth={2} />}
                      onClick={() => setConfirmKick(m.name)}
                    >
                      Expulsar
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </Stack>
      </Stack>
    </Card>
  )
}
