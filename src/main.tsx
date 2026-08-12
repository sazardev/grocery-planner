import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadThemeMode } from './lib/theme.ts'
import { applyTVMode } from './lib/tvMode.ts'
import { startRealtimeSync } from './lib/realtime.ts'

// Aplica el tema guardado al arrancar (el inline de index.html lo hace aún antes).
applyTheme(loadThemeMode())
// Modo TV (10-foot): sin cursor ni toque → remoto con D-pad, oscuro.
applyTVMode()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
})

// Tiempo real (fase 2): SSE para que cualquier cambio de otro dispositivo
// (o del propio server) se refleje al instante en la UI.
startRealtimeSync(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

// PWA: registra el service worker solo en producción web
// (en desktop Tauri no aplica; la app ya es standalone).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !('__TAURI_INTERNALS__' in window)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* silencioso: el registro falla solo si no hay soporte/red */
    })
  })
}
