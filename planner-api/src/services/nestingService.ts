export interface NestingPart {
  id: string
  label: string
  width_mm: number
  height_mm: number
  material_key: string
  quantity: number
}

export interface NestingSheetPlacement {
  part_id: string
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
  rotated: boolean
}

export interface NestingSheet {
  index: number
  width_mm: number
  height_mm: number
  used_area_mm2: number
  waste_area_mm2: number
  placements: NestingSheetPlacement[]
}

export interface NestingResult {
  sheets: NestingSheet[]
  total_parts: number
  placed_parts: number
  waste_pct: number
}

export class OversizedPartError extends Error {
  readonly part_id: string

  constructor(partId: string, message: string) {
    super(message)
    this.name = 'OversizedPartError'
    this.part_id = partId
  }
}

type NestingOptions = {
  sheet_width_mm: number
  sheet_height_mm: number
  kerf_mm: number
  allow_rotate: boolean
}

type ExpandedPart = {
  part_id: string
  width_mm: number
  height_mm: number
  material_key: string
  area_mm2: number
}

type CandidatePoint = { x_mm: number; y_mm: number }

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : fallback
}

function toExpandedParts(parts: NestingPart[]): ExpandedPart[] {
  const expanded: ExpandedPart[] = []

  for (const part of parts) {
    const quantity = normalizePositiveInt(part.quantity, 1)
    const width = normalizePositiveInt(part.width_mm, 0)
    const height = normalizePositiveInt(part.height_mm, 0)

    for (let i = 0; i < quantity; i += 1) {
      expanded.push({
        part_id: part.id,
        material_key: part.material_key,
        width_mm: width,
        height_mm: height,
        area_mm2: width * height,
      })
    }
  }

  return expanded
}

function placementsOverlapWithKerf(
  a: { x_mm: number; y_mm: number; width_mm: number; height_mm: number },
  b: { x_mm: number; y_mm: number; width_mm: number; height_mm: number },
  kerfMm: number,
) {
  return (
    a.x_mm < b.x_mm + b.width_mm + kerfMm
    && a.x_mm + a.width_mm + kerfMm > b.x_mm
    && a.y_mm < b.y_mm + b.height_mm + kerfMm
    && a.y_mm + a.height_mm + kerfMm > b.y_mm
  )
}

function canPlaceOnSheet(
  sheet: NestingSheet,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  kerfMm: number,
): boolean {
  if (xMm + widthMm > sheet.width_mm || yMm + heightMm > sheet.height_mm) {
    return false
  }

  const probe = { x_mm: xMm, y_mm: yMm, width_mm: widthMm, height_mm: heightMm }
  return !sheet.placements.some((placed) => placementsOverlapWithKerf(probe, placed, kerfMm))
}

function finalizeSheetMetrics(sheet: NestingSheet) {
  sheet.used_area_mm2 = sheet.placements.reduce((sum, placement) => sum + placement.width_mm * placement.height_mm, 0)
  sheet.waste_area_mm2 = sheet.width_mm * sheet.height_mm - sheet.used_area_mm2
}

function createSheet(index: number, options: NestingOptions): NestingSheet {
  return {
    index,
    width_mm: options.sheet_width_mm,
    height_mm: options.sheet_height_mm,
    placements: [],
    used_area_mm2: 0,
    waste_area_mm2: options.sheet_width_mm * options.sheet_height_mm,
  }
}

