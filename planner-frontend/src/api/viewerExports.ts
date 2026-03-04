const BASE_URL = '/api/v1'
const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

type ApiErrorBody = {
  error?: unknown
  message?: unknown
}

function formatPathParameter(value: string, parameterName: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${parameterName} ist erforderlich`)
  }
  return encodeURIComponent(normalized)
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || 'Unbekannter Fehler'

  try {
    const body = await response.json() as ApiErrorBody
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message
    }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error
    }
  } catch {
    try {
      const text = await response.text()
      if (text.trim()) {
        return text.trim()
      }
    } catch {
      return fallback
    }
  }

  return fallback
}

async function fetchExportBlob(path: string): Promise<Blob> {
  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'X-Tenant-Id': TENANT_ID_PLACEHOLDER,
      },
    })
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : ''
    throw new Error(`Export konnte nicht gestartet werden${detail}`)
  }

  if (!response.ok) {
    const detail = await extractErrorMessage(response)
    throw new Error(`Export fehlgeschlagen (${response.status}): ${detail}`)
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error('Export fehlgeschlagen: Leere Datei erhalten')
  }

  return blob
}

export function exportHtmlViewer(projectId: string): Promise<Blob> {
  const id = formatPathParameter(projectId, 'projectId')
  return fetchExportBlob(`/projects/${id}/export/html-viewer`)
}

export function exportPlanSvg(projectId: string): Promise<Blob> {
  const id = formatPathParameter(projectId, 'projectId')
  return fetchExportBlob(`/projects/${id}/export/plan-svg`)
}

export function exportLayoutSheetSvg(sheetId: string): Promise<Blob> {
  const id = formatPathParameter(sheetId, 'sheetId')
  return fetchExportBlob(`/layout-sheets/${id}/export/svg`)
}