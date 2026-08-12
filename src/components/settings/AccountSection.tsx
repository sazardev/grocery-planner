import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { changePassword, updateProfile } from '../../lib/api'
import { useAuth } from '../../lib/auth/useAuth.ts'
import { readFileAsDataURL } from '../../lib/readFile.ts'
import Text from '../../shared/ui/primitives/Text.tsx'
import Button from '../../shared/ui/primitives/Button.tsx'
import Avatar from '../../shared/ui/primitives/Avatar.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Card, Input, Stack } from '../../shared/ui/index.ts'
import { Camera, KeyRound } from 'lucide-react'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

/** Perfil de la cuenta: alias, avatar/foto y cambio de contraseña (SPEC §2.1). */
export default function AccountSection() {
  const { user, token, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [alias, setAlias] = useState(user?.alias ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [current, setCurrent] = useState('')
  const [nextPass, setNextPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [passSaved, setPassSaved] = useState(false)

  const profileMutation = useMutation({
    mutationFn: (avatar?: string) => updateProfile(token ?? '', alias.trim() || undefined, avatar),
    onSuccess: async () => {
      await refreshUser()
      queryClient.invalidateQueries({ queryKey: ['home'] })
      setSaved(true)
      setError(null)
      window.setTimeout(() => setSaved(false), 2000)
    },
    onError: (e) => setError(errMsg(e, 'No se pudo guardar el perfil')),
  })

  const saveProfile = () => profileMutation.mutate(undefined)

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(token ?? '', current, nextPass),
    onSuccess: () => {
      setPassSaved(true)
      setPassError(null)
      setCurrent('')
      setNextPass('')
      setConfirm('')
      window.setTimeout(() => setPassSaved(false), 2000)
    },
    onError: (e) => setPassError(errMsg(e, 'No se pudo cambiar la contraseña')),
  })

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const dataUrl = await readFileAsDataURL(f)
    profileMutation.mutate(dataUrl)
  }

  return (
    <Card padding="lg">
      <Stack gap="4">
        <div className="accountHead" style={{ display: 'flex', alignItems: 'center', gap: 'var(--gp-space-3)' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Cambiar mi foto"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <Avatar name={user?.name ?? ''} src={user?.avatar ?? undefined} size="lg" />
          </button>
          <div>
            <Text variant="item">{user?.name}</Text>
            <Text as="p" variant="note" tone="secondary">
              {user?.alias ? `«${user.alias}»` : 'Toca la foto para cambiarla.'}
            </Text>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label="Subir foto de perfil"
          />
        </div>

        <Stack gap="2">
          <Text as="p" variant="note" tone="secondary">
            Alias (opcional): cómo te llama la familia, ej. “la mamá de Ana”.
          </Text>
          <Input
            label="Alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            aria-label="Alias"
            placeholder="la mamá de Ana"
          />
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success" title="Perfil guardado" />}
          <Button variant="secondary" onClick={saveProfile} loading={profileMutation.isPending}>
            <Camera size={16} strokeWidth={2} aria-hidden="true" /> Guardar perfil
          </Button>
        </Stack>

        <Stack gap="2">
          <Text as="h3" variant="section">
            <KeyRound size={18} aria-hidden="true" /> Cambiar contraseña
          </Text>
          <Input
            type="password"
            autoComplete="current-password"
            label="Contraseña actual"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-label="Contraseña actual"
          />
          <Input
            type="password"
            autoComplete="new-password"
            label="Contraseña nueva"
            value={nextPass}
            onChange={(e) => setNextPass(e.target.value)}
            aria-label="Contraseña nueva"
          />
          <Input
            type="password"
            autoComplete="new-password"
            label="Repite la nueva"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-label="Repite la contraseña nueva"
          />
          {passError && <Alert tone="danger">{passError}</Alert>}
          {passSaved && <Alert tone="success" title="Contraseña actualizada" />}
          <Button
            variant="secondary"
            onClick={() => {
              setPassError(null)
              if (nextPass.length < 6) {
                setPassError('La contraseña nueva debe tener al menos 6 caracteres.')
                return
              }
              if (nextPass !== confirm) {
                setPassError('Las contraseñas nuevas no coinciden.')
                return
              }
              passwordMutation.mutate()
            }}
            loading={passwordMutation.isPending}
            disabled={!current || !nextPass || !confirm}
          >
            Cambiar contraseña
          </Button>
        </Stack>
      </Stack>
    </Card>
  )
}
