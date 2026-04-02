import { useSearchParams } from 'react-router-dom'
import { EmbedProvider } from '../contexts/EmbedContext'
import VesselDesignerPage from './VesselDesignerPage'

export default function EmbedPage() {
  const [searchParams] = useSearchParams()
  const shopId = searchParams.get('shop')

  return (
    <EmbedProvider shopId={shopId}>
      {/* Hide the app navbar — embed renders inside a fabricator's iframe */}
      <style>{`header.bg-slate-900 { display: none !important; }`}</style>
      <VesselDesignerPage />
    </EmbedProvider>
  )
}
