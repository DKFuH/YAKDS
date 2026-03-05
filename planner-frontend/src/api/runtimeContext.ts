const TENANT_HEADER = 'X-Tenant-Id'
const TENANT_META_NAME = 'okp-tenant-id'
const UUID_V4_OR_V1_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface YakdsRuntimeContext {
  tenantId?: string
}

declare global {
  interface Window {
    __YAKDS_RUNTIME_CONTEXT__?: YakdsRuntimeContext
  }
}

function normalizeTenantId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!UUID_V4_OR_V1_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed
}

export function getRuntimeTenantId(): string {
  if (typeof window === 'undefined') {
    throw new Error('Tenant context unavailable outside browser runtime')
  }

  const fromRuntime = normalizeTenantId(window.__YAKDS_RUNTIME_CONTEXT__?.tenantId)
  if (fromRuntime) {
    return fromRuntime
  }

  const fromMeta = typeof document !== 'undefined'
    ? normalizeTenantId(document.querySelector(`meta[name="${TENANT_META_NAME}"]`)?.getAttribute('content'))
    : null

  if (fromMeta) {
    return fromMeta
  }

  throw new Error('Tenant context missing or invalid. Inject window.__YAKDS_RUNTIME_CONTEXT__.tenantId at runtime.')
}

export function tenantScopedHeaders(headers?: Record<string, string>): Record<string, string> {
  const tenantId = getRuntimeTenantId()
  return {
    ...(headers ?? {}),
    [TENANT_HEADER]: tenantId,
  }
}
