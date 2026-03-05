import type { ScreenshotFormat } from '../../api/mediaCapture.js'

export type ScreenshotViewMode = '2d' | '3d' | 'split' | 'presentation'

export interface ScreenshotOptions {
  format: ScreenshotFormat
  width_px: number | null
  height_px: number | null
  quality: number
  transparent_background: boolean
}

export interface CanvasSnapshot {
  canvas: HTMLCanvasElement
  left: number
  top: number
  width: number
  height: number
}

export interface SplitCaptureLayout {
  width: number
  height: number
  minLeft: number
  minTop: number
  items: Array<CanvasSnapshot & { offsetLeft: number; offsetTop: number }>
}

export const DEFAULT_SCREENSHOT_OPTIONS: ScreenshotOptions = {
  format: 'png',
  width_px: null,
  height_px: null,
  quality: 0.92,
  transparent_background: false,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeScreenshotOptions(next: Partial<ScreenshotOptions>): ScreenshotOptions {
  const width = typeof next.width_px === 'number' && Number.isFinite(next.width_px)
    ? Math.round(clamp(next.width_px, 256, 8192))
    : null
  const height = typeof next.height_px === 'number' && Number.isFinite(next.height_px)
    ? Math.round(clamp(next.height_px, 256, 8192))
    : null
  const quality = typeof next.quality === 'number' && Number.isFinite(next.quality)
    ? Math.round(clamp(next.quality, 0.1, 1) * 100) / 100
    : DEFAULT_SCREENSHOT_OPTIONS.quality

  return {
    format: next.format === 'jpeg' ? 'jpeg' : 'png',
    width_px: width,
    height_px: height,
    quality,
    transparent_background: next.transparent_background === true,
  }
}

function sortSnapshotsByAreaDesc(snapshots: CanvasSnapshot[]): CanvasSnapshot[] {
  return [...snapshots].sort((left, right) => (right.width * right.height) - (left.width * left.height))
}

export function pickCanvasTargets(snapshots: CanvasSnapshot[], mode: ScreenshotViewMode): CanvasSnapshot[] {
  if (snapshots.length === 0) {
    return []
  }

  if (mode === 'split') {
    const sortedByLeft = [...snapshots].sort((a, b) => {
      if (a.left !== b.left) return a.left - b.left
      return a.top - b.top
    })

    return sortedByLeft.slice(0, Math.min(2, sortedByLeft.length))
  }

  return sortSnapshotsByAreaDesc(snapshots).slice(0, 1)
}

export function computeSplitCaptureLayout(snapshots: CanvasSnapshot[]): SplitCaptureLayout {
  const minLeft = Math.min(...snapshots.map((entry) => entry.left))
  const minTop = Math.min(...snapshots.map((entry) => entry.top))
  const maxRight = Math.max(...snapshots.map((entry) => entry.left + entry.width))
  const maxBottom = Math.max(...snapshots.map((entry) => entry.top + entry.height))

  return {
    width: Math.max(1, Math.round(maxRight - minLeft)),
    height: Math.max(1, Math.round(maxBottom - minTop)),
    minLeft,
    minTop,
    items: snapshots.map((entry) => ({
      ...entry,
      offsetLeft: Math.round(entry.left - minLeft),
      offsetTop: Math.round(entry.top - minTop),
    })),
  }
}

function collectVisibleCanvases(root: HTMLElement): CanvasSnapshot[] {
  const canvases = Array.from(root.querySelectorAll('canvas'))
  const snapshots: CanvasSnapshot[] = []

  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) {
      continue
    }

    snapshots.push({
      canvas,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }

  return snapshots
}

function extractBase64(dataUrl: string): string {
  const marker = 'base64,'
  const index = dataUrl.indexOf(marker)
  if (index < 0) {
    throw new Error('Canvas export failed: missing base64 payload')
  }

  return dataUrl.slice(index + marker.length)
}

export function captureScreenshotFromRoot(
  root: HTMLElement,
  mode: ScreenshotViewMode,
  optionsInput: Partial<ScreenshotOptions>,
): {
  image_base64: string
  mime_type: 'image/png' | 'image/jpeg'
  width_px: number
  height_px: number
} {
  const options = normalizeScreenshotOptions(optionsInput)
  const snapshots = collectVisibleCanvases(root)
  const targets = pickCanvasTargets(snapshots, mode)

  if (targets.length === 0) {
    throw new Error('Keine sichtbare Canvas-Ansicht fuer Screenshot gefunden')
  }

  const sourceWidth = mode === 'split' && targets.length > 1
    ? computeSplitCaptureLayout(targets).width
    : Math.max(1, Math.round(targets[0].width))
  const sourceHeight = mode === 'split' && targets.length > 1
    ? computeSplitCaptureLayout(targets).height
    : Math.max(1, Math.round(targets[0].height))

  const outputWidth = options.width_px ?? sourceWidth
  const outputHeight = options.height_px ?? sourceHeight

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight
  const context = outputCanvas.getContext('2d')

  if (!context) {
    throw new Error('Screenshot konnte nicht erstellt werden (2D context fehlt)')
  }

  if (options.transparent_background !== true || options.format === 'jpeg') {
    context.fillStyle = '#0F172A'
    context.fillRect(0, 0, outputWidth, outputHeight)
  } else {
    context.clearRect(0, 0, outputWidth, outputHeight)
  }

  if (mode === 'split' && targets.length > 1) {
    const layout = computeSplitCaptureLayout(targets)
    const scaleX = outputWidth / layout.width
    const scaleY = outputHeight / layout.height

    for (const entry of layout.items) {
      context.drawImage(
        entry.canvas,
        entry.offsetLeft * scaleX,
        entry.offsetTop * scaleY,
        entry.width * scaleX,
        entry.height * scaleY,
      )
    }
  } else {
    const target = targets[0]
    context.drawImage(target.canvas, 0, 0, outputWidth, outputHeight)
  }

  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const dataUrl = outputCanvas.toDataURL(mimeType, options.quality)

  return {
    image_base64: extractBase64(dataUrl),
    mime_type: mimeType,
    width_px: outputWidth,
    height_px: outputHeight,
  }
}
