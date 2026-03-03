import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    catalogArticle: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    projectLineItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { mcpRoutes } from './mcp.js'

const PROJECT_FIXTURE = {
  id: projectId,
  name: 'Musterküche EG',
  description: 'Küche im Erdgeschoss',
  project_status: 'planning',
  priority: 'medium',
  progress_pct: 30,
  deadline: null,
  tenant_id: 'tenant-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
}

async function createApp() {
  const app = Fastify()
  await app.register(mcpRoutes, { prefix: '/api/v1' })
  return app
}

describe('mcpRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === projectId) return PROJECT_FIXTURE
      return null
    })
    prismaMock.project.findMany.mockResolvedValue([PROJECT_FIXTURE])
    prismaMock.project.count.mockResolvedValue(1)
    prismaMock.catalogArticle.findMany.mockResolvedValue([])
    prismaMock.catalogArticle.count.mockResolvedValue(0)
    prismaMock.projectLineItem.findMany.mockResolvedValue([])
  })

  // ── Server-Info ───────────────────────────────────────────────────────────

  it('GET /mcp → 200 server info', async () => {
    const app = await createApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/mcp' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('open-kitchen-planner')
    expect(body.capabilities.tools).toBe(true)
    await app.close()
  })

  // ── JSON-RPC validation ───────────────────────────────────────────────────

  it('POST /mcp missing jsonrpc field → 400', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: { method: 'initialize' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe(-32600)
    await app.close()
  })

  it('POST /mcp unknown method → 400 method not found', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'nonexistent' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe(-32601)
    await app.close()
  })

  // ── initialize ────────────────────────────────────────────────────────────

  it('POST initialize → 200 with capabilities', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.result.serverInfo.name).toBe('open-kitchen-planner')
    expect(body.result.capabilities.tools).toBeDefined()
    await app.close()
  })

  // ── tools/list ────────────────────────────────────────────────────────────

  it('POST tools/list → 200 with tools array', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.result.tools)).toBe(true)
    const names = (body.result.tools as Array<{ name: string }>).map((t) => t.name)
    expect(names).toContain('list_projects')
    expect(names).toContain('get_project')
    expect(names).toContain('suggest_kitchen_layout')
    expect(names).toContain('get_catalog_articles')
    expect(names).toContain('get_bom')
    await app.close()
  })

  // ── tools/call – list_projects ────────────────────────────────────────────

  it('tools/call list_projects → 200 with projects', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_projects', arguments: {} },
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const text = body.result.content[0].text
    const data = JSON.parse(text)
    expect(data.total).toBe(1)
    expect(data.projects[0].id).toBe(projectId)
    await app.close()
  })

  // ── tools/call – get_project ──────────────────────────────────────────────

  it('tools/call get_project existing → 200 with project data', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'get_project', arguments: { project_id: projectId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.id).toBe(projectId)
    expect(data.name).toBe('Musterküche EG')
    await app.close()
  })

  it('tools/call get_project unknown id → isError true', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'get_project', arguments: { project_id: '00000000-0000-0000-0000-000000000000' } },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true)
    await app.close()
  })

  // ── tools/call – suggest_kitchen_layout ──────────────────────────────────

  it('tools/call suggest_kitchen_layout valid room → suggestions', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'suggest_kitchen_layout',
          arguments: {
            ceiling_height_mm: 2600,
            wall_segments: [
              { id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 4200, y1_mm: 0 },
              { id: 'w2', x0_mm: 4200, y0_mm: 0, x1_mm: 4200, y1_mm: 3600 },
              { id: 'w3', x0_mm: 4200, y0_mm: 3600, x1_mm: 0, y1_mm: 3600 },
              { id: 'w4', x0_mm: 0, y0_mm: 3600, x1_mm: 0, y1_mm: 0 },
            ],
          },
        },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(Array.isArray(data.suggestions)).toBe(true)
    expect(data.suggestions.length).toBeGreaterThan(0)
    const types = data.suggestions.map((s: { layout_type: string }) => s.layout_type)
    expect(types).toContain('einzeiler')
    await app.close()
  })

  it('tools/call suggest_kitchen_layout empty wall_segments → isError true', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'suggest_kitchen_layout',
          arguments: { ceiling_height_mm: 2600, wall_segments: [] },
        },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true)
    await app.close()
  })

  // ── tools/call – get_catalog_articles ────────────────────────────────────

  it('tools/call get_catalog_articles → 200 with articles array', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'get_catalog_articles', arguments: {} },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.total).toBe(0)
    expect(Array.isArray(data.articles)).toBe(true)
    await app.close()
  })

  // ── tools/call – get_bom ─────────────────────────────────────────────────

  it('tools/call get_bom known project → 200 with items', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'get_bom', arguments: { project_id: projectId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.project_id).toBe(projectId)
    expect(Array.isArray(data.items)).toBe(true)
    await app.close()
  })

  it('tools/call get_bom unknown project → isError true', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { name: 'get_bom', arguments: { project_id: '00000000-0000-0000-0000-000000000000' } },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true)
    await app.close()
  })

  // ── tools/call – unknown tool ─────────────────────────────────────────────

  it('tools/call unknown tool name → 400 method not found', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: { name: 'does_not_exist', arguments: {} },
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe(-32601)
    await app.close()
  })
})
