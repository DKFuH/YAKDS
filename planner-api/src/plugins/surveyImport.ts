import type { FastifyInstance } from 'fastify'
import type { OkpPlugin } from './pluginRegistry.js'

async function surveyImportPluginRoutes(_app: FastifyInstance): Promise<void> {
  // Measurement-Import wird aktuell über Core-Route bereitgestellt,
  // die Aktivierung erfolgt tenant-spezifisch über dieses Plugin.
}

export const surveyImportPlugin: OkpPlugin = {
  id: 'survey-import',
  name: 'Survey Import',
  register: surveyImportPluginRoutes,
}
