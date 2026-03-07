import { useEffect, useRef, useState } from 'react'
import { mediaCaptureApi } from '../api/mediaCapture.js'
import {
  DEFAULT_SCREENSHOT_OPTIONS,
  captureScreenshotFromRoot,
  normalizeScreenshotOptions,
  type ScreenshotOptions,
} from '../components/editor/screenshotCapture.js'
import styles from './CaptureDialogHarnessPage.module.css'

type HarnessScreenshotResult = {
  filename: string
}

type HarnessExportCreateResult = {
  job_id: string
}

type HarnessExportStatusResult = {
  status: 'queued' | 'assigned' | 'running' | 'done' | 'failed'
  error_message: string | null
  download_url: string | null
}

type E2eMediaMock = {
  screenshotResult?: HarnessScreenshotResult
  exportCreateResult?: HarnessExportCreateResult
  exportStatusQueue?: HarnessExportStatusResult[]
}

declare global {
  interface Window {
    __OKP_E2E_MEDIA_MOCK__?: E2eMediaMock
  }
}

const PROJECT_ID = '11111111-1111-1111-1111-111111111111'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = '#f4efe6'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#8d5524'
    context.fillRect(24, 28, 180, 100)
    context.fillStyle = '#2a9d8f'
    context.fillRect(224, 56, 110, 44)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={180}
      data-testid="capture-canvas"
      className={styles.captureCanvas}
    />
  )
}

export function CaptureDialogHarnessPage() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(true)
  const [screenshotOptions, setScreenshotOptions] = useState<ScreenshotOptions>(DEFAULT_SCREENSHOT_OPTIONS)
  const [screenshotBusy, setScreenshotBusy] = useState(false)
  const [export360Busy, setExport360Busy] = useState(false)
  const [screenshotError, setScreenshotError] = useState(false)
  const [screenshotMessage, setScreenshotMessage] = useState<string | null>(null)
  const [export360Status, setExport360Status] = useState<string | null>(null)

  const captureRootRef = useRef<HTMLDivElement | null>(null)

  async function handleCaptureScreenshot() {
    const captureRoot = captureRootRef.current
    if (!captureRoot) {
      setScreenshotError(true)
      setScreenshotMessage('Screenshot fehlgeschlagen: kein aktiver Viewport gefunden')
      return
    }

    setScreenshotBusy(true)
    setScreenshotError(false)
    setScreenshotMessage(null)

    try {
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const capture = captureScreenshotFromRoot(captureRoot, '3d', normalizedOptions)
      const extension = normalizedOptions.format === 'jpeg' ? 'jpg' : 'png'
      const mockScreenshot = window.__OKP_E2E_MEDIA_MOCK__?.screenshotResult

      if (mockScreenshot) {
        setScreenshotMessage(`Screenshot gespeichert: ${mockScreenshot.filename}`)
        return
      }

      const result = await mediaCaptureApi.uploadScreenshot(PROJECT_ID, {
        ...capture,
        filename: `harness-screenshot-${Date.now()}.${extension}`,
        view_mode: '3d',
        transparent_background: normalizedOptions.transparent_background,
        uploaded_by: 'capture-harness',
      })

      setScreenshotMessage(`Screenshot gespeichert: ${result.filename}`)
    } catch (captureError) {
      setScreenshotError(true)
      setScreenshotMessage(`Screenshot fehlgeschlagen: ${String(captureError)}`)
    } finally {
      setScreenshotBusy(false)
    }
  }

  async function handleStartExport360() {
    setExport360Busy(true)
    setScreenshotError(false)
    setExport360Status('360-Export wird gestartet...')

    try {
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const mock = window.__OKP_E2E_MEDIA_MOCK__
      const request = mock?.exportCreateResult
        ? mock.exportCreateResult
        : await mediaCaptureApi.createExport360(PROJECT_ID, {
            format: normalizedOptions.format,
            quality: normalizedOptions.quality,
            width_px: normalizedOptions.width_px ?? 4096,
            height_px: normalizedOptions.height_px ?? 2048,
          })

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const status = mock?.exportStatusQueue
          ? mock.exportStatusQueue.shift() ?? {
              status: 'failed',
              error_message: 'E2E mock export status queue exhausted',
              download_url: null,
            }
          : await mediaCaptureApi.getExport360Status(PROJECT_ID, request.job_id)
        setExport360Status(`360-Status: ${status.status}`)

        if (status.status === 'done') {
          if (status.download_url) {
            window.open(status.download_url, '_blank', 'noopener,noreferrer')
            setScreenshotMessage('360-Export abgeschlossen und geoeffnet')
          } else {
            setScreenshotMessage('360-Export abgeschlossen (kein Download-Link)')
          }
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error_message ?? '360-Export fehlgeschlagen')
        }

        await delay(50)
      }

      throw new Error('360-Export laeuft noch. Bitte spaeter erneut pruefen.')
    } catch (exportError) {
      setScreenshotError(true)
      setScreenshotMessage(`360-Export fehlgeschlagen: ${String(exportError)}`)
    } finally {
      setExport360Busy(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1>Capture Dialog E2E Harness</h1>

      <div className={styles.controls}>
        <button type="button" data-testid="toggle-capture-dialog" onClick={() => setPanelOpen((value) => !value)}>
          Capture
        </button>
        <button type="button" data-testid="toggle-preview-viewport" onClick={() => setPreviewVisible((value) => !value)}>
          {previewVisible ? 'Viewport ausblenden' : 'Viewport einblenden'}
        </button>
      </div>

      {previewVisible && (
        <div ref={captureRootRef} data-testid="capture-root" className={styles.captureRoot}>
          <PreviewCanvas />
        </div>
      )}

      {panelOpen && (
        <section data-testid="capture-dialog" className={styles.dialog}>
          <label>
            <span>Format </span>
            <select
              data-testid="capture-format"
              value={screenshotOptions.format}
              onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                ...screenshotOptions,
                format: event.target.value === 'jpeg' ? 'jpeg' : 'png',
              }))}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </label>

          <label>
            <span>Qualitaet </span>
            <input
              data-testid="capture-quality"
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={screenshotOptions.quality}
              onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                ...screenshotOptions,
                quality: Number(event.target.value),
              }))}
            />
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              data-testid="capture-screenshot"
              onClick={() => {
                void handleCaptureScreenshot()
              }}
              disabled={screenshotBusy}
            >
              {screenshotBusy ? 'Screenshot...' : 'Screenshot'}
            </button>
            <button
              type="button"
              data-testid="capture-export360"
              onClick={() => {
                void handleStartExport360()
              }}
              disabled={export360Busy}
            >
              {export360Busy ? '360...' : '360 Export'}
            </button>
          </div>

          {export360Status && <p className={styles.statusLine} data-testid="capture-export-status">{export360Status}</p>}
          {screenshotMessage && <p className={styles.statusLine} data-testid="capture-message" data-error={screenshotError ? 'true' : 'false'}>{screenshotMessage}</p>}
        </section>
      )}
    </main>
  )
}
