import { useNavigate } from 'react-router-dom'

/**
 * Vuelve atrás en el historial; si la página se abrió directo (link/recarga),
 * navega al destino por defecto para no sacar a la persona de la app.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  return () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }
}
