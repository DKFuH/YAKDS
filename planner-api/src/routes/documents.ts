import multipart from '@fastify/multipart'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'
import { deleteDocumentBlob, readDocumentBlob } from '../services/documentStorage.js'
import { queueNotification } from '../services/notificationService.js'

const documentTypeValues = [
  'quote_pdf',
  'order_pdf',
  'spec_package',
  'manual_upload',
  'render_image',
  'cad_import',
  'email',
  'contract',
  'conflict_entry',
  'other',
] as const
const documentSourceKindValues = [
  'manual_upload',
  'quote_export',
  'order_export',
  'spec_export',
  'render_job',
  'import_job',
  'archive_version',
  'offline_sync',
  'conflict_local',
] as const

const DocumentParamsSchema = z.object({
  id: z.string().uuid(),
})

const DocumentIdParamsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
})

const DocumentListQuerySchema = z.object({
  type: z.enum(documentTypeValues).optional(),
  tag: z.string().min(1).max(100).optional(),
  source_kind: z.enum(documentSourceKindValues).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  include_conflicts: z.coerce.boolean().optional(),
})

const JsonUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(255),
  file_base64: z.string().min(1),
  uploaded_by: z.string().min(1).max(200),
  type: z.enum(documentTypeValues),
  tags: z.array(z.string().min(1).max(100)).default([]),
  is_public: z.boolean().optional(),
  source_kind: z.enum(documentSourceKindValues).optional(),
  source_id: z.string().min(1).max(200).nullable().optional(),
  sent_at: z.string().optional(),
  archived_at: z.string().optional(),
  version_metadata: z.record(z.unknown()).optional(),
  conflict_marker: z.boolean().optional(),
})

const ArchiveVersionBodySchema = z.object({
  uploaded_by: z.string().min(1).max(200).optional(),
  filename: z.string().min(1).max(255).optional(),
  mime_type: z.string().min(1).max(255).optional(),
  file_base64: z.string().min(1).optional(),
  type: z.enum(documentTypeValues).optional(),
  source_kind: z.enum(documentSourceKindValues).optional(),
  source_id: z.string().min(1).max(200).nullable().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  is_public: z.boolean().optional(),
  sent_at: z.string().optional(),
  mark_conflict: z.boolean().optional(),
  conflict_reason: z.string().min(1).max(500).optional(),
  local_updated_at: z.string().optional(),
})

const VersionCheckQuerySchema = z.object({
  source_kind: z.enum(documentSourceKindValues).optional(),
  source_id: z.string().min(1).max(200).optional(),
  filename: z.string().min(1).max(255).optional(),
  local_checksum: z.string().min(1).max(128).optional(),
  local_updated_at: z.string().optional(),
})

const documentSelect = {
  id: true,
  project_id: true,
  tenant_id: true,
  filename: true,
  original_filename: true,
  mime_type: true,
  size_bytes: true,
  uploaded_by: true,
  uploaded_at: true,
  type: true,
  source_kind: true,
  source_id: true,
  storage_provider: true,
  storage_bucket: true,
  storage_key: true,
  storage_path: true,
  storage_version: true,
  version_no: true,
  checksum: true,
  external_url: true,
  sent_at: true,
  archived_at: true,
  version_metadata: true,
  conflict_marker: true,
  tags: true,
  is_public: true,
} as const

function getTenantId(request: { tenantId?: string | null; headers?: Record<string, string | string[] | undefined> }): string | null {
  if (request.tenantId) {
    return request.tenantId
  }

  const headerValue = request.headers?.['x-tenant-id']
  if (!headerValue) {
    return null
  }

  return Array.isArray(headerValue) ? (headerValue[0] ?? null) : headerValue
}

async function assertProjectInTenantScope(projectId: string, tenantId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: { id: true, tenant_id: true },
  })
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function decodeBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64')
  } catch {
    return null
  }
}

function getDownloadUrl(projectId: string, documentId: string): string {
  return `/api/v1/projects/${projectId}/documents/${documentId}/download`
}

