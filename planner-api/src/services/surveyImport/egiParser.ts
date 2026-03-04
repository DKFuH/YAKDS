export type EgiSectionType =
  | 'global'
  | 'wall'
  | 'window'
  | 'door'
  | 'roof'
  | 'recess'
  | 'radiator'
  | 'hindrance'
  | 'cs_installation'
  | 'unknown'

export type EgiSection = {
  name: string
  type: EgiSectionType
  index: number
  fields: Record<string, string>
}

export type ParsedEgiFile = {
  sections: EgiSection[]
  grouped: Record<EgiSectionType, EgiSection[]>
  warnings: string[]
}

function createGrouped(): Record<EgiSectionType, EgiSection[]> {
  return {
    global: [],
    wall: [],
    window: [],
    door: [],
    roof: [],
    recess: [],
    radiator: [],
    hindrance: [],
    cs_installation: [],
    unknown: [],
  }
}

function normalizeSectionName(value: string): string {
  return value.trim().replace(/\s+/g, '_')
}

function resolveSectionType(name: string): EgiSectionType {
  const normalized = name.trim().toLowerCase()
  if (normalized === 'global') return 'global'
  if (normalized === 'wall' || normalized.startsWith('wall_')) return 'wall'
  if (normalized === 'window' || normalized.startsWith('window_')) return 'window'
  if (normalized === 'door' || normalized.startsWith('door_')) return 'door'
  if (normalized === 'roof' || normalized.startsWith('roof_')) return 'roof'
  if (normalized === 'recess' || normalized.startsWith('recess_')) return 'recess'
  if (normalized === 'radiator' || normalized.startsWith('radiator_')) return 'radiator'
  if (normalized === 'hindrance' || normalized.startsWith('hindrance_')) return 'hindrance'
  if (
    normalized === 'cs_installation'
    || normalized.startsWith('cs_installation_')
    || normalized.startsWith('csinstallation_')
  ) {
    return 'cs_installation'
  }
  return 'unknown'
}

function trySectionHeader(line: string): string | null {
  const bracketMatch = line.match(/^\[([^\]]+)\]$/)
  if (bracketMatch) {
    return normalizeSectionName(bracketMatch[1] ?? '')
  }

  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(line)) {
    const asName = normalizeSectionName(line)
    const resolvedType = resolveSectionType(asName)
    if (resolvedType !== 'unknown') {
      return asName
    }
  }

  return null
}

export function parseEgiNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const cleaned = value.trim().replace(',', '.')
  if (cleaned.length === 0) {
    return null
  }

  const match = cleaned.match(/[+-]?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }

  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function parseEgiContent(content: string): ParsedEgiFile {
  const sections: EgiSection[] = []
  const warnings: string[] = []

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  let currentSection: EgiSection | null = null

  const openSection = (sectionName: string) => {
    const nextSection: EgiSection = {
      name: sectionName,
      type: resolveSectionType(sectionName),
      index: sections.length,
      fields: {},
    }
    sections.push(nextSection)
    currentSection = nextSection
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (line.startsWith(';') || line.startsWith('#') || line.startsWith('//')) continue

    const sectionHeader = trySectionHeader(line)
    if (sectionHeader) {
      openSection(sectionHeader)
      continue
    }

    const keyValueMatch = line.match(/^([^=:#]+?)\s*(=|:)\s*(.*)$/)
    if (keyValueMatch) {
      if (!currentSection) {
        warnings.push('Feld ohne Sektion gefunden; Werte werden unter GLOBAL gesammelt.')
        openSection('GLOBAL')
      }

      const key = keyValueMatch[1]?.trim() ?? ''
      const value = keyValueMatch[3]?.trim() ?? ''

      if (key.length > 0) {
        currentSection!.fields[key] = value
      }
      continue
    }

    warnings.push(`Unbekannte Zeile ignoriert: ${line}`)
  }

  const grouped = createGrouped()
  for (const section of sections) {
    grouped[section.type].push(section)
  }

  return {
    sections,
    grouped,
    warnings,
  }
}
