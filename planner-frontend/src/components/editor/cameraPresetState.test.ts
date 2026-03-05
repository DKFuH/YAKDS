import { describe, expect, it } from 'vitest'
import { cameraStateToPresetPayload, clampPresetFov, presetToCameraState, toCameraTarget } from './cameraPresetState.js'

describe('cameraPresetState', () => {
  it('builds target from yaw and pitch', () => {
    const target = toCameraTarget({
      x_mm: 100,
      y_mm: 200,
      yaw_rad: 0,
      pitch_rad: 0,
      camera_height_mm: 1500,
    }, 1000)

    expect(Math.round(target.x)).toBe(1100)
    expect(Math.round(target.y)).toBe(1500)
    expect(Math.round(target.z)).toBe(200)
  })

  it('creates preset payload with clamped fov and default flag', () => {
    const payload = cameraStateToPresetPayload({
      name: 'Test',
      state: {
        x_mm: 1,
        y_mm: 2,
        yaw_rad: 0.5,
        pitch_rad: 0.1,
        camera_height_mm: 1300,
      },
      fovDeg: 999,
      mode: 'visitor',
      isDefault: true,
    })

    expect(payload.name).toBe('Test')
    expect(payload.fov).toBe(110)
    expect(payload.mode).toBe('visitor')
    expect(payload.is_default).toBe(true)
  })

  it('converts preset to camera state preserving position', () => {
    const state = presetToCameraState({
      id: '1',
      name: 'A',
      position: { x: 200, y: 1650, z: 300 },
      target: { x: 1200, y: 1650, z: 300 },
      fov: 55,
      mode: 'orbit',
      is_default: false,
      created_at: '',
      updated_at: '',
    })

    expect(state.x_mm).toBe(200)
    expect(state.y_mm).toBe(300)
    expect(state.camera_height_mm).toBe(1650)
    expect(state.yaw_rad).toBeCloseTo(0)
    expect(state.pitch_rad).toBeCloseTo(0)
  })

  it('converts pitch from target elevation', () => {
    const state = presetToCameraState({
      id: '1',
      name: 'A',
      position: { x: 0, y: 1000, z: 0 },
      target: { x: 1000, y: 1500, z: 0 },
      fov: 55,
      mode: 'orbit',
      is_default: false,
      created_at: '',
      updated_at: '',
    })

    expect(state.pitch_rad).toBeGreaterThan(0)
  })

  it('falls back to neutral angles when target equals position', () => {
    const state = presetToCameraState({
      id: '1',
      name: 'A',
      position: { x: 500, y: 1200, z: 400 },
      target: { x: 500, y: 1200, z: 400 },
      fov: 55,
      mode: 'orbit',
      is_default: false,
      created_at: '',
      updated_at: '',
    })

    expect(state.yaw_rad).toBe(0)
    expect(state.pitch_rad).toBe(0)
  })

  it('clamps preset fov values into valid range', () => {
    expect(clampPresetFov(10)).toBe(20)
    expect(clampPresetFov(45)).toBe(45)
    expect(clampPresetFov(140)).toBe(110)
  })
})
