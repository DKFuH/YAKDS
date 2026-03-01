/**
 * ruleEngineV2.ts – Sprint 22 / TASK-22-A01
 * "Protect"-Framework: konfigurierbarer Regelkatalog + Persistenz
 */
import { prisma } from '../db.js'

// ─── Typen ───────────────────────────────────────────────────────

export interface PlacedObjectV2 {
    id: string
    wall_id: string
    offset_mm: number
    width_mm: number
    depth_mm: number
    height_mm: number
    type: 'base' | 'wall' | 'tall' | 'appliance'
    door_swing?: 'left' | 'right' | 'none'
    has_handle_boring?: boolean
    worldPos?: { x_mm: number; y_mm: number }
}

export interface ProjectSnapshot {
    project_id: string
    room_id: string
    placements: PlacedObjectV2[]
    worktop_items: { id: string; qty: number }[]
    plinth_items: { id: string; qty: number }[]
    ceiling_height_mm: number
    min_clearance_mm: number
}

interface ViolationInput {
    rule_key: string
    severity: 'error' | 'warning' | 'hint'
    entity_refs: string[]
    message: string
    hint?: string
    auto_fix_possible?: boolean
}

type RuleHandler = (s: ProjectSnapshot, p: Record<string, unknown>) => ViolationInput[]

interface WorldPoint {
    x_mm: number
    y_mm: number
}

function getWorldPolygon(obj: PlacedObjectV2): WorldPoint[] | null {
    if (!obj.worldPos) {
        return null
    }

    const x = obj.worldPos.x_mm
    const y = obj.worldPos.y_mm
    const width = Math.max(0, obj.width_mm)
    const depth = Math.max(0, obj.depth_mm)

    return [
        { x_mm: x, y_mm: y },
        { x_mm: x + width, y_mm: y },
        { x_mm: x + width, y_mm: y + depth },
        { x_mm: x, y_mm: y + depth },
    ]
}

function dot(a: WorldPoint, b: WorldPoint): number {
    return a.x_mm * b.x_mm + a.y_mm * b.y_mm
}

function edgeNormal(a: WorldPoint, b: WorldPoint): WorldPoint {
    const edge = { x_mm: b.x_mm - a.x_mm, y_mm: b.y_mm - a.y_mm }
    return { x_mm: -edge.y_mm, y_mm: edge.x_mm }
}

function projectPolygon(points: WorldPoint[], axis: WorldPoint): { min: number; max: number } {
    const first = dot(points[0], axis)
    let min = first
    let max = first

    for (let i = 1; i < points.length; i++) {
        const value = dot(points[i], axis)
        if (value < min) min = value
        if (value > max) max = value
    }

    return { min, max }
}

function polygonsIntersectSAT(left: WorldPoint[], right: WorldPoint[]): boolean {
    const axes: WorldPoint[] = []

    for (let i = 0; i < left.length; i++) {
        axes.push(edgeNormal(left[i], left[(i + 1) % left.length]))
    }
    for (let i = 0; i < right.length; i++) {
        axes.push(edgeNormal(right[i], right[(i + 1) % right.length]))
    }

    for (const axis of axes) {
        const l = projectPolygon(left, axis)
        const r = projectPolygon(right, axis)

        if (l.max <= r.min || r.max <= l.min) {
            return false
        }
    }

    return true
}

// ─── Regelimplementierungen ───────────────────────────────────────

