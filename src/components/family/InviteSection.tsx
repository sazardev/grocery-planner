import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
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

// Caducidad: (etiqueta, segundos o null para "nunca").
const EXPIRY_OPTIONS: { label: string; value: string }[] = [
  { label: '24 horas', value: '86400' },
  { label: '7 días', value: '604800' },
  { label: 'Nunca caduca', value: '' },
]
const USES_OPTIONS: { label: string; value: string }[] = [
  { label: 'Una persona', value: '1' },
  { label: 'Hasta 5', value: '5' },
  { label: 'Ilimitado', value: '' },
]

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/** Invita a la familia: código corto, enlace, QR, caducidad y límite de usos. */
export default function InviteSection() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [role, setRole] = useState<Role>('miembro')
  const [expiry, setExpiry] = useState('604800')
  const [maxUses, setMaxUses] = useState('5')
  const [invite, setInvite] = useState<{ code: string; token: string; role: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: home, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    retry: false,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['home'] })

  const inviteMutation = useMutation({
    mutationFn: () =>
      createInvitation({
        by: ME,
        roleGranted: role,
        expiresInSecs: expiry ? Number(expiry) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
      }),
    onSuccess: (inv) => {
      invalidate()
      setInvite({ code: inv.code, token: inv.token, role: ROLE_LABEL[inv.roleGranted] })
      setError(null)
      setCopied(false)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear la invitación')),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id, ME),
    onSuccess: invalidate,
  })

  // Enlace de invitación (lo comparte el admin; el que acepta entra por el código o el token).
  const inviteUrl = invite
    ? `${window.location.origin}/family/join#${invite.token}`
    : ''

  // Dibuja el QR del enlace (self-hosted, sin servicios externos).
  useEffect(() => {
    if (!inviteUrl || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, inviteUrl, { width: 168, margin: 1 })
      .catch(() => {
        /* el QR es un extra; si falla, el enlace y el código siguen sirviendo */
      })
  }, [inviteUrl])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar el enlace')
    }
  }

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
          Suma a alguien con un código corto (para dictar por teléfono), un
          enlace o un QR.
        </Text>

        <Select label="Rol que otorga" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <Select label="Caducidad" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value || 'never'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Cuántas personas pueden usarla" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
          {USES_OPTIONS.map((o) => (
            <option key={o.value || 'unlimited'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        {error && <Alert tone="danger">{error}</Alert>}

        {invite && (
          <Stack gap="2">
            <Alert tone="success" title={`Invitación creada (${invite.role})`}>
              Código corto para dictar por teléfono: <strong>{invite.code}</strong>
            </Alert>
            <div className={styles.shareRow}>
              <canvas ref={canvasRef} aria-hidden="true" className={styles.qr} />
              <Stack gap="2">
                <Text as="p" variant="note" tone="secondary">
                  Enlace de invitación:
                </Text>
                <Text as="p" variant="note" className={styles.link}>
                  {inviteUrl}
                </Text>
                <div className={styles.actions}>
                  <Button variant="secondary" size="sm" onClick={copyLink}>
                    {copied ? '¡Copiado!' : 'Copiar enlace'}
                  </Button>
                </div>
              </Stack>
            </div>
          </Stack>
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
                    {inv.expiresAt ? ` · vence ${new Date(inv.expiresAt).toLocaleDateString('es')}` : ''}
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
