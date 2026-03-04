import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { arcLengthMm, pointOnArc, type ArcWallSegment } from '../services/arcWallGeometry.js'

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })

const StyleSchema = z.object({
  unit: z.enum(['mm', 'cm']).optional(),
  fontSize: z.number().int().min(6).max(24).optional(),
  arrowType: z.enum(['open', 'closed', 'none']).optional(),
  offset_mm: z.number().min(0).max(1000).optional(),
}).optional()

const CreateDimensionSchema = z.object({
  room_id: z.string().uuid(),
  type: z.enum(['linear', 'angular', 'radial', 'arc_length', 'chord']),
  points: z.array(PointSchema).min(2).max(3),
  style: StyleSchema,
  label: z.string().max(100).nullable().optional(),
})

const UpdateDimensionSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  style: StyleSchema,
})

type RoomBoundary = {
  vertices?: Array<{ id: string; x_mm: number; y_mm: number }>
  wall_segments?: Array<{
    id: string
    kind?: 'line' | 'arc'
    x0_mm?: number
    y0_mm?: number
    x1_mm?: number
    y1_mm?: number
    start_vertex_id?: string
    end_vertex_id?: string
    start?: { x_mm: number; y_mm: number }
    end?: { x_mm: number; y_mm: number }
    center?: { x_mm: number; y_mm: number }
    radius_mm?: number
    clockwise?: boolean
  }>
} | null

type RoomPlacement = { id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm?: number }
type RoomOpening = { id: string; wall_id: string; offset_mm: number; width_mm: number }

const AutoChainBodySchema = z.object({
  wall_id: z.string().min(1),
  offset_mm: z.number().min(0).max(1000).optional(),
})

const AutoChainQuerySchema = z.object({
  include_arcs: z.coerce.boolean().optional().default(false),
})

type ChainPoint = {
  x_mm: number
  ref_type: 'wall' | 'placement' | 'opening'
  ref_id: string
}

type ResolvedWall =
  | { kind: 'line'; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }
  | { kind: 'arc'; arc: ArcWallSegment }

function wallEndpoints(boundary: RoomBoundary, wallId: string): ResolvedWall | null {
  const wall = boundary?.wall_segments?.find((entry) => entry.id === wallId)
  if (!wall) return null

  if (wall.kind === 'arc' && wall.start && wall.end && wall.center && typeof wall.radius_mm === 'number') {
    return {
      kind: 'arc',
      arc: {
        id: wall.id,
        kind: 'arc',
        start: wall.start,
        end: wall.end,
        center: wall.center,
        radius_mm: wall.radius_mm,
        clockwise: Boolean(wall.clockwise),
      },
    }
  }

  if (
    typeof wall.x0_mm === 'number' &&
    typeof wall.y0_mm === 'number' &&
    typeof wall.x1_mm === 'number' &&
    typeof wall.y1_mm === 'number'
  ) {
    return {
      kind: 'line',
      x0_mm: wall.x0_mm,
      y0_mm: wall.y0_mm,
      x1_mm: wall.x1_mm,
      y1_mm: wall.y1_mm,
    }
  }

  const start = boundary?.vertices?.find((vertex) => vertex.id === wall.start_vertex_id)
  const end = boundary?.vertices?.find((vertex) => vertex.id === wall.end_vertex_id)
  if (!start || !end) return null

  return {
    kind: 'line',
    x0_mm: start.x_mm,
    y0_mm: start.y_mm,
    x1_mm: end.x_mm,
    y1_mm: end.y_mm,
  }
}

function wallPointAt(wall: ResolvedWall, offsetMm: number): { x_mm: number; y_mm: number } {
  if (wall.kind === 'arc') {
    const length = arcLengthMm(wall.arc)
    const ratio = length <= 0 ? 0 : Math.max(0, Math.min(1, offsetMm / length))
    const point = pointOnArc(wall.arc, ratio)
    return { x_mm: point.x_mm, y_mm: point.y_mm }
  }

  const dx = wall.x1_mm - wall.x0_mm
  const dy = wall.y1_mm - wall.y0_mm
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x_mm: wall.x0_mm, y_mm: wall.y0_mm }
  const ux = dx / len
  const uy = dy / len
  return {
    x_mm: wall.x0_mm + ux * offsetMm,
    y_mm: wall.y0_mm + uy * offsetMm,
  }
}

