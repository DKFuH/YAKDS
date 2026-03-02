import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

// ---- Wall Segment helpers ----

type Vertex = { id: string; x_mm: number; y_mm: number; index: number }
type WallSeg = {
  id: string
  index: number
  start_vertex_id: string
  end_vertex_id: string
  length_mm?: number
  thickness_mm?: number
  is_inner_wall?: boolean
  is_hidden?: boolean
  wall_objects?: WallObjectType[]
  installations?: InstallationType[]
}
type BoundaryJson = {
  vertices?: Vertex[]
  wall_segments?: WallSeg[]
}
type WallObjectType = {
  id: string
  wall_id: string
  type: string
  offset_mm: number
  width_mm: number
  height_mm?: number
  sill_height_mm?: number
  hinge_side?: 'left' | 'right'
  door_direction?: 'inward' | 'outward'
  frame_type?: string
  leibung_depth_mm?: number
  show_in_plan?: boolean
  show_in_view?: boolean
}
type InstallationType = {
  id: string
  wall_id: string
  installation_type: string
  offset_mm: number
  height_from_floor_mm?: number
  floor_object?: boolean
  offset_from_wall2_mm?: number
  show_in_plan?: boolean
  show_in_view?: boolean
  symbol_type?: string
}

function computeLength(v1: Vertex, v2: Vertex): number {
  const dx = v2.x_mm - v1.x_mm
  const dy = v2.y_mm - v1.y_mm
  return Math.sqrt(dx * dx + dy * dy)
}

function getBoundary(room: { boundary: unknown }): BoundaryJson {
  return (room.boundary as BoundaryJson) ?? {}
}

// ---- Zod Schemas ----

const WallObjectSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  type: z.enum(['door_single', 'door_double', 'pass_through', 'window_single', 'window_double', 'window_casement']),
  offset_mm: z.number().min(0),
  width_mm: z.number().positive(),
  height_mm: z.number().positive().optional(),
  sill_height_mm: z.number().min(0).optional(),
  hinge_side: z.enum(['left', 'right']).optional(),
  door_direction: z.enum(['inward', 'outward']).optional(),
  frame_type: z.string().optional(),
  leibung_depth_mm: z.number().positive().optional(),
  show_in_plan: z.boolean().default(true),
  show_in_view: z.boolean().default(true),
})

const InstallationSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  installation_type: z.enum(['socket_single', 'socket_double', 'socket_triple', 'water', 'drain', 'gas', '400v_floor']),
  offset_mm: z.number().min(0),
  height_from_floor_mm: z.number().min(0).optional(),
  floor_object: z.boolean().default(false),
  offset_from_wall2_mm: z.number().min(0).optional(),
  show_in_plan: z.boolean().default(true),
  show_in_view: z.boolean().default(true),
  symbol_type: z.enum(['installation_symbol', 'installation_object']).default('installation_symbol'),
})

const MIN_WALL_SHIFT_MM = -50000
const MAX_WALL_SHIFT_MM = 50000

