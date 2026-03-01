const BASE_URL = '/api/v1'

type ApiError = { error: string; message: string }

async function request<T>(path: string, options?: RequestInit, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders, ...options?.headers },
    ...options,
  })

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ error: 'UNKNOWN', message: res.statusText }))
    throw new Error(err.message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, undefined, headers),
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, headers),
  put: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, headers),
  delete: (path: string, headers?: Record<string, string>) =>
    request<void>(path, { method: 'DELETE' }, headers),
}

export function shouldUseDemoFallback(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('database_url') ||
    message.includes('prisma') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('internal server error')
  )
}
