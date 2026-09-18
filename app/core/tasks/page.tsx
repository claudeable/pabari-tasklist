import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreTasksPage() {
  return (
    <CoreModulePage
      title="Tasks"
      description="Create, assign, track and resolve tasks across all companies and departments."
      icon="✓"
      fullPageHref="/tasks"
      fullPageLabel="Open Task Board"
      color="#22c55e"
      bg="#f0fdf4"
      features={[
        'Create and assign tasks',
        'Set due dates and priorities',
        'Track status and progress',
        'HK approval workflow',
        'Recurring task automation',
        'Task comments and updates',
        'Filter by company / section',
        'Export and reporting',
      ]}
    />
  )
}
