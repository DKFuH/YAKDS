import { api } from './client.js'

const BASE_URL = '/api/v1'

type ApiError = { error: string; message: string }

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  if (!match || !match[1]) return fallback

  try {
    return decodeURIComponent(match[1].replace(/\"/g, '').trim())
  } catch {
    return match[1].replace(/\"/g, '').trim() || fallback
  }
}

export interface SpecificationPackage {
  id: string
  tenant_id: string
  project_id: string
  name: string
  config_json: {
    sections?: string[]
    include_cover_page?: boolean
    include_company_profile?: boolean
  }
  generated_at: string | null
  artifact_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SpecificationGenerateResult {
  id: string
  generated_at: string
  sections: Array<{ key: string; title: string; page_count: number; artifact_type: string }>
}

export const specificationPackagesApi = {
  list: (projectId: string) => api.get<SpecificationPackage[]>(`/projects/${projectId}/specification-packages`),

  create: (projectId: string, payload: { name: string; config_json?: SpecificationPackage['config_json'] }) =>
    api.post<SpecificationPackage>(`/projects/${projectId}/specification-packages`, payload),

  generate: (id: string) => api.post<SpecificationGenerateResult>(`/specification-packages/${id}/generate`, {}),

  remove: (id: string) => api.delete(`/specification-packages/${id}`),

  download: async (id: string): Promise<void> => {
    const response = await fetch(`${BASE_URL}/specification-packages/${id}/download`)
    if (!response.ok) {
      const err: ApiError = await response
        .json()
        .catch(() => ({ error: 'UNKNOWN', message: response.statusText }))
      throw new Error(err.message)
    }

    const blob = await response.blob()
    const filename = parseFilename(response.headers.get('content-disposition'), `specification-package-${id}.pdf`)

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
