import { describe, expect, it } from 'vitest'
import {
  deriveStairAndOpeningGeometry,
  extractRoomIdFromFootprint,
  StairGeometryValidationError,
} from './stairGeometryService.js'

describe('stairGeometryService', () => {
  it('derives deterministic geometry for straight stairs', () => {
    const result = deriveStairAndOpeningGeometry({
      kind: 'straight_stair',
      from_level_elevation_mm: 0,
      to_level_elevation_mm: 2800,
      footprint_json: {
        room_id: '44444444-4444-4444-4444-444444444444',
        rect: { x_mm: 1000, y_mm: 2000, width_mm: 1200, depth_mm: 3000 },
      },
      stair_json: {
        width_mm: 1000,
        tread_mm: 270,
      },
    })

    expect(result.stair_json.floor_height_mm).toBe(2800)
    expect(result.stair_json.step_count).toBeGreaterThan(0)
    expect(result.opening_json.source_kind).toBe('straight_stair')
    expect(result.opening_json.bbox_mm).toMatchObject({ width_mm: 1200, depth_mm: 3000 })
  })

  it('supports explicit step_count and rise_mm when consistent', () => {
    const result = deriveStairAndOpeningGeometry({
      kind: 'l_stair',
      from_level_elevation_mm: 0,
      to_level_elevation_mm: 3000,
      footprint_json: {
        rect: { x_mm: 0, y_mm: 0, width_mm: 1500, depth_mm: 2600 },
      },
      stair_json: {
        step_count: 15,
        rise_mm: 200,
        tread_mm: 260,
      },
    })

    expect(result.stair_json.step_count).toBe(15)
    expect(result.stair_json.rise_mm).toBe(200)
  })

  it('derives opening for kind void without steps', () => {
    const result = deriveStairAndOpeningGeometry({
      kind: 'void',
      from_level_elevation_mm: 0,
      to_level_elevation_mm: 2500,
      footprint_json: {
        vertices: [
          { x_mm: 0, y_mm: 0 },
          { x_mm: 1200, y_mm: 0 },
          { x_mm: 1200, y_mm: 1200 },
          { x_mm: 0, y_mm: 1200 },
        ],
      },
      stair_json: {},
    })

    expect(result.stair_json.step_count).toBe(0)
    expect(result.opening_json.source_kind).toBe('void')
  })

  it('throws for non-positive floor height', () => {
    expect(() => deriveStairAndOpeningGeometry({
      kind: 'straight_stair',
      from_level_elevation_mm: 3000,
      to_level_elevation_mm: 3000,
      footprint_json: {
        rect: { x_mm: 0, y_mm: 0, width_mm: 1200, depth_mm: 2500 },
      },
      stair_json: {},
    })).toThrowError(StairGeometryValidationError)
  })

  it('throws for invalid footprint dimensions', () => {
    expect(() => deriveStairAndOpeningGeometry({
      kind: 'u_stair',
      from_level_elevation_mm: 0,
      to_level_elevation_mm: 2800,
      footprint_json: {
        rect: { x_mm: 0, y_mm: 0, width_mm: 0, depth_mm: 2500 },
      },
      stair_json: {},
    })).toThrowError('footprint_json.rect.width_mm must be greater than 0')
  })

  it('throws for impossible step_count/rise combination', () => {
    expect(() => deriveStairAndOpeningGeometry({
      kind: 'spiral_stair',
      from_level_elevation_mm: 0,
      to_level_elevation_mm: 2800,
      footprint_json: {
        rect: { x_mm: 0, y_mm: 0, width_mm: 1400, depth_mm: 1400 },
      },
      stair_json: {
        step_count: 8,
        rise_mm: 400,
      },
    })).toThrowError('Impossible step count/rise')
  })

  it('extracts optional room id from footprint', () => {
    expect(extractRoomIdFromFootprint({ room_id: ' room-1 ' })).toBe('room-1')
    expect(extractRoomIdFromFootprint({})).toBeNull()
  })
})
