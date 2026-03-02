/**
 * fillerPieces.test.ts – Sprint 41
 *
 * Route-level tests for the filler pieces, height zones, and plinth options
 * endpoints.  Uses Vitest + Fastify inject (no real database).
 */
import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ALT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const WALL_ID = 'w-001'

// ─── Hoisted mocks ───────────────────────────────────────────────

const { serviceMock } = vi.hoisted(() => ({
    serviceMock: {
        generate: vi.fn(),
        list: vi.fn(),
    },
}))

vi.mock('../services/fillerService.js', () => ({
    FillerService: serviceMock,
}))

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        alternative: { findUnique: vi.fn() },
        heightZone: { upsert: vi.fn(), findUnique: vi.fn() },
        plinthOption: { upsert: vi.fn() },
    },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { fillerPiecesRoutes } from './fillerPieces.js'

// ─── Helpers ─────────────────────────────────────────────────────

function makeApp() {
    const app = Fastify()
    app.register(fillerPiecesRoutes, { prefix: '/api/v1' })
    return app
}

const sampleAlternative = { id: ALT_ID, area_id: 'area-1', name: 'Variante A', is_active: false }

const sampleFiller = {
    id: 'ff000000-0000-0000-0000-000000000001',
    alternative_id: ALT_ID,
    wall_id: WALL_ID,
    gap_mm: 120,
    width_mm: 120,
    position_mm: 0,
    side: 'left',
    params_json: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

// ─── POST /alternatives/:id/filler-pieces/generate ───────────────

describe('POST /alternatives/:id/filler-pieces/generate', () => {
    beforeEach(() => vi.clearAllMocks())

    it('generates filler pieces and returns a summary', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        serviceMock.generate.mockResolvedValue({
            alternative_id: ALT_ID,
            deleted: 0,
            created: 1,
            items: [sampleFiller],
        })

        const app = makeApp()
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces/generate`,
            payload: {
                walls: [{ wall_id: WALL_ID, length_mm: 3600 }],
                placements: [{ wall_id: WALL_ID, offset_mm: 600, width_mm: 2400 }],
            },
        })

        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body).toMatchObject({ alternative_id: ALT_ID, created: 1 })
        expect(serviceMock.generate).toHaveBeenCalledOnce()
        await app.close()
    })

    it('returns 404 when alternative not found', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(null)

        const app = makeApp()
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces/generate`,
            payload: { walls: [], placements: [] },
        })

        expect(res.statusCode).toBe(404)
        await app.close()
    })

    it('returns 400 for invalid UUID param', async () => {
        const app = makeApp()
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/alternatives/not-a-uuid/filler-pieces/generate',
            payload: {},
        })

        expect(res.statusCode).toBe(400)
        await app.close()
    })

    it('returns 400 when placements entry is invalid', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)

        const app = makeApp()
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces/generate`,
            payload: {
                walls: [{ wall_id: WALL_ID, length_mm: 3600 }],
                // offset_mm missing → should be rejected
                placements: [{ wall_id: WALL_ID, width_mm: 600 }],
            },
        })

        expect(res.statusCode).toBe(400)
        await app.close()
    })
})

// ─── GET /alternatives/:id/filler-pieces ─────────────────────────

describe('GET /alternatives/:id/filler-pieces', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns list of filler pieces', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        serviceMock.list.mockResolvedValue([sampleFiller])

        const app = makeApp()
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces`,
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual(expect.arrayContaining([
            expect.objectContaining({ wall_id: WALL_ID, side: 'left' }),
        ]))
        expect(serviceMock.list).toHaveBeenCalledWith(ALT_ID)
        await app.close()
    })

    it('returns empty array when no filler pieces exist', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        serviceMock.list.mockResolvedValue([])

        const app = makeApp()
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces`,
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual([])
        await app.close()
    })

    it('returns 404 when alternative not found', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(null)

        const app = makeApp()
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/alternatives/${ALT_ID}/filler-pieces`,
        })

        expect(res.statusCode).toBe(404)
        await app.close()
    })
})

// ─── PUT /alternatives/:id/height-zones ──────────────────────────

describe('PUT /alternatives/:id/height-zones', () => {
    beforeEach(() => vi.clearAllMocks())

    it('upserts height zones and returns the record', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        const zones = [
            { zone: 'base', min_height_mm: 600, max_height_mm: 900, default_height_mm: 720 },
            { zone: 'wall', min_height_mm: 300, max_height_mm: 900, default_height_mm: 720 },
        ]
        prismaMock.heightZone.upsert.mockResolvedValue({
            id: 'hz-01',
            alternative_id: ALT_ID,
            zones_json: zones,
        })

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/height-zones`,
            payload: { zones },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toMatchObject({ alternative_id: ALT_ID })
        expect(prismaMock.heightZone.upsert).toHaveBeenCalledOnce()
        await app.close()
    })

    it('returns 400 for invalid zone enum value', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/height-zones`,
            payload: {
                zones: [{ zone: 'invalid_zone', min_height_mm: 600, max_height_mm: 900, default_height_mm: 720 }],
            },
        })

        expect(res.statusCode).toBe(400)
        await app.close()
    })

    it('returns 404 when alternative not found', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(null)

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/height-zones`,
            payload: { zones: [] },
        })

        expect(res.statusCode).toBe(404)
        await app.close()
    })
})

// ─── GET /alternatives/:id/height-zones ──────────────────────────

describe('GET /alternatives/:id/height-zones', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns height zone record when it exists', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        prismaMock.heightZone.findUnique.mockResolvedValue({
            id: 'hz-01',
            alternative_id: ALT_ID,
            zones_json: [],
        })

        const app = makeApp()
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/alternatives/${ALT_ID}/height-zones`,
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toMatchObject({ alternative_id: ALT_ID })
        await app.close()
    })

    it('returns default stub when no height zone record exists', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        prismaMock.heightZone.findUnique.mockResolvedValue(null)

        const app = makeApp()
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/alternatives/${ALT_ID}/height-zones`,
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toMatchObject({ alternative_id: ALT_ID, zones_json: [] })
        await app.close()
    })
})

// ─── PUT /alternatives/:id/plinth-options ────────────────────────

describe('PUT /alternatives/:id/plinth-options', () => {
    beforeEach(() => vi.clearAllMocks())

    it('upserts plinth options and returns the record', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
        prismaMock.plinthOption.upsert.mockResolvedValue({
            id: 'po-01',
            alternative_id: ALT_ID,
            height_mm: 150,
            depth_mm: 60,
            material: 'Aluminium',
            color: '#888',
            extra_json: {},
        })

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/plinth-options`,
            payload: { height_mm: 150, depth_mm: 60, material: 'Aluminium', color: '#888' },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toMatchObject({ alternative_id: ALT_ID, height_mm: 150 })
        expect(prismaMock.plinthOption.upsert).toHaveBeenCalledOnce()
        await app.close()
    })

    it('returns 400 when height_mm exceeds maximum', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/plinth-options`,
            payload: { height_mm: 999 },
        })

        expect(res.statusCode).toBe(400)
        await app.close()
    })

    it('returns 404 when alternative not found', async () => {
        prismaMock.alternative.findUnique.mockResolvedValue(null)

        const app = makeApp()
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/alternatives/${ALT_ID}/plinth-options`,
            payload: { height_mm: 150 },
        })

        expect(res.statusCode).toBe(404)
        await app.close()
    })
})
