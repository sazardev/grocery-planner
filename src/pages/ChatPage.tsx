import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listChat,
  reactToMessage,
  sendChatMessage,
  togglePinnedMessage,
} from '../lib/api'
import { ME } from '../lib/me'
import type { ChatMessage } from '../domain/chat'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Button, Card, EmptyState, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { formatDateTime } from '../lib/dates.ts'
import { readFileAsDataURL } from '../lib/readFile.ts'
import { ImagePlus, Pin, Send, X } from 'lucide-react'
import styles from './ChatPage.module.css'

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏']

const CHAT_KEY = ['chat']

export default function ChatPage() {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useDocumentTitle('Chat de la familia · Grocery Planner')

  const {
    data: messages = [],
    isLoading,
    isError,
    error: queryError,
  } = useQuery({ queryKey: CHAT_KEY, queryFn: listChat, refetchInterval: 8_000 })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CHAT_KEY })

  const sendMutation = useMutation({
    mutationFn: () =>
      sendChatMessage({ by: ME, body, photo: photo ?? undefined }),
    onSuccess: () => {
      setBody('')
      setPhoto(null)
      setError(null)
      invalidate()
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

  const pinned = messages.filter((m) => m.pinned)
  const visible = pinned.length > 0 ? messages : messages

  const submit = () => {
    if (!body.trim() && !photo) return
    sendMutation.mutate()
  }

  return (
    <Stack gap="4">
      <header>
        <Text as="h1" variant="h1">
          Chat de la familia
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Hablen del mandado, la despensa y lo que sobra.
        </Text>
      </header>

      {isError && (
        <Card padding="sm">
          <Text variant="note" tone="danger">
            {queryError instanceof Error ? queryError.message : 'No se pudo cargar el chat.'}
          </Text>
        </Card>
      )}
      {error && <Chip tone="danger">{error}</Chip>}

      {pinned.length > 0 && (
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

      <div className={styles.thread} aria-live="polite">
        {isLoading ? (
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
            {visible.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.by === ME}
                onReact={(emoji) => reactMutation.mutate({ id: m.id, emoji })}
                onPin={() => pinMutation.mutate(m.id)}
              />
            ))}
          </Stack>
        )}
        <div ref={endRef} />
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
          className={styles.input}
          placeholder="Escribe un mensaje… (@María para avisarle)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
          disabled={!body.trim() && !photo}
          aria-label="Enviar mensaje"
        >
          <Send size={20} aria-hidden="true" />
        </Button>
      </div>
    </Stack>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  onReact: (emoji: string) => void
  onPin: () => void
}

function MessageBubble({ message, mine, onReact, onPin }: MessageBubbleProps) {
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
  return (
    <div className={`${styles.bubbleRow} ${mine ? styles.mine : ''}`}>
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
        {message.body && <Text variant="body">{message.body}</Text>}
        {message.photo && (
          <img className={styles.photo} src={message.photo} alt="Foto del chat" />
        )}
        <div className={styles.meta}>
          <Text variant="note" tone="tertiary">
            {formatDateTime(message.at)}
          </Text>
          <button
            type="button"
            className={styles.pinBtn}
            onClick={onPin}
            aria-label={message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
          >
            <Pin size={14} strokeWidth={2} aria-hidden="true" />
          </button>
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
        <div className={styles.emojiRow} aria-label="Reaccionar">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.emojiBtn}
              onClick={() => onReact(emoji)}
              aria-label={`Reaccionar con ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
