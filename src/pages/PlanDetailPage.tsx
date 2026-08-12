import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCircle2, Play, XCircle } from 'lucide-react'
import { activatePlan, cancelPlan, completePlan, getPlan } from '../lib/api'
import type { PlanStatus } from '../domain/plan'
import { RECURRENCE_LABEL } from '../domain/plan'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { invalidateCalendar } from '../lib/queryKeys.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import styles from './PlanDetailPage.module.css'

const planTone: Record<PlanStatus, ChipTone> = {
  planificado: 'default',
  activo: 'warning',
  completado: 'info',
  cancelado: 'danger',
}

const planStatusLabel: Record<PlanStatus, string> = {
  planificado: 'Planificado',
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: plan, isLoading, isError, error } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => getPlan(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })

  useMeta({
    title: plan ? `${plan.title} · Grocery Planner` : 'Plan de compras · Grocery Planner',
    description: plan
      ? `Plan de compras: ${plan.title} (${plan.scheduledAt}).`
      : 'Detalle del plan de compras de la familia.',
    path: plan ? `/plans/${plan.id}` : undefined,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] })
    queryClient.invalidateQueries({ queryKey: ['plan', id] })
    invalidateCalendar(queryClient)
  }

  const activateMutation = useMutation({ mutationFn: () => activatePlan(plan!.id), onSuccess: invalidate })
  const completeMutation = useMutation({ mutationFn: () => completePlan(plan!.id), onSuccess: invalidate })
  const cancelMutation = useMutation({ mutationFn: () => cancelPlan(plan!.id), onSuccess: invalidate })

  const goBack = useGoBack('/plans')

  if (isLoading || !plan) {
    return (
      <Stack gap="4">
        <Skeleton variant="rect" height={100} />
        <Skeleton variant="rect" height={160} />
      </Stack>
    )
  }

  if (isError) {
    return (
      <Stack gap="4">
        <Alert tone="danger" title="No se pudo cargar el plan.">
          {error instanceof Error ? error.message : 'Intenta de nuevo.'}
        </Alert>
        <Button variant="secondary" onClick={goBack}>
          Volver a los planes
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a los planes" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <div className={styles.titleBlock}>
          <Text as="h1" variant="h1">
            {plan.title}
          </Text>
          <Chip tone={planTone[plan.status]}>{planStatusLabel[plan.status]}</Chip>
        </div>
        <div className={styles.headerSpacer} />
        <ShareButton
          title={`${plan.title} · Grocery Planner`}
          text={`Plan de compras: ${plan.title} (${plan.scheduledAt})`}
          url={`/plans/${plan.id}`}
        />
      </header>

      <Card padding="lg">
        <Stack gap="2">
          <Text variant="item">
            <CalendarClock size={18} strokeWidth={2} aria-hidden="true" /> {plan.scheduledAt}
          </Text>
          <Text as="p" variant="note" tone="secondary">
            {[plan.store, plan.assignedTo ? `lo lleva ${plan.assignedTo}` : null]
              .filter(Boolean)
              .join(' · ') || 'Sin tienda asignada'}
          </Text>
          <Text as="p" variant="note" tone="secondary">
            Repetición: {RECURRENCE_LABEL[plan.recurrence]}
          </Text>
          {plan.note && (
            <Text as="p" variant="body">
              {plan.note}
            </Text>
          )}
        </Stack>
      </Card>

      <Stack gap="2">
        {plan.status === 'planificado' && (
          <Button
            iconLeft={<Play size={18} strokeWidth={2} />}
            onClick={() => activateMutation.mutate()}
            loading={activateMutation.isPending}
            full
          >
            Activar plan
          </Button>
        )}
        {plan.status === 'activo' && (
          <Button
            iconLeft={<CheckCircle2 size={18} strokeWidth={2} />}
            onClick={() => completeMutation.mutate()}
            loading={completeMutation.isPending}
            full
          >
            Completar
          </Button>
        )}
        {plan.status !== 'completado' && plan.status !== 'cancelado' && (
          <Button
            variant="danger"
            iconLeft={<XCircle size={18} strokeWidth={2} />}
            onClick={() => cancelMutation.mutate()}
            loading={cancelMutation.isPending}
            full
          >
            Cancelar plan
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
