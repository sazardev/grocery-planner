import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Code2,
  MessageCircle,
  Package,
  Play,
  Plus,
  Send,
  Server,
  ShoppingCart,
  Sparkles,
  SmilePlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../lib/auth/useAuth.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Checkbox from '../shared/ui/primitives/Checkbox.tsx'
import Input from '../shared/ui/form/Input.tsx'
import ProgressBar from '../shared/ui/primitives/ProgressBar.tsx'
import TabBar from '../shared/ui/navigation/TabBar.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import BrandMark from '../shared/ui/brand/BrandMark.tsx'
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

interface DemoItem {
  name: string
  qty: string
  requestedBy: string
  urgent?: boolean
  carried: boolean
}

function parseQty(text: string): { name: string; qty: string } {
  const t = text.trim()
  const m = t.match(/^(.+?)\s+([\d.,]+\s*\w+)$/)
  if (m) return { name: m[1].trim(), qty: m[2].trim() }
  return { name: t, qty: '1 pieza' }
}

export default function LandingPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  useMeta({
    title: 'Grocery Planner — ¿Qué falta? La lista de compras de la familia',
    description:
      'Planeador de compras self-hosted para tu familia: lista compartida, mandados, planes, calendario, chat e historial. Simple, en español y en todos tus dispositivos.',
    path: '/',
  })

  const [draft, setDraft] = useState('')
  const [items, setItems] = useState<DemoItem[]>([
    { name: 'Pollo', qty: '2 kg', requestedBy: 'Ana', carried: true },
    { name: 'Leche', qty: '1 l', requestedBy: 'Papá', urgent: true, carried: false },
    { name: 'Canela', qty: '1 caja', requestedBy: 'Abuela', carried: false },
  ])

  if (status === 'authenticated') return <Navigate to="/home" replace />

  const toggle = (i: number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, carried: !it.carried } : it)))

  const add = () => {
    if (!draft.trim()) return
    const { name, qty } = parseQty(draft)
    setItems((prev) => [...prev, { name, qty, requestedBy: 'Tú', carried: false }])
    setDraft('')
  }

  const carriedCount = items.filter((i) => i.carried).length

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand} aria-label="Grocery Planner">
          <BrandMark size={28} />
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

          {/* Demo de la lista */}
          <div className={styles.mockWrap}>
            <Card padding="lg" className={styles.mockCard}>
              <Stack gap="3">
                <div className={styles.mockHead}>
                  <Text variant="section">¿Qué falta?</Text>
                  <Chip tone="default">{items.length - carriedCount} pendientes</Chip>
                </div>
                <div className={styles.mockInput}>
                  <Input
                    size="md"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                    placeholder="pollo 2kg…"
                    aria-label="Agregar una falta de prueba"
                  />
                  <Button size="sm" onClick={add} aria-label="Agregar">
                    <Plus size={16} strokeWidth={2} />
                  </Button>
                </div>
                {items.map((it, i) => (
                  <MockRow key={`${it.name}-${i}`} item={it} onToggle={() => toggle(i)} />
                ))}
                <ProgressBar value={carriedCount} max={items.length || 1} showValue label="Ya llevas" />
                <Text variant="note" tone="tertiary" align="center">
                  Pruébalo: agrega algo y toca la bolita.
                </Text>
              </Stack>
            </Card>
            <div className={styles.mockFab} aria-hidden="true">
              <Plus size={22} strokeWidth={2.5} />
            </div>
          </div>
        </section>

        {/* Pestañas de pantallas interactivas */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Explóralo tú mismo</h2>
            <p className={styles.lead}>
              Cada pestaña es una pantalla real de la app: manipúlala y mira cómo responde.
            </p>
          </div>
          <AppDemos />
        </section>

        {/* Features */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Hecho para el día a día de la familia</h2>
            <p className={styles.lead}>Sin curvas de aprendizaje: se usa como un mensaje de WhatsApp.</p>
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
          <BrandMark size={16} /> Grocery Planner
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

function MockRow({ item, onToggle }: { item: DemoItem; onToggle: () => void }) {
  return (
    <div className={styles.mockRow}>
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={item.carried}
          onChange={onToggle}
          ariaLabel={`${item.name}: ${item.carried ? 'quitar del carrito' : 'decir que ya lo llevo'}`}
        />
      </span>
      <span className={`${styles.mockName} ${item.carried ? styles.done : ''}`}>{item.name}</span>
      <span className={styles.mockQty}>{item.qty}</span>
      {item.urgent && <Chip tone="warning">Urgente</Chip>}
      {item.carried && <Chip tone="default">en el carrito</Chip>}
      <Avatar name={item.requestedBy} size="sm" />
    </div>
  )
}

/* ============ Pestañas de pantallas interactivas ============ */

const TABS = [
  { key: 'lista', label: 'Lista', icon: <ShoppingCart size={16} strokeWidth={2} aria-hidden="true" /> },
  { key: 'mandado', label: 'Mandado', icon: <Play size={16} strokeWidth={2} aria-hidden="true" /> },
  { key: 'chat', label: 'Chat', icon: <MessageCircle size={16} strokeWidth={2} aria-hidden="true" /> },
]

function AppDemos() {
  const [tab, setTab] = useState('lista')
  return (
    <div className={styles.demos}>
      <TabBar items={TABS} active={tab} onChange={setTab} label="Pantallas de la app" />
      <div className={styles.demoPanel} key={tab}>
        {tab === 'lista' && <ListaDemo />}
        {tab === 'mandado' && <MandadoDemo />}
        {tab === 'chat' && <ChatDemo />}
      </div>
    </div>
  )
}

function DemoShell({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <Card padding="lg">
      <Stack gap="3">
        <div className={styles.mockHead}>
          <Text variant="section">{title}</Text>
          <Chip tone="default">demo</Chip>
        </div>
        {children}
        <Text variant="note" tone="tertiary">
          💡 {hint}
        </Text>
      </Stack>
    </Card>
  )
}

function ListaDemo() {
  const [items, setItems] = useState<DemoItem[]>([
    { name: 'Pollo', qty: '2 kg', requestedBy: 'Ana', carried: true },
    { name: 'Leche', qty: '1 l', requestedBy: 'Papá', urgent: true, carried: false },
    { name: 'Canela', qty: '1 caja', requestedBy: 'Abuela', carried: false },
  ])
  const [draft, setDraft] = useState('')
  const toggle = (i: number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, carried: !it.carried } : it)))
  const add = () => {
    if (!draft.trim()) return
    const { name, qty } = parseQty(draft)
    setItems((prev) => [...prev, { name, qty, requestedBy: 'Tú', carried: false }])
    setDraft('')
  }
  const carried = items.filter((i) => i.carried).length
  return (
    <DemoShell title="Lista de compras" hint="Escribe “arroz 2kg” y presiona Enter, o toca la bolita para marcar “ya lo llevo”.">
      <div className={styles.mockInput}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="pollo 2kg…"
          aria-label="Agregar falta (demo)"
        />
        <Button size="sm" onClick={add} aria-label="Agregar (demo)">
          <Plus size={16} strokeWidth={2} />
        </Button>
      </div>
      {items.map((it, i) => (
        <MockRow key={`${it.name}-${i}`} item={it} onToggle={() => toggle(i)} />
      ))}
      <ProgressBar value={carried} max={items.length || 1} showValue label="Ya llevas" />
    </DemoShell>
  )
}

