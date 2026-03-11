import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'
import {
  mergeCoreMessages,
  resolveLanguagePackOverrides,
  type LanguagePackLike,
  type MessageTree,
} from '../services/languagePackResolver.js'

const LanguagePackCreateBodySchema = z.object({
  locale_code: z.string().min(2).max(10),
  name: z.string().min(1).max(120),
  scope: z.enum(['system', 'tenant']).default('tenant'),
  messages_json: z.record(z.unknown()),
  enabled: z.boolean().optional(),
})

const LanguagePackPatchBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  messages_json: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

const LanguagePackQuerySchema = z.object({
  locale_code: z.string().min(2).max(10).optional(),
  enabled: z.coerce.boolean().optional(),
  resolved: z.coerce.boolean().optional(),
})

const CoreMessagesByLocale: Record<string, MessageTree> = {
  de: {
    common: { save: 'Speichern', cancel: 'Abbrechen', back: 'Zurück' },
    settings: { title: 'Einstellungen' },
  },
  en: {
    common: { save: 'Save', cancel: 'Cancel', back: 'Back' },
    settings: { title: 'Settings' },
  },
}

type LanguagePackStore = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  create: (args: unknown) => Promise<Record<string, unknown>>
  update: (args: unknown) => Promise<Record<string, unknown>>
  delete: (args: unknown) => Promise<Record<string, unknown>>
}

function getStore(): LanguagePackStore | null {
  const candidate = (prisma as unknown as { languagePack?: LanguagePackStore }).languagePack
  return candidate ?? null
}

function normalizeLocaleCode(code: string): string {
  return code.trim().toLowerCase()
}

function toPack(value: Record<string, unknown>): LanguagePackLike & Record<string, unknown> {
  return {
    id: String(value.id),
    tenant_id: value.tenant_id == null ? null : String(value.tenant_id),
    locale_code: normalizeLocaleCode(String(value.locale_code)),
    name: String(value.name),
    scope: String(value.scope),
    messages_json: value.messages_json,
    enabled: Boolean(value.enabled),
    created_at: value.created_at,
    updated_at: value.updated_at,
  }
}

function isPackOwnedByTenant(pack: Record<string, unknown>, tenantId: string | null): boolean {
  if (!tenantId) return false
  const scope = String(pack.scope)
  const packTenantId = pack.tenant_id == null ? null : String(pack.tenant_id)
  return scope === 'tenant' && packTenantId === tenantId
}

export async function languagePackRoutes(app: FastifyInstance) {
  app.get('/language-packs', async (request, reply) => {
    const tenantId = request.tenantId
    const parsed = LanguagePackQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid query')
    }

    const where: Record<string, unknown> = {
      ...(parsed.data.locale_code && { locale_code: normalizeLocaleCode(parsed.data.locale_code) }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      ...(tenantId
        ? {
          OR: [
            { scope: 'system' },
            { scope: 'tenant', tenant_id: tenantId },
          ],
        }
        : {
          scope: 'system',
        }),
    }

    const store = getStore()
    if (!store) {
      if (parsed.data.resolved && parsed.data.locale_code) {
        const localeCode = normalizeLocaleCode(parsed.data.locale_code)
        const coreMessages = CoreMessagesByLocale[localeCode] ?? {}
        return reply.send({
          items: [],
          locale_code: localeCode,
          resolved_messages: coreMessages,
        })
      }

      return reply.send([])
    }

    const raw = await store.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    })

    const items = raw.map(toPack)

    if (parsed.data.resolved && parsed.data.locale_code) {
      const localeCode = normalizeLocaleCode(parsed.data.locale_code)
      const coreMessages = CoreMessagesByLocale[localeCode] ?? {}
      const overrides = resolveLanguagePackOverrides({
        localeCode,
        tenantId,
        packs: items,
      })
      const resolvedMessages = mergeCoreMessages(coreMessages, overrides)

      return reply.send({
        items,
        locale_code: localeCode,
        resolved_messages: resolvedMessages,
      })
    }

    return reply.send(items)
  })

  app.post('/language-packs', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsed = LanguagePackCreateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    if (parsed.data.scope === 'system') {
      return sendForbidden(reply, 'System language packs are read-only in tenant context')
    }

    const store = getStore()
    if (!store) {
      return sendNotFound(reply, 'Language packs are not available in this database schema')
    }
    const created = await store.create({
      data: {
        tenant_id: tenantId,
        locale_code: normalizeLocaleCode(parsed.data.locale_code),
        name: parsed.data.name,
        scope: 'tenant',
        messages_json: parsed.data.messages_json as Prisma.InputJsonValue,
        enabled: parsed.data.enabled ?? true,
      },
    })

    return reply.status(201).send(toPack(created))
  })

  app.patch<{ Params: { id: string } }>('/language-packs/:id', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsed = LanguagePackPatchBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const store = getStore()
    if (!store) {
      return sendNotFound(reply, 'Language packs are not available in this database schema')
    }
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || !isPackOwnedByTenant(existing, tenantId)) {
      return sendNotFound(reply, 'Language pack not found')
    }

    const updated = await store.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
        ...(parsed.data.messages_json !== undefined && { messages_json: parsed.data.messages_json as Prisma.InputJsonValue }),
      },
    })

    return reply.send(toPack(updated))
  })

  app.delete<{ Params: { id: string } }>('/language-packs/:id', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const store = getStore()
    if (!store) {
      return sendNotFound(reply, 'Language packs are not available in this database schema')
    }
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || !isPackOwnedByTenant(existing, tenantId)) {
      return sendNotFound(reply, 'Language pack not found')
    }

    await store.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