const rules: Record<string, RuleHandler> = {
    'COLL-001': (s) => {
        const out: ViolationInput[] = []
        const bases = s.placements.filter((p) => p.type === 'base' || p.type === 'tall')
        for (let i = 0; i < bases.length; i++) {
            for (let j = i + 1; j < bases.length; j++) {
                const a = bases[i], b = bases[j]
                const sameWallOverlap =
                    a.wall_id === b.wall_id &&
                    a.offset_mm < b.offset_mm + b.width_mm &&
                    a.offset_mm + a.width_mm > b.offset_mm

                const polyA = getWorldPolygon(a)
                const polyB = getWorldPolygon(b)
                const worldOverlap = polyA !== null && polyB !== null
                    ? polygonsIntersectSAT(polyA, polyB)
                    : false

                if (sameWallOverlap || worldOverlap) {
                    out.push({ rule_key: 'COLL-001', severity: 'error', entity_refs: [a.id, b.id], message: `Schrank ${a.id} und ${b.id} überlappen.` })
                }
            }
        }
        return out
    },

    'COLL-002': (s, p) => {
        const clearance = Number(p['door_clearance_mm'] ?? 50)
        const out: ViolationInput[] = []
        for (const cab of s.placements.filter((c) => c.door_swing && c.door_swing !== 'none')) {
            for (const nb of s.placements.filter((c) => c.id !== cab.id && c.wall_id === cab.wall_id)) {
                const gap = cab.door_swing === 'right'
                    ? nb.offset_mm - (cab.offset_mm + cab.width_mm)
                    : cab.offset_mm - (nb.offset_mm + nb.width_mm)
                if (gap >= 0 && gap < clearance) {
                    out.push({ rule_key: 'COLL-002', severity: 'warning', entity_refs: [cab.id, nb.id], message: `Türöffnung ${cab.id}: ${gap} mm < ${clearance} mm.`, hint: 'Schrank verschieben.', auto_fix_possible: false })
                }
            }
        }
        return out
    },

    'COLL-003': (s, p) => {
        const ext = Number(p['drawer_extension_mm'] ?? 500)
        const minSpace = Number(p['min_front_space_mm'] ?? 600)
        return s.placements
            .filter((p) => p.depth_mm + ext > minSpace)
            .map((p) => ({ rule_key: 'COLL-003', severity: 'warning' as const, entity_refs: [p.id], message: `Auszugskollision ${p.id}: Tiefe+Auszug > ${minSpace}mm.` }))
    },

    'COLL-004': () => [],

    'CLEAR-001': (s, p) => {
        const min = Number(p['min_passage_mm'] ?? 600)
        const out: ViolationInput[] = []
        const sorted = [...s.placements].sort((a, b) => a.offset_mm - b.offset_mm)
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1], curr = sorted[i]
            if (prev.wall_id !== curr.wall_id) continue
            const gap = curr.offset_mm - (prev.offset_mm + prev.width_mm)
            if (gap > 0 && gap < min) out.push({ rule_key: 'CLEAR-001', severity: 'warning', entity_refs: [prev.id, curr.id], message: `Durchgang ${gap}mm < ${min}mm.` })
        }
        return out
    },

    'CLEAR-002': (s, p) => {
        const min = Number(p['min_clearance_mm'] ?? s.min_clearance_mm)
        const out: ViolationInput[] = []
        for (let i = 0; i < s.placements.length; i++) {
            for (let j = i + 1; j < s.placements.length; j++) {
                const a = s.placements[i], b = s.placements[j]
                if (a.wall_id !== b.wall_id) continue
                const gap = Math.max(b.offset_mm - (a.offset_mm + a.width_mm), a.offset_mm - (b.offset_mm + b.width_mm))
                if (gap > 0 && gap < min) out.push({ rule_key: 'CLEAR-002', severity: 'warning', entity_refs: [a.id, b.id], message: `Abstand ${a.id}↔${b.id}: ${gap}mm < ${min}mm.` })
            }
        }
        return out
    },

    'ERG-001': (s, p) => {
        const minDist = Number(p['min_dist_from_worktop_mm'] ?? 450)
        const wtHeight = Number(p['standard_worktop_height_mm'] ?? 870)
        return s.placements
            .filter((pl) => pl.type === 'wall' && pl.worldPos && pl.worldPos.y_mm - wtHeight < minDist)
            .map((pl) => ({ rule_key: 'ERG-001', severity: 'warning' as const, entity_refs: [pl.id], message: `Oberschrank ${pl.id} zu nah an Arbeitsfläche.`, hint: 'Montagehöhe korrigieren.' }))
    },

    'ERG-002': (s) =>
        s.placements
            .filter((p) => p.height_mm > s.ceiling_height_mm)
            .map((p) => ({ rule_key: 'ERG-002', severity: 'error' as const, entity_refs: [p.id], message: `Schrank ${p.id} ragt über Raumhöhe.` })),

    'ERG-003': (s, p) => {
        const std = Number(p['standard_worktop_height_mm'] ?? 870)
        const tol = Number(p['height_tolerance_mm'] ?? 20)
        return s.placements
            .filter((pl) => pl.type === 'base' && Math.abs(pl.height_mm - std) > tol)
            .map((pl) => ({ rule_key: 'ERG-003', severity: 'hint' as const, entity_refs: [pl.id], message: `Unterschrankhöhe ${pl.height_mm}mm weicht von ${std}mm ab.` }))
    },

    'COMP-001': (s) =>
        s.placements.some((p) => p.type === 'base') && s.worktop_items.length === 0
            ? [{ rule_key: 'COMP-001', severity: 'warning', entity_refs: [], message: 'Keine Arbeitsplatte in BOM.', hint: 'Auto-Vervollständigen.', auto_fix_possible: true }]
            : [],

    'COMP-002': (s) =>
        s.placements.some((p) => p.type === 'base') && s.plinth_items.length === 0
            ? [{ rule_key: 'COMP-002', severity: 'hint', entity_refs: [], message: 'Kein Sockelbrett in BOM.', hint: 'Auto-Vervollständigen.', auto_fix_possible: true }]
            : [],

    'COMP-003': (s) =>
        s.placements.length === 0
            ? [{ rule_key: 'COMP-003', severity: 'hint', entity_refs: [], message: 'Keine Schränke platziert.' }]
            : [],

    'COMP-004': () => [],

    'COMP-005': () => [],

    'COMP-006': (s) =>
        s.placements
            .filter((p) => p.type === 'appliance')
            .map((p) => ({ rule_key: 'COMP-006', severity: 'hint' as const, entity_refs: [p.id], message: `Gerät ${p.id}: Anschlussart prüfen.` })),

    'ACC-001': (s) =>
        s.placements
            .filter((p) => p.has_handle_boring)
            .map((p) => ({ rule_key: 'ACC-001', severity: 'hint' as const, entity_refs: [p.id], message: `Schrank ${p.id}: Griffartikel in BOM prüfen.` })),
}

