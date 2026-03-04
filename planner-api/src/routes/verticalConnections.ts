import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'
import {
  deriveStairAndOpeningGeometry,
  extractRoomIdFromFootprint,
  StairGeometryValidationError,
} from '../services/stairGeometryService.js'

const CreateVerticalConnectionSchema = z.object({
  from_level_id: z.string().uuid(),
  to_level_id: z.string().uuid(),
  kind: z.string().min(1).max(40),
  footprint_json: z.record(z.unknown()),
  stair_json: z.record(z.unknown()).optional(),
})

const UpdateVerticalConnectionSchema = z.object({
  from_level_id: z.string().uuid().optional(),
  to_level_id: z.string().uuid().optional(),
  kind: z.string().min(1).max(40).optional(),
  footprint_json: z.record(z.unknown()).optional(),
  stair_json: z.record(z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
})

function resolveTenantId(request: {
  tenantId?: string | null
  headers?: Record<string, string | string[] | undefined>
}): string | null {
  if (request.tenantId) {
    return request.tenantId
  }

  const tenantHeader = request.headers?.['x-tenant-id']
  if (!tenantHeader) {
    return null
  }

  return Array.isArray(tenantHeader) ? (tenantHeader[0] ?? null) : tenantHeader
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function normalizeCeilingOpenings(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
}

function buildCeilingOpeningEntry(params: {
  verticalConnectionId: string
  kind: string
  fromLevelId: string
  toLevelId: string
  openingJson: Record<string, unknown>
}): Record<string, unknown> {
  return {
    vertical_connection_id: params.verticalConnectionId,
    kind: params.kind,
    from_level_id: params.fromLevelId,
    to_level_id: params.toLevelId,
    opening_json: params.openingJson,
    updated_at: new Date().toISOString(),
  }
}

async function upsertRoomCeilingOpening(
  tx: Prisma.TransactionClient,
  params: {
    roomId: string
    verticalConnectionId: string
    kind: string
    fromLevelId: string
    toLevelId: string
    openingJson: Record<string, unknown>
  },
): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: params.roomId },
    select: { id: true, ceiling_openings: true },
  })

  if (!room) return

  const existing = normalizeCeilingOpenings(room.ceiling_openings)
    .filter((entry) => entry.vertical_connection_id !== params.verticalConnectionId)

  existing.push(buildCeilingOpeningEntry({
    verticalConnectionId: params.verticalConnectionId,
    kind: params.kind,
    fromLevelId: params.fromLevelId,
    toLevelId: params.toLevelId,
    openingJson: params.openingJson,
  }))

  await tx.room.update({
    where: { id: params.roomId },
    data: { ceiling_openings: toInputJson(existing) },
  })
}

async function removeRoomCeilingOpening(
  tx: Prisma.TransactionClient,
  roomId: string,
  verticalConnectionId: string,
): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { id: true, ceiling_openings: true },
  })

  if (!room) return

  const next = normalizeCeilingOpenings(room.ceiling_openings)
    .filter((entry) => entry.vertical_connection_id !== verticalConnectionId)

  await tx.room.update({
    where: { id: roomId },
    data: { ceiling_openings: toInputJson(next) },
  })
}

async function resolveScopedProject(projectId: string, tenantId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, tenant_id: true },
  })

  if (!project) return null
  if (project.tenant_id && project.tenant_id !== tenantId) return null
  return project
}

type ResolvedLevel = {
  id: string
  project_id: string
  elevation_mm: number
}

type LevelPairResult =
  | { fromLevel: ResolvedLevel; toLevel: ResolvedLevel }
  | { error: string }
  | { notFound: string }

async function resolveLevelPair(params: {
  fromLevelId: string
  toLevelId: string
  projectId: string
}): Promise<LevelPairResult> {
  if (params.fromLevelId === params.toLevelId) {
    return { error: 'from_level_id and to_level_id must be different' as const }
  }

  const levels = await prisma.buildingLevel.findMany({
    where: { id: { in: [params.fromLevelId, params.toLevelId] } },
    select: {
      id: true,
      project_id: true,
      elevation_mm: true,
    },
  })

  if (levels.length !== 2) {
    return { notFound: 'Level not found in project scope' as const }
  }

  const fromLevel = levels.find((entry) => entry.id === params.fromLevelId)
  const toLevel = levels.find((entry) => entry.id === params.toLevelId)

  if (!fromLevel || !toLevel) {
    return { notFound: 'Level not found in project scope' as const }
  }

  if (fromLevel.project_id !== toLevel.project_id) {
    return { error: 'from_level_id and to_level_id must belong to the same project' as const }
  }

  if (fromLevel.project_id !== params.projectId || toLevel.project_id !== params.projectId) {
    return { notFound: 'Level not found in project scope' as const }
  }

  return { fromLevel, toLevel }
}

async function ensureRoomInProject(roomId: string, projectId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, project_id: true },
  })

  if (!room) return false
  return room.project_id === projectId
}