export async function wallRoutes(app: FastifyInstance) {
  // PATCH /walls/:id/shift – parallel shift by delta_mm
  app.patch<{ Params: { id: string } }>('/walls/:id/shift', async (request, reply) => {
    const { id } = request.params
    const parsed = z.object({ delta_mm: z.number().min(MIN_WALL_SHIFT_MM).max(MAX_WALL_SHIFT_MM), room_id: z.string().uuid() }).safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const wall = boundary.wall_segments?.find(w => w.id === id)
    if (!wall) return sendNotFound(reply, 'Wall not found')

    const vertices = boundary.vertices ?? []
    const v1 = vertices.find(v => v.id === wall.start_vertex_id)
    const v2 = vertices.find(v => v.id === wall.end_vertex_id)
    if (!v1 || !v2) return sendNotFound(reply, 'Vertices not found')

    const dx = v2.x_mm - v1.x_mm
    const dy = v2.y_mm - v1.y_mm
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) return sendBadRequest(reply, 'Wall too short')

    // Inner normal (perpendicular, pointing inward by convention)
    const nx = -dy / len
    const ny = dx / len
    const delta = parsed.data.delta_mm

    const newVertices = vertices.map(v => {
      if (v.id === wall.start_vertex_id || v.id === wall.end_vertex_id) {
        return { ...v, x_mm: v.x_mm + nx * delta, y_mm: v.y_mm + ny * delta }
      }
      return v
    })

    const newBoundary = { ...boundary, vertices: newVertices }
    const updatedRoom = await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { boundary: newBoundary as object },
    })
    return reply.send({ wall_id: id, delta_mm: delta, room: updatedRoom })
  })

  // POST /walls/:id/split – split wall at offset_mm from start
  app.post<{ Params: { id: string } }>('/walls/:id/split', async (request, reply) => {
    const { id } = request.params
    const parsed = z.object({ offset_mm: z.number().positive(), room_id: z.string().uuid() }).safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const walls = boundary.wall_segments ?? []
    const vertices = boundary.vertices ?? []
    const wallIdx = walls.findIndex(w => w.id === id)
    if (wallIdx === -1) return sendNotFound(reply, 'Wall not found')

    const wall = walls[wallIdx]
    const v1 = vertices.find(v => v.id === wall.start_vertex_id)
    const v2 = vertices.find(v => v.id === wall.end_vertex_id)
    if (!v1 || !v2) return sendNotFound(reply, 'Vertices not found')

    const len = computeLength(v1, v2)
    const offset = parsed.data.offset_mm
    if (offset <= 0 || offset >= len) return sendBadRequest(reply, `Offset ${offset} out of wall bounds [0, ${len}]`)

    const t = offset / len
    const newVertex: Vertex = {
      id: randomUUID(),
      x_mm: v1.x_mm + t * (v2.x_mm - v1.x_mm),
      y_mm: v1.y_mm + t * (v2.y_mm - v1.y_mm),
      index: vertices.length,
    }

    const newWall1: WallSeg = {
      id: randomUUID(),
      index: wall.index,
      start_vertex_id: wall.start_vertex_id,
      end_vertex_id: newVertex.id,
      length_mm: offset,
    }
    const newWall2: WallSeg = {
      id: randomUUID(),
      index: wall.index + 1,
      start_vertex_id: newVertex.id,
      end_vertex_id: wall.end_vertex_id,
      length_mm: len - offset,
    }

    const newWalls = [
      ...walls.slice(0, wallIdx),
      newWall1,
      newWall2,
      ...walls.slice(wallIdx + 1),
    ].map((w, i) => ({ ...w, index: i }))

    const newBoundary = {
      ...boundary,
      vertices: [...vertices, newVertex],
      wall_segments: newWalls,
    }
    const updatedRoom = await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { boundary: newBoundary as object },
    })
    return reply.status(201).send({ wall1_id: newWall1.id, wall2_id: newWall2.id, vertex_id: newVertex.id, room: updatedRoom })
  })

  // POST /rooms/:id/complete – complete room polygon (90deg mode)
  app.post<{ Params: { id: string }; Querystring: { mode?: string } }>(
    '/rooms/:id/complete',
    async (request, reply) => {
      const { id } = request.params
      const mode = (request.query as { mode?: string }).mode ?? '90deg'

      const room = await prisma.room.findUnique({ where: { id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const boundary = getBoundary(room)
      const vertices = boundary.vertices ?? []
      const walls = boundary.wall_segments ?? []

      if (vertices.length < 2) return sendBadRequest(reply, 'At least 2 vertices required to complete')

      if (mode === '90deg') {
        const lastWall = walls[walls.length - 1]
        if (lastWall && lastWall.end_vertex_id === vertices[0].id) {
          return reply.send({ message: 'Already closed', room })
        }

        const closingWall: WallSeg = {
          id: randomUUID(),
          index: walls.length,
          start_vertex_id: vertices[vertices.length - 1].id,
          end_vertex_id: vertices[0].id,
        }
        const newBoundary = { ...boundary, wall_segments: [...walls, closingWall] }
        const updatedRoom = await prisma.room.update({
          where: { id },
          data: { boundary: newBoundary as object },
        })
        return reply.status(201).send({ mode, room: updatedRoom })
      }

      return sendBadRequest(reply, `Unknown completion mode: ${mode}`)
    },
  )

  // GET /rooms/:id/wall-objects
  app.get<{ Params: { id: string } }>('/rooms/:id/wall-objects', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const allObjects: (WallObjectType & { room_id: string })[] = []
    for (const wall of boundary.wall_segments ?? []) {
      for (const obj of wall.wall_objects ?? []) {
        allObjects.push({ ...obj, wall_id: wall.id, room_id: request.params.id })
      }
    }
    return reply.send(allObjects)
  })

  // POST /walls/:id/wall-objects
  app.post<{ Params: { id: string } }>('/walls/:id/wall-objects', async (request, reply) => {
    const { id } = request.params
    const bodyParsed = z.object({
      room_id: z.string().uuid(),
      wall_object: WallObjectSchema,
    }).safeParse(request.body)
    if (!bodyParsed.success) return sendBadRequest(reply, bodyParsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: bodyParsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const walls = boundary.wall_segments ?? []
    const wallIdx = walls.findIndex(w => w.id === id)
    if (wallIdx === -1) return sendNotFound(reply, 'Wall not found')

    const newObj: WallObjectType = { ...bodyParsed.data.wall_object, wall_id: id }
    const updatedWalls = walls.map((w, i) => {
      if (i !== wallIdx) return w
      return { ...w, wall_objects: [...(w.wall_objects ?? []), newObj] }
    })
    const newBoundary = { ...boundary, wall_segments: updatedWalls }
    await prisma.room.update({ where: { id: bodyParsed.data.room_id }, data: { boundary: newBoundary as object } })
    return reply.status(201).send(newObj)
  })

  // PATCH /wall-objects/:id/hinge-side
  app.patch<{ Params: { id: string } }>('/wall-objects/:id/hinge-side', async (request, reply) => {
    const { id: objId } = request.params
    const parsed = z.object({ hinge_side: z.enum(['left', 'right']), room_id: z.string().uuid() }).safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    let found = false
    const updatedWalls = (boundary.wall_segments ?? []).map(w => ({
      ...w,
      wall_objects: (w.wall_objects ?? []).map(obj => {
        if (obj.id !== objId) return obj
        found = true
        return { ...obj, hinge_side: parsed.data.hinge_side }
      }),
    }))
    if (!found) return sendNotFound(reply, 'Wall object not found')

    await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { boundary: { ...boundary, wall_segments: updatedWalls } as object },
    })
    return reply.send({ id: objId, hinge_side: parsed.data.hinge_side })
  })

  // PATCH /wall-objects/:id/show-in-view – toggle plan/view visibility for wall objects
  app.patch<{ Params: { id: string } }>('/wall-objects/:id/show-in-view', async (request, reply) => {
    const { id: objId } = request.params
    const parsed = z.object({
      show_in_plan: z.boolean().optional(),
      show_in_view: z.boolean().optional(),
      room_id: z.string().uuid(),
    }).safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    let found = false
    const updatedWalls = (boundary.wall_segments ?? []).map(w => ({
      ...w,
      wall_objects: (w.wall_objects ?? []).map((obj: WallObjectType) => {
        if (obj.id !== objId) return obj
        found = true
        return {
          ...obj,
          ...(parsed.data.show_in_plan !== undefined ? { show_in_plan: parsed.data.show_in_plan } : {}),
          ...(parsed.data.show_in_view !== undefined ? { show_in_view: parsed.data.show_in_view } : {}),
        }
      }),
    }))
    if (!found) return sendNotFound(reply, 'Wall object not found')

    await prisma.room.update({
      where: { id: parsed.data.room_id },
      data: { boundary: { ...boundary, wall_segments: updatedWalls } as object },
    })
    return reply.send({ id: objId, show_in_plan: parsed.data.show_in_plan, show_in_view: parsed.data.show_in_view })
  })

  // POST /walls/:id/installations
  app.post<{ Params: { id: string } }>('/walls/:id/installations', async (request, reply) => {
    const { id } = request.params
    const bodyParsed = z.object({
      room_id: z.string().uuid(),
      installation: InstallationSchema,
    }).safeParse(request.body)
    if (!bodyParsed.success) return sendBadRequest(reply, bodyParsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: bodyParsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const walls = boundary.wall_segments ?? []
    const wallIdx = walls.findIndex(w => w.id === id)
    if (wallIdx === -1) return sendNotFound(reply, 'Wall not found')

    const newInst: InstallationType = { ...bodyParsed.data.installation, wall_id: id }
    const updatedWalls = walls.map((w, i) => {
      if (i !== wallIdx) return w
      return { ...w, installations: [...(w.installations ?? []), newInst] }
    })
    const newBoundary = { ...boundary, wall_segments: updatedWalls }
    await prisma.room.update({ where: { id: bodyParsed.data.room_id }, data: { boundary: newBoundary as object } })
    return reply.status(201).send(newInst)
  })

  // GET /rooms/:id/installations
  app.get<{ Params: { id: string } }>('/rooms/:id/installations', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = getBoundary(room)
    const allInst: (InstallationType & { room_id: string })[] = []
    for (const wall of boundary.wall_segments ?? []) {
      for (const inst of wall.installations ?? []) {
        allInst.push({ ...inst, wall_id: wall.id, room_id: request.params.id })
      }
    }
    return reply.send(allInst)
  })
}
