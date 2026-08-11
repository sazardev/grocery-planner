import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { Stack } from '../../shared/ui/index.ts'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'

function AuthLoader() {
  return (
    <Stack gap="4">
      <Skeleton variant="rect" height={40} width={220} />
      <Skeleton variant="rect" height={160} />
    </Stack>
  )
}

/**
 * Protege las rutas: sin sesión válida redirige a /login y recuerda a dónde
 * quería ir el usuario (para volver después de iniciar sesión).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <AuthLoader />
  if (status !== 'authenticated') {
    // Conserva path + query + hash: un enlace de invitación `/family/join#TOKEN`
    // debe seguir funcionando después de entrar (SPEC §3.3).
    const from = location.pathname + location.search + location.hash
    return <Navigate to="/login" state={{ from }} replace />
  }
  return <>{children}</>
}
