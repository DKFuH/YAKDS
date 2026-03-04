import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest } from '../errors.js'
import { getPlugins } from '../plugins/pluginRegistry.js'

const TenantSettingBodySchema = z.object({
  company_name:   z.string().max(200).optional(),
  company_street: z.string().max(200).optional(),
  company_zip:    z.string().max(20).optional(),
  company_city:   z.string().max(100).optional(),
  company_phone:  z.string().max(50).optional(),
  company_email:  z.string().email().optional(),
  company_web:    z.string().max(200).optional(),
  iban:           z.string().max(50).optional(),
  bic:            z.string().max(20).optional(),
  bank_name:      z.string().max(100).optional(),
  vat_id:         z.string().max(30).optional(),
  tax_number:     z.string().max(30).optional(),
  quote_footer:   z.string().max(2000).optional(),
  logo_url:       z.string().url().optional(),
  currency_code:  z.string().length(3).optional(),
  navigation_profile: z.enum(['cad', 'presentation', 'trackpad']).optional(),
  invert_y_axis: z.boolean().optional(),
  middle_mouse_pan: z.boolean().optional(),
  touchpad_mode: z.enum(['cad', 'trackpad']).optional(),
  zoom_direction: z.enum(['natural', 'inverted']).optional(),
})

const TenantPluginsBodySchema = z.object({
  enabled: z.array(z.string().min(1)).default([]),
})

const ProjectDefaultsBodySchema = z.object({
  default_advisor: z.string().max(200).nullable().optional(),
  default_processor: z.string().max(200).nullable().optional(),
  default_area_name: z.string().max(200).nullable().optional(),
  default_alternative_name: z.string().max(200).nullable().optional(),
})

type TenantSettingsStore = {
  findUnique: (args: unknown) => Promise<{ enabled_plugins?: unknown } | null>
  upsert: (args: unknown) => Promise<{ enabled_plugins?: unknown }>
}

function getTenantSettingsStore(): TenantSettingsStore {
  return (prisma as unknown as { tenantSetting: TenantSettingsStore }).tenantSetting
}

function normalizeEnabledPlugins(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function normalizeOptionalName(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function tenantSettingsRoutes(app: FastifyInstance) {
  app.get('/tenant/settings', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const settings = await prisma.tenantSetting.findUnique({
      where: { tenant_id: tenantId },
    })

    return reply.send(settings ?? {})
  })

  app.put('/tenant/settings', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const parsed = TenantSettingBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const data = parsed.data

    const settings = await prisma.tenantSetting.upsert({
      where: { tenant_id: tenantId },
      update: data,
      create: { tenant_id: tenantId, ...data },
    })

    return reply.send(settings)
  })

  app.get('/tenant/plugins', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const available = getPlugins().map((plugin) => ({ id: plugin.id, name: plugin.name }))
    const availableIds = new Set(available.map((plugin) => plugin.id))

    const store = getTenantSettingsStore()
    const settings = await store.findUnique({ where: { tenant_id: tenantId } })
    const configured = normalizeEnabledPlugins(settings?.enabled_plugins)
    const enabled = (configured.length > 0 ? configured : available.map((plugin) => plugin.id))
      .filter((id) => availableIds.has(id))

    return reply.send({ available, enabled })
  })

  app.put('/tenant/plugins', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const parsed = TenantPluginsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const availableIds = new Set(getPlugins().map((plugin) => plugin.id))
    const normalized = [...new Set(parsed.data.enabled)].filter((id) => availableIds.has(id))

    const store = getTenantSettingsStore()
    const updated = await store.upsert({
      where: { tenant_id: tenantId },
      update: { enabled_plugins: normalized },
      create: { tenant_id: tenantId, enabled_plugins: normalized },
    })

    return reply.send({ enabled: normalizeEnabledPlugins(updated.enabled_plugins) })
  })

  app.get('/tenant/project-defaults', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const settings = await prisma.tenantSetting.findUnique({
      where: { tenant_id: tenantId },
      select: {
        default_advisor: true,
        default_processor: true,
        default_area_name: true,
        default_alternative_name: true,
      },
    })

    return reply.send({
      default_advisor: settings?.default_advisor ?? null,
      default_processor: settings?.default_processor ?? null,
      default_area_name: settings?.default_area_name ?? null,
      default_alternative_name: settings?.default_alternative_name ?? null,
    })
  })

  app.put('/tenant/project-defaults', async (request, reply) => {
    const tenantId = (request as { tenantId?: string }).tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const parsed = ProjectDefaultsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const updated = await prisma.tenantSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        default_advisor: normalizeOptionalName(parsed.data.default_advisor),
        default_processor: normalizeOptionalName(parsed.data.default_processor),
        default_area_name: normalizeOptionalName(parsed.data.default_area_name),
        default_alternative_name: normalizeOptionalName(parsed.data.default_alternative_name),
      },
      create: {
        tenant_id: tenantId,
        default_advisor: normalizeOptionalName(parsed.data.default_advisor),
        default_processor: normalizeOptionalName(parsed.data.default_processor),
        default_area_name: normalizeOptionalName(parsed.data.default_area_name),
        default_alternative_name: normalizeOptionalName(parsed.data.default_alternative_name),
      },
      select: {
        default_advisor: true,
        default_processor: true,
        default_area_name: true,
        default_alternative_name: true,
      },
    })

    return reply.send(updated)
  })
}
