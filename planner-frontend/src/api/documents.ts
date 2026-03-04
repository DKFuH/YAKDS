import { api, shouldUseDemoFallback } from './client.js'
import {
  archiveDocumentVersion as archiveDemoDocumentVersion,
  createDocument as createDemoDocument,
  deleteDocument as deleteDemoDocument,
  listDocuments as listDemoDocuments,
  versionCheckDocument as versionCheckDemoDocument,
} from './demoBackend.js'

export type DocumentType =
  | 'quote_pdf'
  | 'order_pdf'
  | 'spec_package'
  | 'manual_upload'
  | 'render_image'
  | 'cad_import'
  | 'email'
  | 'contract'
  | 'conflict_entry'
  | 'other'

export type DocumentSourceKind =
  | 'manual_upload'
  | 'quote_export'
  | 'order_export'
  | 'spec_export'
  | 'render_job'
  | 'import_job'
  | 'archive_version'
  | 'offline_sync'
  | 'conflict_local'

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
  source_kind: DocumentSourceKind
  source_id: string | null
  storage_provider: string
  storage_bucket: string | null
  storage_key: string
  storage_path: string | null
  storage_version: number
  version_no: number
  checksum: string | null
  external_url: string | null
  sent_at: string | null
  archived_at: string | null
  version_metadata: Record<string, unknown>
  conflict_marker: boolean
  tags: string[]
  is_public: boolean
  download_url: string
  preview_url?: string
}

export interface DocumentListParams {
  type?: DocumentType
  tag?: string
  source_kind?: DocumentSourceKind
  created_from?: string
  created_to?: string
  include_conflicts?: boolean
}

export interface ArchiveDocumentVersionPayload {
  uploaded_by?: string
  filename?: string
  mime_type?: string
  file_base64?: string
  type?: DocumentType
  source_kind?: DocumentSourceKind
  source_id?: string | null
  tags?: string[]
  is_public?: boolean
  sent_at?: string
  mark_conflict?: boolean
  conflict_reason?: string
  local_updated_at?: string
}

export interface DocumentVersionCheckResult {
  status: 'up_to_date' | 'local_newer' | 'server_newer' | 'conflict' | 'missing_on_server'
  hint: string
  latest_document: ProjectDocument | null
  local_checksum: string | null
  local_updated_at: string | null
}

export interface DocumentVersionCheckParams {
  source_kind?: DocumentSourceKind
  source_id?: string
  filename?: string
  local_checksum?: string
  local_updated_at?: string
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
    if (params.source_kind) {
      query.set('source_kind', params.source_kind)
    }
    if (params.created_from) {
      query.set('created_from', params.created_from)
    }
    if (params.created_to) {
      query.set('created_to', params.created_to)
    }
    if (params.include_conflicts) {
      query.set('include_conflicts', 'true')
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
          `/projects/${projectId}/documents/upload`,
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
  archiveVersion: async (projectId: string, documentId: string, payload: ArchiveDocumentVersionPayload = {}) => {
    try {
      const document = await api.post<ProjectDocument>(
        `/projects/${projectId}/documents/${documentId}/archive-version`,
        payload,
        { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
      )
      return {
        ...document,
        download_url: withAbsoluteBase(document.download_url),
      }
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return archiveDemoDocumentVersion(projectId, documentId, payload)
      }
      throw error
    }
  },
  versionCheck: async (projectId: string, params: DocumentVersionCheckParams = {}) => {
    const query = new URLSearchParams()
    if (params.source_kind) {
      query.set('source_kind', params.source_kind)
    }
    if (params.source_id?.trim()) {
      query.set('source_id', params.source_id.trim())
    }
    if (params.filename?.trim()) {
      query.set('filename', params.filename.trim())
    }
    if (params.local_checksum?.trim()) {
      query.set('local_checksum', params.local_checksum.trim())
    }
    if (params.local_updated_at) {
      query.set('local_updated_at', params.local_updated_at)
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''

    try {
      const result = await api.get<DocumentVersionCheckResult>(
        `/projects/${projectId}/documents/version-check${suffix}`,
        { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
      )
      return {
        ...result,
        latest_document: result.latest_document
          ? {
              ...result.latest_document,
              download_url: withAbsoluteBase(result.latest_document.download_url),
            }
          : null,
      }
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return versionCheckDemoDocument(projectId, params)
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
