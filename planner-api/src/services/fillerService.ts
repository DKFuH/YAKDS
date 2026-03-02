/**
 * fillerService.ts – Sprint 41
 *
 * Calculates available wall space between cabinet clusters and the wall ends,
 * generating filler pieces wherever the gap is at least 60 mm.
 *
 * Follows the same rebuild-and-reconcile pattern as AutoCompletionService
 * (Sprint 21).
 */
import { prisma } from '../db.js'

export const FILLER_MIN_GAP_MM = 60

export interface FillerPlacement {
    wall_id: string
    offset_mm: number
    width_mm: number
}

export interface FillerWall {
    wall_id: string
    length_mm: number
}

export interface FillerGenerateOptions {
    placements: FillerPlacement[]
    walls: FillerWall[]
}

interface DesiredFiller {
    wall_id: string
    gap_mm: number
    width_mm: number
    position_mm: number
    side: 'left' | 'right'
}

function calculateFillers(options: FillerGenerateOptions): DesiredFiller[] {
    const result: DesiredFiller[] = []

    for (const wall of options.walls) {
        const wallPlacements = options.placements
            .filter((p) => p.wall_id === wall.wall_id)
            .sort((a, b) => a.offset_mm - b.offset_mm)

        if (wallPlacements.length === 0) continue

        const first = wallPlacements[0]
        const last = wallPlacements[wallPlacements.length - 1]

        // Gap on the left side (between wall start and first cabinet)
        const leftGap = first.offset_mm
        if (leftGap >= FILLER_MIN_GAP_MM) {
            result.push({
                wall_id: wall.wall_id,
                gap_mm: leftGap,
                width_mm: leftGap,
                position_mm: 0,
                side: 'left',
            })
        }

        // Gap on the right side (between last cabinet end and wall end)
        const lastEnd = last.offset_mm + last.width_mm
        const rightGap = wall.length_mm - lastEnd
        if (rightGap >= FILLER_MIN_GAP_MM) {
            result.push({
                wall_id: wall.wall_id,
                gap_mm: rightGap,
                width_mm: rightGap,
                position_mm: lastEnd,
                side: 'right',
            })
        }
    }

    return result
}

export const FillerService = {
    /**
     * (Re-)generates filler pieces for all walls in the given alternative.
     * Deletes any existing filler pieces for this alternative first, then
     * creates new ones for every gap >= FILLER_MIN_GAP_MM.
     *
     * @returns Summary of deleted and created records.
     */
    async generate(alternative_id: string, options: FillerGenerateOptions) {
        const desired = calculateFillers(options)

        // Delete all existing filler pieces for this alternative
        const { count: deleted } = await prisma.fillerPiece.deleteMany({
            where: { alternative_id },
        })

        if (desired.length === 0) {
            return { alternative_id, deleted, created: 0, items: [] }
        }

        await prisma.fillerPiece.createMany({
            data: desired.map((d) => ({
                alternative_id,
                wall_id: d.wall_id,
                gap_mm: d.gap_mm,
                width_mm: d.width_mm,
                position_mm: d.position_mm,
                side: d.side,
                params_json: {},
            })),
        })

        const items = await prisma.fillerPiece.findMany({
            where: { alternative_id },
            orderBy: [{ wall_id: 'asc' }, { position_mm: 'asc' }],
        })

        return {
            alternative_id,
            deleted,
            created: desired.length,
            items,
        }
    },

    /**
     * Returns all filler pieces for a given alternative.
     */
    async list(alternative_id: string) {
        return prisma.fillerPiece.findMany({
            where: { alternative_id },
            orderBy: [{ wall_id: 'asc' }, { position_mm: 'asc' }],
        })
    },
}
