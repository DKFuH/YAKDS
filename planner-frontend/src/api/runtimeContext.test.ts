import { afterEach, describe, expect, it } from 'vitest'
import { getRuntimeTenantId, tenantScopedHeaders } from './runtimeContext.js'

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
})

describe('runtimeContext', () => {
  it('returns tenant id from runtime window context', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __YAKDS_RUNTIME_CONTEXT__: {
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

  it('throws when tenant context is missing or invalid', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __YAKDS_RUNTIME_CONTEXT__: { tenantId: 'invalid-tenant' },
      },
    })

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: () => null,
      },
    })

    expect(() => getRuntimeTenantId()).toThrow('Tenant context missing or invalid')
  })

  it('builds scoped headers with runtime tenant id', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __YAKDS_RUNTIME_CONTEXT__: {
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
})