export async function dimensionRoutes(app: FastifyInstance) {
  app.post('/dimensions', async (request, reply) => {
    const parsed = CreateDimensionSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')
    }

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    if (parsed.data.type === 'angular' && parsed.data.points.length !== 3) {
      return sendBadRequest(reply, 'Angular dimension requires exactly 3 points')
    }

    if ((parsed.data.type === 'linear' || parsed.data.type === 'radial' || parsed.data.type === 'arc_length' || parsed.data.type === 'chord') && parsed.data.points.length !== 2) {
      return sendBadRequest(reply, `${parsed.data.type} dimension requires exactly 2 points`)
    }

    const dimension = await prisma.dimension.create({
      data: {
        room_id: parsed.data.room_id,
        type: parsed.data.type,
        points: parsed.data.points,
        style: parsed.data.style ?? {},
        label: parsed.data.label ?? null,
      },
    })

    return reply.status(201).send(dimension)
  })

  app.get<{ Params: { id: string } }>('/rooms/:id/dimensions', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const dimensions = await prisma.dimension.findMany({
      where: { room_id: request.params.id },
      orderBy: { created_at: 'asc' },
    })

    return reply.send(dimensions)
  })

  app.delete<{ Params: { id: string } }>('/dimensions/:id', async (request, reply) => {
    const existing = await prisma.dimension.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Dimension not found')

    if (existing.locked) {
      return sendBadRequest(reply, 'Dimension is locked and cannot be deleted')
    }

    await prisma.dimension.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.put<{ Params: { id: string } }>('/dimensions/:id', async (request, reply) => {
    const existing = await prisma.dimension.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Dimension not found')

    if (existing.locked) {
      return sendBadRequest(reply, 'Dimension is locked and cannot be edited')
    }

    const parsed = UpdateDimensionSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')
    }

    const updated = await prisma.dimension.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(parsed.data.style !== undefined ? { style: parsed.data.style ?? {} } : {}),
      },
    })
    return reply.send(updated)
  })

  app.post<{ Params: { id: string } }>('/rooms/:id/dimensions/auto', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const existingDimensions = await prisma.dimension.findMany({ where: { room_id: request.params.id } })
    if (existingDimensions.some((dimension) => Boolean(dimension.locked))) {
      return sendBadRequest(reply, 'Locked dimensions prevent auto-generation')
    }

    const boundary = room.boundary as RoomBoundary
    if (!boundary?.wall_segments?.length) {
      return sendBadRequest(reply, 'Room has no boundary')
    }

    await prisma.dimension.deleteMany({ where: { room_id: request.params.id } })

    const offsetMm = 300
    const walls = boundary.wall_segments
      .map((wall) => wallEndpoints(boundary, wall.id))
      .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall))
      .filter((wall): wall is Extract<NonNullable<typeof wall>, { kind: 'line' }> => {
        if (wall.kind !== 'line') return false
        const dx = wall.x1_mm - wall.x0_mm
        const dy = wall.y1_mm - wall.y0_mm
        return Math.hypot(dx, dy) >= 50
      })

    const created = await Promise.all(
      walls.map((wall) => prisma.dimension.create({
        data: {
          room_id: request.params.id,
          type: 'linear',
          points: [
            { x_mm: wall.x0_mm, y_mm: wall.y0_mm },
            { x_mm: wall.x1_mm, y_mm: wall.y1_mm },
          ],
          style: { unit: 'mm', offset_mm: offsetMm },
          label: null,
        },
      })),
    )

    return reply.status(201).send(created)
  })

  app.post<{ Params: { id: string } }>('/rooms/:id/dimensions/smart', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const existingDimensions = await prisma.dimension.findMany({ where: { room_id: request.params.id } })
    if (existingDimensions.some((dimension) => Boolean(dimension.locked))) {
      return sendBadRequest(reply, 'Locked dimensions prevent smart-generation')
    }

    const boundary = room.boundary as RoomBoundary
    if (!boundary?.wall_segments?.length) {
      return sendBadRequest(reply, 'Room has no boundary')
    }

    const placements = (room.placements as RoomPlacement[] | null) ?? []
    await prisma.dimension.deleteMany({ where: { room_id: request.params.id } })

    const OUTER_OFFSET_MM = 300
    const INNER_OFFSET_MM = 150
    const results: Awaited<ReturnType<typeof prisma.dimension.create>>[] = []

    for (const wallSegment of boundary.wall_segments) {
      const wall = wallEndpoints(boundary, wallSegment.id)
      if (!wall) continue

      if (wall.kind === 'arc') {
        const arcLen = arcLengthMm(wall.arc)
        if (arcLen < 50) continue
        results.push(await prisma.dimension.create({
          data: {
            room_id: request.params.id,
            type: 'arc_length',
            points: [
              { x_mm: wall.arc.start.x_mm, y_mm: wall.arc.start.y_mm },
              { x_mm: wall.arc.end.x_mm, y_mm: wall.arc.end.y_mm },
            ],
            style: { unit: 'mm', offset_mm: OUTER_OFFSET_MM },
            label: `${Math.round(arcLen)} mm`,
          },
        }))
        continue
      }

      const dx = wall.x1_mm - wall.x0_mm
      const dy = wall.y1_mm - wall.y0_mm
      const len = Math.hypot(dx, dy)
      if (len < 50) continue

      const dirX = dx / len
      const dirY = dy / len

      results.push(await prisma.dimension.create({
        data: {
          room_id: request.params.id,
          type: 'linear',
          points: [
            { x_mm: wall.x0_mm, y_mm: wall.y0_mm },
            { x_mm: wall.x1_mm, y_mm: wall.y1_mm },
          ],
          style: { unit: 'mm', offset_mm: OUTER_OFFSET_MM },
          label: null,
        },
      }))

      const wallPlacements = placements
        .filter(p => p.wall_id === wallSegment.id)
        .sort((a, b) => a.offset_mm - b.offset_mm)

      for (const placement of wallPlacements) {
        const startX = wall.x0_mm + dirX * placement.offset_mm
        const startY = wall.y0_mm + dirY * placement.offset_mm
        const endX = wall.x0_mm + dirX * (placement.offset_mm + placement.width_mm)
        const endY = wall.y0_mm + dirY * (placement.offset_mm + placement.width_mm)
        results.push(await prisma.dimension.create({
          data: {
            room_id: request.params.id,
            type: 'linear',
            points: [
              { x_mm: startX, y_mm: startY },
              { x_mm: endX, y_mm: endY },
            ],
            style: { unit: 'mm', offset_mm: INNER_OFFSET_MM },
            label: `${Math.round(placement.width_mm)} mm`,
          },
        }))
      }
    }

    return reply.status(201).send(results)
  })

  app.post<{ Params: { id: string } }>('/rooms/:id/dimensions/auto-chain', async (request, reply) => {
    const parsed = AutoChainBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')
    }

    const queryParsed = AutoChainQuerySchema.safeParse(request.query ?? {})
    if (!queryParsed.success) {
      return sendBadRequest(reply, queryParsed.error.errors[0]?.message ?? 'Invalid query')
    }

    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const existingDimensions = await prisma.dimension.findMany({ where: { room_id: request.params.id } })
    if (existingDimensions.some((dimension) => Boolean(dimension.locked))) {
      return sendBadRequest(reply, 'Locked dimensions prevent auto-chain generation')
    }

    const boundary = room.boundary as RoomBoundary
    const wall = wallEndpoints(boundary, parsed.data.wall_id)
    if (!wall) return sendNotFound(reply, 'Wall not found')

    const placements = ((room.placements as RoomPlacement[] | null) ?? [])
      .filter((placement) => placement.wall_id === parsed.data.wall_id)
    const openings = ((room.openings as RoomOpening[] | null) ?? [])
      .filter((opening) => opening.wall_id === parsed.data.wall_id)

    const wallLength = wall.kind === 'arc'
      ? arcLengthMm(wall.arc)
      : Math.hypot(wall.x1_mm - wall.x0_mm, wall.y1_mm - wall.y0_mm)

    if (wall.kind === 'arc' && queryParsed.data.include_arcs) {
      const created = await prisma.dimension.create({
        data: {
          room_id: request.params.id,
          type: 'arc_length',
          points: [
            { x_mm: wall.arc.start.x_mm, y_mm: wall.arc.start.y_mm },
            { x_mm: wall.arc.end.x_mm, y_mm: wall.arc.end.y_mm },
          ],
          style: { chain: true, wall_id: parsed.data.wall_id, offset_mm: parsed.data.offset_mm ?? 150 },
          label: `${Math.round(wallLength)} mm`,
          ref_a_type: 'wall',
          ref_a_id: parsed.data.wall_id,
          ref_b_type: 'wall',
          ref_b_id: parsed.data.wall_id,
          auto_update: true,
        },
      })

      return reply.status(201).send({ created: 1, dimension_ids: [created.id] })
    }
    const chainPoints: ChainPoint[] = [{ x_mm: 0, ref_type: 'wall', ref_id: parsed.data.wall_id }]

    for (const opening of openings) {
      chainPoints.push({ x_mm: opening.offset_mm, ref_type: 'opening', ref_id: opening.id })
      chainPoints.push({ x_mm: opening.offset_mm + opening.width_mm, ref_type: 'opening', ref_id: opening.id })
    }

    for (const placement of placements) {
      chainPoints.push({ x_mm: placement.offset_mm, ref_type: 'placement', ref_id: placement.id })
      chainPoints.push({ x_mm: placement.offset_mm + placement.width_mm, ref_type: 'placement', ref_id: placement.id })
    }

    chainPoints.push({ x_mm: wallLength, ref_type: 'wall', ref_id: parsed.data.wall_id })

    const sorted = chainPoints
      .sort((a, b) => a.x_mm - b.x_mm)
      .filter((point, index, items) => index === 0 || Math.abs(point.x_mm - items[index - 1].x_mm) >= 5)

    const dimensionIds: string[] = []
    const offsetMm = parsed.data.offset_mm ?? 150

    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]
      const to = sorted[i + 1]

      const p1 = wallPointAt(wall, from.x_mm)
      const p2 = wallPointAt(wall, to.x_mm)

      const created = await prisma.dimension.create({
        data: {
          room_id: request.params.id,
          type: 'linear',
          points: [p1, p2],
          style: { chain: true, wall_id: parsed.data.wall_id, offset_mm: offsetMm },
          label: null,
          ref_a_type: from.ref_type,
          ref_a_id: from.ref_id,
          ref_b_type: to.ref_type,
          ref_b_id: to.ref_id,
          auto_update: true,
        },
      })

      dimensionIds.push(created.id)
    }

    return reply.status(201).send({ created: dimensionIds.length, dimension_ids: dimensionIds })
  })

  app.get<{ Params: { id: string; wallIndex: string } }>(
    '/rooms/:id/elevation/:wallIndex',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const wallIndex = Number(request.params.wallIndex)
      if (!Number.isInteger(wallIndex) || wallIndex < 0) {
        return sendNotFound(reply, 'Wall not found')
      }

      const boundary = room.boundary as RoomBoundary
      const wallSegment = boundary?.wall_segments?.[wallIndex]
      if (!wallSegment) return sendNotFound(reply, 'Wall not found')

      const wall = wallEndpoints(boundary, wallSegment.id)
      if (!wall) return sendNotFound(reply, 'Wall not found')

      const wallLength =
        wall.kind === 'arc'
          ? arcLengthMm(wall.arc)
          : Math.hypot(wall.x1_mm - wall.x0_mm, wall.y1_mm - wall.y0_mm)
      const roomHeight = room.ceiling_height_mm
      const placements = ((room.placements as RoomPlacement[] | null) ?? [])
        .filter((placement) => placement.wall_id === wallSegment.id)

      const scale = 0.1
      const svgWidth = Math.round(wallLength * scale) + 100
      const svgHeight = Math.round(roomHeight * scale) + 80

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`
      svgContent += `<line x1="50" y1="${svgHeight - 30}" x2="${svgWidth - 50}" y2="${svgHeight - 30}" stroke="#333" stroke-width="2"/>`

      for (const placement of placements) {
        const x = 50 + placement.offset_mm * scale
        const w = placement.width_mm * scale
        const h = 720 * scale
        const y = svgHeight - 30 - h
        svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8d5b0" stroke="#8B4513" stroke-width="1"/>`
        svgContent += `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-size="8" fill="#333">${Math.round(placement.width_mm)}</text>`
      }

      svgContent += `<line x1="50" y1="${svgHeight - 15}" x2="${svgWidth - 50}" y2="${svgHeight - 15}" stroke="#666" stroke-width="1"/>`
      svgContent += `<text x="${svgWidth / 2}" y="${svgHeight - 5}" text-anchor="middle" font-size="10" fill="#666">${Math.round(wallLength)} mm</text>`
      svgContent += '</svg>'

      reply.header('Content-Type', 'image/svg+xml')
      return reply.send(svgContent)
    },
  )
}
