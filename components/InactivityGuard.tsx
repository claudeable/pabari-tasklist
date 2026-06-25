'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INACTIVITY_MS = 10 * 60 * 1000 // 10 minutes

export default function InactivityGuard() {
  const router = useRouter()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
      }, INACTIVITY_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(timer)
    }
  }, [router])

  return null
}