// ─── Engine ──────────────────────────────────────────────────────

export const RuleEngineV2 = {

    async run(snapshot: ProjectSnapshot, tenantId?: string) {
        const ruleDefs = await prisma.ruleDefinition.findMany({
            where: {
                enabled: true,
                OR: [{ tenant_id: null }, ...(tenantId ? [{ tenant_id: tenantId }] : [])],
            },
        })

        const allViolations: ViolationInput[] = []

        for (const def of ruleDefs) {
            const handler = rules[def.rule_key]
            if (!handler) continue
            const params = (def.params_json as Record<string, unknown>) ?? {}
            const violations = handler(snapshot, params)
            for (const v of violations) {
                v.severity = def.severity as 'error' | 'warning' | 'hint'
                allViolations.push(v)
            }
        }

        const summary = {
            total: allViolations.length,
            errors: allViolations.filter((v) => v.severity === 'error').length,
            warnings: allViolations.filter((v) => v.severity === 'warning').length,
            hints: allViolations.filter((v) => v.severity === 'hint').length,
        }

        const run = await prisma.ruleRun.create({
            data: {
                project_id: snapshot.project_id,
                summary_json: summary,
                violations: {
                    create: allViolations.map((v) => ({
                        rule_key: v.rule_key,
                        severity: v.severity,
                        entity_refs_json: v.entity_refs,
                        message: v.message,
                        hint: v.hint,
                        auto_fix_possible: v.auto_fix_possible ?? false,
                        ...(ruleDefs.find((d) => d.rule_key === v.rule_key)
                            ? { rule_definition: { connect: { rule_key: v.rule_key } } }
                            : {}),
                    })),
                },
            },
            include: { violations: true },
        })

        return { run_id: run.id, project_id: snapshot.project_id, run_at: run.run_at, summary, valid: summary.errors === 0, violations: run.violations }
    },

    async history(project_id: string, limit = 10) {
        return prisma.ruleRun.findMany({ where: { project_id }, include: { violations: true }, orderBy: { run_at: 'desc' }, take: limit })
    },

    async seedDefaultRules() {
        const defaults = [
            { rule_key: 'COLL-001', category: 'collision' as const, severity: 'error' as const, params_json: {} },
            { rule_key: 'COLL-002', category: 'collision' as const, severity: 'warning' as const, params_json: { door_clearance_mm: 50 } },
            { rule_key: 'COLL-003', category: 'collision' as const, severity: 'warning' as const, params_json: { drawer_extension_mm: 500, min_front_space_mm: 600 } },
            { rule_key: 'COLL-004', category: 'collision' as const, severity: 'warning' as const, params_json: {} },
            { rule_key: 'CLEAR-001', category: 'clearance' as const, severity: 'warning' as const, params_json: { min_passage_mm: 600 } },
            { rule_key: 'CLEAR-002', category: 'clearance' as const, severity: 'warning' as const, params_json: { min_clearance_mm: 50 } },
            { rule_key: 'ERG-001', category: 'ergonomics' as const, severity: 'warning' as const, params_json: { min_dist_from_worktop_mm: 450, standard_worktop_height_mm: 870 } },
            { rule_key: 'ERG-002', category: 'ergonomics' as const, severity: 'error' as const, params_json: {} },
            { rule_key: 'ERG-003', category: 'ergonomics' as const, severity: 'hint' as const, params_json: { standard_worktop_height_mm: 870, height_tolerance_mm: 20 } },
            { rule_key: 'COMP-001', category: 'completeness' as const, severity: 'warning' as const, params_json: {} },
            { rule_key: 'COMP-002', category: 'completeness' as const, severity: 'hint' as const, params_json: {} },
            { rule_key: 'COMP-003', category: 'completeness' as const, severity: 'hint' as const, params_json: {} },
            { rule_key: 'COMP-004', category: 'completeness' as const, severity: 'warning' as const, params_json: {} },
            { rule_key: 'COMP-005', category: 'completeness' as const, severity: 'hint' as const, params_json: {} },
            { rule_key: 'COMP-006', category: 'completeness' as const, severity: 'hint' as const, params_json: {} },
            { rule_key: 'ACC-001', category: 'accessory' as const, severity: 'hint' as const, params_json: {} },
        ]
        for (const d of defaults) {
            await prisma.ruleDefinition.upsert({ where: { rule_key: d.rule_key }, update: d, create: { ...d, enabled: true } })
        }
        return { seeded: defaults.length }
    },
}
