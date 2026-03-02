import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    generatedItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    generatedItemSourceLink: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

vi.mock('@okp/shared-schemas', () => ({
  clusterCabinetsByWall: vi.fn((cabinets: any[]) => [
    {
      wall_id: 'wall-1',
      cabinets,
      max_depth_mm: 600,
    },
  ]),
  calculateWorktopSegments: vi.fn(() => [
    {
      length_mm: 1000,
      depth_mm: 600,
      segment_index: 1,
      joint_left: false,
      joint_right: false,
    },
  ]),
  calculatePlinthSegments: vi.fn(() => []),
}))

import { AutoCompletionService } from './autoCompletionService.js'

describe('AutoCompletionService.rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.generatedItem.create.mockResolvedValue({ id: 'gi-new' })
    prismaMock.generatedItem.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.generatedItemSourceLink.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('keeps matching generated segments and does not recreate unchanged items', async () => {
    prismaMock.generatedItem.findMany.mockResolvedValue([
      {
        id: 'gi-existing',
        item_type: 'worktop',
        label: 'Arbeitsplatte (Wand wall-1)',
        qty: 1000,
        unit: 'mm',
        params_json: {
          wall_id: 'wall-1',
          depth_mm: 600,
          segment_index: 1,
          joint_left: false,
          joint_right: false,
        },
        source_links: [{ source_placement_id: 'p-1' }],
      },
    ])

    const result = await AutoCompletionService.rebuild(
      'project-1',
      'room-1',
      [
        {
          id: 'p-1',
          wall_id: 'wall-1',
          offset_mm: 0,
          width_mm: 600,
          depth_mm: 600,
          height_mm: 720,
          type: 'base',
        },
      ],
      { addSidePanels: false },
    )

    expect(result.created).toBe(0)
    expect(result.deleted).toBe(0)
    expect(prismaMock.generatedItem.create).not.toHaveBeenCalled()
    expect(prismaMock.generatedItemSourceLink.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.generatedItem.deleteMany).not.toHaveBeenCalled()
  })

  it('replaces stale generated segments with newly calculated ones', async () => {
    prismaMock.generatedItem.findMany.mockResolvedValue([
      {
        id: 'gi-stale',
        item_type: 'worktop',
        label: 'Arbeitsplatte (Wand wall-1)',
        qty: 800,
        unit: 'mm',
        params_json: {
          wall_id: 'wall-1',
          depth_mm: 600,
          segment_index: 1,
          joint_left: false,
          joint_right: false,
        },
        source_links: [{ source_placement_id: 'p-1' }],
      },
    ])

    const result = await AutoCompletionService.rebuild(
      'project-1',
      'room-1',
      [
        {
          id: 'p-1',
          wall_id: 'wall-1',
          offset_mm: 0,
          width_mm: 600,
          depth_mm: 600,
          height_mm: 720,
          type: 'base',
        },
      ],
      { addSidePanels: false },
    )

    expect(result.created).toBe(1)
    expect(result.deleted).toBe(1)
    expect(prismaMock.generatedItem.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.generatedItemSourceLink.deleteMany).toHaveBeenCalledWith({
      where: { generated_item_id: { in: ['gi-stale'] } },
    })
    expect(prismaMock.generatedItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['gi-stale'] } },
    })
  })
})
