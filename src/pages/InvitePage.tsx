import SectionPage from '../components/SectionPage.tsx'
import InviteSection from '../components/family/InviteSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function InvitePage() {
  useDocumentTitle('Invitar a la familia · Grocery Planner')
  return (
    <SectionPage
      title="Invitar a la familia"
      subtitle="Suma a alguien con un código corto"
      backTo="/family"
      backLabel="Volver a la familia"
    >
      <InviteSection />
    </SectionPage>
  )
}
