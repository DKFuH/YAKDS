import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest } from '../errors.js'

/** Locales known to the system. planned:true entries are future-only and not selectable in the UI. */
const KNOWN_LOCALES = [
  { code: 'de', label: 'Deutsch', planned: false },
  { code: 'en', label: 'English', planned: false },
  { code: 'fr', label: 'Français', planned: true },
  { code: 'nl', label: 'Nederlands', planned: true },
]

const ACTIVE_CODES = KNOWN_LOCALES.filter((l) => !l.planned).map((l) => l.code)

const LocaleSettingsBodySchema = z.object({
  preferred_locale: z.string().refine((v) => ACTIVE_CODES.includes(v), {
    message: `preferred_locale must be one of: ${ACTIVE_CODES.join(', ')}`,
  }).optional(),
  fallback_locale: z.string().refine((v) => ACTIVE_CODES.includes(v), {
    message: `fallback_locale must be one of: ${ACTIVE_CODES.join(', ')}`,
  }).optional(),
})

export async function localesRoutes(app: FastifyInstance) {
  /** List all known locales (planned ones included for informational purposes). */
  app.get('/locales', async (_request, reply) => {
    return reply.send(KNOWN_LOCALES)
  })

  /** Get tenant locale preferences. Scoped to the authenticated tenant. */
  app.get('/tenant/locale-settings', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const settings = await prisma.tenantSetting.findUnique({
      where: { tenant_id: tenantId },
      select: { preferred_locale: true, fallback_locale: true },
    })

    return reply.send({
      preferred_locale: settings?.preferred_locale ?? null,
      fallback_locale: settings?.fallback_locale ?? null,
    })
  })

  /** Update tenant locale preferences. Only allows active (non-planned) locales. */
  app.put('/tenant/locale-settings', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const parsed = LocaleSettingsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const { preferred_locale, fallback_locale } = parsed.data

    const updated = await prisma.tenantSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        ...(preferred_locale !== undefined && { preferred_locale }),
        ...(fallback_locale !== undefined && { fallback_locale }),
      },
      create: {
        tenant_id: tenantId,
        ...(preferred_locale !== undefined && { preferred_locale }),
        ...(fallback_locale !== undefined && { fallback_locale }),
      },
      select: { preferred_locale: true, fallback_locale: true },
    })

    return reply.send(updated)
  })
}
