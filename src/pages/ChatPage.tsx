import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  chatPage,
  chatSearch,
  getHome,
  listEvents,
  listItems,
  listTrips,
  markMentionsRead,
  presenceHeartbeat,
  reactToMessage,
  sendChatMessage,
  togglePinnedMessage,
} from '../lib/api'
import { ME } from '../lib/me'
import type { ChatMessage, MessageRef, MessageRefKind } from '../domain/chat'
import PresenceStrip from '../components/PresenceStrip.tsx'
import MentionPicker from '../components/MentionPicker.tsx'
import type { PickerMode, Suggestion } from '../components/MentionPicker.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Button, Card, EmptyState, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { usePresenceLeave } from '../lib/hooks/usePresenceLeave.ts'
import { formatDateTime } from '../lib/dates.ts'
import { readFileAsDataURL } from '../lib/readFile.ts'
import {
  AtSign,
  CalendarDays,
  ImagePlus,
  Package,
  Pin,
  Search,
  Send,
  ShoppingCart,
  SmilePlus,
  X,
} from 'lucide-react'
import styles from './ChatPage.module.css'

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏']

const PAGE_SIZE = 30

const CHAT_KEY = ['chat-tail']

type SearchKind = 'all' | 'item' | 'event' | 'trip' | 'photo'

const SEARCH_KINDS: { key: SearchKind; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'item', label: 'Ítems' },
  { key: 'event', label: 'Eventos' },
  { key: 'trip', label: 'Mandados' },
  { key: 'photo', label: 'Fotos' },
]

interface PickerState {
  open: boolean
  mode: PickerMode
  seed: string
  viaAt: boolean
}

const CLOSED_PICKER: PickerState = { open: false, mode: 'all', seed: '', viaAt: false }

