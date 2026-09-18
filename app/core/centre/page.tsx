import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreCentrePage() {
  return (
    <CoreModulePage
      title="Pabari Centre"
      description="Company forms, leave requests, petty cash submissions, and internal operations for all staff."
      icon="🏛️"
      fullPageHref="/centre"
      fullPageLabel="Open Pabari Centre"
      color="#ef4444"
      bg="#fef2f2"
      features={[
        'Leave request forms',
        'Petty cash requests',
        'Internal reports',
        'HR submissions',
        'Approval workflows',
        'Status tracking',
        'Document attachments',
        'Manager notifications',
      ]}
    />
  )
}
