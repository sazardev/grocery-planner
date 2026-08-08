import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import AuthShell from './AuthShell.tsx'
import { useAuth } from '../../lib/auth/useAuth.ts'
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle.ts'
import { Card, Stack } from '../../shared/ui/index.ts'
import Input from '../../shared/ui/form/Input.tsx'
import Button from '../../shared/ui/primitives/Button.tsx'
import Text from '../../shared/ui/primitives/Text.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  useDocumentTitle('Crear cuenta · Grocery Planner')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !password) {
      setError('Escribe tu nombre y una contraseña para crear la cuenta.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signUp(trimmed, password)
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <Card padding="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="4">
            <Text as="p" variant="note" tone="secondary">
              Tu cuenta es tu nombre y una contraseña. El primero de la familia
              crea el hogar; los demás se unen con una invitación.
            </Text>
            <Input
              label="Nombre"
              placeholder="María"
              autoComplete="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nombre"
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Contraseña"
            />
            <Input
              label="Repite la contraseña"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-label="Repite la contraseña"
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" full loading={submitting} iconLeft={<UserPlus size={16} strokeWidth={2} aria-hidden="true" />}>
              Crear cuenta
            </Button>
            <Text as="p" variant="note" tone="secondary" align="center">
              ¿Ya tienes cuenta? <Link to="/login">Entra</Link>.
            </Text>
          </Stack>
        </form>
      </Card>
    </AuthShell>
  )
}