export function nestCutlistParts(parts: NestingPart[], options: NestingOptions): NestingResult {
  const sheetWidth = normalizePositiveInt(options.sheet_width_mm, 0)
  const sheetHeight = normalizePositiveInt(options.sheet_height_mm, 0)
  const kerfMm = Math.max(0, Math.round(options.kerf_mm))

  if (!sheetWidth || !sheetHeight) {
    throw new Error('Invalid sheet dimensions')
  }

  const expanded = toExpandedParts(parts)
  const materialKeys = [...new Set(expanded.map((part) => part.material_key || 'UNBEKANNT'))].sort((a, b) => a.localeCompare(b))

  const allSheets: NestingSheet[] = []

  for (const materialKey of materialKeys) {
    const materialParts = expanded
      .filter((part) => (part.material_key || 'UNBEKANNT') === materialKey)
      .sort((left, right) => {
        if (right.area_mm2 !== left.area_mm2) return right.area_mm2 - left.area_mm2
        if (right.width_mm !== left.width_mm) return right.width_mm - left.width_mm
        if (right.height_mm !== left.height_mm) return right.height_mm - left.height_mm
        return left.part_id.localeCompare(right.part_id)
      })

    const materialSheets: NestingSheet[] = []
    const candidatesBySheet = new Map<number, CandidatePoint[]>()

    for (const part of materialParts) {
      const canFitNormal = part.width_mm <= sheetWidth && part.height_mm <= sheetHeight
      const canFitRotated = options.allow_rotate && part.height_mm <= sheetWidth && part.width_mm <= sheetHeight
      if (!canFitNormal && !canFitRotated) {
        throw new OversizedPartError(
          part.part_id,
          `Part ${part.part_id} (${part.width_mm}x${part.height_mm}) exceeds sheet ${sheetWidth}x${sheetHeight}`,
        )
      }

      const orientations = [
        { width_mm: part.width_mm, height_mm: part.height_mm, rotated: false },
      ]

      if (
        options.allow_rotate
        && part.width_mm !== part.height_mm
        && (part.height_mm !== part.width_mm || part.width_mm !== part.height_mm)
      ) {
        orientations.push({ width_mm: part.height_mm, height_mm: part.width_mm, rotated: true })
      }

      let placed = false
      for (const sheet of materialSheets) {
        const candidates = candidatesBySheet.get(sheet.index) ?? [{ x_mm: 0, y_mm: 0 }]
        candidates.sort((a, b) => (a.y_mm - b.y_mm) || (a.x_mm - b.x_mm))

        for (const candidate of candidates) {
          for (const orientation of orientations) {
            if (!canPlaceOnSheet(sheet, candidate.x_mm, candidate.y_mm, orientation.width_mm, orientation.height_mm, kerfMm)) {
              continue
            }

            sheet.placements.push({
              part_id: part.part_id,
              x_mm: candidate.x_mm,
              y_mm: candidate.y_mm,
              width_mm: orientation.width_mm,
              height_mm: orientation.height_mm,
              rotated: orientation.rotated,
            })

            candidates.push(
              { x_mm: candidate.x_mm + orientation.width_mm + kerfMm, y_mm: candidate.y_mm },
              { x_mm: candidate.x_mm, y_mm: candidate.y_mm + orientation.height_mm + kerfMm },
            )

            finalizeSheetMetrics(sheet)
            placed = true
            break
          }

          if (placed) break
        }

        if (placed) break
      }

      if (!placed) {
        const newSheet = createSheet(materialSheets.length + 1 + allSheets.length, {
          sheet_width_mm: sheetWidth,
          sheet_height_mm: sheetHeight,
          kerf_mm: kerfMm,
          allow_rotate: options.allow_rotate,
        })

        const candidates: CandidatePoint[] = [{ x_mm: 0, y_mm: 0 }]
        candidatesBySheet.set(newSheet.index, candidates)

        let placedOnNewSheet = false
        for (const orientation of orientations) {
          if (!canPlaceOnSheet(newSheet, 0, 0, orientation.width_mm, orientation.height_mm, kerfMm)) {
            continue
          }

          newSheet.placements.push({
            part_id: part.part_id,
            x_mm: 0,
            y_mm: 0,
            width_mm: orientation.width_mm,
            height_mm: orientation.height_mm,
            rotated: orientation.rotated,
          })

          candidates.push(
            { x_mm: orientation.width_mm + kerfMm, y_mm: 0 },
            { x_mm: 0, y_mm: orientation.height_mm + kerfMm },
          )

          finalizeSheetMetrics(newSheet)
          placedOnNewSheet = true
          break
        }

        if (!placedOnNewSheet) {
          throw new OversizedPartError(
            part.part_id,
            `Part ${part.part_id} (${part.width_mm}x${part.height_mm}) exceeds sheet ${sheetWidth}x${sheetHeight}`,
          )
        }

        materialSheets.push(newSheet)
      }
    }

    allSheets.push(...materialSheets)
  }

  const placedParts = allSheets.reduce((sum, sheet) => sum + sheet.placements.length, 0)
  const totalParts = expanded.length
  const totalSheetArea = allSheets.reduce((sum, sheet) => sum + sheet.width_mm * sheet.height_mm, 0)
  const totalWasteArea = allSheets.reduce((sum, sheet) => sum + sheet.waste_area_mm2, 0)

  const wastePct = totalSheetArea === 0
    ? 0
    : Math.round((totalWasteArea / totalSheetArea) * 10000) / 100

  return {
    sheets: allSheets,
    total_parts: totalParts,
    placed_parts: placedParts,
    waste_pct: wastePct,
  }
}
