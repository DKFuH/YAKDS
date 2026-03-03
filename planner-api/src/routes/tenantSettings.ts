import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest } from '../errors.js'

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
})

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
}
