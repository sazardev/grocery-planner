import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { acceptInvitation } from '../../lib/api'
import { ME } from '../../lib/me'
import { Button, Card, Input, Stack } from '../../shared/ui/index.ts'
import Text from '../../shared/ui/primitives/Text.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Link2 } from 'lucide-react'

/**
 * Unirse con invitación (SPEC §3.3): acepta un código corto (492-113) o un
 * enlace con `#TOKEN` (el token se lee de la URL y se envía directamente).
 */
export default function JoinSection() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Soportes el enlace compartido: /family/join#TOKEN
  const initialToken = typeof location.hash === 'string' ? location.hash.replace(/^#/, '') : ''
  const [code, setCode] = useState(initialToken)
  const [error, setError] = useState<string | null>(null)

  const joinMutation = useMutation({
    mutationFn: (value: string) => acceptInvitation(value, ME),
    onSuccess: () => {
      setError(null)
      // Refresca el hogar y la cuenta (home_id ya quedó ligado en el backend).
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['notif-unread'] })
      navigate('/family', { replace: true })
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación'),
  })

  const submit = () => {
    const value = code.trim()
    if (!value) return
    setError(null)
    joinMutation.mutate(value)
  }

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <Link2 size={18} aria-hidden="true" /> Unirse con invitación
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Escribe el código corto que te compartieron (ej. 492-113), o abre el
          enlace de invitación directamente desde tu celular.
        </Text>

        <Input
          label="Código de invitación"
          placeholder="492-113"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Código de invitación"
          autoFocus
        />

        {error && <Alert tone="danger">{error}</Alert>}
        {joinMutation.isSuccess && (
          <Alert tone="success" title="¡Ya eres parte del hogar!" />
        )}

        <Button onClick={submit} loading={joinMutation.isPending} disabled={!code.trim()}>
          Unirse al hogar
        </Button>
      </Stack>
    </Card>
  )
}
