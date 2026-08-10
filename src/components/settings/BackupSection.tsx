import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { exportBackup, importBackup } from '../../lib/api'
import Text from '../../shared/ui/primitives/Text.tsx'
import Alert from '../../shared/ui/feedback/Alert.tsx'
import { Button, Card, Stack } from '../../shared/ui/index.ts'
import { Download, Upload } from 'lucide-react'
import { todayISO } from '../../lib/dates.ts'

export default function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const exportMutation = useMutation({
    mutationFn: async () => {
      const data = await exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grocery-planner-respaldo-${todayISO()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo exportar'),
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      const data = JSON.parse(text) as Parameters<typeof importBackup>[0]
      await importBackup(data)
    },
    onSuccess: () => {
      setError(null)
      setDone(true)
      window.setTimeout(() => setDone(false), 3000)
    },
    onError: (e) =>
      setError(
        e instanceof Error ? e.message : 'El respaldo no es válido o no se pudo importar',
      ),
  })

  return (
    <Card padding="lg">
      <Stack gap="3">
        <Text as="h2" variant="section">
          Respaldo de la familia
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Lleva tu hogar a otra máquina: lista, historial, eventos, planes y chat.
        </Text>

        {error && <Alert tone="danger" title="No se pudo hacer el respaldo">{error}</Alert>}
        {done && <Alert tone="success" title="Respaldo importado" />}

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importMutation.mutate(file)
            e.target.value = ''
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--gp-space-3)', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => exportMutation.mutate()}
            loading={exportMutation.isPending}
          >
            <Download size={16} aria-hidden="true" /> Exportar respaldo
          </Button>
          <Button
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            loading={importMutation.isPending}
          >
            <Upload size={16} aria-hidden="true" /> Importar respaldo
          </Button>
        </div>
        <Alert tone="info">
          Importar reemplaza el contenido actual de la lista, el historial y el chat.
        </Alert>
      </Stack>
    </Card>
  )
}
