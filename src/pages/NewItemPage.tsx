import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
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
import styles from './NewItemPage.module.css'

const ITEMS_KEY = ['items']

interface FallbackDraft {
  name: string
  quantity: string
  unit: string
  note: string
}

export default function NewItemPage() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'rapido' | 'detallado'>('rapido')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Modo detallado
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [quantity, setQuantity] = useState('')
  const [quantityMax, setQuantityMax] = useState('')
  const [unit, setUnit] = useState('')
  const [priority, setPriority] = useState<Priority>('media')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [fallbacks, setFallbacks] = useState<FallbackDraft[]>([])

  useDocumentTitle('¿Qué falta? Agregar · Grocery Planner')

  const addMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'rapido') {
        const parsed = await parseQuickEntry(text)
        return createItem({ ...parsed, priority: 'media', requestedBy: ME })
      }
      const qty = Number(quantity)
      const fbList: FallbackInput[] = fallbacks
        .filter((f) => f.name.trim())
        .map((f) => ({
          name: f.name.trim(),
          quantity: Number(f.quantity) || 1,
          unit: f.unit.trim() || 'pieza',
          note: f.note.trim() || undefined,
        }))
      return createItem({
        name: name.trim(),
        brand: brand.trim() || undefined,
        quantity: qty,
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

  const addFallbackDraft = () =>
    setFallbacks((prev) => [...prev, { name: '', quantity: '', unit: '', note: '' }])
  const updateFallback = (i: number, patch: Partial<FallbackDraft>) =>
    setFallbacks((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const removeFallback = (i: number) =>
    setFallbacks((prev) => prev.filter((_, idx) => idx !== i))
  const moveFallback = (i: number, dir: -1 | 1) =>
    setFallbacks((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

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

            <div className={styles.fbHeader}>
              <Text variant="section">Si no hay…</Text>
              <Button variant="ghost" size="sm" onClick={addFallbackDraft} aria-label="Agregar alternativa">
                <Plus size={16} strokeWidth={2} /> Alternativa
              </Button>
            </div>
            <Text as="p" variant="note" tone="secondary">
              Encadena opciones: “si no hay pechuga de pollo, trae pierna; si no hay pierna, no traigas nada”.
            </Text>
            {fallbacks.length === 0 ? (
              <Text variant="note" tone="tertiary">
                Sin alternativas todavía.
              </Text>
            ) : (
              <Stack gap="3">
                {fallbacks.map((f, i) => (
                  <Card key={i} padding="sm">
                    <Stack gap="2">
                      <div className={styles.fbRow}>
                        <Text variant="note" tone="secondary">
                          {i + 1}. Si no hay, trae:
                        </Text>
                        <div className={styles.fbActions}>
                          <IconButton
                            label={`Subir alternativa ${i + 1}`}
                            onClick={() => moveFallback(i, -1)}
                            disabled={i === 0}
                          >
                            <ChevronUp size={16} strokeWidth={2} />
                          </IconButton>
                          <IconButton
                            label={`Bajar alternativa ${i + 1}`}
                            onClick={() => moveFallback(i, 1)}
                            disabled={i === fallbacks.length - 1}
                          >
                            <ChevronDown size={16} strokeWidth={2} />
                          </IconButton>
                          <IconButton label={`Quitar alternativa ${i + 1}`} onClick={() => removeFallback(i)} variant="danger">
                            <X size={16} strokeWidth={2} />
                          </IconButton>
                        </div>
                      </div>
                      <Field label="Producto alternativo">
                        <Input
                          value={f.name}
                          onChange={(e) => updateFallback(i, { name: e.target.value })}
                          placeholder="pierna de pollo"
                          aria-label={`Producto alternativo ${i + 1}`}
                        />
                      </Field>
                      <div className={styles.rowFields}>
                        <Field label="Cantidad">
                          <Input
                            inputMode="decimal"
                            value={f.quantity}
                            onChange={(e) => updateFallback(i, { quantity: e.target.value })}
                            placeholder="2"
                            aria-label={`Cantidad alternativa ${i + 1}`}
                          />
                        </Field>
                        <Field label="Unidad">
                          <Input
                            value={f.unit}
                            onChange={(e) => updateFallback(i, { unit: e.target.value })}
                            placeholder="kg"
                            aria-label={`Unidad alternativa ${i + 1}`}
                          />
                        </Field>
                      </div>
                      <Field label="Nota (opcional)">
                        <Input
                          value={f.note}
                          onChange={(e) => updateFallback(i, { note: e.target.value })}
                          placeholder="mediano"
                          aria-label={`Nota alternativa ${i + 1}`}
                        />
                      </Field>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}

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
