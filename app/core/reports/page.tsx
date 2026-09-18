import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreReportsPage() {
  return (
    <CoreModulePage
      title="Reports"
      description="Analytics, dashboards and performance reports across tasks, finance, and operations."
      icon="📊"
      fullPageHref="/reports"
      fullPageLabel="Open Reports"
      color="#f59e0b"
      bg="#fffbeb"
      features={[
        'Task completion analytics',
        'Company-level breakdowns',
        'Petty cash reports',
        'Leave and HR reports',
        'Export to PDF / CSV',
        'Date range filtering',
        'Department performance',
        'Trend analysis',
      ]}
    />
  )
}
