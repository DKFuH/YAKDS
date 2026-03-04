import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mapEgi } from './egiMapper.js'
import { parseEgiContent } from './egiParser.js'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__')

async function readFixture(name: string): Promise<string> {
  const path = join(fixtureDir, name)
  return readFile(path, 'utf8')
}

describe('mapEgi', () => {
  it('maps summary counts from fixture data', async () => {
    const fixture = await readFixture('sample-basic.egi')
    const result = mapEgi(parseEgiContent(fixture))

    expect(result.summary).toEqual({
      walls: 4,
      roofs: 0,
      windows: 1,
      doors: 1,
      hindrances: 1,
      installations: 1,
    })
  })

  it('resolves WallRefNo to wall indexes for openings', async () => {
    const fixture = await readFixture('sample-basic.egi')
    const result = mapEgi(parseEgiContent(fixture))

    const window = result.mapped.openings.find((entry) => entry.kind === 'window')
    const door = result.mapped.openings.find((entry) => entry.kind === 'door')

    expect(window?.wall_ref_no).toBe(2)
    expect(window?.wall_index).toBe(1)
    expect(door?.wall_ref_no).toBe(1)
    expect(door?.wall_index).toBe(0)
  })

  it('imports Roof sections as roof constraints', async () => {
    const fixture = await readFixture('sample-roof-recess-radiator.egi')
    const result = mapEgi(parseEgiContent(fixture))

    expect(result.mapped.roofs).toHaveLength(1)
    expect(result.mapped.roofs[0]?.kind).toBe('roof_slope')
    expect(result.summary.roofs).toBe(1)
  })

  it('warns for unknown CS_Installation type but keeps import usable', async () => {
    const fixture = await readFixture('sample-roof-recess-radiator.egi')
    const result = mapEgi(parseEgiContent(fixture))

    expect(result.usable).toBe(true)
    expect(result.warnings.some((warning) => warning.code === 'INSTALLATION_TYPE_UNKNOWN')).toBe(true)
    expect(result.mapped.installations[0]?.category).toBe('custom')
  })

  it('marks structurally empty files as unusable', () => {
    const result = mapEgi(parseEgiContent('[GLOBAL]\nRoomheight=2500'))
    expect(result.usable).toBe(false)
  })

  it('parses Roomheight from numeric strings with comma decimals', async () => {
    const fixture = await readFixture('sample-roof-recess-radiator.egi')
    const result = mapEgi(parseEgiContent(fixture))
    expect(result.preview.room_height_mm).toBe(2490.5)
  })
})
