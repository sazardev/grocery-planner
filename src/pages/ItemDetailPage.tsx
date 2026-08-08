import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Trash2, ArrowLeft, MessageSquare, History } from 'lucide-react'
import {
  addItemComment,
  assignItem,
  changeItemStatus,
  deleteItem,
  getHome,
  getItem,
  getItemHistory,
  listSections,
  moveItem,
  setItemPrice,
  setItemSection,
  updateItem,
} from '../lib/api'
import { ME } from '../lib/me'
import type { ItemComment, ItemEvent, ItemEventKind, ItemStatus, Priority } from '../domain/item'
import { STATUS_LABEL } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Field from '../shared/ui/form/Field.tsx'
import Input from '../shared/ui/form/Input.tsx'
import Textarea from '../shared/ui/form/Textarea.tsx'
import Select from '../shared/ui/form/Select.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { PRIORITY_LABEL, PRIORITY_TONE } from './itemPriority.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import styles from './ItemDetailPage.module.css'

function historyText(kind: ItemEventKind): string {
  switch (kind.type) {
    case 'created':
      return 'lo agregó'
    case 'status_changed':
      return `lo cambió de ${STATUS_LABEL[kind.from]} a ${STATUS_LABEL[kind.to]}`
    case 'assigned':
      return `lo asignó a ${kind.member}`
    case 'cancelled':
      return kind.reason ? `lo canceló (${kind.reason})` : 'lo canceló'
    case 'commented':
      return 'comentó'
    case 'updated':
      return 'editó'
    case 'priority_changed':
      return `cambió la prioridad de ${PRIORITY_LABEL[kind.from]} a ${PRIORITY_LABEL[kind.to]}`
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError, error } = useQuery({
    queryKey: ['item', id],
    queryFn: () => getItem(id ?? ''),
    enabled: Boolean(id),
  })

  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false })
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: listSections })
  const historyQuery = useQuery({
    queryKey: ['item', id, 'history'],
    queryFn: () => getItemHistory(id ?? ''),
    enabled: Boolean(id),
  })

  useMeta({
    title: item ? `Editar ${item.name} · Grocery Planner` : 'Editar ítem · Grocery Planner',
    description: item
      ? `Falta ${item.quantity} ${item.unit} de ${item.name} (pedido por ${item.requestedBy}) en la lista de compras de la familia.`
      : 'Edita un ítem de la lista de compras.',
    path: item ? `/items/${item.id}` : undefined,
  })

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [priority, setPriority] = useState<Priority>('media')
  const [commentBody, setCommentBody] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const invalidateItem = () => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
    queryClient.invalidateQueries({ queryKey: ['item', id] })
  }

  // Sincroniza el formulario con el ítem cargado.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (item && loadedFor !== item.id) {
    setName(item.name)
    setQuantity(String(item.quantity))
    setUnit(item.unit)
    setNote(item.note ?? '')
    setCategory(item.category ?? '')
    setPrice(item.price != null ? String(item.price) : '')
    setPriority(item.priority)
    setLoadedFor(item.id)
    setSaved(false)
  }

  const updateMutation = useMutation({
    mutationFn: (fields: {
      name?: string
      quantity?: number
      unit?: string
      note?: string
      priority?: Priority
      category?: string
    }) => updateItem(item!.id, { by: ME, ...fields }),
    onSuccess: () => {
      invalidateItem()
      setSaveError(null)
      setSaved(true)
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar'),
  })

  const priceMutation = useMutation({
    mutationFn: (value: number) => setItemPrice(item!.id, value),
    onSuccess: invalidateItem,
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el precio'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(item!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      navigate('/')
    },
  })

  const moveMutation = useMutation({
    mutationFn: (direction: 'up' | 'down') => moveItem(item!.id, direction),
    onSuccess: invalidateItem,
  })

  const statusMutation = useMutation({
    mutationFn: (to: ItemStatus) => changeItemStatus(item!.id, to, ME),
    onSuccess: invalidateItem,
  })

  const assignMutation = useMutation({
    mutationFn: (member: string) => assignItem(item!.id, member, ME),
    onSuccess: invalidateItem,
  })

  const sectionMutation = useMutation({
    mutationFn: (section: string) => setItemSection(item!.id, section),
    onSuccess: invalidateItem,
  })

  const commentMutation = useMutation({
    mutationFn: (body: string) => addItemComment(item!.id, ME, body),
    onSuccess: () => {
      invalidateItem()
      setCommentBody('')
    },
  })

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const submit = () => {
    if (!item) return
    const qty = Number(quantity)
    const fields: {
      name?: string
      quantity?: number
      unit?: string
      note?: string
      priority?: Priority
      category?: string
    } = {}
    if (name.trim() && name.trim() !== item.name) fields.name = name.trim()
    if (Number.isFinite(qty) && qty > 0 && qty !== item.quantity) fields.quantity = qty
    if (unit.trim() && unit.trim() !== item.unit) fields.unit = unit.trim()
    if (note.trim() !== (item.note ?? '')) fields.note = note.trim()
    if (category.trim() !== (item.category ?? '')) fields.category = category.trim()
    if (priority !== item.priority) fields.priority = priority
    if (Object.keys(fields).length > 0) updateMutation.mutate(fields)
    const priceNum = Number(price)
    if (price.trim() !== '' && Number.isFinite(priceNum) && priceNum >= 0 && priceNum !== item.price) {
      priceMutation.mutate(priceNum)
    }
    if (Object.keys(fields).length === 0 && price.trim() === '') setSaved(true)
  }

  const pendingStatuses: ItemStatus[] = (
    ['falta', 'pedido', 'llevo', 'comprado', 'cancelado'] as ItemStatus[]
  ).filter((s) => s !== item?.status)

  if (isLoading || !item) {
    return (
      <Stack gap="4">
        <Skeleton variant="rect" height={120} />
        <Skeleton variant="rect" height={200} />
      </Stack>
    )
  }

  if (isError) {
    return (
      <Stack gap="4">
        <Alert tone="danger" title="No se pudo cargar el ítem.">
          {error instanceof Error ? error.message : 'Intenta de nuevo.'}
        </Alert>
        <Button variant="secondary" onClick={goBack}>
          Volver a la lista
        </Button>
      </Stack>
    )
  }

  const members = homeQuery.data?.members ?? []
  const sections = sectionsQuery.data ?? []
  const comments: ItemComment[] = item.comments ?? []
  const history: ItemEvent[] = historyQuery.data ?? []

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a la lista" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          Editar ítem
        </Text>
        <div className={styles.headerSpacer} />
        <ShareButton
          title={`${item.name} · Grocery Planner`}
          text={`Falta ${item.quantity} ${item.unit} de ${item.name} (pedido por ${item.requestedBy})`}
          url={`/items/${item.id}`}
        />
      </header>

      <Card padding="lg">
        <Stack gap="4">
          <Text variant="item" className={styles.itemName}>
            {item.name}
          </Text>
          <Text variant="note" tone="secondary">
            Pedido por {item.requestedBy} · {STATUS_LABEL[item.status]}
          </Text>

          {saveError && <Alert tone="danger">{saveError}</Alert>}
          {saved && !saveError && (
            <Alert tone="success">Guardado. La lista se actualizó.</Alert>
          )}

          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pollo" autoFocus />
          </Field>

          <div className={styles.rowFields}>
            <Field label="Cantidad">
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="2"
              />
            </Field>
            <Field label="Unidad">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" />
            </Field>
          </div>

          <div className={styles.rowFields}>
            <Field label="Categoría">
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="carnes, lácteos…"
              />
            </Field>
            <Field label="Precio aprox. ($)">
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="120"
              />
            </Field>
          </div>

          <Field label="Nota">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="pechugas, no muslos…"
              rows={2}
            />
          </Field>

          <Field label="Quién lo lleva">
            <Select
              value={item.assignedTo ?? ''}
              onChange={(e) => e.target.value && assignMutation.mutate(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>

          {sections.length > 0 && (
            <Field label="Sección de la lista">
              <Select
                value={item.section ?? ''}
                onChange={(e) => e.target.value && sectionMutation.mutate(e.target.value)}
              >
                <option value="">Sin sección</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </Stack>
      </Card>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          Prioridad
        </Text>
        <div className={styles.chipRow}>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <Chip
              key={p}
              tone={p === priority ? PRIORITY_TONE[p] : 'muted'}
              onClick={() => setPriority(p)}
              className={p === priority ? styles.chipActive : ''}
            >
              {PRIORITY_LABEL[p]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          Estado
        </Text>
        <div className={styles.chipRow}>
          {pendingStatuses.map((s) => (
            <Chip key={s} onClick={() => statusMutation.mutate(s)}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          Orden en la lista
        </Text>
        <div className={styles.moveRow}>
          <Button variant="secondary" iconLeft={<ArrowUp size={18} strokeWidth={2} />} onClick={() => moveMutation.mutate('up')}>
            Subir
          </Button>
          <Button variant="secondary" iconLeft={<ArrowDown size={18} strokeWidth={2} />} onClick={() => moveMutation.mutate('down')}>
            Bajar
          </Button>
        </div>
      </section>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          <MessageSquare size={16} aria-hidden="true" /> Comentarios de la familia
        </Text>
        <Stack gap="3">
          {comments.length === 0 ? (
            <Text variant="note" tone="secondary">
              Aún no hay comentarios. Cuenta qué marca prefieren o aclara el pedido.
            </Text>
          ) : (
            comments.map((c) => (
              <Card key={c.id} padding="sm">
                <Stack gap="1">
                  <Text variant="note" tone="secondary">
                    <strong>{c.by}</strong> · {formatTime(c.at)}
                  </Text>
                  <Text variant="body">{c.body}</Text>
                </Stack>
              </Card>
            ))
          )}
          <Textarea
            label="Comentar"
            placeholder="esta marca es la buena…"
            rows={2}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          />
          <Button
            onClick={() => commentBody.trim() && commentMutation.mutate(commentBody.trim())}
            loading={commentMutation.isPending}
            disabled={!commentBody.trim()}
          >
            Comentar
          </Button>
        </Stack>
      </section>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          <History size={16} aria-hidden="true" /> Historial
        </Text>
        <Stack gap="2">
          {history.length === 0 ? (
            <Text variant="note" tone="secondary">
              Sin movimientos todavía.
            </Text>
          ) : (
            history.map((ev, i) => (
              <div key={i} className={styles.historyRow}>
                <span className={styles.historyDot} />
                <Text variant="note" tone="secondary">
                  <strong>{ev.by}</strong> {historyText(ev.kind)} · {formatTime(ev.at)}
                </Text>
              </div>
            ))
          )}
        </Stack>
      </section>

      <Button onClick={submit} full loading={updateMutation.isPending || priceMutation.isPending}>
        Guardar cambios
      </Button>

      <Button variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending} full>
        <Trash2 size={18} strokeWidth={2} />
        Eliminar ítem
      </Button>
    </Stack>
  )
}
