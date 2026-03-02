import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAvailableHeight } from '@okp/shared-schemas'
import type { CeilingConstraint, Point2D } from '@okp/shared-schemas'

import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const PointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const CeilingConstraintSchema = z.object({
  id: z.string().min(1).default(() => randomUUID()),
  room_id: z.string().uuid(),
  wall_id: z.string().min(1),
  wall_start: PointSchema,
  wall_end: PointSchema,
  kniestock_height_mm: z.number().nonnegative(),
  slope_angle_deg: z.number().positive(),
  depth_into_room_mm: z.number().positive(),
})

const UpdateCeilingConstraintSchema = z.object({
  room_id: z.string().uuid(),
  wall_id: z.string().min(1).optional(),
  wall_start: PointSchema.optional(),
  wall_end: PointSchema.optional(),
  kniestock_height_mm: z.number().nonnegative().optional(),
  slope_angle_deg: z.number().positive().optional(),
  depth_into_room_mm: z.number().positive().optional(),
})

const AvailableHeightQuerySchema = z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
})

function getRoomConstraints(room: { ceiling_constraints: unknown }): CeilingConstraint[] {
  return ((room.ceiling_constraints as unknown[]) ?? []) as CeilingConstraint[]
}

export async function ceilingConstraintRoutes(app: FastifyInstance) {
  app.post('/ceiling-constraints', async (request, reply) => {
    const parsed = CeilingConstraintSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const constraints = getRoomConstraints(room)
    const nextConstraints = [...constraints, parsed.data]

    await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { ceiling_constraints: nextConstraints as object[] },
    })

    return reply.status(201).send(parsed.data)
  })

  app.put<{ Params: { id: string } }>('/ceiling-constraints/:id', async (request, reply) => {
    const parsed = UpdateCeilingConstraintSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const constraints = getRoomConstraints(room)
    const current = constraints.find((constraint) => constraint.id === request.params.id)
    if (!current) return sendNotFound(reply, 'Ceiling constraint not found')

    const updatedConstraint: CeilingConstraint = {
      ...current,
      ...parsed.data,
      id: request.params.id,
    }

    const nextConstraints = constraints.map((constraint) =>
      constraint.id === request.params.id ? updatedConstraint : constraint,
    )

    await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { ceiling_constraints: nextConstraints as object[] },
    })

    return reply.send(updatedConstraint)
  })

  app.get<{ Params: { id: string }; Querystring: { x: string; y: string } }>(
    '/rooms/:id/available-height',
    async (request, reply) => {
      const parsedQuery = AvailableHeightQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) return sendBadRequest(reply, parsedQuery.error.errors[0].message)

      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const point: Point2D = {
        x_mm: parsedQuery.data.x,
        y_mm: parsedQuery.data.y,
      }

      const constraints = getRoomConstraints(room)
      const available_height_mm = getAvailableHeight(constraints, point, room.ceiling_height_mm)

      return reply.send({
        room_id: room.id,
        point,
        available_height_mm,
      })
    },
  )
}
