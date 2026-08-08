import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvitation,
  changeHomeRole,
  createHome,
  createInvitation,
  getHome,
  listSessions,
  removeHomeMember,
  revokeInvitation,
  revokeSession,
} from '../lib/api'
import { ME } from '../lib/me'
import { useAuth } from '../lib/auth/useAuth.ts'
import { ROLE_LABEL, type HomeView, type Role } from '../domain/home'
import type { Session } from '../domain/auth'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import Select from '../shared/ui/form/Select.tsx'
import { Card, Input, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import {
  Home as HomeIcon,
  KeyRound,
  Link2,
  UserPlus,
  Ban,
  LogOut,
  MonitorSmartphone,
} from 'lucide-react'
import styles from './SettingsPage.module.css'

const ROLES: Role[] = ['miembro', 'organizador', 'admin']

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, token, signOut } = useAuth()
  const [homeName, setHomeName] = useState('')
  const [homeError, setHomeError] = useState<string | null>(null)
  const [inviteRole, setInviteRole] = useState<Role>('miembro')
  const [invite, setInvite] = useState<{ code: string; role: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [confirmKick, setConfirmKick] = useState<string | null>(null)
  const [manageError, setManageError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinMessage, setJoinMessage] = useState<string | null>(null)
  useDocumentTitle('Ajustes · Grocery Planner')

  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    retry: false,
  })

  const invalidateHome = () => queryClient.invalidateQueries({ queryKey: ['home'] })

  const createHomeMutation = useMutation({
    mutationFn: (name: string) => createHome(name, ME),
    onSuccess: () => {
      invalidateHome()
      setHomeName('')
      setHomeError(null)
    },
    onError: (err) => setHomeError(errorMessage(err, 'No se pudo crear el hogar')),
  })

  const inviteMutation = useMutation({
    mutationFn: () => createInvitation({ by: ME, roleGranted: inviteRole, maxUses: 3 }),
    onSuccess: (inv) => {
      invalidateHome()
      setInvite({ code: inv.code, role: ROLE_LABEL[inv.roleGranted] })
      setInviteError(null)
    },
    onError: (err) => setInviteError(errorMessage(err, 'No se pudo crear la invitación')),
  })

  const roleMutation = useMutation({
    mutationFn: ({ name, role }: { name: string; role: Role }) =>
      changeHomeRole(name, role, ME),
    onSuccess: () => {
      invalidateHome()
      setManageError(null)
    },
    onError: (err) => setManageError(errorMessage(err, 'No se pudo cambiar el rol')),
  })

  const kickMutation = useMutation({
    mutationFn: (name: string) => removeHomeMember(name, ME),
    onSuccess: () => {
      invalidateHome()
      setConfirmKick(null)
      setManageError(null)
    },
    onError: (err) => setManageError(errorMessage(err, 'No se pudo expulsar al miembro')),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id, ME),
    onSuccess: invalidateHome,
  })

  const joinMutation = useMutation({
    mutationFn: () => acceptInvitation(joinCode.trim(), joinName.trim() || ME),
    onSuccess: (member) => {
      invalidateHome()
      setJoinCode('')
      setJoinName('')
      setJoinMessage(`¡Bienvenido ${member.name}! Ya está dentro del hogar.`)
    },
    onError: (err) => setJoinMessage(errorMessage(err, 'No se pudo aceptar la invitación')),
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => listSessions(token ?? ''),
    enabled: !!token,
    retry: false,
  })

  const sessionRevokeMutation = useMutation({
    mutationFn: (targetToken: string) => revokeSession(token ?? '', targetToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const home: HomeView | undefined = homeQuery.data

  return (
    <Stack gap="6">
      <header>
        <Text as="h1" variant="h1">
          Ajustes
        </Text>
        <Text as="p" variant="note" tone="secondary">
          El hogar de la familia: quién lo integra y cómo invitar a más personas.
        </Text>
      </header>

      <Card padding="lg">
        <Stack gap="3">
          <div className={styles.line}>
            <Text as="h2" variant="section">
              Tu cuenta
            </Text>
            <Chip tone="default">{user?.name ?? ME}</Chip>
          </div>
            <Text as="p" variant="note" tone="secondary">
              Sesión activa de {user?.name ?? ME}
              {user?.homeId ? ' · miembro del hogar' : ' · sin hogar aún'}.
            </Text>
            <Button variant="ghost" size="sm" iconLeft={<LogOut size={16} strokeWidth={2} aria-hidden="true" />} onClick={() => signOut()}>
              Cerrar sesión
            </Button>

            <div className={styles.line}>
              <Text as="h3" variant="section">
                <MonitorSmartphone size={18} aria-hidden="true" /> Dispositivos conectados
              </Text>
              <Chip tone="default">{sessionsQuery.data?.length ?? 0}</Chip>
            </div>
            {sessionsQuery.isLoading ? (
              <Skeleton variant="rect" height={80} />
            ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
              <Stack gap="2">
                {sessionsQuery.data.map((s: Session) => (
                  <div key={s.token} className={styles.line}>
                    <span>
                      <Text variant="item">{s.device}</Text>
                      {s.current && <Chip tone="default">este dispositivo</Chip>}
                      {s.revoked && <Chip tone="danger">cerrada</Chip>}
                    </span>
                    {!s.revoked && !s.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={sessionRevokeMutation.isPending}
                        onClick={() => sessionRevokeMutation.mutate(s.token)}
                      >
                        Cerrar
                      </Button>
                    )}
                  </div>
                ))}
              </Stack>
            ) : (
              <EmptyState
                title="Sin sesiones"
                description="Aquí aparecen los dispositivos con tu sesión abierta."
              />
            )}
          </Stack>
        </Card>

        {homeQuery.isLoading ? (
          <Skeleton variant="rect" height={160} />
        ) : home ? (
          <>
            <Card padding="lg">
              <Stack gap="3">
                <div className={styles.line}>
                  <Text as="h2" variant="section">
                    <HomeIcon size={18} aria-hidden="true" /> {home.name}
                  </Text>
                  <Chip tone="default">{home.members.length} miembros</Chip>
                </div>

              {manageError && <Alert tone="danger">{manageError}</Alert>}

              <Stack gap="2">
                {home.members.map((m) => (
                  <div key={m.name} className={styles.memberRow}>
                    <span className={styles.member}>
                      <Avatar name={m.name} size="sm" />
                      <Text variant="item">{m.name}</Text>
                      {m.name === ME && (
                        <Chip tone="default">eres tú</Chip>
                      )}
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
                      {m.name !== ME && (
                        confirmKick === m.name ? (
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
                        )
                      )}
                    </div>
                  </div>
                ))}
              </Stack>

              <div className={styles.line}>
                <Text variant="note" tone="secondary">
                  <KeyRound size={14} aria-hidden="true" /> Clave de respaldo
                </Text>
                <Text variant="note" tone="secondary" numeric>
                  {home.backupKey}
                </Text>
              </div>
            </Stack>
          </Card>

          <Card padding="md">
            <Stack gap="3">
              <Text as="h2" variant="section">
                Invitar a la familia
              </Text>
              <div className={styles.inviteRow}>
                <label htmlFor="invite-role">Rol que otorga</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              {inviteError && <Alert tone="danger">{inviteError}</Alert>}
              {invite && (
                <Alert tone="success" title={`Invitación creada (${invite.role})`}>
                  Código corto para dictar por teléfono:{' '}
                  <strong>{invite.code}</strong>
                </Alert>
              )}
              <Button onClick={() => inviteMutation.mutate()} loading={inviteMutation.isPending}>
                <Link2 size={16} aria-hidden="true" /> Crear invitación
              </Button>

              {home.invitations.length > 0 && (
                <Stack gap="2">
                  <Text as="h3" variant="section">
                    Invitaciones activas
                  </Text>
                  {home.invitations.map((inv) => (
                    <div key={inv.id} className={styles.line}>
                      <span>
                        <Text variant="note" tone="secondary">
                          <strong>{inv.code}</strong> · {ROLE_LABEL[inv.roleGranted]}
                          {inv.maxUses != null ? ` · ${inv.uses}/${inv.maxUses} usos` : ''}
                        </Text>
                      </span>
                      {!inv.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMutation.mutate(inv.id)}
                          disabled={revokeMutation.isPending}
                        >
                          Revocar
                        </Button>
                      )}
                      {inv.revoked && <Chip tone="danger">revocada</Chip>}
                    </div>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>

          <Card padding="md">
            <Stack gap="3">
              <Text as="h2" variant="section">
                Unirse con invitación
              </Text>
              <Text as="p" variant="note" tone="secondary">
                ¿Alguien te pasó un código? Acepta aquí la invitación.
              </Text>
              <div className={styles.rowFields}>
                <Input
                  label="Código (ej. 492-113)"
                  placeholder="492-113"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  aria-label="Código de invitación"
                />
                <Input
                  label="Tu nombre"
                  placeholder="María"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  aria-label="Nombre del invitado"
                />
              </div>
              {joinMessage && <Alert tone="info">{joinMessage}</Alert>}
              <Button
                onClick={() => joinMutation.mutate()}
                loading={joinMutation.isPending}
                disabled={!joinCode.trim()}
              >
                <UserPlus size={16} aria-hidden="true" /> Aceptar invitación
              </Button>
            </Stack>
          </Card>
          </>
        ) : (
        <Card padding="lg">
          <Stack gap="3">
            <EmptyState
              icon={<HomeIcon size={28} strokeWidth={2} aria-hidden="true" />}
              title="Aún no hay hogar"
              description="Crea el hogar de tu familia; tú quedas como Admin y podrás invitar a los demás."
            />
            <Input
              label="Nombre del hogar"
              placeholder="Los Ramírez"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && homeName.trim() && createHomeMutation.mutate(homeName.trim())}
            />
            {homeError && <Alert tone="danger">{homeError}</Alert>}
            <Button
              onClick={() => homeName.trim() && createHomeMutation.mutate(homeName.trim())}
              loading={createHomeMutation.isPending}
              full
            >
              Crear hogar
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
