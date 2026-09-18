import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreDocumentsPage() {
  return (
    <CoreModulePage
      title="Documents"
      description="Company-wide document library — upload, organise, search and share files across all entities. Includes Pabari Shelf for cloud document storage."
      icon="📄"
      fullPageHref="/documents"
      fullPageLabel="Open Documents"
      secondaryHref="https://pabari-shelf-production.up.railway.app"
      secondaryLabel="Pabari Shelf"
      secondaryExternal={true}
      color="#64748b"
      bg="#f8fafc"
      features={[
        'Upload and organise files',
        'Company-level folders',
        'Search documents',
        'Share with team',
        'Version history',
        'Access permissions',
        'Preview documents',
        'Download and export',
        'Pabari Shelf — cloud storage',
        'Shelf document sharing',
      ]}
    />
  )
}
