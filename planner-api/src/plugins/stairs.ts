import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'
import { verticalConnectionsRoutes } from '../routes/verticalConnections.js'

async function stairsPluginRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'stairs')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin stairs is disabled for this tenant',
      })
    }
  })

  await app.register(verticalConnectionsRoutes)
}

export const stairsPlugin: OkpPlugin = {
  id: 'stairs',
  name: 'Stairs',
  register: stairsPluginRoutes,
}
