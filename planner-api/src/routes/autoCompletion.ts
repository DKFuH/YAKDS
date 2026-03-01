/**
 * autoCompletion.ts – Sprint 21 / TASK-21-A01
 * HTTP-Routen für den AutoCompletionService
 */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AutoCompletionService } from '../services/autoCompletionService.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { prisma } from '../db.js'

const ProjectRoomParamsSchema = z.object({
    project_id: z.string().uuid(),
    room_id: z.string().uuid(),
})

const AutoCompletionOptionsSchema = z.object({
    worktopOverhangFront_mm: z.number().nonnegative().max(500).optional(),
    worktopOverhangSide_mm: z.number().nonnegative().max(500).optional(),
    plinthHeight_mm: z.number().positive().max(500).optional(),
    plinthDepth_mm: z.number().positive().max(200).optional(),
    maxWorktopLength_mm: z.number().positive().max(10000).optional(),
    addSidePanels: z.boolean().optional(),
})

export async function autoCompletionRoutes(app: FastifyInstance) {

    /**
     * POST /projects/:project_id/rooms/:room_id/auto-complete
     * Triggert den Rebuild der automatisch generierten Langteile.
     */
    app.post<{ Params: { project_id: string; room_id: string } }>(
        '/projects/:project_id/rooms/:room_id/auto-complete',
        async (request, reply) => {
            const params = ProjectRoomParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const body = AutoCompletionOptionsSchema.safeParse(request.body ?? {})
            if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

            // Lade aktuelle Placements aus der Datenbank
            const room = await prisma.room.findUnique({
                where: { id: params.data.room_id },
                select: { id: true, project_id: true, placements: true },
            })
            if (!room || room.project_id !== params.data.project_id) {
                return sendNotFound(reply, 'Room not found in project')
            }

            const placements = Array.isArray(room.placements) ? room.placements : []

            const result = await AutoCompletionService.rebuild(
                params.data.project_id,
                params.data.room_id,
                placements as unknown as Parameters<typeof AutoCompletionService.rebuild>[2],
                body.data,
            )

            return reply.status(200).send(result)
        },
    )

    app.get<{ Params: { project_id: string; room_id: string } }>(
        '/projects/:project_id/rooms/:room_id/auto-complete',
        async (request, reply) => {
            const params = ProjectRoomParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const items = await AutoCompletionService.list(
                params.data.project_id,
                params.data.room_id,
            )

            return reply.send(items)
        },
    )

    /**
     * GET /projects/:project_id/rooms/:room_id/suggestions
     * Schlägt Zubehör basierend auf dem aktuellen Planungsstand vor.
     */
    app.get<{ Params: { project_id: string; room_id: string } }>(
        '/projects/:project_id/rooms/:room_id/suggestions',
        async (request, reply) => {
            const params = ProjectRoomParamsSchema.safeParse(request.params)
            if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

            const suggestions = await AutoCompletionService.suggestAccessories(
                params.data.project_id,
                params.data.room_id,
            )

            return reply.send(suggestions)
        },
    )
}
