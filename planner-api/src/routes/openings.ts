import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { detectOpeningsFromCad, validateOpening as validateOpeningRule } from '@okp/shared-schemas'
import type { CadEntity, Opening as SharedOpening, WallSegment } from '@okp/shared-schemas'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'
import { arcLengthMm } from '../services/arcWallGeometry.js'

const openingTypeValues = [
  'door',
  'window',
  'pass-through',
  'radiator',
  'socket',
  'switch',
  'niche',
  'pipe',
  'custom',
] as const

const OpeningSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  wall_id: z.string().uuid(),
  type: z.enum(openingTypeValues).optional(),
  offset_mm: z.number().min(0),
  width_mm: z.number().positive(),
  height_mm: z.number().positive().optional(),
  sill_height_mm: z.number().min(0).optional(),
  wall_offset_depth_mm: z.number().int().min(0).max(2000).nullable().optional(),
  source: z.enum(['manual', 'cad_import']).default('manual'),
})

type Opening = z.infer<typeof OpeningSchema>
type BoundaryJson = {
  vertices?: Array<{ id: string; x_mm: number; y_mm: number }>
  wall_segments?: Array<{
    id: string
    length_mm?: number
    start_vertex_id?: string
    end_vertex_id?: string
    kind?: 'line' | 'arc'
    start?: { x_mm: number; y_mm: number }
    end?: { x_mm: number; y_mm: number }
    center?: { x_mm: number; y_mm: number }
    radius_mm?: number
    clockwise?: boolean
  }>
}

function computeLineLength(boundary: BoundaryJson, wall: NonNullable<BoundaryJson['wall_segments']>[number]): number {
  if (typeof wall.length_mm === 'number' && Number.isFinite(wall.length_mm) && wall.length_mm > 0) {
    return wall.length_mm
  }

  const vertices = boundary.vertices ?? []
  const start = vertices.find((vertex) => vertex.id === wall.start_vertex_id)
  const end = vertices.find((vertex) => vertex.id === wall.end_vertex_id)
  if (!start || !end) {
    return Infinity
  }

  return Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm)
}

function computeWallLength(boundary: BoundaryJson, wallId: string): number {
  const wall = boundary.wall_segments?.find((entry) => entry.id === wallId)
  if (!wall) return Infinity

  if (wall.kind === 'arc' && wall.start && wall.end && wall.center && typeof wall.radius_mm === 'number') {
    return arcLengthMm({
      id: wall.id,
      kind: 'arc',
      start: wall.start,
      end: wall.end,
      center: wall.center,
      radius_mm: wall.radius_mm,
      clockwise: Boolean(wall.clockwise),
    })
  }

  return computeLineLength(boundary, wall)
}

const OpeningDraftSchema = z.object({
  id: z.string().min(1).default(() => randomUUID()),
  wall_id: z.string().min(1),
  type: z.enum(openingTypeValues).optional(),
  offset_mm: z.number().min(0),
  width_mm: z.number().positive(),
  height_mm: z.number().positive().optional(),
  sill_height_mm: z.number().min(0).optional(),
  wall_offset_depth_mm: z.number().int().min(0).max(2000).nullable().optional(),
  source: z.enum(['manual', 'cad_import']).default('manual'),
})

const WallSegmentSchema = z.object({
  id: z.string().min(1),
  length_mm: z.number().positive(),
})

const CadEntitySchema = z.union([
  z.object({
    id: z.string().min(1),
    layer_id: z.string().min(1),
    type: z.string().min(1),
    geometry: z.object({
      type: z.literal('line'),
      start: z.object({ x_mm: z.number(), y_mm: z.number() }),
      end: z.object({ x_mm: z.number(), y_mm: z.number() }),
    }),
  }),
  z.object({
    id: z.string().min(1),
    layer_id: z.string().min(1),
    type: z.string().min(1),
    geometry: z.object({
      type: z.literal('polyline'),
      points: z.array(z.object({ x_mm: z.number(), y_mm: z.number() })).min(2),
      closed: z.boolean(),
    }),
  }),
])

