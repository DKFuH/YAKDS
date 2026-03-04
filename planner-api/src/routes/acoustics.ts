import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseCnivg, valueToColor } from '../services/cnivgParser.js'

const AcousticLayerBodySchema = z.object({
  layer_type: z.enum(['source', 'receiver']),
  label: z.string().optional(),
  object_refs: z.array(
    z.object({
      room_id: z.string(),
      placement_id: z.string().optional(),
      x_mm: z.number(),
      y_mm: z.number(),
    }),
  ),
})

type AcousticVariable = 'spl_db' | 'spl_dba' | 't20_s' | 'sti'

function normalizeVariable(input: string): AcousticVariable {
  const normalized = input.toLowerCase()
  const variableMap: Record<string, AcousticVariable> = {
    spl_db: 'spl_db',
    spl: 'spl_db',
    spl_dba: 'spl_dba',
    dba: 'spl_dba',
    t20: 't20_s',
    t20_s: 't20_s',
    sti: 'sti',
  }

  return variableMap[normalized] ?? 'spl_db'
}

function readRawBody(body: unknown, rawBody: unknown): Buffer | null {
  if (Buffer.isBuffer(rawBody)) {
    return rawBody
  }

  if (typeof body === 'string') {
    return Buffer.from(body)
  }

  if (Buffer.isBuffer(body)) {
    return body
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  return null
}

export async function acousticsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    '/projects/:id/import/acoustics',
    { config: { rawBody: true } } as any,
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) {
        return sendNotFound(reply, 'Project not found')
      }

      const contentType = String(request.headers['content-type'] ?? '')
      if (!contentType.includes('text/plain') && !contentType.includes('application/octet-stream')) {
        return sendBadRequest(reply, 'Expected Content-Type: text/plain or application/octet-stream')
      }

      const raw = readRawBody(request.body, (request as { rawBody?: unknown }).rawBody)
      if (!raw || raw.length === 0) {
        return sendBadRequest(reply, 'Empty body')
      }

      const content = raw.toString('utf-8')
      const filenameHeader = request.headers['x-filename']
      const filename = typeof filenameHeader === 'string'
        ? filenameHeader
        : `acoustics-${Date.now()}.cnivg`

      let parsed
      try {
        parsed = parseCnivg(content)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return sendBadRequest(reply, `CNIVG parse error: ${message}`)
      }

      const variable = normalizeVariable(parsed.header.variable)

      const grid = await prisma.acousticGrid.create({
        data: {
          project_id: request.params.id,
          tenant_id: project.tenant_id ?? 'tenant-unknown',
          filename,
          variable,
          resolution_mm: parsed.header.resolution_mm,
          origin_x_mm: parsed.header.origin_x_mm,
          origin_y_mm: parsed.header.origin_y_mm,
          slice_height_mm: parsed.header.slice_height_mm,
          grid_cols: parsed.header.cols,
          grid_rows: parsed.header.rows,
          values: parsed.values,
          min_value: parsed.min,
          max_value: parsed.max,
        },
      })

      return reply.status(201).send({
        grid_id: grid.id,
        cols: grid.grid_cols,
        rows: grid.grid_rows,
        min: grid.min_value,
        max: grid.max_value,
      })
    },
  )

  app.get<{ Params: { id: string } }>(
    '/projects/:id/acoustic-grids',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) {
        return sendNotFound(reply, 'Project not found')
      }

      const grids = await prisma.acousticGrid.findMany({
        where: { project_id: request.params.id },
        select: {
          id: true,
          filename: true,
          variable: true,
          resolution_mm: true,
          grid_cols: true,
          grid_rows: true,
          min_value: true,
          max_value: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      })

      return reply.send(grids)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/acoustic-grids/:id/tiles',
    async (request, reply) => {
      const grid = await prisma.acousticGrid.findUnique({ where: { id: request.params.id } })
      if (!grid) {
        return sendNotFound(reply, 'Acoustic grid not found')
      }

      const values = Array.isArray(grid.values) ? (grid.values as number[][]) : []
      const features: Array<{
        type: 'Feature'
        geometry: { type: 'Polygon'; coordinates: number[][][] }
        properties: { value: number; color: string }
      }> = []

      for (let row = 0; row < grid.grid_rows; row++) {
        for (let col = 0; col < grid.grid_cols; col++) {
          const value = values[row]?.[col]
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue
          }

          const x = grid.origin_x_mm + col * grid.resolution_mm
          const y = grid.origin_y_mm + row * grid.resolution_mm
          const [red, green, blue] = valueToColor(value, grid.min_value, grid.max_value)

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [x, y],
                [x + grid.resolution_mm, y],
                [x + grid.resolution_mm, y + grid.resolution_mm],
                [x, y + grid.resolution_mm],
                [x, y],
              ]],
            },
            properties: {
              value,
              color: `rgb(${red},${green},${blue})`,
            },
          })
        }
      }

      return reply.send({
        type: 'FeatureCollection',
        variable: grid.variable,
        min: grid.min_value,
        max: grid.max_value,
        features,
      })
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/acoustic-grids/:id',
    async (request, reply) => {
      const grid = await prisma.acousticGrid.findUnique({ where: { id: request.params.id } })
      if (!grid) {
        return sendNotFound(reply, 'Acoustic grid not found')
      }

      await prisma.acousticGrid.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    },
  )

  app.post<{ Params: { id: string }; Body: z.infer<typeof AcousticLayerBodySchema> }>(
    '/projects/:id/acoustic-layers',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) {
        return sendNotFound(reply, 'Project not found')
      }

      const parsed = AcousticLayerBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return sendBadRequest(reply, parsed.error.message)
      }

      const layer = await prisma.acousticLayer.create({
        data: {
          project_id: request.params.id,
          layer_type: parsed.data.layer_type,
          label: parsed.data.label,
          object_refs: parsed.data.object_refs,
        },
      })

      return reply.status(201).send(layer)
    },
  )

  app.get<{ Params: { id: string } }>(
    '/projects/:id/acoustic-layers',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) {
        return sendNotFound(reply, 'Project not found')
      }

      const layers = await prisma.acousticLayer.findMany({ where: { project_id: request.params.id } })
      return reply.send(layers)
    },
  )
}
