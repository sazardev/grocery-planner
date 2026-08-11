import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { resetPassword } from '../../lib/api'
import { getHome } from '../../lib/api'
import { useAuth } from '../../lib/auth/useAuth.ts'
import { Button, Card, Input, Select, Stack } from '../../shared/ui/index.ts'
import Text from '../../shared/ui/primitives/Text.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { KeyRound } from 'lucide-react'

/** Recupera la contraseña de un miembro con la clave de respaldo (SPEC §2.5). */
export default function RecoverSection() {
  const { token } = useAuth()
  const [member, setMember] = useState('')
  const [backupKey, setBackupKey] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false })
  const members = homeQuery.data?.members ?? []

  const recoverMutation = useMutation({
    mutationFn: () => resetPassword(token ?? '', member, backupKey.trim(), newPassword),
    onSuccess: () => {
      setDone(true)
      setError(null)
      setMember('')
      setBackupKey('')
      setNewPassword('')
      window.setTimeout(() => setDone(false), 3000)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo recuperar la cuenta'),
  })

  const canSubmit = member && backupKey.trim() && newPassword.length >= 6

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          <KeyRound size={18} aria-hidden="true" /> Recuperar contraseña
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Si un miembro olvidó su contraseña, restablécela con la clave de
          respaldo de la familia.
        </Text>

        <Select label="Miembro" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">Elige un miembro…</option>
          {members.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input
          label="Clave de respaldo"
          placeholder="copia la clave que aparece arriba"
          value={backupKey}
          onChange={(e) => setBackupKey(e.target.value)}
          aria-label="Clave de respaldo"
        />
        <Input
          label="Nueva contraseña (mínimo 6 caracteres)"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-label="Nueva contraseña"
        />

        {error && <Alert tone="danger">{error}</Alert>}
        {done && <Alert tone="success" title="Contraseña restablecida" />}

        <Button
          onClick={() => recoverMutation.mutate()}
          loading={recoverMutation.isPending}
          disabled={!canSubmit}
        >
          Restablecer contraseña
        </Button>
      </Stack>
    </Card>
  )
}
