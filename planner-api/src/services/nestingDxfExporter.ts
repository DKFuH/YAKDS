import type { NestingResult } from './nestingService.js'

function addRect(lines: string[], layer: string, x: number, y: number, width: number, height: number) {
  lines.push(
    '0',
    'LWPOLYLINE',
    '8',
    layer,
    '90',
    '4',
    '70',
    '1',
    '10',
    String(Math.round(x)),
    '20',
    String(Math.round(y)),
    '10',
    String(Math.round(x + width)),
    '20',
    String(Math.round(y)),
    '10',
    String(Math.round(x + width)),
    '20',
    String(Math.round(y + height)),
    '10',
    String(Math.round(x)),
    '20',
    String(Math.round(y + height)),
  )
}

function addText(lines: string[], layer: string, x: number, y: number, value: string) {
  lines.push(
    '0',
    'TEXT',
    '8',
    layer,
    '10',
    String(Math.round(x)),
    '20',
    String(Math.round(y)),
    '30',
    '0',
    '40',
    '40',
    '1',
    value,
  )
}

export function buildNestingDxf(result: NestingResult): Buffer {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1015',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    '3',
    '0', 'LAYER', '2', 'SHEET_BORDER', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'CUT_PARTS', '70', '0', '62', '2', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'LABELS', '70', '0', '62', '3', '6', 'CONTINUOUS',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ]

  let baseY = 0
  for (const sheet of result.sheets) {
    addRect(lines, 'SHEET_BORDER', 0, baseY, sheet.width_mm, sheet.height_mm)
    addText(lines, 'LABELS', 20, baseY + 60, `Sheet ${sheet.index}`)

    for (const placement of sheet.placements) {
      const px = placement.x_mm
      const py = baseY + placement.y_mm
      addRect(lines, 'CUT_PARTS', px, py, placement.width_mm, placement.height_mm)
      addText(
        lines,
        'LABELS',
        px + 10,
        py + 50,
        `${placement.part_id} ${placement.width_mm}x${placement.height_mm}${placement.rotated ? ' R' : ''}`,
      )
    }

    baseY += sheet.height_mm + 200
  }

  lines.push('0', 'ENDSEC', '0', 'EOF')
  return Buffer.from(lines.join('\n'), 'utf-8')
}
