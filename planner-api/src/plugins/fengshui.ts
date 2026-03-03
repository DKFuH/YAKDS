import type { OkpPlugin } from './pluginRegistry.js'
import { fengshuiRoutes } from '../routes/fengshui.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'

async function guardedFengshuiRoutes(app: import('fastify').FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'fengshui')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin fengshui is disabled for this tenant',
      })
    }
  })

  await fengshuiRoutes(app)
}

/** FengShui-Plugin – Ost/West-Analyse mit Bagua-Raster und Küchendreieck. */
export const fengshuiPlugin: OkpPlugin = {
  id: 'fengshui',
  name: 'FengShui',
  register: guardedFengshuiRoutes,
}
