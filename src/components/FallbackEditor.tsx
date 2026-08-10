import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Input from '../shared/ui/form/Input.tsx'
import Field from '../shared/ui/form/Field.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import styles from './FallbackEditor.module.css'

export interface FallbackDraft {
  name: string
  quantity: string
  unit: string
  note: string
}

interface FallbackEditorProps {
  value: FallbackDraft[]
  onChange: (next: FallbackDraft[]) => void
  productName?: string
}

/**
 * Editor de la cadena "Si no hay…": encadena alternativas ordenadas que se
 * ofrecen en la tienda si el producto no está. Compartido por el modo rápido
 * y el detallado.
 */
export default function FallbackEditor({ value, onChange, productName }: FallbackEditorProps) {
  const add = () =>
    onChange([...value, { name: '', quantity: '', unit: '', note: '' }])

  const update = (i: number, patch: Partial<FallbackDraft>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const label = productName?.trim() ? `si no hay ${productName.trim()}, trae…` : 'si no hay, trae…'

  return (
    <>
      <div className={styles.fbHeader}>
        <Text variant="section">Si no hay…</Text>
        <Button variant="ghost" size="sm" onClick={add} aria-label="Agregar alternativa">
          <Plus size={16} strokeWidth={2} /> Alternativa
        </Button>
      </div>
      <Text as="p" variant="note" tone="secondary">
        Encadena opciones: {label}; si tampoco hay, no traigas nada. Se ofrecen en orden en la
        tienda.
      </Text>
      {value.length === 0 ? (
        <Text variant="note" tone="tertiary">
          Sin alternativas todavía.
        </Text>
      ) : (
        <Stack gap="3">
          {value.map((f, i) => (
            <Card key={i} padding="sm">
              <Stack gap="2">
                <div className={styles.fbRow}>
                  <Text variant="note" tone="secondary">
                    {i + 1}. Si no hay, trae:
                  </Text>
                  <div className={styles.fbActions}>
                    <IconButton
                      label={`Subir alternativa ${i + 1}`}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <ChevronUp size={16} strokeWidth={2} />
                    </IconButton>
                    <IconButton
                      label={`Bajar alternativa ${i + 1}`}
                      onClick={() => move(i, 1)}
                      disabled={i === value.length - 1}
                    >
                      <ChevronDown size={16} strokeWidth={2} />
                    </IconButton>
                    <IconButton label={`Quitar alternativa ${i + 1}`} onClick={() => remove(i)} variant="danger">
                      <X size={16} strokeWidth={2} />
                    </IconButton>
                  </div>
                </div>
                <Field label="Producto alternativo">
                  <Input
                    value={f.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="pierna de pollo"
                    aria-label={`Producto alternativo ${i + 1}`}
                  />
                </Field>
                <div className={styles.rowFields}>
                  <Field label="Cantidad">
                    <Input
                      inputMode="decimal"
                      value={f.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      placeholder="2"
                      aria-label={`Cantidad alternativa ${i + 1}`}
                    />
                  </Field>
                  <Field label="Unidad">
                    <Input
                      value={f.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      placeholder="kg"
                      aria-label={`Unidad alternativa ${i + 1}`}
                    />
                  </Field>
                </div>
                <Field label="Nota (opcional)">
                  <Input
                    value={f.note}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="mediano"
                    aria-label={`Nota alternativa ${i + 1}`}
                  />
                </Field>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </>
  )
}
