import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseEgiContent, parseEgiNumber } from './egiParser.js'

async function readFixture(name: string): Promise<string> {
  const path = join(process.cwd(), 'src', 'services', 'surveyImport', '__fixtures__', name)
  return readFile(path, 'utf8')
}

describe('parseEgiContent', () => {
  it('reads GLOBAL, Wall, Window, Door, Hindrance and CS_Installation sections', async () => {
    const fixture = await readFixture('sample-basic.egi')
    const parsed = parseEgiContent(fixture)

    expect(parsed.grouped.global).toHaveLength(1)
    expect(parsed.grouped.wall).toHaveLength(4)
    expect(parsed.grouped.window).toHaveLength(1)
    expect(parsed.grouped.door).toHaveLength(1)
    expect(parsed.grouped.hindrance).toHaveLength(1)
    expect(parsed.grouped.cs_installation).toHaveLength(1)
  })

  it('reads Roof, Recess and Radiator sections', async () => {
    const fixture = await readFixture('sample-roof-recess-radiator.egi')
    const parsed = parseEgiContent(fixture)

    expect(parsed.grouped.roof).toHaveLength(1)
    expect(parsed.grouped.recess).toHaveLength(1)
    expect(parsed.grouped.radiator).toHaveLength(1)
  })

  it('supports section headers without brackets', () => {
    const parsed = parseEgiContent('GLOBAL\nRoomheight=2500\nWall_1\nWidth=1000\nRefPntX=0\nRefPntY=0\nAngleZ=0')
    expect(parsed.grouped.global).toHaveLength(1)
    expect(parsed.grouped.wall).toHaveLength(1)
  })

  it('captures parser warnings for unknown lines', () => {
    const parsed = parseEgiContent('[GLOBAL]\nRoomheight=2400\nthis is unknown line')
    expect(parsed.warnings.some((warning) => warning.includes('Unbekannte Zeile'))).toBe(true)
  })
})

describe('parseEgiNumber', () => {
  it('parses decimal and comma-based numeric strings robustly', () => {
    expect(parseEgiNumber('2490,5')).toBe(2490.5)
    expect(parseEgiNumber('35.25')).toBe(35.25)
    expect(parseEgiNumber('Width=1200')).toBe(1200)
  })

  it('returns null for non-numeric values', () => {
    expect(parseEgiNumber('abc')).toBeNull()
    expect(parseEgiNumber(undefined)).toBeNull()
  })
})
