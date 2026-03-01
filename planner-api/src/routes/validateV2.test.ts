import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RUN_ID = 'run-abc'
const PROJECT_ID = 'proj-1'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findFirst: vi.fn() },
    ruleDefinition: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    ruleRun: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { validateV2Routes } from './validateV2.js'

function makeSnapshot() {
  return {
    project_id: PROJECT_ID,
    room_id: 'room-1',
    placements: [],
    worktop_items: [],
    plinth_items: [],
    ceiling_height_mm: 2500,
    min_clearance_mm: 50,
  }
}

describe('validateV2Routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST validate-v2 runs rules and returns results', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: PROJECT_ID })
    prismaMock.ruleDefinition.findMany.mockResolvedValue([
      { rule_key: 'COMP-003', category: 'completeness', severity: 'hint', params_json: {}, enabled: true, tenant_id: null },
    ])
    prismaMock.ruleRun.create.mockResolvedValue({
      id: RUN_ID,
      project_id: PROJECT_ID,
      run_at: new Date().toISOString(),
      summary_json: { total: 1, errors: 0, warnings: 0, hints: 1 },
      violations: [{ id: 'v-1', rule_key: 'COMP-003', severity: 'hint', message: 'Keine Schränke platziert.', entity_refs_json: [], auto_fix_possible: false }],
    })

    const app = Fastify()
    await app.register(validateV2Routes, { prefix: '/api/v1' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${PROJECT_ID}/validate-v2`,
      payload: makeSnapshot(),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.valid).toBe(true)
    expect(body.summary.hints).toBe(1)
    await app.close()
  })

  it('POST validate-v2 returns valid:false when errors exist', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: PROJECT_ID })
    prismaMock.ruleDefinition.findMany.mockResolvedValue([
      { rule_key: 'ERG-002', category: 'ergonomics', severity: 'error', params_json: {}, enabled: true, tenant_id: null },
    ])
    prismaMock.ruleRun.create.mockResolvedValue({
      id: RUN_ID,
      project_id: PROJECT_ID,
      run_at: new Date().toISOString(),
      summary_json: { total: 1, errors: 1, warnings: 0, hints: 0 },
      violations: [{ id: 'v-2', rule_key: 'ERG-002', severity: 'error', message: 'Schrank ragt über Raumhöhe.', entity_refs_json: ['p-1'], auto_fix_possible: false }],
    })

    const app = Fastify()
    await app.register(validateV2Routes, { prefix: '/api/v1' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${PROJECT_ID}/validate-v2`,
      payload: { ...makeSnapshot(), placements: [{ id: 'p-1', wall_id: 'w-1', offset_mm: 0, width_mm: 600, depth_mm: 600, height_mm: 3000, type: 'tall' }] },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().valid).toBe(false)
    await app.close()
  })

  it('GET validate-v2/history returns past runs', async () => {
    prismaMock.ruleRun.findMany.mockResolvedValue([
      { id: RUN_ID, project_id: PROJECT_ID, run_at: new Date().toISOString(), summary_json: { total: 0, errors: 0, warnings: 0, hints: 0 }, violations: [] },
    ])

    const app = Fastify()
    await app.register(validateV2Routes, { prefix: '/api/v1' })

    const res = await app.inject({ method: 'GET', url: `/api/v1/projects/${PROJECT_ID}/validate-v2/history` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    await app.close()
  })

  it('POST rule-definitions/seed seeds default rules', async () => {
    prismaMock.ruleDefinition.upsert.mockResolvedValue({})

    const app = Fastify()
    await app.register(validateV2Routes, { prefix: '/api/v1' })

    const res = await app.inject({ method: 'POST', url: '/api/v1/rule-definitions/seed' })
    expect(res.statusCode).toBe(200)
    expect(res.json().seeded).toBeGreaterThan(0)
    await app.close()
  })
})
