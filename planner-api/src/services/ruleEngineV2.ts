/**
 * ruleEngineV2.ts – Sprint 22 / TASK-22-A01
 * "Protect"-Framework: konfigurierbarer Regelkatalog + Persistenz
 */
import { segmentsIntersect, pointInPolygon } from '@yakds/shared-schemas'
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

/** A wall segment with resolved 2D start/end coordinates for footprint computation. */
export interface WallDef {
    id: string
    start: { x_mm: number; y_mm: number }
    end: { x_mm: number; y_mm: number }
}

export interface ProjectSnapshot {
    project_id: string
    room_id: string
    placements: PlacedObjectV2[]
    worktop_items: { id: string; qty: number }[]
    plinth_items: { id: string; qty: number }[]
    ceiling_height_mm: number
    min_clearance_mm: number
    /** Optional wall geometry used for cross-wall (corner) collision detection. */
    walls?: WallDef[]
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

// ─── Footprint helpers ────────────────────────────────────────────

type Point2D = { x_mm: number; y_mm: number }

/**
 * Compute the 2D floor-plan footprint of a cabinet placed on a wall.
 * The cabinet's footprint is a rectangle:
 *   - along the wall: from offset_mm to offset_mm + width_mm
 *   - perpendicular (into the room): depth_mm
 * The inward direction (into the room) is the left-perpendicular of the wall
 * direction (assumes CCW room polygon winding; correct for typical plans).
 * Returns null when the wall is not found or has zero length.
 */
function getCabinetFootprint(p: PlacedObjectV2, walls: WallDef[]): Point2D[] | null {
    const wall = walls.find((w) => w.id === p.wall_id)
    if (!wall) return null

    const dx = wall.end.x_mm - wall.start.x_mm
    const dy = wall.end.y_mm - wall.start.y_mm
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) return null

    const ux = dx / len  // unit vector along wall
    const uy = dy / len
    const nx = -uy  // inward normal (left perpendicular, CCW polygon)
    const ny = ux

    // Four corners of the footprint rectangle
    const x0 = wall.start.x_mm + ux * p.offset_mm
    const y0 = wall.start.y_mm + uy * p.offset_mm
    const x1 = x0 + ux * p.width_mm
    const y1 = y0 + uy * p.width_mm

    return [
        { x_mm: x0, y_mm: y0 },
        { x_mm: x1, y_mm: y1 },
        { x_mm: x1 + nx * p.depth_mm, y_mm: y1 + ny * p.depth_mm },
        { x_mm: x0 + nx * p.depth_mm, y_mm: y0 + ny * p.depth_mm },
    ]
}

/**
 * Returns true when polygon A and polygon B intersect (edge-crossing or containment).
 * Uses the segmentsIntersect / pointInPolygon helpers from shared-schemas.
 */
function polygonsIntersect(a: Point2D[], b: Point2D[]): boolean {
    // Check all edge pairs for intersection
    for (let i = 0; i < a.length; i++) {
        const a1 = a[i]
        const a2 = a[(i + 1) % a.length]
        for (let j = 0; j < b.length; j++) {
            const b1 = b[j]
            const b2 = b[(j + 1) % b.length]
            if (segmentsIntersect(a1, a2, b1, b2)) return true
        }
    }
    // Check containment (one polygon fully inside the other)
    if (a.length > 0 && pointInPolygon(a[0], b)) return true
    if (b.length > 0 && pointInPolygon(b[0], a)) return true
    return false
}

// ─── Regelimplementierungen ───────────────────────────────────────

const rules: Record<string, RuleHandler> = {
    'COLL-001': (s) => {
        const out: ViolationInput[] = []
        const bases = s.placements.filter((p) => p.type === 'base' || p.type === 'tall')
        for (let i = 0; i < bases.length; i++) {
            for (let j = i + 1; j < bases.length; j++) {
                const a = bases[i], b = bases[j]
                if (a.wall_id === b.wall_id) {
                    // Same-wall: fast 1-D overlap check
                    if (a.offset_mm < b.offset_mm + b.width_mm && a.offset_mm + a.width_mm > b.offset_mm) {
                        out.push({ rule_key: 'COLL-001', severity: 'error', entity_refs: [a.id, b.id], message: `Schrank ${a.id} und ${b.id} überlappen.` })
                    }
                } else if (s.walls) {
                    // Cross-wall: 2D polygon footprint intersection (handles L/U corner cases)
                    const polyA = getCabinetFootprint(a, s.walls)
                    const polyB = getCabinetFootprint(b, s.walls)
                    if (polyA && polyB && polygonsIntersect(polyA, polyB)) {
                        out.push({ rule_key: 'COLL-001', severity: 'error', entity_refs: [a.id, b.id], message: `Schrank ${a.id} und ${b.id} überlappen (Eckbereich).` })
                    }
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
        // Group placements by wall before sorting so gaps are only checked
        // between cabinets on the SAME wall (previous code sorted across all
        // walls which caused same-wall gaps to be skipped).
        const byWall = new Map<string, PlacedObjectV2[]>()
        for (const pl of s.placements) {
            const existing = byWall.get(pl.wall_id) ?? []
            existing.push(pl)
            byWall.set(pl.wall_id, existing)
        }
        for (const wallPlacements of byWall.values()) {
            const sorted = [...wallPlacements].sort((a, b) => a.offset_mm - b.offset_mm)
            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1], curr = sorted[i]
                const gap = curr.offset_mm - (prev.offset_mm + prev.width_mm)
                if (gap > 0 && gap < min) out.push({ rule_key: 'CLEAR-001', severity: 'warning', entity_refs: [prev.id, curr.id], message: `Durchgang ${gap}mm < ${min}mm.` })
            }
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