export async function verticalConnectionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/vertical-connections', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const project = await resolveScopedProject(request.params.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const items = await prisma.verticalConnection.findMany({
      where: {
        tenant_id: tenantId,
        project_id: project.id,
      },
      orderBy: [{ created_at: 'asc' }],
    })

    return reply.send(items)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/vertical-connections', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = CreateVerticalConnectionSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await resolveScopedProject(request.params.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const levelPair = await resolveLevelPair({
      fromLevelId: parsed.data.from_level_id,
      toLevelId: parsed.data.to_level_id,
      projectId: project.id,
    })

    if ('error' in levelPair) {
      return sendBadRequest(reply, levelPair.error)
    }
    if ('notFound' in levelPair) {
      return sendNotFound(reply, levelPair.notFound)
    }

    const roomId = extractRoomIdFromFootprint(parsed.data.footprint_json)
    if (roomId) {
      const roomInProject = await ensureRoomInProject(roomId, project.id)
      if (!roomInProject) {
        return sendBadRequest(reply, 'footprint_json.room_id must reference a room in project scope')
      }
    }

    let geometry
    try {
      geometry = deriveStairAndOpeningGeometry({
        kind: parsed.data.kind,
        from_level_elevation_mm: levelPair.fromLevel.elevation_mm,
        to_level_elevation_mm: levelPair.toLevel.elevation_mm,
        footprint_json: parsed.data.footprint_json,
        stair_json: parsed.data.stair_json,
      })
    } catch (error) {
      if (error instanceof StairGeometryValidationError) {
        return sendBadRequest(reply, error.message)
      }
      throw error
    }

    const created = await prisma.$transaction(async (tx) => {
      const connection = await tx.verticalConnection.create({
        data: {
          tenant_id: tenantId,
          project_id: project.id,
          from_level_id: levelPair.fromLevel.id,
          to_level_id: levelPair.toLevel.id,
          kind: parsed.data.kind,
          footprint_json: toInputJson(parsed.data.footprint_json),
          stair_json: toInputJson(geometry.stair_json),
          opening_json: toInputJson(geometry.opening_json),
        },
      })

      if (roomId) {
        await upsertRoomCeilingOpening(tx, {
          roomId,
          verticalConnectionId: connection.id,
          kind: connection.kind,
          fromLevelId: connection.from_level_id,
          toLevelId: connection.to_level_id,
          openingJson: geometry.opening_json,
        })
      }

      return connection
    })

    return reply.status(201).send(created)
  })

  app.patch<{ Params: { id: string } }>('/vertical-connections/:id', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = UpdateVerticalConnectionSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.verticalConnection.findUnique({ where: { id: request.params.id } })
    if (!existing || existing.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Vertical connection not found')
    }

    const project = await resolveScopedProject(existing.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Vertical connection not found in tenant scope')
    }

    const nextFromLevelId = parsed.data.from_level_id ?? existing.from_level_id
    const nextToLevelId = parsed.data.to_level_id ?? existing.to_level_id
    const nextKind = parsed.data.kind ?? existing.kind
    const nextFootprint = parsed.data.footprint_json ?? (existing.footprint_json as Record<string, unknown>)
    const nextStair = parsed.data.stair_json ?? (existing.stair_json as Record<string, unknown>)

    const levelPair = await resolveLevelPair({
      fromLevelId: nextFromLevelId,
      toLevelId: nextToLevelId,
      projectId: project.id,
    })

    if ('error' in levelPair) {
      return sendBadRequest(reply, levelPair.error)
    }
    if ('notFound' in levelPair) {
      return sendNotFound(reply, levelPair.notFound)
    }

    const previousRoomId = extractRoomIdFromFootprint(existing.footprint_json)
    const nextRoomId = extractRoomIdFromFootprint(nextFootprint)

    if (nextRoomId) {
      const roomInProject = await ensureRoomInProject(nextRoomId, project.id)
      if (!roomInProject) {
        return sendBadRequest(reply, 'footprint_json.room_id must reference a room in project scope')
      }
    }

    let geometry
    try {
      geometry = deriveStairAndOpeningGeometry({
        kind: nextKind,
        from_level_elevation_mm: levelPair.fromLevel.elevation_mm,
        to_level_elevation_mm: levelPair.toLevel.elevation_mm,
        footprint_json: nextFootprint,
        stair_json: nextStair,
      })
    } catch (error) {
      if (error instanceof StairGeometryValidationError) {
        return sendBadRequest(reply, error.message)
      }
      throw error
    }

    const updated = await prisma.$transaction(async (tx) => {
      const connection = await tx.verticalConnection.update({
        where: { id: existing.id },
        data: {
          from_level_id: levelPair.fromLevel.id,
          to_level_id: levelPair.toLevel.id,
          kind: nextKind,
          footprint_json: toInputJson(nextFootprint),
          stair_json: toInputJson(geometry.stair_json),
          opening_json: toInputJson(geometry.opening_json),
        },
      })

      if (previousRoomId && previousRoomId !== nextRoomId) {
        await removeRoomCeilingOpening(tx, previousRoomId, existing.id)
      }

      if (nextRoomId) {
        await upsertRoomCeilingOpening(tx, {
          roomId: nextRoomId,
          verticalConnectionId: connection.id,
          kind: connection.kind,
          fromLevelId: connection.from_level_id,
          toLevelId: connection.to_level_id,
          openingJson: geometry.opening_json,
        })
      }

      return connection
    })

    return reply.send(updated)
  })

  app.delete<{ Params: { id: string } }>('/vertical-connections/:id', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const existing = await prisma.verticalConnection.findUnique({ where: { id: request.params.id } })
    if (!existing || existing.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Vertical connection not found')
    }

    const project = await resolveScopedProject(existing.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Vertical connection not found in tenant scope')
    }

    const roomId = extractRoomIdFromFootprint(existing.footprint_json)

    await prisma.$transaction(async (tx) => {
      await tx.verticalConnection.delete({ where: { id: existing.id } })

      if (roomId) {
        await removeRoomCeilingOpening(tx, roomId, existing.id)
      }
    })

    return reply.status(204).send()
  })
}
