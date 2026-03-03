import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })

const StyleSchema = z.object({
  unit: z.enum(['mm', 'cm']).optional(),
  fontSize: z.number().int().min(6).max(24).optional(),
  arrowType: z.enum(['open', 'closed', 'none']).optional(),
  offset_mm: z.number().min(0).max(1000).optional(),
}).optional()

const CreateDimensionSchema = z.object({
  room_id: z.string().uuid(),
  type: z.enum(['linear', 'angular']),
  points: z.array(PointSchema).min(2).max(3),
  style: StyleSchema,
  label: z.string().max(100).nullable().optional(),
})

const UpdateDimensionSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  style: StyleSchema,
})

type RoomBoundary = {
  wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
} | null

type RoomPlacement = { id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm?: number }

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

    await prisma.dimension.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.put<{ Params: { id: string } }>('/dimensions/:id', async (request, reply) => {
    const existing = await prisma.dimension.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Dimension not found')

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

    const boundary = room.boundary as RoomBoundary
    if (!boundary?.wall_segments?.length) {
      return sendBadRequest(reply, 'Room has no boundary')
    }

    await prisma.dimension.deleteMany({ where: { room_id: request.params.id } })

    const offsetMm = 300
    const walls = boundary.wall_segments.filter((wall) => {
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

    const boundary = room.boundary as RoomBoundary
    if (!boundary?.wall_segments?.length) {
      return sendBadRequest(reply, 'Room has no boundary')
    }

    const placements = (room.placements as RoomPlacement[] | null) ?? []
    await prisma.dimension.deleteMany({ where: { room_id: request.params.id } })

    const OUTER_OFFSET_MM = 300
    const INNER_OFFSET_MM = 150
    const results: Awaited<ReturnType<typeof prisma.dimension.create>>[] = []

    for (const wall of boundary.wall_segments) {
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
        .filter(p => p.wall_id === wall.id)
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
      const wall = boundary?.wall_segments?.[wallIndex]
      if (!wall) return sendNotFound(reply, 'Wall not found')

      const wallLength = Math.hypot(wall.x1_mm - wall.x0_mm, wall.y1_mm - wall.y0_mm)
      const roomHeight = room.ceiling_height_mm
      const placements = ((room.placements as RoomPlacement[] | null) ?? [])
        .filter((placement) => placement.wall_id === wall.id)

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