function parseOptionalDate(raw: string | undefined, fieldName: string): Date | null {
  if (!raw) {
    return null
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName} date`)
  }

  return parsed
}

function withDocumentLinks<T extends { id: string; project_id: string }>(document: T) {
  return {
    ...document,
    download_url: getDownloadUrl(document.project_id, document.id),
  }
}

export async function documentRoutes(app: FastifyInstance) {
  await app.register(multipart)

  const handleUpload = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = DocumentParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await assertProjectInTenantScope(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    try {
      const isMultipart = request.isMultipart()
      let document: Awaited<ReturnType<typeof registerProjectDocument>>

      if (isMultipart) {
        const upload = await request.file()
        if (!upload) {
          return sendBadRequest(reply, 'Missing file payload')
        }

        const fields = upload.fields as Record<string, { value: string | undefined } | undefined>
        const typeValue = fields.type?.value
        const uploadedBy = fields.uploaded_by?.value

        if (!typeValue || !documentTypeValues.includes(typeValue as typeof documentTypeValues[number])) {
          return sendBadRequest(reply, 'Invalid document type')
        }

        const type = typeValue as typeof documentTypeValues[number]

        if (!uploadedBy) {
          return sendBadRequest(reply, 'uploaded_by is required')
        }

        const buffer = await upload.toBuffer()
        document = await registerProjectDocument({
          projectId: parsedParams.data.id,
          tenantId,
          filename: upload.filename,
          originalFilename: upload.filename,
          mimeType: upload.mimetype,
          uploadedBy,
          type,
          tags: parseTags(fields.tags?.value),
          isPublic: fields.is_public?.value === 'true',
          sourceKind:
            fields.source_kind?.value && documentSourceKindValues.includes(fields.source_kind.value as typeof documentSourceKindValues[number])
              ? (fields.source_kind.value as typeof documentSourceKindValues[number])
              : 'manual_upload',
          sourceId: fields.source_id?.value ?? null,
          sentAt: parseOptionalDate(fields.sent_at?.value, 'sent_at'),
          archivedAt: parseOptionalDate(fields.archived_at?.value, 'archived_at'),
          conflictMarker: fields.conflict_marker?.value === 'true',
          versionMetadata: fields.version_metadata?.value ? { note: fields.version_metadata.value } : {},
          buffer,
        })
      } else {
        const parsedBody = JsonUploadSchema.safeParse(request.body)
        if (!parsedBody.success) {
          return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
        }

        const buffer = decodeBase64(parsedBody.data.file_base64)
        if (!buffer) {
          return sendBadRequest(reply, 'Invalid file_base64 payload')
        }

        document = await registerProjectDocument({
          projectId: parsedParams.data.id,
          tenantId,
          filename: parsedBody.data.filename,
          originalFilename: parsedBody.data.filename,
          mimeType: parsedBody.data.mime_type,
          uploadedBy: parsedBody.data.uploaded_by,
          type: parsedBody.data.type,
          tags: parsedBody.data.tags,
          isPublic: parsedBody.data.is_public ?? false,
          sourceKind: parsedBody.data.source_kind ?? 'manual_upload',
          sourceId: parsedBody.data.source_id ?? null,
          sentAt: parseOptionalDate(parsedBody.data.sent_at, 'sent_at'),
          archivedAt: parseOptionalDate(parsedBody.data.archived_at, 'archived_at'),
          conflictMarker: parsedBody.data.conflict_marker ?? false,
          versionMetadata: parsedBody.data.version_metadata ?? {},
          buffer,
        })
      }

      await queueNotification({
        tenantId,
        eventType: 'document_uploaded',
        entityType: 'document',
        entityId: document.id,
        recipientEmail: `alerts+${tenantId}@okp.local`,
        subject: `Neues Projektdokument: ${document.filename}`,
        message: `Im Projekt ${document.project_id} wurde ein Dokument vom Typ ${document.type} hochgeladen.`,
        metadata: {
          project_id: document.project_id,
          document_type: document.type,
          version_no: document.version_no,
        },
      })

      return reply.status(201).send(withDocumentLinks(document))
    } catch (error) {
      return sendServerError(reply, error instanceof Error ? error.message : 'Document upload failed')
    }
  }

  app.post<{ Params: { id: string } }>('/projects/:id/documents', handleUpload)
  app.post<{ Params: { id: string } }>('/projects/:id/documents/upload', handleUpload)

  app.get<{
    Params: { id: string }
    Querystring: {
      type?: typeof documentTypeValues[number]
      tag?: string
      source_kind?: typeof documentSourceKindValues[number]
      created_from?: string
      created_to?: string
      include_conflicts?: boolean
    }
  }>(
    '/projects/:id/documents',
    async (request, reply) => {
      const tenantId = getTenantId(request)
      if (!tenantId) {
        return sendForbidden(reply, 'Tenant scope is required')
      }

      const parsedParams = DocumentParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
      }

      const parsedQuery = DocumentListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
      }

      let createdFrom: Date | null = null
      let createdTo: Date | null = null

      try {
        createdFrom = parseOptionalDate(parsedQuery.data.created_from, 'created_from')
        createdTo = parseOptionalDate(parsedQuery.data.created_to, 'created_to')
      } catch (error) {
        return sendBadRequest(reply, error instanceof Error ? error.message : 'Invalid date range')
      }

      const project = await assertProjectInTenantScope(parsedParams.data.id, tenantId)
      if (!project) {
        return sendNotFound(reply, 'Project not found in tenant scope')
      }

      const documents = await prisma.document.findMany({
        where: {
          project_id: parsedParams.data.id,
          tenant_id: tenantId,
          ...(parsedQuery.data.type ? { type: parsedQuery.data.type } : {}),
          ...(parsedQuery.data.tag ? { tags: { has: parsedQuery.data.tag } } : {}),
          ...(parsedQuery.data.source_kind ? { source_kind: parsedQuery.data.source_kind } : {}),
          ...(!parsedQuery.data.include_conflicts ? { conflict_marker: false } : {}),
          ...((createdFrom || createdTo)
            ? {
                uploaded_at: {
                  ...(createdFrom ? { gte: createdFrom } : {}),
                  ...(createdTo ? { lte: createdTo } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ version_no: 'desc' }, { uploaded_at: 'desc' }],
        select: documentSelect,
      })

      return reply.send(documents.map(withDocumentLinks))
    },
  )

  app.post<{ Params: { id: string; documentId: string } }>(
    '/projects/:id/documents/:documentId/archive-version',
    async (request, reply) => {
      const tenantId = getTenantId(request)
      if (!tenantId) {
        return sendForbidden(reply, 'Tenant scope is required')
      }

      const parsedParams = DocumentIdParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
      }

      const parsedBody = ArchiveVersionBodySchema.safeParse(request.body ?? {})
      if (!parsedBody.success) {
        return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid archive payload')
      }

      const project = await assertProjectInTenantScope(parsedParams.data.id, tenantId)
      if (!project) {
        return sendNotFound(reply, 'Project not found in tenant scope')
      }

      const baseDocument = await prisma.document.findFirst({
        where: {
          id: parsedParams.data.documentId,
          project_id: parsedParams.data.id,
          tenant_id: tenantId,
        },
        select: documentSelect,
      })

      if (!baseDocument) {
        return sendNotFound(reply, 'Document not found')
      }

      let sentAt: Date | null = null
      let localUpdatedAt: Date | null = null

      try {
        sentAt = parseOptionalDate(parsedBody.data.sent_at, 'sent_at')
        localUpdatedAt = parseOptionalDate(parsedBody.data.local_updated_at, 'local_updated_at')
      } catch (error) {
        return sendBadRequest(reply, error instanceof Error ? error.message : 'Invalid archive payload')
      }

      const overrideBuffer = parsedBody.data.file_base64 ? decodeBase64(parsedBody.data.file_base64) : null
      if (parsedBody.data.file_base64 && !overrideBuffer) {
        return sendBadRequest(reply, 'Invalid file_base64 payload')
      }

      const inheritedBuffer = !overrideBuffer && !baseDocument.external_url
        ? await readDocumentBlob(baseDocument.storage_key)
        : null

      if (!baseDocument.external_url && !overrideBuffer && !inheritedBuffer) {
        return sendNotFound(reply, 'Document blob not found')
      }

      try {
        const archivedDocument = await registerProjectDocument({
          projectId: parsedParams.data.id,
          tenantId,
          filename: parsedBody.data.filename ?? baseDocument.filename,
          originalFilename: parsedBody.data.filename ?? baseDocument.original_filename ?? baseDocument.filename,
          mimeType: parsedBody.data.mime_type ?? baseDocument.mime_type,
          uploadedBy: parsedBody.data.uploaded_by ?? baseDocument.uploaded_by,
          type: parsedBody.data.mark_conflict ? 'conflict_entry' : (parsedBody.data.type ?? baseDocument.type),
          tags: parsedBody.data.tags ?? baseDocument.tags,
          isPublic: parsedBody.data.is_public ?? baseDocument.is_public,
          sourceKind: parsedBody.data.mark_conflict
            ? 'conflict_local'
            : (parsedBody.data.source_kind ?? baseDocument.source_kind ?? 'archive_version'),
          sourceId: parsedBody.data.source_id ?? baseDocument.source_id,
          buffer: overrideBuffer ?? inheritedBuffer,
          externalUrl: overrideBuffer || inheritedBuffer ? null : baseDocument.external_url,
          sentAt,
          archivedAt: new Date(),
          conflictMarker: parsedBody.data.mark_conflict ?? false,
          versionMetadata: {
            archived_from_document_id: baseDocument.id,
            archived_from_version_no: baseDocument.version_no,
            conflict_reason: parsedBody.data.conflict_reason ?? null,
            local_updated_at: localUpdatedAt?.toISOString() ?? null,
          },
        })

        return reply.status(201).send(withDocumentLinks(archivedDocument))
      } catch (error) {
        return sendServerError(reply, error instanceof Error ? error.message : 'Archive version failed')
      }
    },
  )

  app.get<{
    Params: { id: string }
    Querystring: {
      source_kind?: typeof documentSourceKindValues[number]
      source_id?: string
      filename?: string
      local_checksum?: string
      local_updated_at?: string
    }
  }>(
    '/projects/:id/documents/version-check',
    async (request, reply) => {
      const tenantId = getTenantId(request)
      if (!tenantId) {
        return sendForbidden(reply, 'Tenant scope is required')
      }

      const parsedParams = DocumentParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
      }

      const parsedQuery = VersionCheckQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
      }

      const project = await assertProjectInTenantScope(parsedParams.data.id, tenantId)
      if (!project) {
        return sendNotFound(reply, 'Project not found in tenant scope')
      }

      let localUpdatedAt: Date | null = null
      try {
        localUpdatedAt = parseOptionalDate(parsedQuery.data.local_updated_at, 'local_updated_at')
      } catch (error) {
        return sendBadRequest(reply, error instanceof Error ? error.message : 'Invalid local_updated_at date')
      }

      const latestDocument = await prisma.document.findFirst({
        where: {
          project_id: parsedParams.data.id,
          tenant_id: tenantId,
          ...(parsedQuery.data.source_kind ? { source_kind: parsedQuery.data.source_kind } : {}),
          ...(parsedQuery.data.source_id ? { source_id: parsedQuery.data.source_id } : {}),
          ...(parsedQuery.data.filename ? { filename: parsedQuery.data.filename } : {}),
        },
        orderBy: [{ version_no: 'desc' }, { uploaded_at: 'desc' }],
        select: documentSelect,
      })

      if (!latestDocument) {
        return reply.send({
          status: 'missing_on_server',
          hint: 'Keine Serverversion gefunden. Lokale Version kann hochgeladen werden.',
          latest_document: null,
          local_checksum: parsedQuery.data.local_checksum ?? null,
          local_updated_at: localUpdatedAt?.toISOString() ?? null,
        })
      }

      let status: 'up_to_date' | 'local_newer' | 'server_newer' | 'conflict' = 'up_to_date'

      if (parsedQuery.data.local_checksum && latestDocument.checksum) {
        if (parsedQuery.data.local_checksum !== latestDocument.checksum) {
          if (!localUpdatedAt) {
            status = 'conflict'
          } else {
            const localMs = localUpdatedAt.getTime()
            const serverMs = latestDocument.uploaded_at.getTime()
            status = localMs > serverMs ? 'local_newer' : (localMs < serverMs ? 'server_newer' : 'conflict')
          }
        }
      } else if (localUpdatedAt) {
        const localMs = localUpdatedAt.getTime()
        const serverMs = latestDocument.uploaded_at.getTime()
        status = localMs > serverMs ? 'local_newer' : (localMs < serverMs ? 'server_newer' : 'up_to_date')
      }

      if (latestDocument.conflict_marker && status === 'up_to_date') {
        status = 'conflict'
      }

      const hintByStatus: Record<typeof status, string> = {
        up_to_date: 'Lokale Datei entspricht dem Serverstand.',
        local_newer: 'Lokale Datei ist neuer als die Serverversion. Archivierung empfohlen.',
        server_newer: 'Serverversion ist neuer als die lokale Datei. Download oder Merge prüfen.',
        conflict: 'Versionskonflikt erkannt. Als Konfliktversion archivieren.',
      }

      return reply.send({
        status,
        hint: hintByStatus[status],
        latest_document: withDocumentLinks(latestDocument),
        local_checksum: parsedQuery.data.local_checksum ?? null,
        local_updated_at: localUpdatedAt?.toISOString() ?? null,
      })
    },
  )

  app.get<{ Params: { id: string; documentId: string } }>(
    '/projects/:id/documents/:documentId/download',
    async (request, reply) => {
      const tenantId = getTenantId(request)
      if (!tenantId) {
        return sendForbidden(reply, 'Tenant scope is required')
      }

      const parsedParams = DocumentIdParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
      }

      const document = await prisma.document.findFirst({
        where: {
          id: parsedParams.data.documentId,
          project_id: parsedParams.data.id,
          tenant_id: tenantId,
        },
        select: documentSelect,
      })

      if (!document) {
        return sendNotFound(reply, 'Document not found')
      }

      if (document.external_url) {
        return reply.redirect(document.external_url)
      }

      const buffer = await readDocumentBlob(document.storage_key)
      if (!buffer) {
        return sendNotFound(reply, 'Document blob not found')
      }

      reply.header('content-disposition', `attachment; filename="${document.filename}"`)
      reply.type(document.mime_type)
      return reply.send(buffer)
    },
  )

  app.delete<{ Params: { id: string; documentId: string } }>('/projects/:id/documents/:documentId', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = DocumentIdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const project = await assertProjectInTenantScope(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const existing = await prisma.document.findFirst({
      where: {
        id: parsedParams.data.documentId,
        project_id: parsedParams.data.id,
        tenant_id: tenantId,
      },
      select: documentSelect,
    })

    if (!existing) {
      return sendNotFound(reply, 'Document not found')
    }

    await prisma.document.delete({
      where: { id: existing.id },
    })

    if (!existing.external_url) {
      await deleteDocumentBlob(existing.storage_key)
    }

    await queueNotification({
      tenantId,
      eventType: 'document_deleted',
      entityType: 'document',
      entityId: existing.id,
      recipientEmail: `alerts+${tenantId}@okp.local`,
      subject: `Projektdokument gelöscht: ${existing.filename}`,
      message: `Im Projekt ${existing.project_id} wurde ein Dokument gelöscht.`,
      metadata: {
        project_id: existing.project_id,
        document_type: existing.type,
      },
    })

    return reply.status(204).send()
  })
}
