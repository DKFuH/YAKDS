import { registerPlugin } from './pluginRegistry.js'
import { raumakustikPlugin } from './raumakustik.js'
import { fengshuiPlugin } from './fengshui.js'
import { tischlerPlugin } from './tischler.js'
import { assetLibraryPlugin } from './assetLibrary.js'
import { presentationPlugin } from './presentation.js'
import { daylightPlugin } from './daylight.js'
import { materialsPlugin } from './materials.js'
import { surveyImportPlugin } from './surveyImport.js'
import { viewerExportPlugin } from './viewerExport.js'

/**
 * Bootstraps alle Branche-Plugins.
 * Wird einmalig beim Anwendungsstart aufgerufen, bevor die Plugins in
 * Fastify eingehängt werden.
 */
export function bootstrapPlugins(): void {
  registerPlugin(raumakustikPlugin)
  registerPlugin(fengshuiPlugin)
  registerPlugin(assetLibraryPlugin)
  registerPlugin(presentationPlugin)
  registerPlugin(daylightPlugin)
  registerPlugin(materialsPlugin)
  registerPlugin(surveyImportPlugin)
  registerPlugin(viewerExportPlugin)

  const tischlerEnabled = (process.env.ENABLE_TISCHLER_PLUGIN ?? 'true').toLowerCase() !== 'false'
  if (tischlerEnabled) {
    registerPlugin(tischlerPlugin)
  }
}
