import SectionPage from '../components/SectionPage.tsx'
import SectionsSection from '../components/settings/SectionsSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function SectionsPage() {
  useDocumentTitle('Secciones de la lista · Grocery Planner')
  return (
    <SectionPage
      title="Secciones de la lista"
      subtitle="Agrupa la lista para el mandado"
      backTo="/trips"
      backLabel="Volver al mandado"
    >
      <SectionsSection />
    </SectionPage>
  )
}
