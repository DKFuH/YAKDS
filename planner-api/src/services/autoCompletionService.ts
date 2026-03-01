/**
 * autoCompletionService.ts – Sprint 21 / TASK-21-A01
 *
 * Erzeugt automatisch Langteile (Arbeitsplatte / Sockel / Wange) für
 * zusammenhängende Schrank-Cluster (PlacedObjects an einer Wand).
 *
 * Rebuild-Strategie: Delete-and-recreate (MVP).
 * Spätere Versionen können diff-basiert vorgehen.
 */
import {
    clusterCabinetsByWall,
    calculateWorktopSegments,
    calculatePlinthSegments,
    type AutoLongPartCabinet,
    type WorktopParams,
    type PlinthParams,
} from '@yakds/shared-schemas'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

// ─── Typen (vereinfacht, analog zu shared-schemas) ───────────────

interface PlacedObject {
    id: string
    wall_id: string
    offset_mm: number
    width_mm: number
    depth_mm: number
    height_mm: number
    type: 'base' | 'wall' | 'tall' | 'appliance'
    joins_left_corner?: boolean
    joins_right_corner?: boolean
}

interface AutoCompletionOptions {
    worktopOverhangFront_mm?: number   // Standard: 20 mm
    worktopOverhangSide_mm?: number    // Standard: 0 mm
    cornerJointAllowance_mm?: number   // Standard: 20 mm (corner joint overlap reduction)
    plinthHeight_mm?: number           // Standard: 150 mm
    plinthDepth_mm?: number            // Standard: 60 mm
    maxWorktopLength_mm?: number       // Standard: 3600 mm (Stoß bei Überschreitung)
    addSidePanels?: boolean            // Wangen an freien Abschlüssen
}

type GeneratedLongPartType = 'worktop' | 'plinth' | 'side_panel'

interface DesiredGeneratedItem {
    item_type: GeneratedLongPartType
    label: string
    qty: number
    unit: string
    build_number: number
    params_json: Record<string, unknown>
    source_placement_ids: string[]
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableJson(entry)).join(',')}]`
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`
    }
    return JSON.stringify(value)
}

function generatedItemSignature(input: {
    item_type: string
    label: string
    qty: number
    unit: string
    params_json: unknown
    source_placement_ids: string[]
}): string {
    const sourceIds = [...input.source_placement_ids].sort((a, b) => a.localeCompare(b))
    return [
        input.item_type,
        input.label,
        String(input.qty),
        input.unit,
        stableJson(input.params_json),
        sourceIds.join(','),
    ].join('|')
}

// ─── Main Service ─────────────────────────────────────────────────

