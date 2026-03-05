import type { CameraPreset, CameraPresetMode } from '../../api/cameraPresets.js'

export interface SyncedCameraState {
  x_mm: number
  y_mm: number
  yaw_rad: number
  pitch_rad: number
  camera_height_mm: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function directionFromYawPitch(yawRad: number, pitchRad: number) {
  const cosPitch = Math.cos(pitchRad)
  return {
    x: Math.cos(yawRad) * cosPitch,
    y: Math.sin(pitchRad),
    z: Math.sin(yawRad) * cosPitch,
  }
}

export function toCameraTarget(state: SyncedCameraState, distanceMm = 1200) {
  const direction = directionFromYawPitch(state.yaw_rad, state.pitch_rad)
  return {
    x: state.x_mm + direction.x * distanceMm,
    y: state.camera_height_mm + direction.y * distanceMm,
    z: state.y_mm + direction.z * distanceMm,
  }
}

export function cameraStateToPresetPayload(input: {
  name: string
  state: SyncedCameraState
  fovDeg: number
  mode: CameraPresetMode
  isDefault?: boolean
}) {
  return {
    name: input.name,
    position: {
      x: input.state.x_mm,
      y: input.state.camera_height_mm,
      z: input.state.y_mm,
    },
    target: toCameraTarget(input.state),
    fov: clamp(Number(input.fovDeg), 20, 110),
    mode: input.mode,
    ...(input.isDefault ? { is_default: true } : {}),
  }
}

export function presetToCameraState(preset: CameraPreset): SyncedCameraState {
  const dx = preset.target.x - preset.position.x
  const dy = preset.target.y - preset.position.y
  const dz = preset.target.z - preset.position.z
  const length = Math.hypot(dx, dy, dz)

  if (length < 1e-6) {
    return {
      x_mm: Math.round(preset.position.x),
      y_mm: Math.round(preset.position.z),
      yaw_rad: 0,
      pitch_rad: 0,
      camera_height_mm: Math.round(preset.position.y),
    }
  }

  const yaw = Math.atan2(dz, dx)
  const pitch = Math.asin(clamp(dy / length, -1, 1))

  return {
    x_mm: Math.round(preset.position.x),
    y_mm: Math.round(preset.position.z),
    yaw_rad: yaw,
    pitch_rad: pitch,
    camera_height_mm: Math.round(preset.position.y),
  }
}

export function clampPresetFov(value: number): number {
  return clamp(Math.round(value), 20, 110)
}
