import SectionPage from '../components/SectionPage.tsx'
import JoinSection from '../components/family/JoinSection.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'

export default function JoinPage() {
  useDocumentTitle('Unirse con invitación · Grocery Planner')
  return (
    <SectionPage
      title="Unirse con invitación"
      subtitle="Acepta un código para entrar al hogar"
      backTo="/family"
      backLabel="Volver a la familia"
    >
      <JoinSection />
    </SectionPage>
  )
}
