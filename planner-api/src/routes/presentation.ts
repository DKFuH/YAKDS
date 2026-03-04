import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const PresentationSessionParamsSchema = z.object({
  id: z.string().uuid(),
})

const PresentationSessionBodySchema = z.object({
  entry: z.enum(['auto', 'split-view', 'panorama-tour']).default('auto'),
  panorama_tour_id: z.string().uuid().optional(),
})

type PresentationEntry =
  | { kind: 'split-view' }
  | { kind: 'panorama-tour'; panorama_tour_id: string }

function resolvePreferredEntry(args: {
  requestedEntry: 'auto' | 'split-view' | 'panorama-tour'
  requestedTourId?: string
  availableTourIds: string[]
}): PresentationEntry {
  const firstTourId = args.availableTourIds[0]

  if (args.requestedEntry === 'split-view') {
    return { kind: 'split-view' }
  }

  if (args.requestedEntry === 'panorama-tour') {
    if (args.requestedTourId && args.availableTourIds.includes(args.requestedTourId)) {
      return { kind: 'panorama-tour', panorama_tour_id: args.requestedTourId }
    }

    if (firstTourId) {
      return { kind: 'panorama-tour', panorama_tour_id: firstTourId }
    }

    return { kind: 'split-view' }
  }

  if (firstTourId) {
    return { kind: 'panorama-tour', panorama_tour_id: firstTourId }
  }

  return { kind: 'split-view' }
}

export async function presentationRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/presentation-sessions', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const parsedParams = PresentationSessionParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Ung\u00fcltige Projekt-ID')
    }

    const parsedBody = PresentationSessionBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Ung\u00fcltige Session-Daten')
    }

    const project = await prisma.project.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        name: true,
        tenant_id: true,
      },
    })

    if (!project || project.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Projekt nicht gefunden')
    }

    const [settings, tours] = await Promise.all([
      prisma.tenantSetting.findUnique({
        where: { tenant_id: tenantId },
        select: {
          company_name: true,
          company_city: true,
          company_web: true,
          logo_url: true,
        },
      }),
      prisma.panoramaTour.findMany({
        where: {
          tenant_id: tenantId,
          project_id: project.id,
        },
        select: {
          id: true,
          name: true,
          share_token: true,
          updated_at: true,
        },
        orderBy: {
          updated_at: 'desc',
        },
      }),
    ])

    const preferredEntry = resolvePreferredEntry({
      requestedEntry: parsedBody.data.entry,
      requestedTourId: parsedBody.data.panorama_tour_id,
      availableTourIds: tours.map((tour) => tour.id),
    })

    return reply.send({
      project_id: project.id,
      project_name: project.name,
      branding: {
        company_name: settings?.company_name ?? null,
        company_city: settings?.company_city ?? null,
        company_web: settings?.company_web ?? null,
        logo_url: settings?.logo_url ?? null,
      },
      presentation_mode: {
        hide_editor_panels: true,
        show_branding: true,
        loop_tour: false,
      },
      preferred_entry: preferredEntry,
      panorama_tours: tours.map((tour) => ({
        id: tour.id,
        name: tour.name,
        share_token: tour.share_token,
        share_url: tour.share_token ? `/share/panorama/${tour.share_token}` : null,
        updated_at: tour.updated_at,
      })),
    })
  })
}