const ValidateOpeningRequestSchema = z.object({
  wall: WallSegmentSchema,
  opening: OpeningDraftSchema,
  existing_openings: z.array(OpeningDraftSchema).default([]),
})

const DetectOpeningsRequestSchema = z.object({
  entities: z.array(CadEntitySchema),
  wallLength_mm: z.number().positive(),
})

function validateOpening(opening: Opening, wallLengthMm: number, siblings: Opening[]): string[] {
  const errors: string[] = []
  if (opening.offset_mm + opening.width_mm > wallLengthMm) {
    errors.push(`Öffnung überschreitet Wandlänge (${Math.round(wallLengthMm)} mm)`)
  }
  for (const other of siblings) {
    if (other.id === opening.id || other.wall_id !== opening.wall_id) continue
    if (opening.offset_mm < other.offset_mm + other.width_mm &&
      other.offset_mm < opening.offset_mm + opening.width_mm) {
      errors.push(`Öffnung überschneidet sich mit ${other.id}`)
    }
  }
  return errors
}

export async function openingRoutes(app: FastifyInstance) {
  app.post('/openings/validate', async (request, reply) => {
    const parsed = ValidateOpeningRequestSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const result = validateOpeningRule(
      parsed.data.wall as WallSegment,
      parsed.data.opening as SharedOpening,
      parsed.data.existing_openings as SharedOpening[],
    )

    return reply.send(result)
  })

  app.post('/openings/detect-from-cad', async (request, reply) => {
    const parsed = DetectOpeningsRequestSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const candidates = detectOpeningsFromCad(parsed.data.entities as CadEntity[], parsed.data.wallLength_mm)

    return reply.send({ candidates })
  })

  // GET /rooms/:id/openings
  app.get<{ Params: { id: string } }>('/rooms/:id/openings', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send((room.openings as unknown[]) ?? [])
  })

  // POST /rooms/:id/openings – einzelne Öffnung hinzufügen
  app.post<{ Params: { id: string } }>('/rooms/:id/openings', async (request, reply) => {
    const { id } = request.params
    const parsed = OpeningSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const existing = (room.openings as unknown[] ?? []) as Opening[]
    const boundary = room.boundary as BoundaryJson
    const wallLen = computeWallLength(boundary, parsed.data.wall_id)

    const errors = validateOpening(parsed.data, wallLen, existing)
    if (errors.length > 0) return sendBadRequest(reply, errors[0])

    const newOpenings = [...existing, parsed.data]
    await prisma.room.update({ where: { id }, data: { openings: newOpenings as object[] } })
    return reply.status(201).send(parsed.data)
  })

  // PUT /rooms/:id/openings – alle Öffnungen ersetzen
  app.put<{ Params: { id: string } }>('/rooms/:id/openings', async (request, reply) => {
    const { id } = request.params
    const bodyParsed = z.object({ openings: z.array(OpeningSchema).max(200) }).safeParse(request.body)
    if (!bodyParsed.success) return sendBadRequest(reply, bodyParsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = room.boundary as BoundaryJson
    const wallMap = new Map((boundary.wall_segments ?? []).map((wall) => [wall.id, computeWallLength(boundary, wall.id)]))
    const openings = bodyParsed.data.openings

    for (const opening of openings) {
      const wallLen = wallMap.get(opening.wall_id) ?? Infinity
      const siblings = openings.filter(o => o !== opening)
      const errors = validateOpening(opening, wallLen, siblings)
      if (errors.length > 0) return sendBadRequest(reply, `[${opening.id}] ${errors[0]}`)
    }

    await prisma.room.update({ where: { id }, data: { openings: openings as object[] } })
    return reply.send(openings)
  })

  // DELETE /rooms/:id/openings/:openingId
  app.delete<{ Params: { id: string; openingId: string } }>(
    '/rooms/:id/openings/:openingId',
    async (request, reply) => {
      const { id, openingId } = request.params
      const room = await prisma.room.findUnique({ where: { id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const filtered = ((room.openings as unknown[]) ?? []).filter(
        (o: unknown) => (o as { id: string }).id !== openingId,
      )
      await prisma.room.update({ where: { id }, data: { openings: filtered as object[] } })
      return reply.status(204).send()
    },
  )
}
