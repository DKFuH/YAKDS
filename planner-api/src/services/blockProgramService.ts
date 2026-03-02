import type { BlockBasis, Prisma } from '@prisma/client'
import type { BlockDefinition, BlockTier, PriceSummary } from '@okp/shared-schemas'

export interface StoredBlockCondition {
  id: string
  block_definition_id: string | null
  field: string
  operator: string
  value: Prisma.JsonValue
}

export interface StoredBlockGroup {
  id: string
  code: string
  name: string
  item_selector: Prisma.JsonValue | null
}

export interface StoredBlockDefinition {
  id: string
  name: string
  basis: BlockBasis
  tiers: Prisma.JsonValue
  sort_order: number
  group: StoredBlockGroup | null
  conditions: StoredBlockCondition[]
}

export interface StoredBlockProgram {
  id: string
  name: string
  manufacturer: string | null
  notes: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  groups: StoredBlockGroup[]
  definitions: StoredBlockDefinition[]
  conditions: StoredBlockCondition[]
}

function isBlockTier(value: unknown): value is BlockTier {
  return (
    typeof value === 'object' &&
    value !== null &&
    'min_value' in value &&
    typeof value.min_value === 'number' &&
    'discount_pct' in value &&
    typeof value.discount_pct === 'number'
  )
}

function toBlockTiers(value: Prisma.JsonValue): BlockTier[] {
  if (!Array.isArray(value)) {
    return []
  }

  const tiers: BlockTier[] = []

  for (const tier of value) {
    if (isBlockTier(tier)) {
      tiers.push({
        min_value: tier.min_value,
        discount_pct: tier.discount_pct,
      })
    }
  }

  return tiers
}

function getConditionMetric(
  field: string,
  priceSummary: PriceSummary,
  leadStatus: string | null | undefined,
): number | string | undefined {
  switch (field) {
    case 'dealer_price_net':
      return priceSummary.dealer_price_net
    case 'subtotal_net':
      return priceSummary.subtotal_net
    case 'total_purchase_price_net':
      return priceSummary.total_purchase_price_net
    case 'total_sell_price_net':
      return priceSummary.total_sell_price_net
    case 'total_points':
      return priceSummary.total_points
    case 'lead_status':
      return leadStatus ?? undefined
    default:
      return undefined
  }
}

function matchesCondition(
  condition: StoredBlockCondition,
  priceSummary: PriceSummary,
  leadStatus: string | null | undefined,
) {
  const actual = getConditionMetric(condition.field, priceSummary, leadStatus)
  if (actual === undefined) {
    return false
  }

  const expected = condition.value
  switch (condition.operator) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
    case 'gte':
    default:
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
  }
}

export function getEligibleProgramBlocks(
  program: StoredBlockProgram,
  priceSummary: PriceSummary,
  leadStatus: string | null | undefined,
): BlockDefinition[] {
  const programConditions = program.conditions.filter((condition) => condition.block_definition_id === null)

  return [...program.definitions]
    .sort((left, right) => left.sort_order - right.sort_order)
    .filter((definition) => {
      const conditions = [...programConditions, ...definition.conditions]
      return conditions.every((condition) => matchesCondition(condition, priceSummary, leadStatus))
    })
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      basis: definition.basis,
      tiers: toBlockTiers(definition.tiers),
    }))
    .filter((definition) => definition.tiers.length > 0)
}

export function serializeBlockProgram(program: StoredBlockProgram) {
  return {
    id: program.id,
    name: program.name,
    manufacturer: program.manufacturer,
    notes: program.notes,
    is_active: program.is_active,
    created_at: program.created_at,
    updated_at: program.updated_at,
    groups: program.groups.map((group) => ({
      id: group.id,
      code: group.code,
      name: group.name,
      item_selector: group.item_selector,
    })),
    conditions: program.conditions
      .filter((condition) => condition.block_definition_id === null)
      .map((condition) => ({
        id: condition.id,
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
      })),
    definitions: [...program.definitions]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((definition) => ({
        id: definition.id,
        name: definition.name,
        basis: definition.basis,
        group_code: definition.group?.code ?? null,
        sort_order: definition.sort_order,
        tiers: toBlockTiers(definition.tiers),
        conditions: definition.conditions.map((condition) => ({
          id: condition.id,
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
        })),
      })),
  }
}
