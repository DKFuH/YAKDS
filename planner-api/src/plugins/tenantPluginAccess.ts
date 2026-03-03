import { prisma } from '../db.js'
import { getPlugins } from './pluginRegistry.js'

type TenantSettingsStore = {
  findUnique: (args: unknown) => Promise<{ enabled_plugins?: unknown } | null>
}

function getTenantSettingsStore(): TenantSettingsStore {
  return (prisma as unknown as { tenantSetting: TenantSettingsStore }).tenantSetting
}

function normalizeEnabledPlugins(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

export async function isTenantPluginEnabled(tenantId: string, pluginId: string): Promise<boolean> {
  const available = getPlugins().map((plugin) => plugin.id)
  if (!available.includes(pluginId)) {
    return false
  }

  const store = getTenantSettingsStore()
  const settings = await store.findUnique({ where: { tenant_id: tenantId } })
  const configured = normalizeEnabledPlugins(settings?.enabled_plugins)

  if (configured.length === 0) {
    return true
  }

  return configured.includes(pluginId)
}
