import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'
import { presentationRoutes } from '../routes/presentation.js'

async function presentationPluginRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'presentation')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin presentation is disabled for this tenant',
      })
    }
  })

  await app.register(presentationRoutes)
}

export const presentationPlugin: OkpPlugin = {
  id: 'presentation',
  name: 'Presentation',
  register: presentationPluginRoutes,
}