function MandadoDemo() {
  const [tripItems, setTripItems] = useState<DemoItem[]>([
    { name: 'Pollo', qty: '2 kg', requestedBy: 'Ana', carried: true },
    { name: 'Leche', qty: '1 l', requestedBy: 'Papá', carried: false },
    { name: 'Canela', qty: '1 caja', requestedBy: 'Abuela', carried: false },
  ])
  const [who, setWho] = useState('Papá')
  const [started, setStarted] = useState(false)
  const carried = tripItems.filter((i) => i.carried).length
  const toggle = (i: number) =>
    setTripItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, carried: !it.carried } : it)))
  return (
    <DemoShell
      title="Mandado"
      hint="Elige quién va, pulsa “Empezar” y ve marcando lo que ya lleva en la tienda."
    >
      <div className={styles.mockInput}>
        <label className={styles.whoLabel} htmlFor="demo-who">
          Lo lleva
        </label>
        <select
          id="demo-who"
          className={styles.whoSelect}
          value={who}
          onChange={(e) => setWho(e.target.value)}
          aria-label="Quién lleva el mandado (demo)"
        >
          <option>Papá</option>
          <option>Mamá</option>
          <option>Ana</option>
        </select>
        <Button
          size="sm"
          onClick={() => setStarted((v) => !v)}
          variant={started ? 'secondary' : 'primary'}
          aria-label={started ? 'Pausar mandado (demo)' : 'Empezar mandado (demo)'}
        >
          {started ? 'Pausar' : 'Empezar'}
        </Button>
      </div>
      {tripItems.map((it, i) => (
        <MockRow key={`${it.name}-${i}`} item={it} onToggle={() => toggle(i)} />
      ))}
      <ProgressBar value={carried} max={tripItems.length || 1} showValue label={`${who} lleva`} />
    </DemoShell>
  )
}

interface DemoMsg {
  from: string
  body: string
  mine?: boolean
  reactions: string[]
}

function ChatDemo() {
  const [msgs, setMsgs] = useState<DemoMsg[]>([
    { from: 'Papá', body: 'No había canela, ¿la compro de otra marca?', reactions: ['👍'] },
    { from: 'Mamá', body: 'Sí, cualquiera que no sea de canela molida 🙏', mine: true, reactions: [] },
  ])
  const [draft, setDraft] = useState('')
  const send = () => {
    if (!draft.trim()) return
    setMsgs((prev) => [...prev, { from: 'Tú', body: draft.trim(), mine: true, reactions: [] }])
    setDraft('')
  }
  const react = (i: number) =>
    setMsgs((prev) =>
      prev.map((m, idx) =>
        idx === i ? { ...m, reactions: m.reactions.includes('👍') ? [] : [...m.reactions, '👍'] } : m,
      ),
    )
  return (
    <DemoShell title="Chat del hogar" hint="Escribe un mensaje y envíalo, o toca 👍 en el mensaje de Papá para reaccionar.">
      <div className={styles.chatThread}>
        {msgs.map((m, i) => (
          <div key={i} className={`${styles.bubble} ${m.mine ? styles.bubbleMine : ''}`}>
            <div className={styles.bubbleHead}>
              <Avatar name={m.from} size="sm" />
              <span className={styles.bubbleFrom}>{m.from}</span>
            </div>
            <span className={styles.bubbleBody}>{m.body}</span>
            <div className={styles.bubbleActions}>
              {m.reactions.length > 0 && <Chip tone="default">{m.reactions.join(' ')}</Chip>}
              <button
                type="button"
                className={styles.reactBtn}
                onClick={() => react(i)}
                aria-label={`Reaccionar al mensaje de ${m.from} (demo)`}
              >
                <SmilePlus size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.mockInput}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje (demo)"
        />
        <Button size="sm" onClick={send} aria-label="Enviar (demo)">
          <Send size={16} strokeWidth={2} />
        </Button>
      </div>
    </DemoShell>
  )
}
