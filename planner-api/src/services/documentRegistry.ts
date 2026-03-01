import type { DocumentSourceKind, DocumentType } from '@prisma/client'
import { prisma } from '../db.js'
import { deleteDocumentBlob, writeDocumentBlob } from './documentStorage.js'

interface RegisterProjectDocumentInput {
  projectId: string
  tenantId: string
  filename: string
  originalFilename?: string | null
  mimeType: string
  uploadedBy: string
  type: DocumentType
  tags?: string[]
  isPublic?: boolean
  sourceKind?: DocumentSourceKind
  sourceId?: string | null
  storageVersion?: number
  buffer?: Buffer | null
  externalUrl?: string | null
}

export async function registerProjectDocument(input: RegisterProjectDocumentInput) {
  const existing =
    input.sourceKind && input.sourceId
      ? await prisma.document.findFirst({
          where: {
            project_id: input.projectId,
            tenant_id: input.tenantId,
            source_kind: input.sourceKind,
            source_id: input.sourceId,
          },
        })
      : null

  const storage =
    input.buffer
      ? await writeDocumentBlob({
          tenantId: input.tenantId,
          projectId: input.projectId,
          filename: input.filename,
          buffer: input.buffer,
        })
      : {
          storage_provider: 'local_fs' as const,
          storage_bucket: null,
          storage_key: existing?.storage_key ?? `external/${input.tenantId}/${input.projectId}/${input.sourceKind ?? 'manual_upload'}/${input.sourceId ?? 'asset'}`,
          size_bytes: existing?.size_bytes ?? 0,
        }

  if (existing?.storage_key && input.buffer) {
    await deleteDocumentBlob(existing.storage_key)
  }

  const payload = {
    project_id: input.projectId,
    tenant_id: input.tenantId,
    filename: input.filename,
    original_filename: input.originalFilename ?? input.filename,
    mime_type: input.mimeType,
    size_bytes: storage.size_bytes,
    uploaded_by: input.uploadedBy,
    type: input.type,
    tags: input.tags ?? [],
    is_public: input.isPublic ?? false,
    source_kind: input.sourceKind ?? 'manual_upload',
    source_id: input.sourceId ?? null,
    storage_provider: storage.storage_provider,
    storage_bucket: storage.storage_bucket,
    storage_key: storage.storage_key,
    storage_version: input.storageVersion ?? (existing?.storage_version ?? 0) + 1,
    external_url: input.externalUrl ?? null,
  }

  if (existing) {
    return prisma.document.update({
      where: { id: existing.id },
      data: payload,
    })
  }

  return prisma.document.create({
    data: payload,
  })
}
