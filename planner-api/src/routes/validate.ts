import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import type { Opening, PlacedObject, Point2D, RuleViolation, WallSegment2D } from '../../../shared-schemas/src/types.js'
import {
  checkMinClearance,
  checkObjectInRoom,
  checkObjectOverlap,
  checkObjectVsOpening,
  detectCostHints,
} from '../../../shared-schemas/src/validation/collisionDetector.js'

const PointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const ObjectSchema = z.object({
  id: z.string().min(1),
  wall_id: z.string().min(1),
  offset_mm: z.number(),
  width_mm: z.number().positive(),
  depth_mm: z.number(),
  height_mm: z.number(),
  worldPos: PointSchema.optional(),
})

const OpeningSchema = z.object({
  id: z.string().min(1),
  wall_id: z.string().min(1),
  offset_mm: z.number(),
  width_mm: z.number().positive(),
})

const WallSchema = z.object({
  id: z.string().min(1),
  start: PointSchema,
  end: PointSchema,
  length_mm: z.number().positive(),
})

const ValidateRequestSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  roomPolygon: z.array(PointSchema).min(3).max(128),
  objects: z.array(ObjectSchema).max(200),
  openings: z.array(OpeningSchema).max(200).default([]),
  walls: z.array(WallSchema).max(256).default([]),
  minClearanceMm: z.number().min(0).max(5000).default(50),
})

export async function validateRoutes(app: FastifyInstance) {
  app.post('/validate', async (request, reply) => {
    const parsed = ValidateRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const { project_id, user_id, roomPolygon, objects, openings, walls, minClearanceMm } = parsed.data

    const project = await prisma.project.findFirst({
      where: {
        id: project_id,
        user_id,
      },
      select: { id: true },
    })
    if (!project) {
      return sendNotFound(reply, 'Project not found for user')
    }

    const typedObjects = objects as PlacedObject[]
    const typedOpenings = openings as Opening[]
    const typedPolygon = roomPolygon as Point2D[]
    const typedWalls = walls as WallSegment2D[]

    const violations: RuleViolation[] = []

    for (let i = 0; i < typedObjects.length; i += 1) {
      const obj = typedObjects[i]

      const outside = checkObjectInRoom(obj, typedPolygon)
      if (outside) violations.push(outside)

      const openingViolation = checkObjectVsOpening(obj, typedOpenings)
      if (openingViolation) violations.push(openingViolation)

      const clearanceViolation = checkMinClearance(obj, typedObjects, minClearanceMm)
      if (clearanceViolation) violations.push(clearanceViolation)

      for (let j = i + 1; j < typedObjects.length; j += 1) {
        const overlapViolation = checkObjectOverlap(obj, typedObjects[j])
        if (overlapViolation) violations.push(overlapViolation)
      }

      const wall = typedWalls.find((candidate) => candidate.id === obj.wall_id)
      if (wall) {
        violations.push(...detectCostHints(obj, wall, typedOpenings))
      }
    }

    return reply.send({
      valid: !violations.some((violation) => violation.severity === 'error'),
      violations,
    })
  })
}
