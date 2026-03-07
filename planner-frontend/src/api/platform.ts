import { shouldUseDemoFallback } from './client.js'
import { getRuntimeTenantId } from './runtimeContext.js'
import { listContacts, listProjects, searchGlobal as searchGlobalDemo } from './demoBackend.js'

const BASE_URL = '/api/v1'
export interface GlobalSearchResult {
  type: 'project' | 'contact' | 'document'
  id: string
  title: string
  subtitle: string | null
  meta: string | null
  href: string
  updated_at: string
}

export interface GlobalSearchResponse {
  query: string
  results: GlobalSearchResult[]
}

async function fetchCsv(path: string): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'X-Tenant-Id': getRuntimeTenantId(),
    },
  })

  if (!response.ok) {
    throw new Error(`Export fehlgeschlagen: ${response.statusText}`)
  }

  return response.blob()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0] ?? {})
  const escape = (value: unknown) => {
    const normalized = value == null ? '' : String(value)
    if (/[",\n;]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`
    }
    return normalized
  }

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n')
}

export const platformApi = {
  search: async (query: string, type?: 'project' | 'contact' | 'document'): Promise<GlobalSearchResponse> => {
    const params = new URLSearchParams({ q: query })
    if (type) {
      params.set('type', type)
    }

    try {
      const response = await fetch(`${BASE_URL}/search?${params.toString()}`, {
        headers: { 'X-Tenant-Id': getRuntimeTenantId() },
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      return response.json() as Promise<GlobalSearchResponse>
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return searchGlobalDemo(query, type)
      }
      throw error
    }
  },
  exportProjectsCsv: async () => {
    try {
      const blob = await fetchCsv('/projects/export-csv')
      downloadBlob(blob, 'projects-export.csv')
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        const csv = buildCsv(listProjects().map((project) => ({
          id: project.id,
          name: project.name,
          project_status: project.project_status,
          priority: project.priority,
          deadline: project.deadline ?? '',
          progress_pct: project.progress_pct,
        })))
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'projects-export.csv')
        return
      }
      throw error
    }
  },
  exportContactsCsv: async () => {
    try {
      const blob = await fetchCsv('/contacts/export-csv')
      downloadBlob(blob, 'contacts-export.csv')
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        const csv = buildCsv(listContacts().map((contact) => ({
          id: contact.id,
          first_name: contact.first_name ?? '',
          last_name: contact.last_name,
          company: contact.company ?? '',
          email: contact.email ?? '',
          phone: contact.phone ?? '',
        })))
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'contacts-export.csv')
        return
      }
      throw error
    }
  },
}
