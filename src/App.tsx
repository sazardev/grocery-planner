import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AuthProvider from './lib/auth/AuthProvider.tsx'
import RequireAuth from './lib/auth/RequireAuth.tsx'
import Layout from './components/Layout.tsx'
import Skeleton from './shared/ui/primitives/Skeleton.tsx'
import { Stack } from './shared/ui/index.ts'

// Lazy loading por ruta: cada página es un chunk independiente → carga más rápida.
const HomePage = lazy(() => import('./pages/HomePage.tsx'))
const NewItemPage = lazy(() => import('./pages/NewItemPage.tsx'))
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage.tsx'))
const TripsPage = lazy(() => import('./pages/TripsPage.tsx'))
const TripDetailPage = lazy(() => import('./pages/TripDetailPage.tsx'))
const PlansPage = lazy(() => import('./pages/PlansPage.tsx'))
const NewPlanPage = lazy(() => import('./pages/NewPlanPage.tsx'))
const PlanDetailPage = lazy(() => import('./pages/PlanDetailPage.tsx'))
const EventsPage = lazy(() => import('./pages/EventsPage.tsx'))
const EventDetailPage = lazy(() => import('./pages/EventDetailPage.tsx'))
const ReportsPage = lazy(() => import('./pages/ReportsPage.tsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.tsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.tsx'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage.tsx'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.tsx'))

function PageLoader() {
  return (
    <Stack gap="4">
      <Skeleton variant="rect" height={40} width={220} />
      <Skeleton variant="rect" height={160} />
      <Skeleton variant="rect" height={120} />
    </Stack>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/items/new" element={<NewItemPage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripDetailPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/plans/new" element={<NewPlanPage />} />
            <Route path="/plans/:id" element={<PlanDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
