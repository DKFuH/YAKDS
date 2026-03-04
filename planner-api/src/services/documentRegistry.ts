import { createHash } from 'node:crypto'
import type { DocumentSourceKind, DocumentType, Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { writeDocumentBlob } from './documentStorage.js'

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
  versionNo?: number
  checksum?: string | null
  buffer?: Buffer | null
  externalUrl?: string | null
  sentAt?: Date | null
  archivedAt?: Date | null
  versionMetadata?: Record<string, unknown>
  conflictMarker?: boolean
}

export async function registerProjectDocument(input: RegisterProjectDocumentInput) {
  const sourceKind = input.sourceKind ?? 'manual_upload'
  const sourceId = input.sourceId ?? null

  const latestInScope = await prisma.document.findFirst({
    where: {
      project_id: input.projectId,
      tenant_id: input.tenantId,
      ...(sourceId
        ? {
            source_kind: sourceKind,
            source_id: sourceId,
          }
        : {
            filename: input.filename,
            source_id: null,
          }),
    },
    orderBy: [
      { version_no: 'desc' },
      { uploaded_at: 'desc' },
    ],
    select: {
      storage_key: true,
      size_bytes: true,
      storage_version: true,
      version_no: true,
      checksum: true,
    },
  })

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
          storage_key: latestInScope?.storage_key ?? `external/${input.tenantId}/${input.projectId}/${sourceKind}/${sourceId ?? 'asset'}`,
          size_bytes: latestInScope?.size_bytes ?? 0,
        }

  const checksum =
    input.checksum ??
    (input.buffer ? createHash('sha256').update(input.buffer).digest('hex') : (latestInScope?.checksum ?? null))

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
    source_kind: sourceKind,
    source_id: sourceId,
    storage_provider: storage.storage_provider,
    storage_bucket: storage.storage_bucket,
    storage_key: storage.storage_key,
    storage_path: storage.storage_key,
    storage_version: input.storageVersion ?? (latestInScope?.storage_version ?? 0) + 1,
    version_no: input.versionNo ?? (latestInScope?.version_no ?? 0) + 1,
    checksum,
    external_url: input.externalUrl ?? null,
    sent_at: input.sentAt ?? null,
    archived_at: input.archivedAt ?? null,
    version_metadata: (input.versionMetadata ?? {}) as unknown as Prisma.InputJsonValue,
    conflict_marker: input.conflictMarker ?? false,
  }

  return prisma.document.create({
    data: payload,
  })
}
