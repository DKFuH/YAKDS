/**
 * fillerPieces.ts – Sprint 41
 *
 * HTTP routes for filler pieces, height zones, and plinth options,
 * all scoped under /alternatives/:id.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { FillerService } from '../services/fillerService.js'

// ─── Shared param schema ──────────────────────────────────────────

const AlternativeParamsSchema = z.object({
    id: z.string().uuid(),
})

// ─── Filler-pieces schemas ────────────────────────────────────────

const FillerPlacementSchema = z.object({
    wall_id: z.string().min(1),
    offset_mm: z.number().nonnegative(),
    width_mm: z.number().positive(),
})

const FillerWallSchema = z.object({
    wall_id: z.string().min(1),
    length_mm: z.number().positive(),
})

const GenerateFillerBodySchema = z.object({
    placements: z.array(FillerPlacementSchema).default([]),
    walls: z.array(FillerWallSchema).default([]),
})

// ─── Height-zones schema ──────────────────────────────────────────

const HeightZoneEntrySchema = z.object({
    zone: z.enum(['base', 'wall', 'tall']),
    min_height_mm: z.number().int().positive(),
    max_height_mm: z.number().int().positive(),
    default_height_mm: z.number().int().positive(),
}).refine(
    (data) => data.max_height_mm > data.min_height_mm,
    { message: 'max_height_mm must be greater than min_height_mm' },
)

const PutHeightZonesBodySchema = z.object({
    zones: z.array(HeightZoneEntrySchema).default([]),
})

// ─── Plinth-options schema ────────────────────────────────────────

const PutPlinthOptionBodySchema = z.object({
    height_mm: z.number().int().positive().max(300).optional(),
    depth_mm: z.number().int().positive().max(100).optional(),
    material: z.string().max(200).optional(),
    color: z.string().max(100).optional(),
    extra_json: z.record(z.unknown()).optional(),
})

// ─── Route Registration ───────────────────────────────────────────

export async function fillerPiecesRoutes(app: FastifyInstance) {

    /**
     * POST /alternatives/:id/filler-pieces/generate
     *
     * Triggers FillerService to (re-)calculate filler pieces for the
     * alternative. Replaces all existing filler pieces.
     */
    app.post<{ Params: { id: string } }>(
        '/alternatives/:id/filler-pieces/generate',
        async (request, reply) => {
            const params = AlternativeParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const body = GenerateFillerBodySchema.safeParse(request.body ?? {})
            if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

            const alternative = await prisma.alternative.findUnique({
                where: { id: params.data.id },
            })
            if (!alternative) return sendNotFound(reply, 'Alternative not found')

            const result = await FillerService.generate(params.data.id, body.data)
            return reply.status(200).send(result)
        },
    )

    /**
     * GET /alternatives/:id/filler-pieces
     *
     * Returns all stored filler pieces for this alternative.
     */
    app.get<{ Params: { id: string } }>(
        '/alternatives/:id/filler-pieces',
        async (request, reply) => {
            const params = AlternativeParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const alternative = await prisma.alternative.findUnique({
                where: { id: params.data.id },
            })
            if (!alternative) return sendNotFound(reply, 'Alternative not found')

            const items = await FillerService.list(params.data.id)
            return reply.send(items)
        },
    )

    /**
     * PUT /alternatives/:id/height-zones
     *
     * Upserts height zone configuration for this alternative.
     */
    app.put<{ Params: { id: string } }>(
        '/alternatives/:id/height-zones',
        async (request, reply) => {
            const params = AlternativeParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const body = PutHeightZonesBodySchema.safeParse(request.body ?? {})
            if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

            const alternative = await prisma.alternative.findUnique({
                where: { id: params.data.id },
            })
            if (!alternative) return sendNotFound(reply, 'Alternative not found')

            const heightZone = await prisma.heightZone.upsert({
                where: { alternative_id: params.data.id },
                create: {
                    alternative_id: params.data.id,
                    zones_json: body.data.zones,
                },
                update: {
                    zones_json: body.data.zones,
                },
            })

            return reply.send(heightZone)
        },
    )

    /**
     * GET /alternatives/:id/height-zones
     *
     * Returns height zone configuration for this alternative.
     */
    app.get<{ Params: { id: string } }>(
        '/alternatives/:id/height-zones',
        async (request, reply) => {
            const params = AlternativeParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const alternative = await prisma.alternative.findUnique({
                where: { id: params.data.id },
            })
            if (!alternative) return sendNotFound(reply, 'Alternative not found')

            const heightZone = await prisma.heightZone.findUnique({
                where: { alternative_id: params.data.id },
            })

            return reply.send(heightZone ?? { alternative_id: params.data.id, zones_json: [] })
        },
    )

    /**
     * PUT /alternatives/:id/plinth-options
     *
     * Upserts plinth (Sockel) options for this alternative.
     */
    app.put<{ Params: { id: string } }>(
        '/alternatives/:id/plinth-options',
        async (request, reply) => {
            const params = AlternativeParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const body = PutPlinthOptionBodySchema.safeParse(request.body ?? {})
            if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

            const alternative = await prisma.alternative.findUnique({
                where: { id: params.data.id },
            })
            if (!alternative) return sendNotFound(reply, 'Alternative not found')

            const { extra_json, ...rest } = body.data

            const plinthOption = await prisma.plinthOption.upsert({
                where: { alternative_id: params.data.id },
                create: {
                    alternative_id: params.data.id,
                    ...rest,
                    extra_json: (extra_json ?? {}) as object,
                },
                update: {
                    ...rest,
                    ...(extra_json !== undefined ? { extra_json: extra_json as object } : {}),
                },
            })

            return reply.send(plinthOption)
        },
    )
}
