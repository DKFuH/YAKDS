import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import type {
  CeilingConstraint,
  HeightPlacedObject,
  Opening,
  PlacedObject,
  Point2D,
  RuleViolation,
  WallSegment2D,
} from '@yakds/shared-schemas'
import {
  checkObjectHeight,
  checkMinClearance,
  checkObjectInRoom,
  checkObjectOverlap,
  checkObjectVsOpening,
  detectCostHints,
} from '@yakds/shared-schemas'

const PointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const ObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['base', 'wall', 'tall', 'appliance']).default('base'),
  wall_id: z.string().min(1),
  offset_mm: z.number(),
  width_mm: z.number().positive(),
  depth_mm: z.number(),
  height_mm: z.number(),
  worldPos: PointSchema.optional(),
})
type ValidateObject = z.infer<typeof ObjectSchema>

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

const CeilingConstraintSchema = z.object({
  wall_id: z.string().min(1),
  wall_start: PointSchema,
  wall_end: PointSchema,
  kniestock_height_mm: z.number().nonnegative(),
  slope_angle_deg: z.number().positive(),
  depth_into_room_mm: z.number().positive(),
})

const ValidateRequestSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  roomPolygon: z.array(PointSchema).min(3).max(128),
  objects: z.array(ObjectSchema).max(200),
  openings: z.array(OpeningSchema).max(200).default([]),
  walls: z.array(WallSchema).max(256).default([]),
  ceilingConstraints: z.array(CeilingConstraintSchema).max(64).default([]),
  nominalCeilingMm: z.number().positive().max(10000).default(2500),
  minClearanceMm: z.number().min(0).max(5000).default(50),
})

export async function validateRoutes(app: FastifyInstance) {
  app.post('/validate', async (request, reply) => {
    const parsed = ValidateRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const {
      project_id,
      user_id,
      roomPolygon,
      objects,
      openings,
      walls,
      ceilingConstraints,
      nominalCeilingMm,
      minClearanceMm,
    } = parsed.data

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

    const typedObjects = objects as ValidateObject[]
    const placementObjects = typedObjects as PlacedObject[]
    const typedOpenings = openings as Opening[]
    const typedPolygon = roomPolygon as Point2D[]
    const typedWalls = walls as WallSegment2D[]
    const typedConstraints = ceilingConstraints as CeilingConstraint[]

    const violations: RuleViolation[] = []

    for (let i = 0; i < typedObjects.length; i += 1) {
      const obj = typedObjects[i]
      const placementObject = obj as PlacedObject

      const outside = checkObjectInRoom(placementObject, typedPolygon)
      if (outside) violations.push(outside)

      const openingViolation = checkObjectVsOpening(placementObject, typedOpenings)
      if (openingViolation) violations.push(openingViolation)

      const clearanceViolation = checkMinClearance(placementObject, placementObjects, minClearanceMm)
      if (clearanceViolation) violations.push(clearanceViolation)

      for (let j = i + 1; j < typedObjects.length; j += 1) {
        const overlapViolation = checkObjectOverlap(placementObject, placementObjects[j])
        if (overlapViolation) violations.push(overlapViolation)
      }

      const wall = typedWalls.find((candidate) => candidate.id === placementObject.wall_id)
      if (wall) {
        violations.push(...detectCostHints(placementObject, wall, typedOpenings))
      }

      if (obj.worldPos) {
        const heightObject: HeightPlacedObject = {
          id: obj.id,
          type: obj.type,
          height_mm: obj.height_mm,
          worldPos: obj.worldPos,
        }
        const heightViolation = checkObjectHeight(
          heightObject,
          typedConstraints,
          nominalCeilingMm,
        )
        if (heightViolation) violations.push(heightViolation)
      }
    }

    return reply.send({
      valid: !violations.some((violation) => violation.severity === 'error'),
      violations,
    })
  })
}
