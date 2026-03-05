import { describe, expect, it } from 'vitest'
import type { Vertex } from '@shared/types'
import type { Opening } from '../api/openings.js'
import type { Placement } from '../api/placements.js'
import {
  autofixBoundaryVertices,
  buildBoundaryFromVertices,
  buildDimensionAssistSegments,
  normalizeOpeningForMultiview,
  rebindOpeningsAndPlacements,
} from './roomTopology.js'

function vertex(id: string, x_mm: number, y_mm: number, index = 0): Vertex {
  return { id, x_mm, y_mm, index }
}

describe('roomTopology', () => {
  it('autofix removes duplicate and null-edge vertices and keeps ccw orientation', () => {
    const input: Vertex[] = [
      vertex('v1', 0, 0, 0),
      vertex('v2', 0, 0, 1),
      vertex('v3', 3000, 0, 2),
      vertex('v4', 3000, 2000, 3),
      vertex('v5', 0, 2000, 4),
      vertex('v6', 0, 0, 5),
    ]

    const result = autofixBoundaryVertices(input)

    expect(result.changed).toBe(true)
    expect(result.vertices).toHaveLength(4)
    expect(result.validationErrors).toEqual([])
    expect(result.fixes.length).toBeGreaterThan(0)
  })

  it('builds boundary with provided wall ids', () => {
    const vertices = [
      vertex('a', 0, 0, 0),
      vertex('b', 1000, 0, 1),
      vertex('c', 1000, 1000, 2),
      vertex('d', 0, 1000, 3),
    ]

    const built = buildBoundaryFromVertices(vertices, ['w1', 'w2', 'w3', 'w4'])

    expect(built.wallIds).toEqual(['w1', 'w2', 'w3', 'w4'])
    expect(built.boundary.wall_segments.map((segment) => segment.id)).toEqual(['w1', 'w2', 'w3', 'w4'])
  })

  it('rebind mirrors offsets when wall orientation is reversed', () => {
    const vertices = [
      vertex('v1', 0, 0, 0),
      vertex('v2', 3000, 0, 1),
      vertex('v3', 3000, 1000, 2),
      vertex('v4', 0, 1000, 3),
    ]

    const previous = buildBoundaryFromVertices(vertices, ['w1', 'w2', 'w3', 'w4']).boundary
    const reversed = {
      ...previous,
      wall_segments: previous.wall_segments.map((segment) => (
        segment.id === 'w1'
          ? { ...segment, start_vertex_id: 'v2', end_vertex_id: 'v1' }
          : segment
      )),
    }

    const openings: Opening[] = [{
      id: 'o1',
      wall_id: 'w1',
      type: 'door',
      offset_mm: 300,
      width_mm: 900,
      height_mm: 2100,
      sill_height_mm: 0,
      source: 'manual',
    }]

    const result = rebindOpeningsAndPlacements(previous, reversed, openings, [])
    expect(result.changedOpenings).toBe(1)
    expect(Math.round(result.openings[0].offset_mm)).toBe(1800)
  })

  it('rebinds wall hosted items to nearest wall when ids changed', () => {
    const previousVertices = [
      vertex('v1', 0, 0, 0),
      vertex('v2', 3000, 0, 1),
      vertex('v3', 3000, 1000, 2),
      vertex('v4', 0, 1000, 3),
    ]
    const nextVertices = [
      vertex('n1', 0, 0, 0),
      vertex('n2', 1500, 0, 1),
      vertex('n3', 3000, 0, 2),
      vertex('n4', 3000, 1000, 3),
      vertex('n5', 0, 1000, 4),
    ]

    const previous = buildBoundaryFromVertices(previousVertices, ['w1', 'w2', 'w3', 'w4']).boundary
    const next = buildBoundaryFromVertices(nextVertices, ['n1', 'n2', 'n3', 'n4', 'n5']).boundary

    const openings: Opening[] = [{
      id: 'o1',
      wall_id: 'w1',
      type: 'door',
      offset_mm: 1200,
      width_mm: 900,
      height_mm: 2100,
      sill_height_mm: 0,
      source: 'manual',
    }]

    const placements: Placement[] = [{
      id: 'p1',
      catalog_item_id: 'base-1',
      wall_id: 'w1',
      offset_mm: 100,
      width_mm: 600,
      depth_mm: 600,
      height_mm: 720,
    }]

    const result = rebindOpeningsAndPlacements(previous, next, openings, placements)

    expect(result.changedOpenings).toBeGreaterThan(0)
    expect(result.changedPlacements).toBeGreaterThan(0)
    expect(result.openings[0].wall_id.startsWith('n')).toBe(true)
    expect(result.placements[0].wall_id.startsWith('n')).toBe(true)
  })

  it('builds dimension assist segments from openings and placements', () => {
    const segments = buildDimensionAssistSegments(
      'wall-a',
      4000,
      [{
        id: 'o1',
        wall_id: 'wall-a',
        type: 'window',
        offset_mm: 800,
        width_mm: 1000,
        height_mm: 1200,
        sill_height_mm: 900,
        source: 'manual',
      }],
      [{
        id: 'p1',
        wall_id: 'wall-a',
        catalog_item_id: 'base-1',
        offset_mm: 2200,
        width_mm: 600,
        depth_mm: 600,
        height_mm: 720,
      }],
    )

    expect(segments.length).toBeGreaterThan(3)
    expect(segments.some((segment) => Math.round(segment.length_mm) === 1000)).toBe(true)
  })

  it('normalizes opening attributes for multiview consistency', () => {
    const normalizedWindow = normalizeOpeningForMultiview({
      id: 'o1',
      wall_id: 'w1',
      type: 'window',
      offset_mm: 12.4,
      width_mm: 0,
      source: 'manual',
    } as Opening)

    expect(normalizedWindow.width_mm).toBe(900)
    expect(normalizedWindow.height_mm).toBe(1200)
    expect(normalizedWindow.sill_height_mm).toBe(900)

    const normalizedDoor = normalizeOpeningForMultiview({
      id: 'o2',
      wall_id: 'w1',
      type: 'door',
      offset_mm: 11.9,
      width_mm: 850,
      sill_height_mm: 400,
      source: 'manual',
    } as Opening)

    expect(normalizedDoor.sill_height_mm).toBe(0)
    expect(normalizedDoor.height_mm).toBe(2100)
  })
})
