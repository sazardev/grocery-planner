import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasPin, removePin, setPin } from '../../lib/api'
import { ME } from '../../lib/me'
import Text from '../../shared/ui/primitives/Text.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Button, Card, Input, Stack } from '../../shared/ui/index.ts'
import { KeyRound } from 'lucide-react'

const PIN_KEY = ['has-pin', ME]

export default function PinSection() {
  const queryClient = useQueryClient()
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const { data: enabled, isLoading } = useQuery({
    queryKey: PIN_KEY,
    queryFn: () => hasPin(ME),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PIN_KEY })
    setPinValue('')
    setConfirm('')
    setError(null)
  }

  const setMutation = useMutation({
    mutationFn: () => setPin(ME, pin, ME),
    onSuccess: () => {
      invalidate()
      setDone(true)
      window.setTimeout(() => setDone(false), 2500)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar el PIN'),
  })

  const removeMutation = useMutation({
    mutationFn: () => removePin(ME, ME),
    onSuccess: invalidate,
  })

  if (isLoading) return <Skeleton variant="rect" height={120} />

  const submit = () => {
    setError(null)
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe tener 4 dígitos')
      return
    }
    if (pin !== confirm) {
      setError('El PIN no coincide')
      return
    }
    setMutation.mutate()
  }

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <KeyRound size={18} aria-hidden="true" /> Entrar rápido con PIN
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Un PIN de 4 dígitos para entrar desde un dispositivo conocido. La huella
          y el Face ID viven solo en tu dispositivo y nunca viajan al servidor.
        </Text>

        {error && <Alert tone="danger" title="No se pudo guardar">{error}</Alert>}
        {done && <Alert tone="success" title="PIN guardado" />}

        {enabled ? (
          <>
            <Alert tone="info" title="PIN activo">
              Ya puedes entrar con tu PIN de 4 dígitos desde este dispositivo.
            </Alert>
            <Button variant="danger" onClick={() => removeMutation.mutate()} loading={removeMutation.isPending}>
              Quitar mi PIN
            </Button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 'var(--gp-space-3)', flexWrap: 'wrap' }}>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                label="PIN de 4 dígitos"
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                aria-label="PIN de 4 dígitos"
              />
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                label="Repite el PIN"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
                aria-label="Confirmar PIN"
              />
            </div>
            <Button onClick={submit} loading={setMutation.isPending} disabled={pin.length !== 4 || confirm.length !== 4}>
              Guardar PIN
            </Button>
          </>
        )}
      </Stack>
    </Card>
  )
}
