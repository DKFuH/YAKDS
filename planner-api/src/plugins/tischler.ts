import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'
import { cutlistRoutes } from '../routes/cutlist.js'
import { nestingRoutes } from '../routes/nesting.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'

async function tischlerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'tischler')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin tischler is disabled for this tenant',
      })
    }
  })

  await app.register(cutlistRoutes)
  await app.register(nestingRoutes)
}

export const tischlerPlugin: OkpPlugin = {
  id: 'tischler',
  name: 'Tischler-Fertigung',
  register: tischlerRoutes,
}
