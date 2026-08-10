import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createItem, parseQuickEntry } from '../lib/api'
import type { FallbackInput } from '../lib/api/items.ts'
import { ME } from '../lib/me'
import type { Priority } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Input from '../shared/ui/form/Input.tsx'
import Field from '../shared/ui/form/Field.tsx'
import Textarea from '../shared/ui/form/Textarea.tsx'
import Select from '../shared/ui/form/Select.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { PRIORITY_LABEL } from './itemPriority.ts'
import FallbackEditor from '../components/FallbackEditor.tsx'
import type { FallbackDraft } from '../components/FallbackEditor.tsx'
import styles from './NewItemPage.module.css'

const ITEMS_KEY = ['items']

function toFallbackInputs(fallbacks: FallbackDraft[]): FallbackInput[] {
  return fallbacks
    .filter((f) => f.name.trim())
    .map((f) => ({
      name: f.name.trim(),
      quantity: Number(f.quantity) || 1,
      unit: f.unit.trim() || 'pieza',
      note: f.note.trim() || undefined,
    }))
}

export default function NewItemPage() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'rapido' | 'detallado'>('rapido')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fallbacks, setFallbacks] = useState<FallbackDraft[]>([])

  // Modo detallado
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [quantity, setQuantity] = useState('')
  const [quantityMax, setQuantityMax] = useState('')
  const [unit, setUnit] = useState('')
  const [priority, setPriority] = useState<Priority>('media')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')

  useDocumentTitle('¿Qué falta? Agregar · Grocery Planner')

  const addMutation = useMutation({
    mutationFn: async () => {
      const fbList = toFallbackInputs(fallbacks)
      if (mode === 'rapido') {
        const parsed = await parseQuickEntry(text)
        return createItem({ ...parsed, priority: 'media', requestedBy: ME, fallbacks: fbList })
      }
      return createItem({
        name: name.trim(),
        brand: brand.trim() || undefined,
        quantity: Number(quantity),
        unit: unit.trim(),
        priority,
        requestedBy: ME,
        category: category.trim() || undefined,
        note: note.trim() || undefined,
        quantityMax: quantityMax.trim() ? Number(quantityMax) : undefined,
        fallbacks: fbList,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      navigate('/', { replace: true })
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'No se pudo agregar el ítem'),
  })

  const submit = () => {
    if (mode === 'rapido') {
      if (!text.trim()) return
    } else {
      if (!name.trim() || !quantity.trim() || !unit.trim()) return
    }
    setError(null)
    addMutation.mutate()
  }

  const quickName = (() => {
    const t = text.trim()
    if (!t) return ''
    const idx = t.search(/\d/)
    return idx === -1 ? t : t.slice(0, idx).trim()
  })()

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a la lista" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <div>
          <Text as="h1" variant="h1">
            ¿Qué falta?
          </Text>
          <Text as="p" variant="note" tone="secondary">
            {mode === 'rapido'
              ? 'Escribe y se agrega al instante (ej. “pollo 2kg”).'
              : 'Especifica marca, cantidades y qué traer si no hay.'}
          </Text>
        </div>
      </header>

      <div className={styles.modeRow} role="tablist" aria-label="Modo de captura">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'rapido'}
          className={styles.modeBtn}
          onClick={() => setMode('rapido')}
        >
          Rápido
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'detallado'}
          className={styles.modeBtn}
          onClick={() => setMode('detallado')}
        >
          Detallado
        </button>
      </div>

      {mode === 'rapido' ? (
        <Card padding="lg">
          <Stack gap="3">
            <Field label="Qué falta">
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="leche 1 l, arroz 2kg…"
                disabled={addMutation.isPending}
                aria-label="Qué falta"
              />
            </Field>

            <FallbackEditor value={fallbacks} onChange={setFallbacks} productName={quickName} />

            {error && <Alert tone="danger">{error}</Alert>}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={goBack}>
                Cancelar
              </Button>
              <Button onClick={submit} loading={addMutation.isPending}>
                Agregar
              </Button>
            </div>
          </Stack>
        </Card>
      ) : (
        <Card padding="lg">
          <Stack gap="3">
            <Field label="Producto">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pechuga de pollo"
                aria-label="Producto"
              />
            </Field>
            <Field label="Marca (opcional)">
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="la que nos gusta"
                aria-label="Marca"
              />
            </Field>
            <div className={styles.rowFields}>
              <Field label="Cantidad deseada">
                <Input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="2"
                  aria-label="Cantidad deseada"
                />
              </Field>
              <Field label="Unidad">
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg"
                  aria-label="Unidad"
                />
              </Field>
            </div>
            <Field label="Hasta cuánto aceptas (opcional)">
              <Input
                inputMode="decimal"
                value={quantityMax}
                onChange={(e) => setQuantityMax(e.target.value)}
                placeholder="ej. 3 (quiero 2, acepto hasta 3)"
                aria-label="Cantidad máxima aceptada"
              />
            </Field>
            <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Field label="Categoría (opcional)">
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="carnes, lácteos…"
                aria-label="Categoría"
              />
            </Field>
            <Field label="Nota (opcional)">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="pechugas, no muslos…"
                rows={2}
              />
            </Field>

            <FallbackEditor value={fallbacks} onChange={setFallbacks} productName={name.trim()} />

            {error && <Alert tone="danger">{error}</Alert>}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={goBack}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                loading={addMutation.isPending}
                disabled={!name.trim() || !quantity.trim() || !unit.trim()}
              >
                Agregar ítem
              </Button>
            </div>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
