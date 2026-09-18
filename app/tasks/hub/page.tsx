import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export default function TasksHubPage() { redirect('/tasks') }
