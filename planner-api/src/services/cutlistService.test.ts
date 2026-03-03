import { describe, expect, it, vi } from 'vitest'
import { generateCutlist } from './cutlistService.js'

function createDbMock(rooms: unknown[], articles: unknown[]) {
  return {
    room: {
      findMany: vi.fn().mockResolvedValue(rooms),
    },
    catalogArticle: {
      findMany: vi.fn().mockResolvedValue(articles),
    },
  } as any
}

describe('generateCutlist', () => {
  it('builds parts from cutlist_parts templates', async () => {
    const db = createDbMock(
      [
        {
          id: 'room-1',
          name: 'Küche',
          placements: [
            { id: 'pl-1', catalog_article_id: 'a-1', quantity: 2 },
          ],
        },
      ],
      [
        {
          id: 'a-1',
          name: 'US 60',
          base_dims_json: { width_mm: 600, height_mm: 720 },
          material_code: 'SPAN-19',
          material_label: 'Span 19',
          grain_direction: 'length',
          cutlist_parts: [
            { label: 'Seite links', width_mm: 560, height_mm: 720, qty_per_unit: 1, material_code: 'SPAN-19' },
            { label: 'Seite rechts', width_mm: 560, height_mm: 720, qty_per_unit: 1, material_code: 'SPAN-19' },
          ],
        },
      ],
    )

    const result = await generateCutlist(db, 'project-1')

    expect(result.parts).toHaveLength(2)
    expect(result.parts[0]).toMatchObject({
      label: 'Seite links',
      quantity: 2,
      material_code: 'SPAN-19',
      grain_direction: 'length',
    })
    expect(result.summary.total_parts).toBe(4)
  })

  it('uses fallback dimensions when article has no cutlist_parts', async () => {
    const db = createDbMock(
      [
        {
          id: 'room-1',
          name: 'Küche',
          placements: [
            { id: 'pl-1', catalog_article_id: 'a-1', width_mm: 610, height_mm: 730 },
          ],
        },
      ],
      [
        {
          id: 'a-1',
          name: 'Fallback Artikel',
          base_dims_json: { width_mm: 600, height_mm: 720 },
          material_code: 'MDF-19',
          material_label: 'MDF 19',
          grain_direction: null,
          cutlist_parts: null,
        },
      ],
    )

    const result = await generateCutlist(db, 'project-1')

    expect(result.parts).toHaveLength(1)
    expect(result.parts[0]).toMatchObject({
      label: 'Fallback Artikel',
      width_mm: 610,
      height_mm: 730,
      quantity: 1,
      material_code: 'MDF-19',
      grain_direction: 'none',
    })
  })

  it('aggregates total_parts for multiple placements', async () => {
    const db = createDbMock(
      [
        {
          id: 'room-1',
          name: 'Küche',
          placements: [
            { id: 'pl-1', catalog_article_id: 'a-1', quantity: 1 },
            { id: 'pl-2', catalog_article_id: 'a-1', quantity: 2 },
          ],
        },
      ],
      [
        {
          id: 'a-1',
          name: 'Artikel',
          base_dims_json: { width_mm: 600, height_mm: 720 },
          material_code: 'SPAN-19',
          material_label: 'Span',
          grain_direction: 'none',
          cutlist_parts: [{ label: 'Teil', width_mm: 500, height_mm: 700, qty_per_unit: 1 }],
        },
      ],
    )

    const result = await generateCutlist(db, 'project-1')

    expect(result.summary.total_parts).toBe(3)
  })

  it('calculates summary area_sqm by material', async () => {
    const db = createDbMock(
      [
        {
          id: 'room-1',
          name: 'Küche',
          placements: [{ id: 'pl-1', catalog_article_id: 'a-1', quantity: 2 }],
        },
      ],
      [
        {
          id: 'a-1',
          name: 'Artikel',
          base_dims_json: { width_mm: 600, height_mm: 720 },
          material_code: 'SPAN-19',
          material_label: 'Span',
          grain_direction: 'none',
          cutlist_parts: [{ label: 'Teil', width_mm: 500, height_mm: 700, qty_per_unit: 1, material_code: 'SPAN-19' }],
        },
      ],
    )

    const result = await generateCutlist(db, 'project-1')

    expect(result.summary.by_material['SPAN-19'].count).toBe(2)
    expect(result.summary.by_material['SPAN-19'].area_sqm).toBe(0.7)
  })

  it('returns empty result when no placements exist', async () => {
    const db = createDbMock(
      [{ id: 'room-1', name: 'Küche', placements: [] }],
      [],
    )

    const result = await generateCutlist(db, 'project-1')

    expect(result.parts).toEqual([])
    expect(result.summary.total_parts).toBe(0)
    expect(result.summary.by_material).toEqual({})
  })
})
