import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreIntelligencePage() {
  return (
    <CoreModulePage
      title="Pabari Intelligence"
      description="Executive-level intelligence dashboard for senior leadership — KPIs, alerts, and strategic insights."
      icon="💡"
      fullPageHref="/intelligence"
      fullPageLabel="Open Intelligence"
      color="#8b5cf6"
      bg="#f5f3ff"
      features={[
        'Executive KPI overview',
        'Cross-company analytics',
        'Task health indicators',
        'Escalation monitoring',
        'Team performance metrics',
        'Strategic alerts',
        'CEO and director view',
        'Real-time updates',
      ]}
    />
  )
}