export const AutoCompletionService = {

    /**
     * Führt Auto-Vervollständigung für ein Raum-Placement aus.
     * Löscht alle bisherigen generierten Elemente für diesen Raum und
     * erstellt neue auf Basis der aktuellen Placements.
     *
     * Nutzt shared-schemas clusterCabinetsByWall / calculateWorktopSegments /
     * calculatePlinthSegments damit corner_joint_allowance_mm korrekt berücksichtigt wird.
     *
     * @returns Zusammenfassung der erzeugten Elemente
     */
    async rebuild(
        project_id: string,
        room_id: string,
        placements: PlacedObject[],
        opts: AutoCompletionOptions = {},
    ) {
        const options = {
            worktopOverhangFront_mm: opts.worktopOverhangFront_mm ?? 20,
            worktopOverhangSide_mm: opts.worktopOverhangSide_mm ?? 0,
            cornerJointAllowance_mm: opts.cornerJointAllowance_mm ?? 20,
            plinthHeight_mm: opts.plinthHeight_mm ?? 150,
            plinthDepth_mm: opts.plinthDepth_mm ?? 60,
            maxWorktopLength_mm: opts.maxWorktopLength_mm ?? 3600,
            addSidePanels: opts.addSidePanels ?? true,
        }

        // 1. Map PlacedObject → AutoLongPartCabinet (shared-schemas interface)
        const cabinets: AutoLongPartCabinet[] = placements.map((p) => ({
            id: p.id,
            wall_id: p.wall_id,
            offset_mm: p.offset_mm,
            width_mm: p.width_mm,
            depth_mm: p.depth_mm,
            height_mm: p.height_mm,
            kind: p.type === 'base' ? 'base' : p.type === 'tall' ? 'tall' : p.type === 'wall' ? 'wall' : undefined,
            joins_left_corner: p.joins_left_corner,
            joins_right_corner: p.joins_right_corner,
        }))

        // 2. Cluster cabinets by wall using shared-schemas logic (handles corner joints)
        const clusters = clusterCabinetsByWall(cabinets)

        const desiredItems: DesiredGeneratedItem[] = []
        let buildNumber = 1

        const worktopParams: WorktopParams = {
            front_overhang_mm: options.worktopOverhangFront_mm,
            side_overhang_mm: options.worktopOverhangSide_mm,
            max_segment_length_mm: options.maxWorktopLength_mm,
            corner_joint_allowance_mm: options.cornerJointAllowance_mm,
        }

        const plinthParams: PlinthParams = {
            height_mm: options.plinthHeight_mm,
            recess_mm: options.plinthDepth_mm,
            max_segment_length_mm: options.maxWorktopLength_mm,
            corner_joint_allowance_mm: options.cornerJointAllowance_mm,
        }

        for (const cluster of clusters) {
            const placementIds = cluster.cabinets.map((c) => c.id)

            // ── Arbeitsplatte ─────────────────────────────────────────
            const worktopSegments = calculateWorktopSegments(cluster, worktopParams)
            for (const segment of worktopSegments) {
                desiredItems.push({
                    item_type: 'worktop',
                    label: worktopSegments.length > 1
                        ? `Arbeitsplatte Segment ${segment.segment_index} (Wand ${cluster.wall_id})`
                        : `Arbeitsplatte (Wand ${cluster.wall_id})`,
                    qty: segment.length_mm,
                    unit: 'mm',
                    build_number: buildNumber,
                    params_json: {
                        wall_id: cluster.wall_id,
                        depth_mm: segment.depth_mm,
                        segment_index: segment.segment_index,
                        joint_left: segment.joint_left,
                        joint_right: segment.joint_right,
                    },
                    source_placement_ids: placementIds,
                })
            }

            // ── Sockel ────────────────────────────────────────────────
            const plinthSegments = calculatePlinthSegments(cluster, plinthParams)
            for (const segment of plinthSegments) {
                desiredItems.push({
                    item_type: 'plinth',
                    label: plinthSegments.length > 1
                        ? `Sockelbrett Segment ${segment.segment_index} (Wand ${cluster.wall_id})`
                        : `Sockelbrett (Wand ${cluster.wall_id})`,
                    qty: segment.length_mm,
                    unit: 'mm',
                    build_number: buildNumber,
                    params_json: {
                        wall_id: cluster.wall_id,
                        height_mm: segment.height_mm,
                        recess_mm: segment.recess_mm,
                    },
                    source_placement_ids: placementIds,
                })
            }

            // ── Seitenwangen ─────────────────────────────────────────
            if (options.addSidePanels) {
                for (const side of ['links', 'rechts'] as const) {
                    desiredItems.push({
                        item_type: 'side_panel',
                        label: `Abschlussblende ${side} (Wand ${cluster.wall_id})`,
                        qty: 1,
                        unit: 'Stk',
                        build_number: buildNumber,
                        params_json: {
                            wall_id: cluster.wall_id,
                            side,
                            height_mm: Math.max(...cluster.cabinets.map((c) => c.height_mm ?? 0)),
                            depth_mm: cluster.max_depth_mm,
                        },
                        source_placement_ids: [placementIds[side === 'links' ? 0 : placementIds.length - 1]],
                    })
                }
            }

            buildNumber++
        }

        // 3. Reconcile existing generated long parts with deterministic signatures
        const existingItems = await prisma.generatedItem.findMany({
            where: {
                project_id,
                room_id,
                is_generated: true,
                item_type: { in: ['worktop', 'plinth', 'side_panel'] },
            },
            include: {
                source_links: {
                    select: { source_placement_id: true },
                },
            },
        })

        const existingBySignature = new Map<string, Array<{ id: string }>>()
        for (const item of existingItems) {
            const sourceIds = item.source_links.map((link) => link.source_placement_id)
            const signature = generatedItemSignature({
                item_type: item.item_type,
                label: item.label,
                qty: item.qty,
                unit: item.unit,
                params_json: item.params_json,
                source_placement_ids: sourceIds,
            })
            const list = existingBySignature.get(signature) ?? []
            list.push({ id: item.id })
            existingBySignature.set(signature, list)
        }

        const created: { type: string; label: string; qty: number; unit: string }[] = []
        const matchedExistingIds = new Set<string>()

        for (const desired of desiredItems) {
            const signature = generatedItemSignature(desired)
            const matching = existingBySignature.get(signature)
            if (matching && matching.length > 0) {
                const reused = matching.shift()!
                matchedExistingIds.add(reused.id)
                continue
            }

            await prisma.generatedItem.create({
                data: {
                    project_id,
                    room_id,
                    item_type: desired.item_type,
                    label: desired.label,
                    qty: desired.qty,
                    unit: desired.unit,
                    build_number: desired.build_number,
                    params_json: desired.params_json as Prisma.InputJsonValue,
                    source_links: {
                        create: desired.source_placement_ids.map((sourcePlacementId) => ({ source_placement_id: sourcePlacementId })),
                    },
                },
            })

            created.push({ type: desired.item_type, label: desired.label, qty: desired.qty, unit: desired.unit })
        }

        const staleItemIds = existingItems
            .filter((item) => !matchedExistingIds.has(item.id))
            .map((item) => item.id)

        if (staleItemIds.length > 0) {
            await prisma.generatedItemSourceLink.deleteMany({
                where: { generated_item_id: { in: staleItemIds } },
            })
            await prisma.generatedItem.deleteMany({
                where: { id: { in: staleItemIds } },
            })
        }

        return {
            project_id,
            room_id,
            deleted: staleItemIds.length,
            created: created.length,
            items: created,
        }
    },

    async list(project_id: string, room_id: string) {
        return prisma.generatedItem.findMany({
            where: { project_id, room_id },
            include: { source_links: true, catalog_article: { select: { sku: true, name: true } } },
            orderBy: [{ item_type: 'asc' }, { created_at: 'asc' }],
        })
    },

    /**
     * Schlägt Zubehör für einen Raum vor, basierend auf den IDM-Warengruppen (GRP)
     * der platzierten Artikel.
     */
    async suggestAccessories(project_id: string, room_id: string) {
        const room = await prisma.room.findUnique({
            where: { id: room_id },
            select: { placements: true },
        })

        if (!room || !Array.isArray(room.placements)) {
            return []
        }

        const placements = room.placements as any[]
        const articleIds = Array.from(
            new Set(placements.map((p) => p.catalog_article_id).filter(Boolean)),
        )

        // Hole Artikel-Metadaten
        const placedArticles = await prisma.catalogArticle.findMany({
            where: { id: { in: articleIds as string[] } },
            select: { id: true, name: true, meta_json: true },
        })

        const suggestions: Array<{
            trigger_article_id: string
            trigger_article_name: string
            category: string
            recommendation_label: string
            candidates: any[]
        }> = []

        for (const article of placedArticles) {
            const meta = article.meta_json as any
            const grp = meta?.idm_raw?.GRP || meta?.idm_raw?.['@_GRP']

            if (!grp) continue

            const matchingRules = ACCESSORY_SUGGESTION_RULES.filter((r) => r.triggerGrp === grp)

            for (const rule of matchingRules) {
                // Suche passende Zubehörartikel im Gesamtkatalog
                const candidates = await prisma.catalogArticle.findMany({
                    where: {
                        article_type: 'accessory',
                        OR: rule.keywords.map((kw) => ({
                            name: { contains: kw, mode: 'insensitive' },
                        })),
                    },
                    take: 3,
                    select: { id: true, sku: true, name: true, base_dims_json: true },
                })

                if (candidates.length > 0) {
                    suggestions.push({
                        trigger_article_id: article.id,
                        trigger_article_name: article.name,
                        category: rule.category,
                        recommendation_label: rule.label,
                        candidates,
                    })
                }
            }
        }

        return suggestions
    },
}

// ─── Hilfsdaten (MVP-Regeln) ──────────────────────────────────────

const ACCESSORY_SUGGESTION_RULES = [
    {
        triggerGrp: 'SPL', // Spüle
        category: 'Armaturen',
        label: 'Passende Mischbatterie wählen',
        keywords: ['Armatur', 'Wasserhahn', 'Mischbatterie'],
    },
    {
        triggerGrp: 'SPL',
        category: 'Siphons',
        label: 'Geruchsverschluss / Siphon',
        keywords: ['Siphon', 'Raumsparsiphon', 'Ablaufgarnitur'],
    },
    {
        triggerGrp: 'HER', // Herd
        category: 'Elektro',
        label: 'Anschlusskabel 3x1.5mm / 5x2.5mm',
        keywords: ['Kabel', 'Anschlusskabel', 'Stecker'],
    },
    {
        triggerGrp: 'GSP', // Geschirrspüler
        category: 'Installation',
        label: 'Schlauchverlängerung',
        keywords: ['Verlängerung', 'Schlauch'],
    },
    {
        triggerGrp: 'LUE', // Lüfter
        category: 'Filter',
        label: 'Aktivkohlefilter für Umluft',
        keywords: ['Filter', 'Aktivkohle'],
    },
]
