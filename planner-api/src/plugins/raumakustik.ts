import type { OkpPlugin } from './pluginRegistry.js'
import { acousticsRoutes } from '../routes/acoustics.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'

async function guardedRaumakustikRoutes(app: import('fastify').FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'raumakustik')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin raumakustik is disabled for this tenant',
      })
    }
  })

  await acousticsRoutes(app)
}

/** Raumakustik-Plugin – CNIVG-Import, akustische Raster und Schichtdaten. */
export const raumakustikPlugin: OkpPlugin = {
  id: 'raumakustik',
  name: 'Raumakustik',
  register: guardedRaumakustikRoutes,
}
