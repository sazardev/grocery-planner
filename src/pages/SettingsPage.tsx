import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createHome, getHome, listSessions, revokeSession } from '../lib/api'
import { ME } from '../lib/me'
import { useAuth } from '../lib/auth/useAuth.ts'
import type { HomeView } from '../domain/home'
import type { Session } from '../domain/auth'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import { Card, Input, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useTheme } from '../lib/theme.ts'
import type { ThemeMode } from '../lib/theme.ts'
import TabBar from '../shared/ui/navigation/TabBar.tsx'
import { useNavigate } from 'react-router-dom'
import { Home as HomeIcon, KeyRound, LogOut, MonitorSmartphone, Moon, Sun, Tv } from 'lucide-react'
import NotificationsSection from '../components/settings/NotificationsSection.tsx'
import PinSection from '../components/settings/PinSection.tsx'
import BackupSection from '../components/settings/BackupSection.tsx'
import styles from './SettingsPage.module.css'

const THEME_TABS = [
  { key: 'light', label: 'Claro', icon: <Sun size={16} strokeWidth={2} aria-hidden="true" /> },
  { key: 'dark', label: 'Oscuro', icon: <Moon size={16} strokeWidth={2} aria-hidden="true" /> },
  {
    key: 'system',
    label: 'Sistema',
    icon: <MonitorSmartphone size={16} strokeWidth={2} aria-hidden="true" />,
  },
]

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user, token, signOut } = useAuth()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()
  const [homeName, setHomeName] = useState('')
  const [homeError, setHomeError] = useState<string | null>(null)
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
          Tu cuenta, tu hogar, seguridad y respaldo de la familia.
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
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<LogOut size={16} strokeWidth={2} aria-hidden="true" />}
            onClick={() => signOut()}
          >
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

      <Card padding="lg">
        <Stack gap="3">
          <Text as="h2" variant="section">
            <Sun size={18} aria-hidden="true" /> Apariencia
          </Text>
          <Text as="p" variant="note" tone="secondary">
            Elige el tema de la app. En <strong>Sistema</strong> sigue la preferencia de tu
            dispositivo. Se guarda en este dispositivo.
          </Text>
          <TabBar
            items={THEME_TABS}
            active={themeMode}
            onChange={(k) => setThemeMode(k as ThemeMode)}
            label="Tema de la app"
          />
        </Stack>
      </Card>

      {homeQuery.isLoading ? (
        <Skeleton variant="rect" height={120} />
      ) : home ? (
        <Card padding="lg">
          <Stack gap="3">
            <div className={styles.line}>
              <Text as="h2" variant="section">
                <HomeIcon size={18} aria-hidden="true" /> {home.name}
              </Text>
              <Chip tone="default">{home.members.length} miembros</Chip>
            </div>
            <Text as="p" variant="note" tone="secondary">
              Los miembros y las invitaciones se administran en la sección{' '}
              <strong>Familia</strong>.
            </Text>
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
      ) : (
        <Card padding="lg">
          <Stack gap="3">
            <EmptyState
              icon={<HomeIcon size={28} strokeWidth={2} aria-hidden="true" />}
              title="Aún no hay hogar"
              description="Crea el hogar de tu familia; tú quedas como Admin y podrás invitar a los demás desde Familia."
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

      <Card padding="md">
        <Stack gap="2">
          <div className={styles.line}>
            <Text variant="section">
              <Tv size={18} aria-hidden="true" /> Quiosco de casa
            </Text>
          </div>
          <Text as="p" variant="note" tone="secondary">
            La pantalla de host para la tablet de la cocina: siempre con la lista y el botón grande.
          </Text>
          <Button variant="secondary" full onClick={() => navigate('/kiosk')}>
            Abrir pantalla de host
          </Button>
        </Stack>
      </Card>

      <NotificationsSection />
      <PinSection />
      <BackupSection />
    </Stack>
  )
}
