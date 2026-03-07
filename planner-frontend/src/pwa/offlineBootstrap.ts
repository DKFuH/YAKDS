type DeferredSyncJob = {
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body: unknown
  headers: Record<string, string>
  created_at: string
}

declare global {
  interface Window {
    __okpOfflineBootstrapDone?: boolean
  }
}

const OFFLINE_QUEUE_STORAGE_KEY = 'okp.offline-sync-queue.v1'
const OFFLINE_BADGE_ID = 'okp-offline-badge'

function readQueue(): DeferredSyncJob[] {
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is DeferredSyncJob => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return (
        typeof candidate.id === 'string'
        && typeof candidate.method === 'string'
        && typeof candidate.url === 'string'
        && typeof candidate.created_at === 'string'
      )
    })
  } catch {
    return []
  }
}

function writeQueue(queue: DeferredSyncJob[]): void {
  window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(0, 300)))
}

function upsertBadge(): HTMLDivElement {
  const existing = document.getElementById(OFFLINE_BADGE_ID)
  if (existing instanceof HTMLDivElement) {
    return existing
  }

  const badge = document.createElement('div')
  badge.id = OFFLINE_BADGE_ID
  badge.style.position = 'fixed'
  badge.style.right = '16px'
  badge.style.bottom = '16px'
  badge.style.padding = '8px 12px'
  badge.style.borderRadius = '999px'
  badge.style.border = '1px solid var(--border-subtle)'
  badge.style.background = 'var(--surface-default)'
  badge.style.color = 'var(--text-primary)'
  badge.style.fontSize = '12px'
  badge.style.fontWeight = '600'
  badge.style.boxShadow = 'var(--shadow-sm)'
  badge.style.zIndex = '1000'
  document.body.appendChild(badge)

  return badge
}

function updateBadge(): void {
  if (typeof document === 'undefined') return

  const queueLength = readQueue().length
  const online = navigator.onLine
  const badge = upsertBadge()

  if (!online) {
    badge.textContent = `Offline · ${queueLength} vorgemerkt`
    badge.style.borderColor = 'var(--status-warning-border)'
    badge.style.background = 'var(--status-warning-bg)'
    badge.style.color = 'var(--status-warning-text)'
    return
  }

  if (queueLength > 0) {
    badge.textContent = `Online · ${queueLength} ausstehend`
    badge.style.borderColor = 'var(--status-info)'
    badge.style.background = 'var(--surface-default)'
    badge.style.color = 'var(--text-primary)'
    return
  }

  badge.textContent = 'Online · synchron'
  badge.style.borderColor = 'var(--status-success)'
  badge.style.background = 'var(--surface-default)'
  badge.style.color = 'var(--text-primary)'
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

function serializeBody(body: BodyInit | null | undefined): unknown {
  if (!body) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  if (body instanceof URLSearchParams) return body.toString()
  return null
}

function toHeaderRecord(init?: RequestInit): Record<string, string> {
  if (!init?.headers) return {}

  if (init.headers instanceof Headers) {
    return Object.fromEntries(init.headers.entries())
  }

  if (Array.isArray(init.headers)) {
    return Object.fromEntries(init.headers)
  }

  return Object.fromEntries(Object.entries(init.headers).map(([key, value]) => [key, String(value)]))
}

function isQueueEligible(url: string, method: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false

  try {
    const normalized = new URL(url, window.location.origin)
    if (!normalized.pathname.startsWith('/api/v1')) return false
    if (normalized.pathname === '/api/v1/offline-sync') return false
    return true
  } catch {
    return false
  }
}

function queueFailedMutation(url: string, method: string, init?: RequestInit): void {
  const queue = readQueue()
  queue.push({
    id: crypto.randomUUID(),
    method: method as DeferredSyncJob['method'],
    url,
    body: serializeBody(init?.body),
    headers: toHeaderRecord(init),
    created_at: new Date().toISOString(),
  })
  writeQueue(queue)
  updateBadge()
}

async function flushQueue(unpatchedFetch: typeof window.fetch): Promise<void> {
  if (!navigator.onLine) return

  const queue = readQueue()
  if (queue.length === 0) {
    updateBadge()
    return
  }

  const jobs = queue.map((job) => {
    const normalized = new URL(job.url, window.location.origin)
    return {
      entity_type: `${job.method} ${normalized.pathname}`,
      payload_json: {
        method: job.method,
        url: `${normalized.pathname}${normalized.search}`,
        body: job.body,
        headers: job.headers,
        created_at: job.created_at,
      },
    }
  })

  const response = await unpatchedFetch('/api/v1/offline-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs }),
  })

  if (!response.ok) {
    updateBadge()
    return
  }

  writeQueue([])
  updateBadge()
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

export function bootstrapOfflinePwa(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__okpOfflineBootstrapDone) return
  window.__okpOfflineBootstrapDone = true

  registerServiceWorker()

  const unpatchedFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    const method = resolveMethod(input, init)

    try {
      const response = await unpatchedFetch(input, init)
      if (response.ok && method === 'GET' && navigator.onLine) {
        void flushQueue(unpatchedFetch)
      }
      return response
    } catch (error) {
      if (isQueueEligible(url, method)) {
        queueFailedMutation(url, method, init)
      }
      throw error
    }
  }

  window.addEventListener('online', () => {
    updateBadge()
    void flushQueue(unpatchedFetch)
  })
  window.addEventListener('offline', updateBadge)

  updateBadge()
  if (navigator.onLine) {
    void flushQueue(unpatchedFetch)
  }
}
