import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validatePlacement } from '@yakds/shared-schemas'
import type { Opening, Placement, WallSegment } from '@yakds/shared-schemas'

import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const PointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const PlacementSchema = z.object({
  id: z.string().min(1).default(() => randomUUID()),
  catalog_item_id: z.string().min(1),
  catalog_article_id: z.string().min(1).optional(),
  article_variant_id: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  chosen_options: z.record(z.string(), z.string()).optional(),
  list_price_net: z.number().min(0).optional(),
  dealer_price_net: z.number().min(0).optional(),
  tax_group_id: z.string().min(1).optional(),
  wall_id: z.string().min(1),
  offset_mm: z.number().min(0),
  width_mm: z.number().positive(),
  depth_mm: z.number().positive(),
  height_mm: z.number().positive(),
  worldPos: PointSchema.optional(),
})

const PersistedPlacementSchema = PlacementSchema.extend({
  id: z.string().min(1),
})

const PlacementListSchema = z.object({
  placements: z.array(PersistedPlacementSchema).max(500),
})

type BoundaryJson = {
  vertices?: Array<{ id: string; x_mm: number; y_mm: number }>
  wall_segments?: Array<{
    id: string
    start_vertex_id?: string
    end_vertex_id?: string
    length_mm?: number
  }>
}

function getWallSegment(boundary: BoundaryJson, wallId: string): WallSegment | null {
  const segment = boundary.wall_segments?.find((candidate) => candidate.id === wallId)
  if (!segment) {
    return null
  }

  if (typeof segment.length_mm === 'number' && Number.isFinite(segment.length_mm) && segment.length_mm > 0) {
    return { id: wallId, length_mm: segment.length_mm }
  }

  const vertices = boundary.vertices ?? []
  const start = vertices.find((vertex) => vertex.id === segment.start_vertex_id)
  const end = vertices.find((vertex) => vertex.id === segment.end_vertex_id)

  if (!start || !end) {
    return { id: wallId, length_mm: Number.POSITIVE_INFINITY }
  }

  return {
    id: wallId,
    length_mm: Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm),
  }
}

function getRoomPlacements(room: { placements: unknown }): Placement[] {
  return ((room.placements as unknown[]) ?? []) as Placement[]
}

function getRoomOpenings(room: { openings: unknown }): Opening[] {
  return ((room.openings as unknown[]) ?? []) as Opening[]
}

function validatePlacementSet(
  boundary: BoundaryJson,
  placements: Placement[],
  openings: Opening[],
): string | null {
  const seenIds = new Set<string>()

  for (const placement of placements) {
    if (seenIds.has(placement.id)) {
      return `Duplicate placement id ${placement.id}.`
    }
    seenIds.add(placement.id)

    const wall = getWallSegment(boundary, placement.wall_id)
    if (!wall) {
      return `Wall ${placement.wall_id} not found in room boundary.`
    }

    const siblings = placements.filter((candidate) => candidate.id !== placement.id)
    const result = validatePlacement(wall, placement, siblings, openings)

    if (!result.valid) {
      return result.errors[0]
    }
  }

  return null
}

export async function placementRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/rooms/:id/placements', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    return reply.send((room.placements as unknown[]) ?? [])
  })

  app.post<{ Params: { id: string } }>('/rooms/:id/placements', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const parsed = PlacementSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const boundary = room.boundary as BoundaryJson
    const wall = getWallSegment(boundary, parsed.data.wall_id)
    if (!wall) return sendBadRequest(reply, 'Wall not found in room boundary.')

    const existingPlacements = getRoomPlacements(room)
    const existingOpenings = getRoomOpenings(room)
    const result = validatePlacement(
      wall,
      parsed.data as Placement,
      existingPlacements,
      existingOpenings,
    )

    if (!result.valid) return sendBadRequest(reply, result.errors[0])

    const placements = [...existingPlacements, parsed.data]
    try {
      await prisma.room.update({
        where: { id: request.params.id },
        data: { placements: placements as object[] },
      })
    } catch (e: any) {
      return reply.status(500).send({ error: 'DB_UPDATE_FAIL', message: e.message })
    }

    return reply.status(201).send(parsed.data)
  })

  app.put<{ Params: { id: string } }>('/rooms/:id/placements', async (request, reply) => {
    const parsed = PlacementListSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const placements = parsed.data.placements as Placement[]
    const boundary = room.boundary as BoundaryJson
    const openings = getRoomOpenings(room)
    const error = validatePlacementSet(boundary, placements, openings)
    if (error) return sendBadRequest(reply, error)

    await prisma.room.update({
      where: { id: request.params.id },
      data: { placements: placements as object[] },
    })

    return reply.send(placements)
  })

  app.put<{ Params: { id: string; placementId: string } }>(
    '/rooms/:id/placements/:placementId',
    async (request, reply) => {
      const parsed = PersistedPlacementSchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
      if (parsed.data.id !== request.params.placementId) {
        return sendBadRequest(reply, 'Placement id in payload must match route parameter.')
      }

      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const existingPlacements = getRoomPlacements(room)
      if (!existingPlacements.some((placement) => placement.id === request.params.placementId)) {
        return sendNotFound(reply, 'Placement not found')
      }

      const placements = existingPlacements.map((placement) =>
        placement.id === request.params.placementId ? (parsed.data as Placement) : placement,
      )
      const boundary = room.boundary as BoundaryJson
      const openings = getRoomOpenings(room)
      const error = validatePlacementSet(boundary, placements, openings)
      if (error) return sendBadRequest(reply, error)

      await prisma.room.update({
        where: { id: request.params.id },
        data: { placements: placements as object[] },
      })

      return reply.send(parsed.data)
    },
  )

  app.delete<{ Params: { id: string; placementId: string } }>(
    '/rooms/:id/placements/:placementId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const placements = ((room.placements as unknown[]) ?? []).filter(
        (entry: unknown) => (entry as { id: string }).id !== request.params.placementId,
      )

      await prisma.room.update({
        where: { id: request.params.id },
        data: { placements: placements as object[] },
      })

      return reply.status(204).send()
    },
  )
}
