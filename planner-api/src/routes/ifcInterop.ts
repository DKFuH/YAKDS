import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { buildIfcBuffer, parseIfcRooms } from '../services/ifcEngine.js'

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

const IfcExportBodySchema = z.object({
  level_id: z.string().uuid().optional(),
  section_line_id: z.string().uuid().optional(),
})

type ExportBoundary = {
  wall_segments?: Array<{
    id?: string
    kind?: 'line' | 'arc'
    x0_mm?: number
    y0_mm?: number
    x1_mm?: number
    y1_mm?: number
    start?: { x_mm: number; y_mm: number }
    end?: { x_mm: number; y_mm: number }
    center?: { x_mm: number; y_mm: number }
    radius_mm?: number
    clockwise?: boolean
    thickness_mm?: number
  }>
}

type ExportPlacement = {
  id: string
  width_mm?: number
  depth_mm?: number
  article_id?: string
  offset_mm?: number
}

type SectionLineExport = {
  id: string
  label?: string
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
  direction?: string
  depth_mm?: number
  level_scope?: string
  level_id?: string
  sheet_visibility?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function parsePoint(value: unknown): { x_mm: number; y_mm: number } | null {
  const point = asRecord(value)
  if (!point) return null
  if (typeof point.x_mm !== 'number' || !Number.isFinite(point.x_mm)) return null
  if (typeof point.y_mm !== 'number' || !Number.isFinite(point.y_mm)) return null
  return { x_mm: point.x_mm, y_mm: point.y_mm }
}

function parseSectionLine(value: unknown): SectionLineExport | null {
  const record = asRecord(value)
  if (!record) return null
  if (typeof record.id !== 'string' || record.id.trim().length === 0) return null

  const start = parsePoint(record.start)
  const end = parsePoint(record.end)
  if (!start || !end) return null

  return {
    id: record.id,
    ...(typeof record.label === 'string' ? { label: record.label } : {}),
    start,
    end,
    ...(typeof record.direction === 'string' ? { direction: record.direction } : {}),
    ...(typeof record.depth_mm === 'number' && Number.isFinite(record.depth_mm) ? { depth_mm: record.depth_mm } : {}),
    ...(typeof record.level_scope === 'string' ? { level_scope: record.level_scope } : {}),
    ...(typeof record.level_id === 'string' ? { level_id: record.level_id } : {}),
    ...(typeof record.sheet_visibility === 'string' ? { sheet_visibility: record.sheet_visibility } : {}),
  }
}

function parseSectionLines(value: unknown): SectionLineExport[] {
  if (!Array.isArray(value)) return []
  const parsed: SectionLineExport[] = []
  for (const entry of value) {
    const line = parseSectionLine(entry)
    if (line) parsed.push(line)
  }
  return parsed
}

function ensureBuffer(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) {
    return raw
  }

  if (raw instanceof Uint8Array) {
    return Buffer.from(raw)
  }

  return null
}

