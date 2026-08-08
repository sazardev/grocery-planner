import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, LogIn } from 'lucide-react'
import AuthShell from './AuthShell.tsx'
import { useAuth } from '../../lib/auth/useAuth.ts'
import { DEFAULT_ACCOUNT, DEFAULT_PASSWORD } from '../../lib/auth/defaultAccount.ts'
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle.ts'
import { Card, Stack } from '../../shared/ui/index.ts'
import Input from '../../shared/ui/form/Input.tsx'
import Button from '../../shared/ui/primitives/Button.tsx'
import Text from '../../shared/ui/primitives/Text.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useDocumentTitle('Iniciar sesión · Grocery Planner')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password) {
      setError('Escribe tu nombre y tu contraseña para entrar.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signIn(name.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
      setSubmitting(false)
    }
  }

  async function quickLogin() {
    setSubmitting(true)
    setError(null)
    try {
      await signIn(DEFAULT_ACCOUNT, DEFAULT_PASSWORD)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar con la cuenta de prueba.')
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <Card padding="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="4">
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Contraseña"
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" full loading={submitting} iconLeft={<LogIn size={16} strokeWidth={2} aria-hidden="true" />}>
              Entrar
            </Button>
            <Button type="button" variant="secondary" full onClick={quickLogin} disabled={submitting}>
              <KeyRound size={16} strokeWidth={2} aria-hidden="true" /> Entrar con la cuenta de prueba
            </Button>
            <Text as="p" variant="note" tone="secondary" align="center">
              ¿Aún no tienes cuenta?{' '}
              <Link to="/register">Crea una</Link>.
            </Text>
          </Stack>
        </form>
      </Card>
    </AuthShell>
  )
}
