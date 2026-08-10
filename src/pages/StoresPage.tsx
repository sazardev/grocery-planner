import SectionPage from '../components/SectionPage.tsx'
import StoresSection from '../components/settings/StoresSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function StoresPage() {
  useDocumentTitle('Tiendas y pasillos · Grocery Planner')
  return (
    <SectionPage
      title="Tiendas y pasillos"
      subtitle="Dónde hace el mandado la familia"
      backTo="/trips"
      backLabel="Volver al mandado"
    >
      <StoresSection />
    </SectionPage>
  )
}
