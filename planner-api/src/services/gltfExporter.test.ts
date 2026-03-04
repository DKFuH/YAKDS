import { describe, expect, it } from 'vitest'
import { exportToGlb } from './gltfExporter.js'

describe('gltfExporter', () => {
  it('exports empty scene as GLB buffer', async () => {
    const result = await exportToGlb({ walls: [], placements: [] })
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
    expect(result.readUInt32LE(0)).toBe(0x46546c67)
  })

  it('exports walls as GLB', async () => {
    const result = await exportToGlb({
      walls: [
        { id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 4000, y1_mm: 0 },
        { id: 'w2', x0_mm: 4000, y0_mm: 0, x1_mm: 4000, y1_mm: 3000 },
      ],
      placements: [],
    })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(100)
  })

  it('exports placements as GLB', async () => {
    const result = await exportToGlb({
      walls: [],
      placements: [
        { id: 'p1', wall_id: 'w1', offset_mm: 0, width_mm: 600, depth_mm: 600, height_mm: 720, label: 'Unterschrank' },
      ],
    })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles zero-length walls gracefully', async () => {
    const result = await exportToGlb({
      walls: [{ id: 'w1', x0_mm: 100, y0_mm: 100, x1_mm: 100, y1_mm: 100 }],
      placements: [],
    })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('respects custom room height', async () => {
    const result = await exportToGlb({
      walls: [{ id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 5000, y1_mm: 0 }],
      placements: [],
      room_height_mm: 3000,
    })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('exports arc walls as GLB', async () => {
    const result = await exportToGlb({
      walls: [
        {
          id: 'arc-1',
          kind: 'arc',
          start: { x_mm: 1000, y_mm: 0 },
          end: { x_mm: 0, y_mm: 1000 },
          center: { x_mm: 0, y_mm: 0 },
          radius_mm: 1000,
          clockwise: false,
          thickness_mm: 100,
        },
      ],
      placements: [],
    })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(100)
  })
})