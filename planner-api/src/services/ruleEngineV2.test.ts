import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    ruleDefinition: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    ruleRun: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { RuleEngineV2 } from './ruleEngineV2.js'

function createSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    project_id: 'project-1',
    room_id: 'room-1',
    placements: [],
    worktop_items: [],
    plinth_items: [],
    ceiling_height_mm: 2500,
    min_clearance_mm: 50,
    ...overrides,
  }
}

describe('RuleEngineV2 COLL-001', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ruleDefinition.findMany.mockResolvedValue([
      {
        rule_key: 'COLL-001',
        category: 'collision',
        severity: 'error',
        params_json: {},
        enabled: true,
        tenant_id: null,
      },
    ])

    prismaMock.ruleRun.create.mockImplementation(async ({ data }: { data: any }) => ({
      id: 'run-1',
      project_id: data.project_id,
      run_at: new Date('2026-03-01T00:00:00.000Z').toISOString(),
      violations: (data.violations?.create ?? []).map((entry: any, index: number) => ({
        id: `v-${index + 1}`,
        ...entry,
      })),
    }))
  })

  it('detects overlap across different walls via world polygon SAT', async () => {
    const result = await RuleEngineV2.run(
      createSnapshot({
        placements: [
          {
            id: 'cab-a',
            wall_id: 'wall-1',
            offset_mm: 0,
            width_mm: 600,
            depth_mm: 600,
            height_mm: 720,
            type: 'base',
            worldPos: { x_mm: 0, y_mm: 0 },
          },
          {
            id: 'cab-b',
            wall_id: 'wall-2',
            offset_mm: 0,
            width_mm: 600,
            depth_mm: 600,
            height_mm: 720,
            type: 'tall',
            worldPos: { x_mm: 500, y_mm: 200 },
          },
        ],
      }),
      'tenant-1',
    )

    expect(result.valid).toBe(false)
    expect(result.summary.errors).toBe(1)
    expect(result.violations[0].rule_key).toBe('COLL-001')
    expect(result.violations[0].entity_refs_json).toEqual(['cab-a', 'cab-b'])
  })

  it('does not raise COLL-001 when world polygons are separate across walls', async () => {
    const result = await RuleEngineV2.run(
      createSnapshot({
        placements: [
          {
            id: 'cab-a',
            wall_id: 'wall-1',
            offset_mm: 0,
            width_mm: 600,
            depth_mm: 600,
            height_mm: 720,
            type: 'base',
            worldPos: { x_mm: 0, y_mm: 0 },
          },
          {
            id: 'cab-b',
            wall_id: 'wall-2',
            offset_mm: 0,
            width_mm: 600,
            depth_mm: 600,
            height_mm: 720,
            type: 'tall',
            worldPos: { x_mm: 2000, y_mm: 2000 },
          },
        ],
      }),
      'tenant-1',
    )

    expect(result.valid).toBe(true)
    expect(result.summary.errors).toBe(0)
    expect(result.violations).toHaveLength(0)
  })
})
