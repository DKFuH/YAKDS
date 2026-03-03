import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'

const roomId = '22222222-2222-2222-2222-222222222222'
const placementId = '33333333-3333-3333-3333-333333333333'
const articleId = '44444444-4444-4444-4444-444444444444'
const quoteId = '55555555-5555-5555-5555-555555555555'
const contactId = '66666666-6666-6666-6666-666666666666'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    catalogArticle: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    projectLineItem: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    placement: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    quote: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    lead: {
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
    prismaMock.project.create.mockResolvedValue({ id: projectId, name: 'New Project', project_status: 'lead' })
    prismaMock.project.update.mockResolvedValue({ id: projectId, name: 'Musterküche EG', project_status: 'planning' })
    prismaMock.catalogArticle.findMany.mockResolvedValue([])
    prismaMock.catalogArticle.count.mockResolvedValue(0)
    prismaMock.catalogArticle.findUnique.mockResolvedValue({ id: articleId, width_mm: 600, depth_mm: 600, height_mm: 720 })
    prismaMock.projectLineItem.findMany.mockResolvedValue([])
    prismaMock.room.findMany.mockResolvedValue([{ id: roomId, name: 'Küche', area_sqm: 15.12, ceiling_height_mm: 2600, created_at: new Date() }])
    prismaMock.room.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === roomId) return { id: roomId, name: 'Küche', walls: [], placements: [] }
      return null
    })
    prismaMock.placement.findMany.mockResolvedValue([])
    prismaMock.placement.create.mockResolvedValue({ id: placementId })
    prismaMock.placement.delete.mockResolvedValue({ id: placementId })
    prismaMock.quote.findFirst.mockResolvedValue({ id: quoteId, version: 1, lines: [] })
    prismaMock.quote.create.mockResolvedValue({ id: quoteId, version: 1, lines: [{ position: 1 }] })
    prismaMock.lead.findMany.mockResolvedValue([{ id: contactId, name: 'Max Muster', email: 'max@example.com', phone: null, created_at: new Date() }])
  })

  // ── Server-Info ───────────────────────────────────────────────────────────

  it('GET /mcp → 200 server info', async () => {
    const app = await createApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/mcp' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('open-kitchen-planner')
    expect(body.version).toBe('2.0.0')
    expect(body.capabilities.tools).toBe(true)
    expect(Array.isArray(body.capabilities.read_tools)).toBe(true)
    expect(Array.isArray(body.capabilities.write_tools)).toBe(true)
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

  it('POST tools/list → 200 with 15 tools array', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.result.tools)).toBe(true)
    expect(body.result.tools).toHaveLength(15)
    const names = (body.result.tools as Array<{ name: string }>).map((t) => t.name)
    expect(names).toContain('list_projects')
    expect(names).toContain('get_project')
    expect(names).toContain('suggest_kitchen_layout')
    expect(names).toContain('get_catalog_articles')
    expect(names).toContain('get_bom')
    expect(names).toContain('get_rooms')
    expect(names).toContain('get_room_detail')
    expect(names).toContain('get_placements')
    expect(names).toContain('get_quote')
    expect(names).toContain('search_contacts')
    expect(names).toContain('create_project')
    expect(names).toContain('update_project_status')
    expect(names).toContain('add_placement')
    expect(names).toContain('remove_placement')
    expect(names).toContain('create_quote_from_bom')
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

  // ── tools/call – get_rooms ────────────────────────────────────────────────

  it('tools/call get_rooms with valid project_id → rooms array', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: { name: 'get_rooms', arguments: { project_id: projectId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(Array.isArray(data.rooms)).toBe(true)
    expect(data.count).toBe(1)
    await app.close()
  })

  it('tools/call get_rooms with unknown project_id → empty array', async () => {
    prismaMock.room.findMany.mockResolvedValue([])
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: { name: 'get_rooms', arguments: { project_id: '00000000-0000-0000-0000-000000000000' } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.rooms).toHaveLength(0)
    expect(res.json().result.isError).toBeUndefined()
    await app.close()
  })

  // ── tools/call – get_room_detail ──────────────────────────────────────────

  it('tools/call get_room_detail → walls + openings + placements', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: { name: 'get_room_detail', arguments: { room_id: roomId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.id).toBe(roomId)
    expect(Array.isArray(data.walls)).toBe(true)
    expect(Array.isArray(data.placements)).toBe(true)
    await app.close()
  })

  it('tools/call get_room_detail unknown room → isError true', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 23,
        method: 'tools/call',
        params: { name: 'get_room_detail', arguments: { room_id: '00000000-0000-0000-0000-000000000000' } },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true)
    await app.close()
  })

  // ── tools/call – get_quote ────────────────────────────────────────────────

  it('tools/call get_quote → current quote with lines', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 24,
        method: 'tools/call',
        params: { name: 'get_quote', arguments: { project_id: projectId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.id).toBe(quoteId)
    expect(Array.isArray(data.lines)).toBe(true)
    await app.close()
  })

  // ── tools/call – search_contacts ──────────────────────────────────────────

  it('tools/call search_contacts with query → filtered contacts', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 25,
        method: 'tools/call',
        params: { name: 'search_contacts', arguments: { query: 'Max' } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(Array.isArray(data.contacts)).toBe(true)
    expect(data.count).toBe(1)
    await app.close()
  })

  // ── tools/call – create_project ───────────────────────────────────────────

  it('tools/call create_project → project_id returned', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 26,
        method: 'tools/call',
        params: { name: 'create_project', arguments: { name: 'New Project', tenant_id: 'tenant-1' } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.project_id).toBeDefined()
    await app.close()
  })

  // ── tools/call – update_project_status ───────────────────────────────────

  it('tools/call update_project_status with invalid status → isError true', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 27,
        method: 'tools/call',
        params: { name: 'update_project_status', arguments: { project_id: projectId, status: 'invalid_status' } },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().result.isError).toBe(true)
    await app.close()
  })

  // ── tools/call – add_placement ────────────────────────────────────────────

  it('tools/call add_placement → placement_id returned', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 28,
        method: 'tools/call',
        params: {
          name: 'add_placement',
          arguments: { room_id: roomId, article_id: articleId, wall_id: 'wall-1', offset_mm: 100 },
        },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.placement_id).toBeDefined()
    await app.close()
  })

  // ── tools/call – remove_placement ────────────────────────────────────────

  it('tools/call remove_placement → removed key returned', async () => {
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 29,
        method: 'tools/call',
        params: { name: 'remove_placement', arguments: { placement_id: placementId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.removed).toBe(placementId)
    await app.close()
  })

  // ── tools/call – create_quote_from_bom ───────────────────────────────────

  it('tools/call create_quote_from_bom → quote_id + lines.length returned', async () => {
    prismaMock.projectLineItem.findMany.mockResolvedValue([
      { name: 'Unterschrank', quantity: 2, unit_price: 299, total_price: 598 },
    ])
    const app = await createApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/call',
        params: { name: 'create_quote_from_bom', arguments: { project_id: projectId } },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.json().result.content[0].text)
    expect(data.quote_id).toBeDefined()
    expect(typeof data.lines).toBe('number')
    await app.close()
  })
})
