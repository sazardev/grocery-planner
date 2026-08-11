import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Trash2, ArrowLeft, MessageSquare, History, Camera, Undo2, Plus, X } from 'lucide-react'
import {
  addItemComment,
  addItemPhoto,
  addItemFallback,
  assignItem,
  unassignItem,
  changeItemStatus,
  deleteItem,
  getChatForItem,
  getHome,
  getItem,
  getItemHistory,
  getRules,
  listSections,
  moveItem,
  recoverItem,
  removeItemFallback,
  removeItemPhoto,
  setItemBrand,
  setItemPrice,
  setItemQuantityMax,
  setItemSection,
  setItemStore,
  setItemAisle,
  updateItem,
  applyItemFallback,
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
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import { readFileAsDataURL } from '../lib/readFile.ts'
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
    case 'fallback_used':
      return `no había ${kind.from}; usó ${kind.to}`
    case 'fallbacks_changed':
      return 'cambió las alternativas'
    case 'price_changed':
      return `puso precio de ${kind.price}`
    case 'section_changed':
      return `la movió a la sección ${kind.section}`
    case 'store_changed':
      return `dijo que se consigue en ${kind.store}`
    case 'aisle_changed':
      return kind.aisle ? `la puso en el pasillo ${kind.aisle}` : 'le quitó el pasillo'
    case 'photos_changed':
      return 'cambió las fotos'
    case 'deleted':
      return 'lo movió a la papelera'
    case 'recovered':
      return 'lo recuperó a la lista'
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
    refetchInterval: 15_000,
  })

  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false })
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: listSections })
  const rulesQuery = useQuery({ queryKey: ['rules'], queryFn: getRules })
  const historyQuery = useQuery({
    queryKey: ['item-history', id],
    queryFn: () => getItemHistory(id ?? ''),
    enabled: Boolean(id),
  })
  const itemChatQuery = useQuery({
    queryKey: ['item-chat', id],
    queryFn: () => getChatForItem(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: 15_000,
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
  const [brand, setBrand] = useState('')
  const [quantityMax, setQuantityMax] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [priority, setPriority] = useState<Priority>('media')
  const [assignedTo, setAssignedTo] = useState('')
  const [section, setSection] = useState('')
  const [store, setStore] = useState('')
  const [aisle, setAisle] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Editor de alternativas ("si no hay X, trae Y")
  const [fbName, setFbName] = useState('')
  const [fbQty, setFbQty] = useState('')
  const [fbUnit, setFbUnit] = useState('')
  const [fbNote, setFbNote] = useState('')

  const invalidateItem = () => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
    queryClient.invalidateQueries({ queryKey: ['item', id] })
  }

  const goBack = useGoBack('/home')

  // Al guardar: muestra la confirmación y luego vuelve a la lista (feedback +
  // navegación). Se dispara una sola vez aunque varias mutations se resuelvan
  // en el mismo "Guardar cambios".
  const saveTimerRef = useRef<number | null>(null)
  const markSaved = () => {
    setSaveError(null)
    setSaved(true)
    if (saveTimerRef.current != null) return
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      goBack()
    }, 900)
  }
  useEffect(() => () => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
  }, [])

  // Sincroniza el formulario con el ítem cargado.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (item && loadedFor !== item.id) {
    setName(item.name)
    setQuantity(String(item.quantity))
    setUnit(item.unit)
    setBrand(item.brand ?? '')
    setQuantityMax(item.quantityMax != null ? String(item.quantityMax) : '')
    setNote(item.note ?? '')
    setCategory(item.category ?? '')
    setPrice(item.price != null ? String(item.price) : '')
    setPriority(item.priority)
    setAssignedTo(item.assignedTo ?? '')
    setSection(item.section ?? '')
    setStore(item.store ?? '')
    setAisle(item.aisle ?? '')
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
      markSaved()
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar'),
  })

  const priceMutation = useMutation({
    mutationFn: (value: number) => setItemPrice(item!.id, value, ME),
    onSuccess: () => {
      invalidateItem()
      markSaved()
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el precio'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(item!.id, ME),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      navigate('/home')
    },
  })

  const moveMutation = useMutation({
    mutationFn: (direction: 'up' | 'down') => moveItem(item!.id, direction, ME),
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

  const unassignMutation = useMutation({
    mutationFn: () => unassignItem(item!.id, ME),
    onSuccess: invalidateItem,
  })

  const sectionMutation = useMutation({
    mutationFn: (section: string) => setItemSection(item!.id, section, ME),
    onSuccess: invalidateItem,
  })

  const commentMutation = useMutation({
    mutationFn: (body: string) => addItemComment(item!.id, ME, body),
    onSuccess: () => {
      invalidateItem()
      setCommentBody('')
    },
  })

  const photoFileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoMutation = useMutation({
    mutationFn: (photo: string) => addItemPhoto(item!.id, photo, ME),
    onSuccess: () => {
      invalidateItem()
      setPhotoError(null)
    },
    onError: (err) => setPhotoError(err instanceof Error ? err.message : 'No se pudo subir la foto'),
  })
  const removePhotoMutation = useMutation({
    mutationFn: (index: number) => removeItemPhoto(item!.id, index, ME),
    onSuccess: invalidateItem,
  })
  const recoverMutation = useMutation({
    mutationFn: () => recoverItem(item!.id, ME),
    onSuccess: () => {
      invalidateItem()
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
  const storeMutation = useMutation({
    mutationFn: (storeName: string) => setItemStore(item!.id, storeName, ME),
    onSuccess: invalidateItem,
  })

  const aisleMutation = useMutation({
    mutationFn: (value: string) => setItemAisle(item!.id, value, ME),
    onSuccess: invalidateItem,
  })

  const brandMutation = useMutation({
    mutationFn: (value: string) => setItemBrand(item!.id, value, ME),
    onSuccess: () => {
      invalidateItem()
      markSaved()
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la marca'),
  })

  const quantityMaxMutation = useMutation({
    mutationFn: (value: number | null) => setItemQuantityMax(item!.id, value, ME),
    onSuccess: () => {
      invalidateItem()
      markSaved()
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la cantidad máxima'),
  })

  const addFallbackMutation = useMutation({
    mutationFn: (body: { name: string; quantity: number; unit: string; note?: string }) =>
      addItemFallback(item!.id, body, ME),
    onSuccess: () => {
      invalidateItem()
      setFbName('')
      setFbQty('')
      setFbUnit('')
      setFbNote('')
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : 'No se pudo agregar la alternativa'),
  })

  const removeFallbackMutation = useMutation({
    mutationFn: (index: number) => removeItemFallback(item!.id, index, ME),
    onSuccess: invalidateItem,
  })

  const useFallbackMutation = useMutation({
    mutationFn: (index: number) => applyItemFallback(item!.id, index, ME),
    onSuccess: invalidateItem,
  })

  const pickPhoto = async (file?: File) => {
    if (!file) return
    try {
      photoMutation.mutate(await readFileAsDataURL(file))
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'No se pudo leer la foto')
    }
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
    if (brand.trim() !== (item.brand ?? '')) brandMutation.mutate(brand.trim())
    const max = quantityMax.trim() === '' ? null : Number(quantityMax)
    if (
      quantityMax.trim() !== '' && (!Number.isFinite(max) || max === null || max <= 0)
    ) {
      setSaveError('La cantidad máxima debe ser un número mayor que 0')
      return
    }
    if (max !== null && max !== item.quantityMax) quantityMaxMutation.mutate(max)
    else if (max === null && item.quantityMax != null) quantityMaxMutation.mutate(null)
    if (Object.keys(fields).length === 0 && price.trim() === '') setSaved(true)
  }

  const pendingStatuses: ItemStatus[] = (
    ['falta', 'pedido', 'llevo', 'comprado', 'cancelado'] as ItemStatus[]
  ).filter((s) => s !== item?.status)

  // "Dirty": hay un diff real entre el formulario y el ítem guardado. El botón
  // "Guardar cambios" solo se habilita/pinta cuando cambió algo.
  const dirty = (() => {
    if (!item) return false
    const qty = Number(quantity)
    const priceNum = price.trim() === '' ? undefined : Number(price)
    const max = quantityMax.trim() === '' ? undefined : Number(quantityMax)
    return (
      name.trim() !== item.name ||
      (Number.isFinite(qty) && qty !== item.quantity) ||
      unit.trim() !== item.unit ||
      brand.trim() !== (item.brand ?? '') ||
      (max !== undefined && max !== item.quantityMax) ||
      (max === undefined && item.quantityMax != null) ||
      note.trim() !== (item.note ?? '') ||
      category.trim() !== (item.category ?? '') ||
      (priceNum !== undefined && priceNum !== item.price) ||
      (priceNum === undefined && item.price != null) ||
      priority !== item.priority
    )
  })()

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
  // Siempre incluye al usuario actual y el valor ya asignado como opción de
  // "Quién lo lleva" (puede que ME o el asignado no figuren en los miembros).
  const assignOptions = Array.from(
    new Set([...members.map((m) => m.name), ME, ...(item.assignedTo ? [item.assignedTo] : [])]),
  ).sort((a, b) => a.localeCompare(b, 'es'))
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

          <Field label="Marca (opcional)">
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="la marca que nos gusta"
            />
          </Field>

          <Field label="Hasta cuánto aceptas (opcional)">
            <Input
              inputMode="decimal"
              value={quantityMax}
              onChange={(e) => setQuantityMax(e.target.value)}
              placeholder="ej. 3 (quiero 2, acepto hasta 3)"
            />
          </Field>

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
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value)
                if (e.target.value) assignMutation.mutate(e.target.value)
                else unassignMutation.mutate()
              }}
            >
              <option value="">Sin asignar</option>
              {assignOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          {sections.length > 0 && (
            <Field label="Sección de la lista">
              <Select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value)
                  if (e.target.value) sectionMutation.mutate(e.target.value)
                }}
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

          {(rulesQuery.data?.stores.length ?? 0) > 0 && (
            <Field label="Tienda donde se consigue">
              <Select
                value={store}
                onChange={(e) => {
                  setStore(e.target.value)
                  if (e.target.value) storeMutation.mutate(e.target.value)
                }}
              >
                <option value="">Sin tienda</option>
                {rulesQuery.data!.stores.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {store && (
            <Field label="Pasillo">
              <Input
                list="item-aisles"
                value={aisle}
                placeholder="ej. Lácteos"
                onChange={(e) => {
                  const value = e.target.value
                  setAisle(value)
                  aisleMutation.mutate(value)
                }}
                aria-label="Pasillo del ítem"
              />
              <datalist id="item-aisles">
                {rulesQuery.data?.stores
                  .find((s) => s.name === store)
                  ?.aisles.map((a) => (
                    <option key={a} value={a} />
                  ))}
              </datalist>
            </Field>
          )}
        </Stack>
      </Card>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          Si no hay {item.name}…
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Encadena qué traer si el producto no está: “si no hay pechuga, trae pierna; si no hay
          pierna, no traigas nada”. En la tienda se ofrece en orden.
        </Text>
        <Stack gap="2">
          {(item.fallbacks ?? []).length === 0 ? (
            <Text variant="note" tone="tertiary">
              Sin alternativas. Agrega la primera abajo.
            </Text>
          ) : (
            (item.fallbacks ?? []).map((fb, i) => (
              <Card key={`${fb.name}-${i}`} padding="sm">
                <Stack gap="2">
                  <div className={styles.fbRow}>
                    <div>
                      <Text variant="item">
                        {i + 1}. {fb.name}
                      </Text>
                      <Text variant="note" tone="secondary">
                        {fb.quantity} {fb.unit}
                        {fb.note ? ` · ${fb.note}` : ''}
                      </Text>
                    </div>
                    <div className={styles.fbActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => useFallbackMutation.mutate(i)}
                        loading={useFallbackMutation.isPending}
                        disabled={item.status === 'comprado' || item.status === 'cancelado'}
                        aria-label={`Traer ${fb.name} en su lugar`}
                      >
                        Traer en su lugar
                      </Button>
                      <IconButton
                        label={`Quitar alternativa ${i + 1}`}
                        onClick={() => removeFallbackMutation.mutate(i)}
                        variant="danger"
                      >
                        <X size={16} strokeWidth={2} />
                      </IconButton>
                    </div>
                  </div>
                </Stack>
              </Card>
            ))
          )}
          {addFallbackMutation.isError && (
            <Alert tone="danger">No se pudo agregar la alternativa.</Alert>
          )}
          <Card padding="sm">
            <Stack gap="2">
              <div className={styles.rowFields}>
                <Field label="Producto alternativo">
                  <Input
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                    placeholder="pierna de pollo"
                    aria-label="Producto alternativo"
                  />
                </Field>
                <Field label="Cantidad">
                  <Input
                    inputMode="decimal"
                    value={fbQty}
                    onChange={(e) => setFbQty(e.target.value)}
                    placeholder="2"
                    aria-label="Cantidad alternativa"
                  />
                </Field>
                <Field label="Unidad">
                  <Input
                    value={fbUnit}
                    onChange={(e) => setFbUnit(e.target.value)}
                    placeholder="kg"
                    aria-label="Unidad alternativa"
                  />
                </Field>
              </div>
              <Field label="Nota (opcional)">
                <Input
                  value={fbNote}
                  onChange={(e) => setFbNote(e.target.value)}
                  placeholder="mediano"
                  aria-label="Nota alternativa"
                />
              </Field>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!fbName.trim()) return
                  addFallbackMutation.mutate({
                    name: fbName.trim(),
                    quantity: Number(fbQty) || 1,
                    unit: fbUnit.trim() || 'pieza',
                    note: fbNote.trim() || undefined,
                  })
                }}
                loading={addFallbackMutation.isPending}
                disabled={!fbName.trim()}
              >
                <Plus size={16} strokeWidth={2} /> Agregar alternativa
              </Button>
            </Stack>
          </Card>
        </Stack>
      </section>

      <section>
        <Text as="h2" variant="section" className={styles.sectionTitle}>
          <Camera size={16} aria-hidden="true" /> Fotos ({item.photos?.length ?? 0})
        </Text>
        <Stack gap="2">
          {photoError && <Alert tone="danger">{photoError}</Alert>}
          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            hidden
            aria-hidden="true"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          {(item.photos ?? []).length > 0 && (
            <div className={styles.photoRow}>
              {item.photos.map((src, i) => (
                <div key={`${src.slice(0, 32)}-${i}`} className={styles.photoWrap}>
                  <img className={styles.photo} src={src} alt={`Foto ${i + 1} de ${item.name}`} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePhotoMutation.mutate(i)}
                    aria-label="Quitar foto"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={() => photoFileRef.current?.click()} loading={photoMutation.isPending}>
            <Camera size={16} aria-hidden="true" /> Subir foto
          </Button>
        </Stack>
      </section>

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

      {(item.status === 'cancelado' || item.deleted) && (
        <Alert tone="info">
          <div className={styles.recoverRow}>
            <Text variant="note">
              {item.deleted
                ? 'Este ítem está en la papelera. Recupéralo a la lista con su historial intacto.'
                : '¿Cancelado por error? Tráelo de vuelta a la lista con su historial intacto.'}
            </Text>
            <Button size="sm" onClick={() => recoverMutation.mutate()} loading={recoverMutation.isPending}>
              <Undo2 size={14} aria-hidden="true" /> Recuperar
            </Button>
          </div>
        </Alert>
      )}

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
          {history.length === 0 && (itemChatQuery.data ?? []).length === 0 ? (
            <Text variant="note" tone="secondary">
              Sin movimientos todavía.
            </Text>
          ) : (
            <>
              {history.map((ev, i) => (
                <div key={i} className={styles.historyRow}>
                  <span className={styles.historyDot} />
                  <Text variant="note" tone="secondary">
                    <strong>{ev.by}</strong> {historyText(ev.kind)} · {formatTime(ev.at)}
                  </Text>
                </div>
              ))}
              {(itemChatQuery.data ?? []).map((m) => (
                <div key={m.id} className={styles.historyRow}>
                  <span className={styles.historyDot} />
                  <Text variant="note" tone="secondary">
                    <strong>{m.by}</strong> en el chat: “{m.body}” · {formatTime(m.at)}
                  </Text>
                </div>
              ))}
            </>
          )}
        </Stack>
      </section>

      <Button
        onClick={submit}
        full
        variant={dirty ? 'primary' : 'secondary'}
        disabled={!dirty}
        loading={updateMutation.isPending || priceMutation.isPending}
      >
        {dirty ? 'Guardar cambios' : 'Sin cambios por guardar'}
      </Button>

      <Button variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending} full>
        <Trash2 size={18} strokeWidth={2} />
        Eliminar ítem
      </Button>
    </Stack>
  )
}
