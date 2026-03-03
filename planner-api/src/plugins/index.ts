import { registerPlugin } from './pluginRegistry.js'
import { raumakustikPlugin } from './raumakustik.js'
import { fengshuiPlugin } from './fengshui.js'
import { tischlerPlugin } from './tischler.js'

/**
 * Bootstraps alle Branche-Plugins.
 * Wird einmalig beim Anwendungsstart aufgerufen, bevor die Plugins in
 * Fastify eingehängt werden.
 */
export function bootstrapPlugins(): void {
  registerPlugin(raumakustikPlugin)
  registerPlugin(fengshuiPlugin)

  const tischlerEnabled = (process.env.ENABLE_TISCHLER_PLUGIN ?? 'true').toLowerCase() !== 'false'
  if (tischlerEnabled) {
    registerPlugin(tischlerPlugin)
  }
}
