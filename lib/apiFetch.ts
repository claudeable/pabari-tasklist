// Smart fetch wrapper: auto-retries on network failure, redirects to login on 401

const TIMEOUT_MS = 12000
const RETRY_DELAY_MS = 800

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit & { retries?: number } = {}
): Promise<Response> {
  const { retries = 1, ...fetchOpts } = options

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        credentials: 'include',
        ...fetchOpts,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 401) {
        // Session expired — clear and go to login
        document.cookie = 'pabari-session=; Max-Age=0; path=/'
        window.location.href = '/login'
        // return a placeholder — navigation is in progress
        return res
      }

      return res
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  }

  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * i))
      return await attempt()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}
