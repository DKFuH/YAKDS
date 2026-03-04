import { describe, expect, it } from 'vitest'
import { buildIfcBuffer } from './ifcEngine.js'

describe('ifcEngine', () => {
  it('exports line and arc walls as approximated IFCWALL entities', async () => {
    const buffer = await buildIfcBuffer({
      projectName: 'Arc Projekt',
      rooms: [
        {
          id: 'room-1',
          name: 'Raum Arc',
          placements: [],
          boundary: {
            wall_segments: [
              { id: 'line-1', x0_mm: 0, y0_mm: 0, x1_mm: 2000, y1_mm: 0 },
              {
                id: 'arc-1',
                kind: 'arc',
                start: { x_mm: 2000, y_mm: 0 },
                end: { x_mm: 0, y_mm: 2000 },
                center: { x_mm: 0, y_mm: 0 },
                radius_mm: 2000,
                clockwise: false,
              },
            ],
          },
        },
      ],
    })

    const step = buffer.toString('utf8')
    expect(step.includes('ISO-10303-21')).toBe(true)
    expect(step.match(/IFCWALL\(/g)?.length ?? 0).toBeGreaterThan(2)
    expect(step.includes('WALL|0|0|2000|0')).toBe(true)
  })
})
