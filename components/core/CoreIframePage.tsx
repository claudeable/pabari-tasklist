'use client'

export default function CoreIframePage({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      style={{ flex: 1, width: '100%', border: 'none', display: 'block', minHeight: 0 }}
      allow="fullscreen"
    />
  )
}
