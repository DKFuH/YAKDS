/**
 * fillerService.test.ts – Sprint 41
 *
 * Unit tests for FillerService.  The Prisma client is fully mocked so no
 * database connection is needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        fillerPiece: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
            findMany: vi.fn(),
        },
    },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { FillerService, FILLER_MIN_GAP_MM } from './fillerService.js'

const ALT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

// ─── Helpers ─────────────────────────────────────────────────────

function mockDbEmpty() {
    prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 0 })
    prismaMock.fillerPiece.findMany.mockResolvedValue([])
}

// ─── Tests ───────────────────────────────────────────────────────

describe('FillerService.generate', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns zero created items when there are no placements', async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-1', length_mm: 3600 }],
            placements: [],
        })

        expect(result.created).toBe(0)
        expect(result.items).toEqual([])
        expect(prismaMock.fillerPiece.createMany).not.toHaveBeenCalled()
    })

    it('detects a right-side gap and creates a filler piece', async () => {
        const filler = {
            id: 'fp-1', alternative_id: ALT_ID,
            wall_id: 'w-1', gap_mm: 600, width_mm: 600,
            position_mm: 3000, side: 'right',
            params_json: {},
        }
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 1 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([filler])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-1', length_mm: 3600 }],
            placements: [{ wall_id: 'w-1', offset_mm: 0, width_mm: 3000 }],
        })

        expect(result.created).toBe(1)
        expect(prismaMock.fillerPiece.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ side: 'right', gap_mm: 600 }),
                ]),
            }),
        )
    })

    it('detects a left-side gap and creates a filler piece', async () => {
        const filler = {
            id: 'fp-2', alternative_id: ALT_ID,
            wall_id: 'w-1', gap_mm: 200, width_mm: 200,
            position_mm: 0, side: 'left',
            params_json: {},
        }
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 1 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([filler])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-1', length_mm: 2800 }],
            placements: [{ wall_id: 'w-1', offset_mm: 200, width_mm: 2600 }],
        })

        expect(result.created).toBe(1)
        expect(prismaMock.fillerPiece.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ side: 'left', gap_mm: 200 }),
                ]),
            }),
        )
    })

    it('creates fillers on both sides when both gaps are large enough', async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 2 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([
            { id: 'fp-3', side: 'left' },
            { id: 'fp-4', side: 'right' },
        ])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-2', length_mm: 3600 }],
            placements: [{ wall_id: 'w-2', offset_mm: 100, width_mm: 2400 }],
        })

        expect(result.created).toBe(2)
        expect(prismaMock.fillerPiece.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ side: 'left' }),
                    expect.objectContaining({ side: 'right' }),
                ]),
            }),
        )
    })

    it(`does NOT create a filler when gap is exactly ${FILLER_MIN_GAP_MM - 1} mm (below threshold)`, async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-3', length_mm: 3659 }],
            // Cabinet fills 3600 mm → right gap = 59 mm (below threshold)
            placements: [{ wall_id: 'w-3', offset_mm: 0, width_mm: 3600 }],
        })

        expect(result.created).toBe(0)
        expect(prismaMock.fillerPiece.createMany).not.toHaveBeenCalled()
    })

    it(`creates a filler when gap is exactly ${FILLER_MIN_GAP_MM} mm (at threshold)`, async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 1 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([
            { id: 'fp-5', side: 'right', gap_mm: 60 },
        ])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-4', length_mm: 3660 }],
            placements: [{ wall_id: 'w-4', offset_mm: 0, width_mm: 3600 }],
        })

        expect(result.created).toBe(1)
    })

    it('deletes existing filler pieces before creating new ones', async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 3 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 1 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([{ id: 'fp-6' }])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-5', length_mm: 3600 }],
            placements: [{ wall_id: 'w-5', offset_mm: 0, width_mm: 3400 }],
        })

        expect(result.deleted).toBe(3)
        expect(prismaMock.fillerPiece.deleteMany).toHaveBeenCalledWith({
            where: { alternative_id: ALT_ID },
        })
    })

    it('handles multiple walls independently', async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.createMany.mockResolvedValue({ count: 2 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([
            { id: 'fp-7', wall_id: 'w-A' },
            { id: 'fp-8', wall_id: 'w-B' },
        ])

        const result = await FillerService.generate(ALT_ID, {
            walls: [
                { wall_id: 'w-A', length_mm: 2400 },
                { wall_id: 'w-B', length_mm: 2400 },
            ],
            placements: [
                { wall_id: 'w-A', offset_mm: 0, width_mm: 2000 },
                { wall_id: 'w-B', offset_mm: 0, width_mm: 2200 },
            ],
        })

        expect(result.created).toBe(2)
        const data: any[] = prismaMock.fillerPiece.createMany.mock.calls[0][0].data
        const wallIds = data.map((d: any) => d.wall_id)
        expect(wallIds).toContain('w-A')
        expect(wallIds).toContain('w-B')
    })

    it('ignores placements on walls not listed in walls array', async () => {
        prismaMock.fillerPiece.deleteMany.mockResolvedValue({ count: 0 })
        prismaMock.fillerPiece.findMany.mockResolvedValue([])

        const result = await FillerService.generate(ALT_ID, {
            walls: [{ wall_id: 'w-known', length_mm: 3600 }],
            placements: [
                // This placement is on an unknown wall – should be silently ignored
                { wall_id: 'w-unknown', offset_mm: 0, width_mm: 600 },
            ],
        })

        expect(result.created).toBe(0)
        expect(prismaMock.fillerPiece.createMany).not.toHaveBeenCalled()
    })
})

describe('FillerService.list', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns all filler pieces for the given alternative', async () => {
        const pieces = [
            { id: 'fp-a', alternative_id: ALT_ID, wall_id: 'w-1', side: 'right' },
            { id: 'fp-b', alternative_id: ALT_ID, wall_id: 'w-2', side: 'left' },
        ]
        prismaMock.fillerPiece.findMany.mockResolvedValue(pieces)

        const result = await FillerService.list(ALT_ID)

        expect(result).toHaveLength(2)
        expect(prismaMock.fillerPiece.findMany).toHaveBeenCalledWith({
            where: { alternative_id: ALT_ID },
            orderBy: [{ wall_id: 'asc' }, { position_mm: 'asc' }],
        })
    })

    it('returns empty array when no pieces exist', async () => {
        prismaMock.fillerPiece.findMany.mockResolvedValue([])

        const result = await FillerService.list(ALT_ID)

        expect(result).toEqual([])
    })
})
