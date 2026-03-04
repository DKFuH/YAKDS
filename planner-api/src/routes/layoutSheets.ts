import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const SheetBodySchema = z.object({
  name: z.string().min(1).max(100),
  sheet_type: z.enum(['floorplan', 'elevations', 'installation', 'detail', 'section']).default('floorplan'),
  position: z.number().int().default(0),
  config: z.record(z.unknown()).default({}),
})

const ViewBodySchema = z.object({
  view_type: z.enum(['floorplan', 'elevation', 'section', 'detail', 'isometric']),
  label: z.string().optional(),
  room_id: z.string().optional(),
  wall_id: z.string().optional(),
  clip_x_mm: z.number().optional(),
  clip_y_mm: z.number().optional(),
  clip_w_mm: z.number().optional(),
  clip_h_mm: z.number().optional(),
  scale: z.number().positive().default(1.0),
  x_on_sheet: z.number().default(0),
  y_on_sheet: z.number().default(0),
})

const SheetConfigBodySchema = z.object({
  style_preset_id: z.string().uuid().nullable().optional(),
  sheet_scale: z.enum(['1:10', '1:20', '1:25', '1:50']).optional(),
  annotative_mode: z.boolean().optional(),
  show_arc_annotations: z.boolean().optional(),
  arc_dimension_style: z.enum(['radius-first', 'length-first']).optional(),
})

export async function layoutSheetRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/layout-sheets', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const sheets = await prisma.layoutSheet.findMany({
      where: { project_id: request.params.id },
      include: { views: true },
      orderBy: { position: 'asc' },
    })
    return reply.send(sheets)
  })

  app.post<{ Params: { id: string }; Body: z.infer<typeof SheetBodySchema> }>(
    '/projects/:id/layout-sheets',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const parsed = SheetBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

      const sheet = await prisma.layoutSheet.create({
        data: {
          project_id: request.params.id,
          ...parsed.data,
          config: parsed.data.config as unknown as Prisma.InputJsonValue,
        },
      })
      return reply.status(201).send(sheet)
    },
  )

  app.delete<{ Params: { id: string } }>('/layout-sheets/:id', async (request, reply) => {
    const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
    if (!sheet) return sendNotFound(reply, 'Layout sheet not found')

    await prisma.layoutSheet.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.put<{ Params: { id: string }; Body: z.infer<typeof SheetConfigBodySchema> }>(
    '/layout-sheets/:id/config',
    async (request, reply) => {
      const parsed = SheetConfigBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

      const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
      if (!sheet) return sendNotFound(reply, 'Layout sheet not found')

      const current = (sheet.config as Record<string, unknown> | null) ?? {}
      const merged: Record<string, unknown> = {
        ...current,
        ...(parsed.data.style_preset_id !== undefined ? { style_preset_id: parsed.data.style_preset_id } : {}),
        ...(parsed.data.sheet_scale !== undefined ? { sheet_scale: parsed.data.sheet_scale } : {}),
        ...(parsed.data.annotative_mode !== undefined ? { annotative_mode: parsed.data.annotative_mode } : {}),
        ...(parsed.data.show_arc_annotations !== undefined ? { show_arc_annotations: parsed.data.show_arc_annotations } : {}),
        ...(parsed.data.arc_dimension_style !== undefined ? { arc_dimension_style: parsed.data.arc_dimension_style } : {}),
      }

      const updated = await prisma.layoutSheet.update({
        where: { id: request.params.id },
        data: { config: merged as Prisma.InputJsonValue },
      })

      return reply.send(updated)
    },
  )

  app.post<{ Params: { id: string }; Body: z.infer<typeof ViewBodySchema> }>(
    '/layout-sheets/:id/views',
    async (request, reply) => {
      const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
      if (!sheet) return sendNotFound(reply, 'Layout sheet not found')

      const parsed = ViewBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

      const view = await prisma.layoutView.create({
        data: { sheet_id: request.params.id, ...parsed.data },
      })
      return reply.status(201).send(view)
    },
  )

  app.delete<{ Params: { id: string } }>('/layout-views/:id', async (request, reply) => {
    const view = await prisma.layoutView.findUnique({ where: { id: request.params.id } })
    if (!view) return sendNotFound(reply, 'Layout view not found')

    await prisma.layoutView.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.get<{ Params: { id: string } }>('/layout-sheets/:id/render-svg', async (request, reply) => {
    const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
    if (!sheet) return sendNotFound(reply, 'Layout sheet not found')

    const config = ((sheet.config as Record<string, unknown> | null) ?? {})
    const showArc = Boolean(config.show_arc_annotations)
    const arcStyle = String(config.arc_dimension_style ?? 'radius-first')
    const arcLabel = arcStyle === 'length-first' ? 'L=1571 mm' : 'R=1000 mm'

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect x="0" y="0" width="800" height="600" fill="#ffffff" />
  <text x="40" y="40" font-size="20" font-family="Arial">${sheet.name}</text>
  <path d="M 200 300 A 120 120 0 0 1 440 300" stroke="#1f2937" fill="none" stroke-width="2" />
  ${showArc ? `<text x="300" y="250" font-size="14" font-family="Arial">${arcLabel}</text>` : ''}
</svg>`

    reply.type('image/svg+xml')
    return reply.send(svg)
  })

  app.post<{ Params: { id: string } }>(
    '/projects/:id/layout-sheets/scaffold',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const defaults = [
        { name: 'Grundriss', sheet_type: 'floorplan' as const, position: 0 },
        { name: 'Ansichten', sheet_type: 'elevations' as const, position: 1 },
        { name: 'Installationsplan', sheet_type: 'installation' as const, position: 2 },
      ]

      const created = await Promise.all(
        defaults.map((entry) =>
          prisma.layoutSheet.create({
            data: { project_id: request.params.id, ...entry, config: {} },
          }),
        ),
      )

      return reply.status(201).send(created)
    },
  )
}
