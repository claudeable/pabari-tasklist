import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreProjectsPage() {
  return (
    <CoreModulePage
      title="Project Tracker"
      description="Plan and track projects, milestones, tasks, and team progress across all entities."
      icon="📁"
      fullPageHref="/projects"
      fullPageLabel="Open Project Tracker"
      color="#6366f1"
      bg="#eef2ff"
      features={[
        'Create and manage projects',
        'Assign project members',
        'Track milestones',
        'Link tasks to projects',
        'Project updates and comments',
        'Activity timeline',
        'Status tracking',
        'Admin access control',
      ]}
    />
  )
}
