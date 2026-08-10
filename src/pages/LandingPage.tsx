import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Code2,
  MessageCircle,
  Package,
  Plus,
  Server,
  ShoppingCart,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuth } from '../lib/auth/useAuth.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import styles from './LandingPage.module.css'

const FEATURES = [
  {
    icon: <ShoppingCart size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Una lista, toda la familia',
    body: 'Agrega una falta con un toque (“pollo 2kg”) y todos la ven al instante en su celular, tablet o el quiosco de la cocina.',
  },
  {
    icon: <Package size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Alternativas si no hay',
    body: '“Si no hay pechuga, trae pierna; si no hay pierna, no traigas nada”. La lista encadena opciones por si acaso.',
  },
  {
    icon: <CalendarDays size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Mandados y planes',
    body: 'Quién va, a qué hora y a qué tienda. Planes recurrentes y el calendario familiar en el mismo lugar.',
  },
  {
    icon: <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Chat del hogar',
    body: 'Menciona a alguien con @, manda fotos del recibo o de la alacena, reacciona y fija lo importante.',
  },
  {
    icon: <Bell size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Avisos a tu medida',
    body: 'Te avisa cuando te asignan algo, cuando llega el mandado o cuando faltará la leche en dos días.',
  },
  {
    icon: <Server size={22} strokeWidth={2} aria-hidden="true" />,
    title: 'Self-hosted, tus datos',
    body: 'Todo vive en el PC de la familia, no en la nube de nadie. Con respaldo completo para llevarlo donde quieras.',
  },
]

const STEPS = [
  { n: '1', title: 'Anota lo que falta', body: '“Leche 1 l”, “arroz 2kg”… o detallado con marca, cantidad y alternativas.' },
  { n: '2', title: 'Cada quien su parte', body: 'Asigna ítems, reparte pasillos y mira el progreso en vivo desde la tienda.' },
  { n: '3', title: 'Nadie se duplica', body: 'Lo que uno ya lleva lo ven todos al instante. Al llegar, confirmas el recibo.' },
]

export default function LandingPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  useMeta({
    title: 'Grocery Planner — ¿Qué falta? La lista de compras de la familia',
    description:
      'Planeador de compras self-hosted para tu familia: lista compartida, mandados, planes, calendario, chat e historial. Simple, en español y en todos tus dispositivos.',
    path: '/',
  })

  // Si ya hay sesión, la landing no aporta: directo a la lista.
  if (status === 'authenticated') return <Navigate to="/home" replace />

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand} aria-label="Grocery Planner">
          <span className={styles.mark} aria-hidden="true">
            <ShoppingCart size={18} strokeWidth={2.5} />
          </span>
          <span className={styles.brandName}>Grocery Planner</span>
        </Link>
        <div className={styles.topActions}>
          <Link to="/login" className={styles.link}>
            Entrar
          </Link>
          <Button size="sm" onClick={() => navigate('/register')}>
            Crear cuenta
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <Chip tone="default">
              <Sparkles size={14} strokeWidth={2} aria-hidden="true" /> Self-hosted · open source
            </Chip>
            <h1 className={styles.title}>
              ¿Qué falta en casa?
              <span className={styles.titleAccent}> La lista de compras de la familia.</span>
            </h1>
            <p className={styles.subtitle}>
              Uno checa la despensa, otro va al mandado. Todo en la misma lista, en tiempo real,
              desde cualquier dispositivo de la casa.
            </p>
            <div className={styles.ctaRow}>
              <Button size="lg" onClick={() => navigate('/register')}>
                Crear mi hogar <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/login')}>
                Ya tengo cuenta
              </Button>
            </div>
          </div>

          {/* Mock de la lista con componentes reales */}
          <div className={styles.mockWrap}>
            <Card padding="lg" className={styles.mockCard}>
              <Stack gap="3">
                <div className={styles.mockHead}>
                  <Text variant="section">¿Qué falta?</Text>
                  <Chip tone="default">3 pendientes</Chip>
                </div>
                <MockRow name="Pollo" qty="2 kg" requestedBy="Ana" status="llevo" />
                <MockRow name="Leche" qty="1 l" requestedBy="Papá" status="falta" urgent />
                <MockRow name="Canela" qty="1 caja" requestedBy="Abuela" status="falta" />
              </Stack>
            </Card>
            <div className={styles.mockFab} aria-hidden="true">
              <Plus size={22} strokeWidth={2.5} />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Hecho para el día a día de la familia</h2>
            <p className={styles.lead}>
              Sin curvas de aprendizaje: se usa como un mensaje de WhatsApp.
            </p>
          </div>
          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <Card key={f.title} padding="lg" className={styles.feature}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <Text as="h3" variant="section">
                  {f.title}
                </Text>
                <Text as="p" variant="note" tone="secondary">
                  {f.body}
                </Text>
              </Card>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Así se siente</h2>
          </div>
          <div className={styles.steps}>
            {STEPS.map((s) => (
              <div key={s.n} className={styles.step}>
                <span className={styles.stepNum}>{s.n}</span>
                <Text as="h3" variant="section">
                  {s.title}
                </Text>
                <Text as="p" variant="note" tone="secondary">
                  {s.body}
                </Text>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className={styles.cta}>
          <Card padding="lg" className={styles.ctaCard}>
            <h2 className={styles.h2}>Empieza hoy</h2>
            <p className={styles.lead}>
              Crea tu hogar, invita a los tuyos con un código corto y que nadie vuelva a preguntar
              “¿qué hay que comprar?”.
            </p>
            <Button size="lg" onClick={() => navigate('/register')}>
              <Users size={18} strokeWidth={2} aria-hidden="true" /> Crear mi hogar
            </Button>
          </Card>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>
          <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" /> Grocery Planner
        </span>
        <a
          href="https://github.com/sazardev/grocery-planner"
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          <Code2 size={16} strokeWidth={2} aria-hidden="true" /> Código en GitHub
        </a>
      </footer>
    </div>
  )
}

function MockRow({
  name,
  qty,
  requestedBy,
  status,
  urgent,
}: {
  name: string
  qty: string
  requestedBy: string
  status: 'falta' | 'llevo'
  urgent?: boolean
}) {
  return (
    <div className={styles.mockRow}>
      <span className={`${styles.check} ${status === 'llevo' ? styles.checkOn : ''}`} aria-hidden="true">
        {status === 'llevo' && <CheckCircle2 size={14} strokeWidth={2.5} />}
      </span>
      <span className={`${styles.mockName} ${status === 'llevo' ? styles.done : ''}`}>{name}</span>
      <span className={styles.mockQty}>{qty}</span>
      {urgent && <Chip tone="warning">Urgente</Chip>}
      <Avatar name={requestedBy} size="sm" />
    </div>
  )
}
