import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const HotspotSchema = z.object({
  target_point_id: z.string().min(1),
  label: z.string().min(1).max(120).optional(),
})

const CameraSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  yaw: z.number(),
  pitch: z.number(),
})

const PanoramaPointSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  camera: CameraSchema,
  hotspots: z.array(HotspotSchema).default([]),
})

const PanoramaPointsSchema = z.array(PanoramaPointSchema).max(100)

export type PanoramaPoint = z.infer<typeof PanoramaPointSchema>

export function validatePanoramaPoints(value: unknown): PanoramaPoint[] {
  return PanoramaPointsSchema.parse(value)
}

export function normalizePanoramaPoints(value: unknown): PanoramaPoint[] {
  const parsed = validatePanoramaPoints(value)
  const idSet = new Set(parsed.map((point) => point.id))

  return parsed.map((point) => ({
    ...point,
    hotspots: point.hotspots.filter((hotspot) => idSet.has(hotspot.target_point_id)),
  }))
}

export function generateShareToken(): string {
  return randomBytes(24).toString('hex')
}

export function resolveExpiryDate(expiresInDays?: number | null): Date | null {
  if (!expiresInDays || !Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    return null
  }

  const expires = new Date()
  expires.setDate(expires.getDate() + Math.floor(expiresInDays))
  return expires
}

export function isExpired(expiresAt: Date | null | undefined): boolean {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now())
}
