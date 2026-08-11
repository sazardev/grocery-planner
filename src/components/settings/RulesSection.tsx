import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRules, updateRules } from '../../lib/api'
import Text from '../../shared/ui/primitives/Text.tsx'
import Skeleton from '../../shared/ui/primitives/Skeleton.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Button, Card, Input, Select, Stack, Switch } from '../../shared/ui/index.ts'
import { ME } from '../../lib/me'
import { Settings2 } from 'lucide-react'
import styles from './RulesSection.module.css'

const RULES_KEY = ['rules']

export default function RulesSection() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: rules, isLoading } = useQuery({ queryKey: RULES_KEY, queryFn: getRules })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: RULES_KEY })
    queryClient.invalidateQueries({ queryKey: ['home'] })
  }

  const [draft, setDraft] = useState<Record<string, string>>({})

  const update = useMutation({
    mutationFn: () =>
      updateRules({
        name: draft.name || undefined,
        photoLimit: draft.photoLimit != null ? Number(draft.photoLimit) || undefined : undefined,
        units: draft.units
          ? draft.units.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        categories: draft.categories
          ? draft.categories.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        language: draft.language || undefined,
        timezone: draft.timezone || undefined,
      }, ME),
    onSuccess: () => {
      invalidate()
      setError(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudieron guardar las reglas'),
  })

  const toggle = useMutation({
    mutationFn: (patch: Parameters<typeof updateRules>[0]) => updateRules(patch, ME),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'),
  })

  if (isLoading) return <Skeleton variant="rect" height={200} />
  if (!rules) return null

  const textValue = (v: string[] | undefined) => (v ?? []).join(', ')

  return (
    <Card padding="lg">
      <Stack gap="3">
        <div className={styles.line}>
          <Text as="h2" variant="section">
            <Settings2 size={18} aria-hidden="true" /> Reglas de la familia
          </Text>
          <Text as="p" variant="note" tone="secondary">
            Preferencias del hogar que todos comparten.
          </Text>
        </div>

        {error && <Alert tone="danger" title="No se pudo guardar">{error}</Alert>}
        {saved && <Alert tone="success" title="Reglas guardadas" />}

        <Input
          label="Nombre del hogar"
          defaultValue={rules.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <div className={styles.rowFields}>
          <Input
            label="Límite de fotos por ítem"
            type="number"
            min={1}
            max={20}
            defaultValue={String(rules.photoLimit)}
            onChange={(e) => setDraft((d) => ({ ...d, photoLimit: e.target.value }))}
          />
          <Select
            label="Idioma"
            defaultValue={rules.language}
            onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </Select>
        </div>
        <Input
          label="Zona horaria"
          placeholder="America/Mexico_City"
          defaultValue={rules.timezone}
          onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
        />
        <Input
          label="Unidades preferidas (separadas por coma)"
          defaultValue={textValue(rules.units)}
          onChange={(e) => setDraft((d) => ({ ...d, units: e.target.value }))}
        />
        <Input
          label="Categorías preferidas (separadas por coma)"
          defaultValue={textValue(rules.categories)}
          onChange={(e) => setDraft((d) => ({ ...d, categories: e.target.value }))}
        />

        <div className={styles.switchRow}>
          <Switch
            checked={rules.hostMode}
            label="Modo invitado / host (quiosco de casa)"
            onChange={(v) => toggle.mutate({ hostMode: v })}
          />
          <Switch
            checked={rules.hostPauseWithVisitors}
            label="Pausar el quiosco si hay visita"
            onChange={(v) => toggle.mutate({ hostPauseWithVisitors: v })}
          />
          <Switch
            checked={rules.privacyShowPhotos}
            label="Mostrar fotos a la familia"
            onChange={(v) => toggle.mutate({ privacyShowPhotos: v })}
          />
          <Switch
            checked={rules.privacyShowPrices}
            label="Mostrar precios a la familia"
            onChange={(v) => toggle.mutate({ privacyShowPrices: v })}
          />
        </div>

        <Button
          onClick={() => update.mutate()}
          loading={update.isPending}
          disabled={!rules}
          full
        >
          Guardar reglas
        </Button>
      </Stack>
    </Card>
  )
}
