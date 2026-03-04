import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'
import { isTenantPluginEnabled } from '../plugins/tenantPluginAccess.js'
import { mapEgi } from '../services/surveyImport/egiMapper.js'
import { parseEgiContent } from '../services/surveyImport/egiParser.js'

const SurveyImportPluginId = 'survey-import'

const EgiBodySchema = z.object({
  source_filename: z.string().min(1).max(255).optional(),
  content: z.string().min(1),
})

const RoomParamsSchema = z.object({
  id: z.string().uuid(),
})

function toWarningMessages(entries: Array<{ section: string; message: string }>): string[] {
  return entries.map((entry) => `${entry.section}: ${entry.message}`)
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
}

async function ensurePluginEnabled(tenantId: string): Promise<boolean> {
  return isTenantPluginEnabled(tenantId, SurveyImportPluginId)
}

export async function surveyImportRoutes(app: FastifyInstance) {
  app.post('/survey-import/formats/egi/parse', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const pluginEnabled = await ensurePluginEnabled(tenantId)
    if (!pluginEnabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin survey-import is disabled for this tenant',
      })
    }

    const parsedBody = EgiBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const parsed = parseEgiContent(parsedBody.data.content)
    const mapped = mapEgi(parsed)

    if (!mapped.usable) {
      return sendBadRequest(reply, 'EGI-Datei ist strukturell unbrauchbar (keine importierbaren Sektionen).')
    }

    return reply.send({
      format: mapped.format,
      summary: mapped.summary,
      warnings: toWarningMessages(mapped.warnings),
      preview: mapped.preview,
    })
  })

  app.post<{ Params: { id: string } }>('/rooms/:id/survey-import/egi', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const pluginEnabled = await ensurePluginEnabled(tenantId)
    if (!pluginEnabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin survey-import is disabled for this tenant',
      })
    }

    const parsedParams = RoomParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid room id')
    }

    const parsedBody = EgiBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const room = await prisma.room.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        project_id: true,
        boundary: true,
        measure_lines: true,
        openings: true,
        ceiling_constraints: true,
        placements: true,
      },
    })

    if (!room) {
      return sendNotFound(reply, 'Room not found')
    }

    const project = await prisma.project.findUnique({
      where: { id: room.project_id },
      select: { id: true, tenant_id: true },
    })

    if (!project || project.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Room not found in tenant scope')
    }

    const parsed = parseEgiContent(parsedBody.data.content)
    const mapped = mapEgi(parsed)
    if (!mapped.usable) {
      return sendBadRequest(reply, 'EGI-Datei ist strukturell unbrauchbar (keine importierbaren Sektionen).')
    }

    const boundaryVertices = mapped.mapped.boundary_vertices.map((vertex, index) => ({
      id: randomUUID(),
      x_mm: vertex.x_mm,
      y_mm: vertex.y_mm,
      index,
    }))

    const boundaryWallSegments = boundaryVertices.map((vertex, index) => ({
      id: randomUUID(),
      index,
      start_vertex_id: vertex.id,
      end_vertex_id: boundaryVertices[(index + 1) % boundaryVertices.length]?.id,
    }))

    const mappedOpenings = mapped.mapped.openings.map((opening) => ({
      id: opening.id,
      type: opening.kind,
      wall_index: opening.wall_index,
      wall_ref_no: opening.wall_ref_no,
      width_mm: opening.width_mm,
      height_mm: opening.height_mm,
      offset_mm: opening.offset_mm,
      hinge: opening.hinge,
      opening: opening.opening,
      source: 'egi',
      source_section: opening.section,
    }))

    const mappedCeilingConstraints = mapped.mapped.roofs.map((roof) => ({
      id: roof.id,
      type: roof.kind,
      wall_index: roof.wall_index,
      angle_deg: roof.angle_deg,
      depth_mm: roof.depth_mm,
      height_mm: roof.height_mm,
      source: 'egi',
      source_section: roof.section,
    }))

    const mappedPlacements = [
      ...mapped.mapped.obstacles.map((obstacle) => ({
        id: obstacle.id,
        type: 'obstacle',
        obstacle_kind: obstacle.kind,
        obstacle_type: obstacle.obstacle_type,
        wall_index: obstacle.wall_index,
        x_mm: obstacle.x_mm,
        y_mm: obstacle.y_mm,
        z_mm: obstacle.z_mm,
        width_mm: obstacle.width_mm,
        height_mm: obstacle.height_mm,
        depth_mm: obstacle.depth_mm,
        source: 'egi',
        source_section: obstacle.section,
      })),
      ...mapped.mapped.installations.map((installation) => ({
        id: installation.id,
        type: 'installation',
        installation_type: installation.type,
        category: installation.category,
        wall_index: installation.wall_index,
        x_mm: installation.x_mm,
        y_mm: installation.y_mm,
        z_mm: installation.z_mm,
        source: 'egi',
        source_section: installation.section,
      })),
    ]

    const nextBoundary: Prisma.JsonObject = boundaryVertices.length >= 3
      ? {
          vertices: boundaryVertices,
          wall_segments: boundaryWallSegments,
        }
      : ((room.boundary as Prisma.JsonObject | null) ?? { vertices: [], wall_segments: [] })

    const nextOpenings = [...asObjectArray(room.openings), ...mappedOpenings]
    const nextCeilingConstraints = [...asObjectArray(room.ceiling_constraints), ...mappedCeilingConstraints]
    const nextPlacements = [...asObjectArray(room.placements), ...mappedPlacements]
    const nextMeasureLines = [...asObjectArray(room.measure_lines), ...mapped.mapped.measure_lines]

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        ceiling_height_mm: Math.max(1, Math.round(mapped.preview.room_height_mm)),
        boundary: nextBoundary,
        openings: nextOpenings,
        ceiling_constraints: nextCeilingConstraints,
        placements: nextPlacements,
        measure_lines: nextMeasureLines,
      } as never,
    })

    const protocol = (
      mapped.warnings.length > 0
        ? mapped.warnings.map((warning) => ({
            entity_id: null,
            status: 'needs_review',
            reason: `${warning.section}: ${warning.message}`,
          }))
        : [{ entity_id: null, status: 'imported', reason: 'EGI import completed without warnings.' }]
    )

    const importJob = await prisma.importJob.create({
      data: {
        project_id: room.project_id,
        status: 'done',
        source_format: 'egi',
        source_filename: parsedBody.data.source_filename ?? `room-${room.id}.egi`,
        file_size_bytes: Buffer.byteLength(parsedBody.data.content, 'utf8'),
        import_asset: {
          format: mapped.format,
          summary: mapped.summary,
          preview: mapped.preview,
        },
        protocol,
        completed_at: new Date(),
      } as never,
      select: { id: true },
    })

    return reply.status(201).send({
      format: mapped.format,
      summary: mapped.summary,
      warnings: toWarningMessages(mapped.warnings),
      preview: mapped.preview,
      room_id: updatedRoom.id,
      job_id: importJob.id,
      imported: {
        walls: mapped.mapped.walls.length,
        openings: mappedOpenings.length,
        roofs: mappedCeilingConstraints.length,
        placements: mappedPlacements.length,
        measure_lines: mapped.mapped.measure_lines.length,
      },
    })
  })
}
