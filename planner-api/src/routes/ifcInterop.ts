import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { buildIfcBuffer, parseIfcRooms } from '../services/ifcEngine.js'

const ParamsSchema = z.object({
  id: z.string().uuid(),
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
            boundary: { wall_segments: ifcRoom.wall_segments },
            placements: [],
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

  app.post<{ Params: { id: string } }>('/alternatives/:id/export/ifc', async (request, reply) => {
    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
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
    const rooms = await prisma.room.findMany({ where: { project_id: project.id } })

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
      rooms: exportRooms,
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
