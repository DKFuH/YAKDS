import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'
import { isTenantPluginEnabled } from './tenantPluginAccess.js'
import { viewerExportsRoutes } from '../routes/viewerExports.js'

async function viewerExportPluginRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Missing tenant scope',
      })
    }

    const enabled = await isTenantPluginEnabled(tenantId, 'viewer-export')
    if (!enabled) {
      return reply.status(403).send({
        error: 'PLUGIN_DISABLED',
        message: 'Plugin viewer-export is disabled for this tenant',
      })
    }
  })

  await app.register(viewerExportsRoutes)
}

export const viewerExportPlugin: OkpPlugin = {
  id: 'viewer-export',
  name: 'Viewer Export',
  register: viewerExportPluginRoutes,
}
