import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { generateCutlist, type CutlistPart, type CutlistSummary } from '../services/cutlistService.js'
import { buildCutlistPdf } from '../services/pdfGenerator.js'

type CutlistRecord = {
  id: string
  project_id: string
  room_id: string | null
  generated_at: Date
  parts: unknown
  summary: unknown
}

type ProjectRecord = {
  id: string
  name: string
}

type RoomRecord = {
  id: string
  name: string
}

type CutlistStore = {
  create: (args: unknown) => Promise<CutlistRecord>
  findMany: (args: unknown) => Promise<CutlistRecord[]>
  findUnique: (args: unknown) => Promise<CutlistRecord | null>
  delete: (args: unknown) => Promise<unknown>
}

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const CutlistParamsSchema = z.object({
  id: z.string().uuid(),
})

const GenerateBodySchema = z.object({
  room_id: z.string().uuid().optional(),
})

const CutlistQuerySchema = z.object({
  room_id: z.string().uuid().optional(),
})

function getCutlistStore() {
  return (prisma as unknown as Record<string, CutlistStore>).cutlist
}

function parseParts(value: unknown): CutlistPart[] {
  if (!Array.isArray(value)) return []
  return value as CutlistPart[]
}

function parseSummary(value: unknown): CutlistSummary {
  if (!value || typeof value !== 'object') {
    return { total_parts: 0, by_material: {} }
  }

  const candidate = value as CutlistSummary
  if (!candidate.by_material || typeof candidate.by_material !== 'object') {
    return { total_parts: candidate.total_parts ?? 0, by_material: {} }
  }

  return {
    total_parts: typeof candidate.total_parts === 'number' ? candidate.total_parts : 0,
    by_material: candidate.by_material,
  }
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function grainLabel(value: CutlistPart['grain_direction']): string {
  if (value === 'length') return 'laengs'
  if (value === 'width') return 'quer'
  return 'kein'
}

function toCutlistCsv(parts: CutlistPart[]): string {
  const rows: Array<Array<string | number>> = [
    ['Teile-Nr', 'Bezeichnung', 'Breite (mm)', 'Hoehe (mm)', 'Anzahl', 'Material', 'Korn', 'Artikel'],
  ]

  parts.forEach((part, index) => {
    rows.push([
      index + 1,
      part.label,
      part.width_mm,
      part.height_mm,
      part.quantity,
      part.material_code,
      grainLabel(part.grain_direction),
      part.article_name,
    ])
  })

  return `${rows.map((row) => row.map((entry) => csvCell(entry)).join(',')).join('\n')}\n`
}

export async function cutlistRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/cutlist/generate', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = GenerateBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, name: true },
    }) as ProjectRecord | null

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const result = await generateCutlist(prisma as any, project.id, parsedBody.data.room_id)

    const store = getCutlistStore()
    const cutlist = await store.create({
      data: {
        project_id: project.id,
        room_id: parsedBody.data.room_id ?? null,
        parts: result.parts as unknown as Prisma.InputJsonValue,
        summary: result.summary as unknown as Prisma.InputJsonValue,
      },
    })

    return reply.status(201).send(cutlist)
  })

  app.get<{ Params: { id: string } }>('/projects/:id/cutlists', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedQuery = CutlistQuerySchema.safeParse(request.query ?? {})
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true },
    })

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const store = getCutlistStore()
    const cutlists = await store.findMany({
      where: {
        project_id: parsedParams.data.id,
        ...(parsedQuery.data.room_id ? { room_id: parsedQuery.data.room_id } : {}),
      },
      orderBy: { generated_at: 'desc' },
    })

    return reply.send(cutlists)
  })

  app.get<{ Params: { id: string } }>('/cutlists/:id', async (request, reply) => {
    const parsedParams = CutlistParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getCutlistStore()
    const cutlist = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!cutlist) {
      return sendNotFound(reply, 'Cutlist not found')
    }

    return reply.send(cutlist)
  })

  app.get<{ Params: { id: string } }>('/cutlists/:id/export.csv', async (request, reply) => {
    const parsedParams = CutlistParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getCutlistStore()
    const cutlist = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!cutlist) {
      return sendNotFound(reply, 'Cutlist not found')
    }

    const parts = parseParts(cutlist.parts)
    const filename = `cutlist-${cutlist.id}.csv`

    reply.header('content-disposition', `attachment; filename="${filename}"`)
    reply.type('text/csv; charset=utf-8')
    return reply.send(toCutlistCsv(parts))
  })

  app.get<{ Params: { id: string } }>('/cutlists/:id/export.pdf', async (request, reply) => {
    const parsedParams = CutlistParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getCutlistStore()
    const cutlist = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!cutlist) {
      return sendNotFound(reply, 'Cutlist not found')
    }

    const project = await prisma.project.findUnique({
      where: { id: cutlist.project_id },
      select: { id: true, name: true },
    }) as ProjectRecord | null

    const room = cutlist.room_id
      ? await prisma.room.findUnique({
        where: { id: cutlist.room_id },
        select: { id: true, name: true },
      }) as RoomRecord | null
      : null

    const parts = parseParts(cutlist.parts)
    const summary = parseSummary(cutlist.summary)

    const pdf = buildCutlistPdf({
      project_name: project?.name ?? cutlist.project_id,
      room_name: room?.name ?? undefined,
      generated_at: cutlist.generated_at,
      parts,
      summary,
    })

    const filename = `cutlist-${cutlist.id}.pdf`
    reply.header('content-disposition', `attachment; filename="${filename}"`)
    reply.type('application/pdf')
    return reply.send(pdf)
  })

  app.delete<{ Params: { id: string } }>('/cutlists/:id', async (request, reply) => {
    const parsedParams = CutlistParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getCutlistStore()
    const cutlist = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!cutlist) {
      return sendNotFound(reply, 'Cutlist not found')
    }

    await store.delete({ where: { id: parsedParams.data.id } })
    return reply.status(204).send()
  })
}