export async function ifcInteropRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, payload, done) => {
    done(null, payload)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/import/ifc', async (request, reply) => {
    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await prisma.project.findUnique({ where: { id: parsedParams.data.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const contentType = request.headers['content-type'] ?? ''
    if (!contentType.includes('application/octet-stream')) {
      return sendBadRequest(reply, 'Expected Content-Type: application/octet-stream with IFC file body')
    }

    const buffer = ensureBuffer(request.body)
    if (!buffer || buffer.length < 4) {
      return sendBadRequest(reply, 'Empty or invalid IFC file')
    }

    const header = buffer.subarray(0, 20).toString('ascii')
    if (!header.includes('ISO-10303')) {
      return sendBadRequest(reply, 'Not a valid IFC (STEP) file')
    }

    const job = await prisma.ifcImportJob.create({
      data: {
        project_id: parsedParams.data.id,
        filename: `import-${Date.now()}.ifc`,
        status: 'processing',
      },
    })

    let roomsCreated = 0
    const warnings: string[] = []

    try {
      const ifcRooms = await parseIfcRooms(buffer)

      for (const ifcRoom of ifcRooms) {
        if (ifcRoom.wall_segments.length === 0) {
          warnings.push(`Raum "${ifcRoom.name}" hat keine Wandsegmente – übersprungen`)
          continue
        }

        await prisma.room.create({
          data: {
            project_id: parsedParams.data.id,
            name: ifcRoom.name,
            ceiling_height_mm: ifcRoom.ceiling_height_mm,
            boundary: ({ wall_segments: ifcRoom.wall_segments } as unknown as Prisma.InputJsonValue),
            placements: [] as unknown as Prisma.InputJsonValue,
          },
        })
        roomsCreated += 1
      }

      await prisma.ifcImportJob.update({
        where: { id: job.id },
        data: {
          status: 'done',
          result: {
            rooms_created: roomsCreated,
            warnings,
          },
        },
      })
    } catch (error) {
      await prisma.ifcImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: String(error),
        },
      })

      return sendBadRequest(reply, `IFC parsing failed: ${String(error)}`)
    }

    return reply.status(201).send({ job_id: job.id, rooms_created: roomsCreated, warnings })
  })

  app.post<{ Params: { id: string }; Body: z.infer<typeof IfcExportBodySchema> }>('/alternatives/:id/export/ifc', async (request, reply) => {
    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
    }

    const parsedBody = IfcExportBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const alternative = await prisma.alternative.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        area: {
          include: {
            project: true,
          },
        },
      },
    })

    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const project = alternative.area.project
    const level = parsedBody.data.level_id
      ? await prisma.buildingLevel.findFirst({
          where: {
            id: parsedBody.data.level_id,
            project_id: project.id,
          },
          select: { id: true, name: true },
        })
      : null

    if (parsedBody.data.level_id && !level) {
      return sendBadRequest(reply, 'level_id must reference a level in project scope')
    }

    const rooms = await prisma.room.findMany({
      where: {
        project_id: project.id,
        ...(parsedBody.data.level_id ? { level_id: parsedBody.data.level_id } : {}),
      },
      orderBy: { created_at: 'asc' },
    })

    const sectionLines = rooms.flatMap((room) => parseSectionLines(room.section_lines))
    const sectionLine = parsedBody.data.section_line_id
      ? sectionLines.find((line) => line.id === parsedBody.data.section_line_id) ?? null
      : sectionLines[0] ?? null

    if (parsedBody.data.section_line_id && !sectionLine) {
      return sendBadRequest(reply, 'section_line_id must reference a section line in project scope')
    }

    const exportRooms = rooms.map((room) => {
      const boundary = (room.boundary as ExportBoundary | null) ?? null
      const placements = (room.placements as ExportPlacement[] | null) ?? []

      return {
        id: room.id,
        name: room.name,
        boundary,
        placements: placements.map((placement) => ({
          id: placement.id,
          width_mm: placement.width_mm ?? 600,
          depth_mm: placement.depth_mm ?? 600,
          height_mm: 720,
          article_name: placement.article_id ?? 'Artikel',
          offset_mm: placement.offset_mm ?? 0,
        })),
      }
    })

    const buffer = await buildIfcBuffer({
      projectName: project.name,
      rooms: exportRooms as any,
      metadata: {
        level_id: level?.id ?? sectionLine?.level_id ?? null,
        level_name: level?.name ?? null,
        section_line: sectionLine
          ? {
              id: sectionLine.id,
              label: sectionLine.label ?? null,
              direction: sectionLine.direction ?? null,
              depth_mm: sectionLine.depth_mm ?? null,
              level_scope: sectionLine.level_scope ?? null,
              level_id: sectionLine.level_id ?? null,
              sheet_visibility: sectionLine.sheet_visibility ?? null,
              start: sectionLine.start,
              end: sectionLine.end,
            }
          : null,
      },
    })

    reply.header('Content-Type', 'application/x-step')
    reply.header('Content-Disposition', `attachment; filename="alternative-${parsedParams.data.id}.ifc"`)
    return reply.send(buffer)
  })

  app.get<{ Params: { id: string } }>('/projects/:id/ifc-jobs', async (request, reply) => {
    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await prisma.project.findUnique({ where: { id: parsedParams.data.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const jobs = await prisma.ifcImportJob.findMany({
      where: { project_id: parsedParams.data.id },
      orderBy: { created_at: 'desc' },
    })

    return reply.send(jobs)
  })
}
