import type { GrainDir, PrismaClient } from '@prisma/client'

type PlacementLike = {
  id: string
  catalog_article_id?: string
  description?: string
  width_mm?: number
  height_mm?: number
  quantity?: number
  qty?: number
}

type RoomLike = {
  id: string
  name: string
  placements: unknown
}

type CutlistPartTemplate = {
  label?: string
  width_mm?: number
  height_mm?: number
  qty_per_unit?: number
  material_code?: string
}

type ArticleLike = {
  id: string
  name: string
  base_dims_json: unknown
  material_code: string | null
  material_label: string | null
  grain_direction: GrainDir | null
  cutlist_parts: unknown
}

export interface CutlistPart {
  label: string
  width_mm: number
  height_mm: number
  quantity: number
  material_code: string
  material_label: string
  grain_direction: 'none' | 'length' | 'width'
  article_name: string
  article_id: string
  placement_id: string
  room_id: string
  room_name: string
}

export interface CutlistSummary {
  total_parts: number
  by_material: Record<string, { count: number; area_sqm: number; material_label: string }>
}

export interface CutlistResult {
  parts: CutlistPart[]
  summary: CutlistSummary
}

function asPositiveNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0
  }
  return value
}

function asQuantity(value: unknown, fallback = 1): number {
  const normalized = asPositiveNumber(value)
  if (!normalized) return fallback
  return Math.max(1, Math.round(normalized))
}

function normalizeGrainDirection(value: GrainDir | null | undefined): CutlistPart['grain_direction'] {
  if (value === 'length' || value === 'width') return value
  return 'none'
}

function getBaseDims(baseDims: unknown): { width_mm: number; height_mm: number } {
  if (!baseDims || typeof baseDims !== 'object') {
    return { width_mm: 0, height_mm: 0 }
  }

  const candidate = baseDims as { width_mm?: unknown; height_mm?: unknown }
  return {
    width_mm: asPositiveNumber(candidate.width_mm),
    height_mm: asPositiveNumber(candidate.height_mm),
  }
}

function getPlacements(value: unknown): PlacementLike[] {
  if (!Array.isArray(value)) return []
  return value as PlacementLike[]
}

function getPartTemplates(value: unknown): CutlistPartTemplate[] {
  if (!Array.isArray(value)) return []
  return value as CutlistPartTemplate[]
}

export async function generateCutlist(
  db: PrismaClient,
  projectId: string,
  roomId?: string,
): Promise<CutlistResult> {
  const rooms = await db.room.findMany({
    where: roomId ? { project_id: projectId, id: roomId } : { project_id: projectId },
    select: {
      id: true,
      name: true,
      placements: true,
    },
  }) as RoomLike[]

  const articleIds = new Set<string>()
  for (const room of rooms) {
    for (const placement of getPlacements(room.placements)) {
      if (placement.catalog_article_id) {
        articleIds.add(placement.catalog_article_id)
      }
    }
  }

  const articles = articleIds.size
    ? await db.catalogArticle.findMany({
      where: { id: { in: [...articleIds] } },
      select: {
        id: true,
        name: true,
        base_dims_json: true,
        material_code: true,
        material_label: true,
        grain_direction: true,
        cutlist_parts: true,
      },
    }) as ArticleLike[]
    : []

  const articleById = new Map(articles.map((article) => [article.id, article]))
  const parts: CutlistPart[] = []

  for (const room of rooms) {
    for (const placement of getPlacements(room.placements)) {
      const articleId = placement.catalog_article_id
      if (!articleId) continue

      const article = articleById.get(articleId)
      if (!article) continue

      const units = asQuantity(placement.quantity ?? placement.qty, 1)
      const templates = getPartTemplates(article.cutlist_parts)
      const grainDirection = normalizeGrainDirection(article.grain_direction)

      if (templates.length > 0) {
        for (const template of templates) {
          const widthMm = asPositiveNumber(template.width_mm)
          const heightMm = asPositiveNumber(template.height_mm)
          const qtyPerUnit = asQuantity(template.qty_per_unit, 1)
          const materialCode = template.material_code ?? article.material_code ?? 'UNBEKANNT'
          const materialLabel = article.material_label ?? template.material_code ?? materialCode

          parts.push({
            label: template.label?.trim() || article.name,
            width_mm: widthMm,
            height_mm: heightMm,
            quantity: qtyPerUnit * units,
            material_code: materialCode,
            material_label: materialLabel,
            grain_direction: grainDirection,
            article_name: article.name,
            article_id: article.id,
            placement_id: placement.id,
            room_id: room.id,
            room_name: room.name,
          })
        }
        continue
      }

      const baseDims = getBaseDims(article.base_dims_json)
      const widthMm = asPositiveNumber(placement.width_mm) || baseDims.width_mm
      const heightMm = asPositiveNumber(placement.height_mm) || baseDims.height_mm
      const materialCode = article.material_code ?? 'UNBEKANNT'
      const materialLabel = article.material_label ?? materialCode

      parts.push({
        label: placement.description?.trim() || article.name,
        width_mm: widthMm,
        height_mm: heightMm,
        quantity: units,
        material_code: materialCode,
        material_label: materialLabel,
        grain_direction: grainDirection,
        article_name: article.name,
        article_id: article.id,
        placement_id: placement.id,
        room_id: room.id,
        room_name: room.name,
      })
    }
  }

  const byMaterial: CutlistSummary['by_material'] = {}
  for (const part of parts) {
    const key = part.material_code
    if (!byMaterial[key]) {
      byMaterial[key] = {
        count: 0,
        area_sqm: 0,
        material_label: part.material_label,
      }
    }

    byMaterial[key].count += part.quantity
    byMaterial[key].area_sqm += (part.width_mm / 1000) * (part.height_mm / 1000) * part.quantity
  }

  for (const material of Object.values(byMaterial)) {
    material.area_sqm = Math.round(material.area_sqm * 1000) / 1000
  }

  return {
    parts,
    summary: {
      total_parts: parts.reduce((sum, part) => sum + part.quantity, 0),
      by_material: byMaterial,
    },
  }
}
