import CoreModulePage from '@/components/core/CoreModulePage'
export const dynamic = 'force-dynamic'
export default function CoreConnectPage() {
  return (
    <CoreModulePage
      title="Pabari Connect"
      description="Internal communication hub — direct messages, group channels, and team announcements."
      icon="💬"
      fullPageHref="/connect"
      fullPageLabel="Open Pabari Connect"
      color="#0ea5e9"
      bg="#f0f9ff"
      features={[
        'Direct messaging',
        'Group channels',
        'Team announcements',
        'File sharing',
        'Read receipts',
        'Push notifications',
        'Search messages',
        'Department channels',
      ]}
    />
  )
}
