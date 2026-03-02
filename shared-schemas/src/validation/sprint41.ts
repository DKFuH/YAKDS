/**
 * sprint41.ts – Sprint 41 Zod schemas
 *
 * Shared validation schemas for FillerPiece, HeightZone, and PlinthOption.
 * Used by planner-api routes and can be imported by any consuming package.
 */
import { z } from 'zod'

// ─── FillerPiece ─────────────────────────────────────────────────

export const FillerPieceSchema = z.object({
    id: z.string().uuid().optional(),
    alternative_id: z.string().uuid(),
    wall_id: z.string().min(1),
    gap_mm: z.number().positive().min(60),
    width_mm: z.number().positive().min(60),
    position_mm: z.number().nonnegative(),
    side: z.enum(['left', 'right']),
    params_json: z.record(z.unknown()).default({}),
})

export type FillerPiece = z.infer<typeof FillerPieceSchema>

// ─── HeightZone ──────────────────────────────────────────────────

export const HeightZoneEntrySchema = z.object({
    zone: z.enum(['base', 'wall', 'tall']),
    min_height_mm: z.number().int().positive(),
    max_height_mm: z.number().int().positive(),
    default_height_mm: z.number().int().positive(),
}).refine(
    (data) => data.max_height_mm > data.min_height_mm,
    { message: 'max_height_mm must be greater than min_height_mm' },
)

export type HeightZoneEntry = z.infer<typeof HeightZoneEntrySchema>

export const HeightZoneSchema = z.object({
    alternative_id: z.string().uuid().optional(),
    zones: z.array(HeightZoneEntrySchema).default([]),
})

export type HeightZone = z.infer<typeof HeightZoneSchema>

// ─── PlinthOption ────────────────────────────────────────────────

export const PlinthOptionSchema = z.object({
    alternative_id: z.string().uuid().optional(),
    height_mm: z.number().int().positive().max(300).default(150),
    depth_mm: z.number().int().positive().max(100).default(60),
    material: z.string().max(200).optional(),
    color: z.string().max(100).optional(),
    extra_json: z.record(z.unknown()).default({}),
})

export type PlinthOption = z.infer<typeof PlinthOptionSchema>