export default function ChatPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [pendingRefs, setPendingRefs] = useState<MessageRef[]>([])
  const [picker, setPicker] = useState<PickerState>(CLOSED_PICKER)
  const [error, setError] = useState<string | null>(null)

  // Historico con lazy load (paginación + infinite scroll)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const initialized = useRef(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const scrollInfo = useRef<{ top: number; height: number } | null>(null)

  // Búsqueda
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchKind, setSearchKind] = useState<SearchKind>('all')

  const fileInput = useRef<HTMLInputElement>(null)
  const composerInput = useRef<HTMLInputElement>(null)
  useDocumentTitle('Chat de la familia · Grocery Planner')
  usePresenceLeave(ME)

  const { data: tailData, isLoading, isError, error: queryError } = useQuery({
    queryKey: CHAT_KEY,
    queryFn: () => chatPage(PAGE_SIZE),
    refetchInterval: 12_000,
  })

  const presence = useQuery({
    queryKey: ['chat', 'presence'],
    queryFn: () => presenceHeartbeat(ME, 'chat'),
    refetchInterval: 15_000,
  })
  const viewers = (presence.data ?? []).filter((p) => p.online && p.screen === 'chat')

  const homeQ = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false, staleTime: 30_000 })
  const members = useMemo(
    () => (homeQ.data?.members ?? []).map((m) => m.name),
    [homeQ.data],
  )
  const itemsQ = useQuery({ queryKey: ['chat-pick', 'items'], queryFn: listItems, staleTime: 30_000 })
  const eventsQ = useQuery({ queryKey: ['chat-pick', 'events'], queryFn: listEvents, staleTime: 30_000 })
  const tripsQ = useQuery({ queryKey: ['chat-pick', 'trips'], queryFn: listTrips, staleTime: 30_000 })

  /** Carga inicial y merge del último batch (la "cola" reciente). */
  useEffect(() => {
    if (!tailData) return
    if (!initialized.current) {
      initialized.current = true
      setMessages(tailData.messages)
      setHasMore(tailData.hasMore)
      requestAnimationFrame(() => scrollToBottom(false))
      return
    }
    setMessages((prev) => {
      const prevById = new Map(prev.map((m) => [m.id, m]))
      // Cambios sobre mensajes existentes (fijar, reaccionar, mensajes de
      // sistema que se derivan del historial) también deben reflejarse: no
      // basta con ver si llegan ids nuevos.
      const changed = tailData.messages.some((m) => {
        const before = prevById.get(m.id)
        return !before || JSON.stringify(before) !== JSON.stringify(m)
      })
      if (!changed) return prev
      const byId = new Map(prevById)
      for (const m of tailData.messages) byId.set(m.id, m)
      return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at))
    })
  }, [tailData])

  /** Baja al final cuando llegan mensajes nuevos y estás cerca del fondo. */
  useEffect(() => {
    const el = threadRef.current
    if (!el || messages.length === 0 || searchOpen) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom) scrollToBottom(true)
  }, [messages.length, searchOpen])

  /** Preserva la posición del scroll al prependear mensajes viejos. */
  useLayoutEffect(() => {
    const el = threadRef.current
    if (el && scrollInfo.current) {
      el.scrollTop = scrollInfo.current.top + (el.scrollHeight - scrollInfo.current.height)
      scrollInfo.current = null
    }
  }, [messages.length])

  useEffect(() => {
    markMentionsRead(ME)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['notif-mentions'] })
        queryClient.invalidateQueries({ queryKey: ['notif-unread'] })
      })
      .catch(() => {})
  }, [queryClient])

  const scrollToBottom = (smooth = true) => {
    const el = threadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  /** Carga la página de mensajes más viejos que el primero visible. */
  const loadOlder = async () => {
    if (isLoadingOlder || !hasMore || messages.length === 0 || searchOpen) return
    const el = threadRef.current
    if (el) scrollInfo.current = { top: el.scrollTop, height: el.scrollHeight }
    setIsLoadingOlder(true)
    try {
      const page = await chatPage(PAGE_SIZE, `${messages[0].at}|${messages[0].id}`)
      setMessages((prev) => {
        const byId = new Map(page.messages.map((m) => [m.id, m]))
        for (const m of prev) byId.set(m.id, m)
        return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at))
      })
      setHasMore(page.hasMore)
    } catch {
      // silencioso: se reintenta al volver a tocar el tope
    } finally {
      setIsLoadingOlder(false)
    }
  }

  const handleThreadScroll = () => {
    const el = threadRef.current
    if (!el || isLoadingOlder || !hasMore || searchOpen) return
    if (el.scrollTop < 100) loadOlder()
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CHAT_KEY })
    queryClient.invalidateQueries({ queryKey: ['chat-search'] })
  }

  const sendMutation = useMutation({
    mutationFn: () =>
      sendChatMessage({
        by: ME,
        body,
        photo: photo ?? undefined,
        refs: pendingRefs,
      }),
    onSuccess: () => {
      setBody('')
      setPhoto(null)
      setPendingRefs([])
      setError(null)
      invalidate()
      scrollToBottom(true)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo enviar'),
  })

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      reactToMessage(id, emoji, ME),
    onSuccess: invalidate,
  })

  const pinMutation = useMutation({
    mutationFn: (id: string) => togglePinnedMessage(id),
    onSuccess: invalidate,
  })

  const pickPhoto = async (file?: File) => {
    if (!file) return
    try {
      setPhoto(await readFileAsDataURL(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la foto')
    }
  }

  const searchResult = useQuery({
    queryKey: ['chat-search', searchQuery.trim(), searchKind],
    queryFn: () =>
      chatSearch({
        query: searchQuery.trim() || undefined,
        refKind:
          searchKind === 'item' ? 'item' : searchKind === 'event' ? 'event' : searchKind === 'trip' ? 'trip' : undefined,
        hasPhoto: searchKind === 'photo' ? true : undefined,
      }),
    enabled: searchOpen,
  })

  const pinned = messages.filter((m) => m.pinned)
  const visible = messages

  const submit = () => {
    if (!body.trim() && !photo && pendingRefs.length === 0) return
    sendMutation.mutate()
  }

  /** Detecta `@` al final del texto para abrir el buscador de menciones. */
  const handleComposerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBody(value)
    const m = /(?:^|\s)@([^\s@]*)$/.exec(value)
    if (m) {
      queryClient.invalidateQueries({ queryKey: ['chat-pick'] })
      setPicker({ open: true, mode: 'all', seed: m[1], viaAt: true })
    } else if (picker.viaAt) {
      setPicker((p) => ({ ...p, open: false }))
    }
  }

  const openPickerMode = (mode: PickerMode) => {
    // Los buscadores de refs (eventos/mandados) siempre abren con datos al día:
    // en desktop no hay SSE, así que se invalidan aquí on-demand (SPEC §11.1).
    queryClient.invalidateQueries({ queryKey: ['chat-pick'] })
    setPicker({ open: true, mode, seed: '', viaAt: false })
  }

  const handleCancel = () => {
    setPicker(CLOSED_PICKER)
    requestAnimationFrame(() => composerInput.current?.focus())
  }

  const handlePick = (s: Suggestion) => {
    const insertMention = (name: string) => {
      setBody((prev) => {
        const m = /(?:^|\s)@([^\s@]*)$/.exec(prev)
        if (m) {
          const atPos = m.index + m[0].indexOf('@')
          return (
            prev.slice(0, atPos) +
            `@${name} ` +
            prev.slice(atPos + m[1].length + 1)
          )
        }
        return prev ? `${prev}@${name} ` : `@${name} `
      })
    }
    insertMention(s.name)
    if (s.kind !== 'member') {
      setPendingRefs((prev) =>
        prev.some((r) => r.kind === s.kind && r.id === s.id)
          ? prev
          : [...prev, { kind: s.kind as MessageRefKind, id: s.id, name: s.name }],
      )
    }
    setPicker(CLOSED_PICKER)
    requestAnimationFrame(() => composerInput.current?.focus())
  }

  const removeRef = (r: MessageRef) => {
    setPendingRefs((prev) => prev.filter((x) => !(x.kind === r.kind && x.id === r.id)))
  }

  const openRef = (r: MessageRef) => {
    if (r.kind === 'item') navigate(`/items/${r.id}`)
    else if (r.kind === 'event') navigate(`/events/${r.id}`)
    else navigate(`/trips/${r.id}`)
  }

  return (
    <Stack gap="4" className={styles.chat}>
      <header className={styles.headerRow}>
        <div className={styles.headerText}>
          <Text as="h1" variant="h1">
            Chat de la familia
          </Text>
          <Text as="p" variant="note" tone="secondary">
            {viewers.length > 0
              ? `${viewers.length} ${viewers.length === 1 ? 'persona viendo' : 'personas viendo'} el chat`
              : 'Hablen del mandado, la despensa y lo que sobra.'}
          </Text>
        </div>
        <div className={styles.headerActions}>
          {viewers.length > 0 && <PresenceStrip users={viewers} />}
          <button
            type="button"
            className={styles.searchToggle}
            onClick={() => setSearchOpen((o) => !o)}
            aria-pressed={searchOpen}
            aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en el chat'}
            title="Buscar en el chat"
          >
            <Search size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            <input
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar: texto, persona, ítem, evento, mandado…"
              aria-label="Buscar en el chat"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={styles.searchChips} role="group" aria-label="Filtrar búsqueda">
            {SEARCH_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className={`${styles.searchChip} ${searchKind === k.key ? styles.searchChipActive : ''}`}
                onClick={() => setSearchKind(k.key)}
                aria-pressed={searchKind === k.key}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isError && (
        <Card padding="sm">
          <Text variant="note" tone="danger">
            {queryError instanceof Error ? queryError.message : 'No se pudo cargar el chat.'}
          </Text>
        </Card>
      )}
      {error && <Chip tone="danger">{error}</Chip>}

      {!searchOpen && pinned.length > 0 && (
        <Card padding="sm">
          <Stack gap="1">
            <Text variant="label" uppercase tone="secondary">
              Fijados
            </Text>
            {pinned.map((m) => (
              <Text key={m.id} variant="note" truncate>
                <Pin size={12} aria-hidden="true" /> {m.body || '📷 foto'}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

      <div className={styles.thread} ref={threadRef} onScroll={handleThreadScroll} aria-live="polite">
        {searchOpen ? (
          searchResult.isLoading ? (
            <Stack gap="3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rect" height={56} />
              ))}
            </Stack>
          ) : searchResult.data && searchResult.data.messages.length > 0 ? (
            <Stack gap="2">
              <Text variant="note" tone="tertiary">
                {searchResult.data.total} {searchResult.data.total === 1 ? 'resultado' : 'resultados'}
              </Text>
              {searchResult.data.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={m.by === ME}
                  onReact={(emoji) => reactMutation.mutate({ id: m.id, emoji })}
                  onPin={() => pinMutation.mutate(m.id)}
                  onOpenRef={openRef}
                />
              ))}
            </Stack>
          ) : (
            <EmptyState
              icon={<Search size={28} strokeWidth={2} aria-hidden="true" />}
              title="Sin resultados"
              description="Prueba con otra palabra o quita filtros: busca por texto, persona, ítem, evento, mandado o fotos."
            />
          )
        ) : isLoading ? (
          <Stack gap="3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rect" height={56} />
            ))}
          </Stack>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Send size={28} strokeWidth={2} aria-hidden="true" />}
            title="Aún no hay mensajes"
            description="Escríbele a tu familia: 'no había canela, ¿la compro de otra marca?'"
          />
        ) : (
          <Stack gap="2">
            {isLoadingOlder && <Chip tone="muted">Cargando mensajes anteriores…</Chip>}
            {visible.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.by === ME}
                onReact={(emoji) => reactMutation.mutate({ id: m.id, emoji })}
                onPin={() => pinMutation.mutate(m.id)}
                onOpenRef={openRef}
              />
            ))}
          </Stack>
        )}
      </div>

      {photo && (
        <Card padding="sm">
          <div className={styles.photoPreview}>
            <img src={photo} alt="Foto por enviar" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPhoto(null)}
              aria-label="Quitar foto"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </Card>
      )}

      <div className={styles.composer}>
        <MentionPicker
          open={picker.open}
          mode={picker.mode}
          seed={picker.seed}
          members={members}
          items={itemsQ.data ?? []}
          events={eventsQ.data ?? []}
          trips={tripsQ.data ?? []}
          onPick={handlePick}
          onCancel={handleCancel}
        />

        {pendingRefs.length > 0 && (
          <div className={styles.refsRow} aria-label="Referencias del mensaje">
            {pendingRefs.map((r) => (
              <span key={`${r.kind}-${r.id}`} className={styles.refChip}>
                <RefIcon kind={r.kind} />
                <span className={styles.refChipName}>{r.name}</span>
                <button
                  type="button"
                  className={styles.refRemove}
                  onClick={() => removeRef(r)}
                  aria-label={`Quitar ${r.name}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.toolbar} role="group" aria-label="Mencionar algo">
          <button type="button" className={styles.toolBtn} onClick={() => openPickerMode('member')} aria-label="Mencionar una persona">
            <AtSign size={16} strokeWidth={2} aria-hidden="true" /> Persona
          </button>
          <button type="button" className={styles.toolBtn} onClick={() => openPickerMode('item')} aria-label="Mencionar un ítem">
            <Package size={16} strokeWidth={2} aria-hidden="true" /> Ítem
          </button>
          <button type="button" className={styles.toolBtn} onClick={() => openPickerMode('event')} aria-label="Mencionar un evento">
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" /> Evento
          </button>
          <button type="button" className={styles.toolBtn} onClick={() => openPickerMode('trip')} aria-label="Mencionar un mandado">
            <ShoppingCart size={16} strokeWidth={2} aria-hidden="true" /> Mandado
          </button>
        </div>

        <div className={styles.inputRow}>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            aria-hidden="true"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            aria-label="Adjuntar foto"
          >
            <ImagePlus size={20} aria-hidden="true" />
          </Button>
          <input
            ref={composerInput}
            className={styles.input}
            placeholder="Escribe @ para mencionar a alguien…"
            value={body}
            onChange={handleComposerChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            aria-label="Mensaje del chat"
          />
          <Button
            onClick={submit}
            loading={sendMutation.isPending}
            disabled={!body.trim() && !photo && pendingRefs.length === 0}
            aria-label="Enviar mensaje"
          >
            <Send size={20} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Stack>
  )
}

function RefIcon({ kind }: { kind: MessageRefKind }) {
  const size = 14
  if (kind === 'item') return <Package size={size} strokeWidth={2} aria-hidden="true" />
  if (kind === 'event') return <CalendarDays size={size} strokeWidth={2} aria-hidden="true" />
  return <ShoppingCart size={size} strokeWidth={2} aria-hidden="true" />
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Resalta menciones @Nombre y convierte las de ítems/eventos/mandados en links. */
function renderBody(
  body: string,
  mentions: string[],
  refs: MessageRef[],
  onOpenRef: (r: MessageRef) => void,
) {
  const refByName = new Map<string, MessageRef>()
  for (const r of refs) if (!refByName.has(r.name)) refByName.set(r.name, r)
  const allNames = [...new Set([...mentions, ...refByName.keys()])]
  if (allNames.length === 0) return body
  const re = new RegExp(`(@(?:${allNames.map(escapeRegex).join('|')}))(?=[\\s.,;:!?]|$)`, 'g')
  return body.split(re).map((part, i) => {
    if (!part || part[0] !== '@') return part
    const name = part.slice(1)
    const ref = refByName.get(name)
    if (ref) {
      return (
        <a
          key={i}
          href="#"
          className={styles.mentionLink}
          onClick={(e) => {
            e.preventDefault()
            onOpenRef(ref)
          }}
        >
          {part}
        </a>
      )
    }
    return (
      <span key={i} className={styles.mention}>
        {part}
      </span>
    )
  })
}

interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  onReact: (emoji: string) => void
  onPin: () => void
  onOpenRef: (r: MessageRef) => void
}

function MessageBubble({ message, mine, onReact, onPin, onOpenRef }: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const holdTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const holdStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pickerOpen) return
    function onDocDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('pointerdown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  useEffect(
    () => () => {
      clearTimeout(holdTimer.current ?? undefined)
      clearTimeout(hideTimer.current ?? undefined)
    },
    [],
  )

  const isSystem = message.kind === 'system'
  if (isSystem) {
    return (
      <div className={styles.system} role="status">
        <Text variant="note" tone="secondary" align="center">
          {message.body}
        </Text>
      </div>
    )
  }

  const canHover = () => window.matchMedia?.('(hover: hover)').matches ?? true

  const openPicker = () => {
    clearTimeout(hideTimer.current ?? undefined)
    setPickerOpen(true)
  }
  const scheduleClose = () => {
    clearTimeout(hideTimer.current ?? undefined)
    hideTimer.current = window.setTimeout(() => setPickerOpen(false), 200)
  }
  const cancelClose = () => clearTimeout(hideTimer.current ?? undefined)

  const startHold = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    holdStart.current = { x: e.clientX, y: e.clientY }
    clearTimeout(holdTimer.current ?? undefined)
    holdTimer.current = window.setTimeout(openPicker, 420)
  }
  const moveHold = (e: React.PointerEvent) => {
    if (!holdStart.current) return
    const dx = e.clientX - holdStart.current.x
    const dy = e.clientY - holdStart.current.y
    if (Math.abs(dx) + Math.abs(dy) > 12) cancelHold()
  }
  const cancelHold = () => {
    holdStart.current = null
    clearTimeout(holdTimer.current ?? undefined)
  }

  const pick = (emoji: string) => {
    onReact(emoji)
    setPickerOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.bubbleRow} ${mine ? styles.mine : ''}`}
      onMouseEnter={() => {
        if (canHover()) openPicker()
      }}
      onMouseLeave={() => {
        if (canHover()) scheduleClose()
      }}
      onPointerDown={startHold}
      onPointerMove={moveHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
    >
      {!mine && <Avatar name={message.by} size="sm" />}
      <div className={`${styles.bubble} ${mine ? styles.bubbleMine : ''}`}>
        {!mine && (
          <Text variant="label" tone="secondary">
            {message.by}
          </Text>
        )}
        {message.itemName && (
          <Chip tone="info" size="sm">
            Acerca de: {message.itemName}
          </Chip>
        )}
        {message.body && (
          <Text variant="body">
            {renderBody(message.body, message.mentions, message.refs, onOpenRef)}
          </Text>
        )}
        {message.refs.length > 0 && (() => {
          const inline = new Set<string>()
          for (const r of message.refs) {
            if (message.body.includes(`@${r.name}`)) inline.add(r.name)
          }
          const orphan = message.refs.filter((r) => !inline.has(r.name))
          if (orphan.length === 0) return null
          return (
            <div className={styles.refsRow}>
              {orphan.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  className={styles.refChip}
                  onClick={() => onOpenRef(r)}
                >
                  <RefIcon kind={r.kind} />
                  <span className={styles.refChipName}>{r.name}</span>
                </button>
              ))}
            </div>
          )
        })()}
        {message.photo && (
          <img className={styles.photo} src={message.photo} alt="Foto del chat" />
        )}
        <div className={styles.meta}>
          <Text variant="note" tone="tertiary">
            {formatDateTime(message.at)}
          </Text>
          <span className={styles.metaActions}>
            <button
              type="button"
              className={styles.reactBtn}
              onClick={() => setPickerOpen((o) => !o)}
              aria-pressed={pickerOpen}
              aria-label="Reaccionar"
              title="Reaccionar"
            >
              <SmilePlus size={15} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.pinBtn}
              onClick={onPin}
              aria-label={message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
            >
              <Pin size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        </div>
        {message.reactions.length > 0 && (
          <div className={styles.reactions}>
            {message.reactions.map((r, i) => (
              <span key={i} className={styles.reaction}>
                {r.emoji} {r.by}
              </span>
            ))}
          </div>
        )}
        {pickerOpen && (
          <div
            className={`${styles.quickReactions} ${mine ? styles.quickMine : ''}`}
            onMouseEnter={cancelClose}
            onMouseLeave={() => {
              if (canHover()) scheduleClose()
            }}
            role="group"
            aria-label="Reaccionar"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.quickBtn}
                onClick={() => pick(emoji)}
                aria-label={`Reaccionar con ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
