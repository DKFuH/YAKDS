import { api, shouldUseDemoFallback } from './client.js'
import {
  createDocument as createDemoDocument,
  deleteDocument as deleteDemoDocument,
  listDocuments as listDemoDocuments,
} from './demoBackend.js'

export type DocumentType = 'quote_pdf' | 'render_image' | 'cad_import' | 'email' | 'contract' | 'other'

export interface ProjectDocument {
  id: string
  project_id: string
  tenant_id: string
  filename: string
  original_filename: string | null
  mime_type: string
  size_bytes: number
  uploaded_by: string
  uploaded_at: string
  type: DocumentType
  source_kind: 'manual_upload' | 'quote_export' | 'render_job' | 'import_job'
  source_id: string | null
  storage_provider: string
  storage_bucket: string | null
  storage_key: string
  storage_version: number
  external_url: string | null
  tags: string[]
  is_public: boolean
  download_url: string
  preview_url?: string
}

export interface DocumentListParams {
  type?: DocumentType
  tag?: string
}

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'
const UPLOADED_BY_PLACEHOLDER = 'planner-frontend'

function withAbsoluteBase(path: string): string {
  return path.startsWith('/api/') ? `${window.location.origin}${path}` : path
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error(`Datei ${file.name} hat keinen lesbaren Inhalt geliefert.`))
        return
      }

      const [, base64] = result.split(',', 2)
      if (!base64) {
        reject(new Error(`Datei ${file.name} konnte nicht in Base64 umgewandelt werden.`))
        return
      }

      resolve(base64)
    }
    reader.readAsDataURL(file)
  })
}

export const documentsApi = {
  list: async (projectId: string, params: DocumentListParams = {}) => {
    const query = new URLSearchParams()
    if (params.type) {
      query.set('type', params.type)
    }
    if (params.tag?.trim()) {
      query.set('tag', params.tag.trim())
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''

    try {
      const documents = await api.get<ProjectDocument[]>(
        `/projects/${projectId}/documents${suffix}`,
        { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
      )
      return documents.map((document) => ({
        ...document,
        download_url: withAbsoluteBase(document.download_url),
      }))
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return listDemoDocuments(projectId, params)
      }
      throw error
    }
  },
  uploadMany: async (
    projectId: string,
    files: File[],
    config: { type: DocumentType; tags: string[]; is_public?: boolean },
  ) => {
    try {
      const uploaded: ProjectDocument[] = []
      for (const file of files) {
        const fileBase64 = await fileToBase64(file)
        const document = await api.post<ProjectDocument>(
          `/projects/${projectId}/documents`,
          {
            filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            file_base64: fileBase64,
            uploaded_by: UPLOADED_BY_PLACEHOLDER,
            type: config.type,
            tags: config.tags,
            is_public: config.is_public ?? false,
          },
          { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
        )
        uploaded.push({
          ...document,
          download_url: withAbsoluteBase(document.download_url),
        })
      }
      return uploaded
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        const uploaded: ProjectDocument[] = []
        for (const file of files) {
          const fileBase64 = await fileToBase64(file)
          uploaded.push(createDemoDocument(projectId, TENANT_ID_PLACEHOLDER, {
            filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            file_base64: fileBase64,
            uploaded_by: UPLOADED_BY_PLACEHOLDER,
            type: config.type,
            tags: config.tags,
            is_public: config.is_public,
          }))
        }
        return uploaded
      }
      throw error
    }
  },
  remove: async (projectId: string, documentId: string) => {
    try {
      return await api.delete(`/projects/${projectId}/documents/${documentId}`, {
        'X-Tenant-Id': TENANT_ID_PLACEHOLDER,
      })
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return deleteDemoDocument(projectId, documentId)
      }
      throw error
    }
  },
}
