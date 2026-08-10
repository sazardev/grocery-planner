import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createInvitation, getHome, revokeInvitation } from '../../lib/api'
import { ME } from '../../lib/me'
import { ROLE_LABEL, type Role } from '../../domain/home'
import Text from '../../shared/ui/primitives/Text.tsx'
import Chip from '../../shared/ui/primitives/Chip.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import EmptyState from '../../shared/ui/feedback/EmptyState.tsx'
import Select from '../../shared/ui/form/Select.tsx'
import { Button, Card, Stack } from '../../shared/ui/index.ts'
import { Link2, UserPlus } from 'lucide-react'
import styles from './InviteSection.module.css'

const ROLES: Role[] = ['miembro', 'organizador', 'admin']

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/** Invita a la familia con un código corto y administra las invitaciones activas. */
export default function InviteSection() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [role, setRole] = useState<Role>('miembro')
  const [invite, setInvite] = useState<{ code: string; role: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: home, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    retry: false,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['home'] })

  const inviteMutation = useMutation({
    mutationFn: () => createInvitation({ by: ME, roleGranted: role, maxUses: 3 }),
    onSuccess: (inv) => {
      invalidate()
      setInvite({ code: inv.code, role: ROLE_LABEL[inv.roleGranted] })
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear la invitación')),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id, ME),
    onSuccess: invalidate,
  })

  if (isLoading) return <Skeleton variant="rect" height={120} />
  if (!home) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<Link2 size={28} strokeWidth={2} aria-hidden="true" />}
          title="Aún no hay hogar"
          description="Crea el hogar en Ajustes para poder invitar a tu familia."
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
        <Text as="h2" variant="section">
          <UserPlus size={18} aria-hidden="true" /> Invitar a la familia
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Suma a alguien con un código corto para dictar por teléfono.
        </Text>

        <Select
          label="Rol que otorga"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>

        {error && <Alert tone="danger">{error}</Alert>}
        {invite && (
          <Alert tone="success" title={`Invitación creada (${invite.role})`}>
            Código corto para dictar por teléfono: <strong>{invite.code}</strong>
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
  )
}
