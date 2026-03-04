import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'
import { surveyImportRoutes } from '../routes/surveyImport.js'

async function surveyImportPluginRoutes(app: FastifyInstance): Promise<void> {
  await app.register(surveyImportRoutes)
}

export const surveyImportPlugin: OkpPlugin = {
  id: 'survey-import',
  name: 'Survey Import',
  register: surveyImportPluginRoutes,
}
