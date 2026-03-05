import { describe, expect, it } from 'vitest'
import {
  computeSplitCaptureLayout,
  DEFAULT_SCREENSHOT_OPTIONS,
  normalizeScreenshotOptions,
  pickCanvasTargets,
  type CanvasSnapshot,
} from './screenshotCapture.js'

function snapshot(left: number, top: number, width: number, height: number): CanvasSnapshot {
  return {
    canvas: {} as HTMLCanvasElement,
    left,
    top,
    width,
    height,
  }
}

describe('screenshotCapture', () => {
  it('normalizes options with defaults', () => {
    const normalized = normalizeScreenshotOptions({})
    expect(normalized).toEqual(DEFAULT_SCREENSHOT_OPTIONS)
  })

  it('clamps width, height, and quality ranges', () => {
    const normalized = normalizeScreenshotOptions({
      width_px: 99999,
      height_px: 12,
      quality: 1.7,
    })

    expect(normalized.width_px).toBe(8192)
    expect(normalized.height_px).toBe(256)
    expect(normalized.quality).toBe(1)
  })

  it('picks single largest canvas in non-split modes', () => {
    const targets = pickCanvasTargets([
      snapshot(0, 0, 640, 480),
      snapshot(10, 10, 1200, 700),
      snapshot(20, 20, 800, 800),
    ], '3d')

    expect(targets).toHaveLength(1)
    expect(targets[0].width).toBe(1200)
    expect(targets[0].height).toBe(700)
  })

  it('picks two left-to-right canvases in split mode', () => {
    const targets = pickCanvasTargets([
      snapshot(620, 0, 640, 480),
      snapshot(0, 0, 600, 480),
      snapshot(1280, 0, 320, 200),
    ], 'split')

    expect(targets).toHaveLength(2)
    expect(targets[0].left).toBe(0)
    expect(targets[1].left).toBe(620)
  })

  it('computes split layout dimensions and offsets', () => {
    const layout = computeSplitCaptureLayout([
      snapshot(120, 40, 600, 400),
      snapshot(760, 80, 620, 420),
    ])

    expect(layout.width).toBe(1260)
    expect(layout.height).toBe(460)
    expect(layout.items[0].offsetLeft).toBe(0)
    expect(layout.items[0].offsetTop).toBe(0)
    expect(layout.items[1].offsetLeft).toBe(640)
    expect(layout.items[1].offsetTop).toBe(40)
  })

  it('returns one target in split mode when only one canvas exists', () => {
    const targets = pickCanvasTargets([snapshot(0, 0, 500, 300)], 'split')
    expect(targets).toHaveLength(1)
  })
})
