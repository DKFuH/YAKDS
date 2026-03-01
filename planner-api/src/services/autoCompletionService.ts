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

        // 1. Lösche alte generated_items für diesen Raum
        const oldItems = await prisma.generatedItem.findMany({
            where: { project_id, room_id, is_generated: true },
            select: { id: true },
        })
        if (oldItems.length > 0) {
            await prisma.generatedItemSourceLink.deleteMany({
                where: { generated_item_id: { in: oldItems.map((i) => i.id) } },
            })
            await prisma.generatedItem.deleteMany({
                where: { id: { in: oldItems.map((i) => i.id) } },
            })
        }

        // 2. Map PlacedObject → AutoLongPartCabinet (shared-schemas interface)
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

        // 3. Cluster cabinets by wall using shared-schemas logic (handles corner joints)
        const clusters = clusterCabinetsByWall(cabinets)

        const created: { type: string; label: string; qty: number; unit: string }[] = []
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
                const wt = await prisma.generatedItem.create({
                    data: {
                        project_id,
                        room_id,
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
                        source_links: {
                            create: placementIds.map((pid) => ({ source_placement_id: pid })),
                        },
                    },
                })
                created.push({ type: 'worktop', label: wt.label, qty: segment.length_mm, unit: 'mm' })
            }

            // ── Sockel ────────────────────────────────────────────────
            const plinthSegments = calculatePlinthSegments(cluster, plinthParams)
            for (const segment of plinthSegments) {
                const pl = await prisma.generatedItem.create({
                    data: {
                        project_id,
                        room_id,
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
                        source_links: {
                            create: placementIds.map((pid) => ({ source_placement_id: pid })),
                        },
                    },
                })
                created.push({ type: 'plinth', label: pl.label, qty: segment.length_mm, unit: 'mm' })
            }

            // ── Seitenwangen ─────────────────────────────────────────
            if (options.addSidePanels) {
                for (const side of ['links', 'rechts'] as const) {
                    const sp = await prisma.generatedItem.create({
                        data: {
                            project_id,
                            room_id,
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
                            source_links: {
                                create: [{ source_placement_id: placementIds[side === 'links' ? 0 : placementIds.length - 1] }],
                            },
                        },
                    })
                    created.push({ type: 'side_panel', label: sp.label, qty: 1, unit: 'Stk' })
                }
            }

            buildNumber++
        }

        return {
            project_id,
            room_id,
            deleted: oldItems.length,
            created: created.length,
            items: created,
        }
    },

    /**
     * Gibt alle generierten Elemente für einen Raum zurück.
     */
    async list(project_id: string, room_id: string) {
        return prisma.generatedItem.findMany({
            where: { project_id, room_id },
            include: { source_links: true, catalog_article: { select: { sku: true, name: true } } },
            orderBy: [{ item_type: 'asc' }, { created_at: 'asc' }],
        })
    },
}
