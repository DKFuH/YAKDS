import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID, authScopedHeaders, getRuntimeTenantId, getRuntimeUserId, tenantScopedHeaders } from './runtimeContext.js'

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
})

describe('runtimeContext', () => {
  it('returns tenant id from runtime window context', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __OKP_RUNTIME_CONTEXT__: {
          tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      },
    })

    expect(getRuntimeTenantId()).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('falls back to tenant meta tag when runtime context is absent', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    })

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: () => ({ getAttribute: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      },
    })

    expect(getRuntimeTenantId()).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  })

  it('falls back to default tenant when context is missing or invalid', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __OKP_RUNTIME_CONTEXT__: { tenantId: 'invalid-tenant' },
      },
    })

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: () => null,
      },
    })

    expect(getRuntimeTenantId()).toBe(DEFAULT_TENANT_ID)
  })

  it('builds scoped headers with runtime tenant id', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __OKP_RUNTIME_CONTEXT__: {
          tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
      },
    })

    const headers = tenantScopedHeaders({ 'X-Custom': '1' })
    expect(headers).toEqual({
      'X-Custom': '1',
      'X-Tenant-Id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
  })

  it('falls back to tenant id from localStorage', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        },
        location: { search: '' },
      },
    })

    expect(getRuntimeTenantId()).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
  })

  it('returns user id from runtime window context', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __OKP_RUNTIME_CONTEXT__: {
          userId: 'user-runtime-1',
        },
      },
    })

    expect(getRuntimeUserId()).toBe('user-runtime-1')
  })

  it('falls back to user id from query param', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '?userId=user-query-1' },
      },
    })

    expect(getRuntimeUserId()).toBe('user-query-1')
  })

  it('falls back to default user id when context is missing', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    })

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: () => null,
      },
    })

    expect(getRuntimeUserId()).toBe(DEFAULT_USER_ID)
  })

  it('builds auth scoped headers with tenant and user id', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __OKP_RUNTIME_CONTEXT__: {
          tenantId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          userId: 'user-auth-1',
        },
      },
    })

    const headers = authScopedHeaders({ 'X-Custom': '1' })
    expect(headers).toEqual({
      'X-Custom': '1',
      'X-Tenant-Id': 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'X-User-Id': 'user-auth-1',
    })
  })
})
