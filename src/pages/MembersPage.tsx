import SectionPage from '../components/SectionPage.tsx'
import MembersSection from '../components/family/MembersSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function MembersPage() {
  useDocumentTitle('Miembros · Grocery Planner')
  return (
    <SectionPage
      title="Miembros"
      subtitle="Quiénes integran el hogar y su rol"
      backTo="/family"
      backLabel="Volver a la familia"
    >
      <MembersSection />
    </SectionPage>
  )
}
