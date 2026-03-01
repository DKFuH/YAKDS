import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'
import { deleteDocumentBlob, readDocumentBlob } from '../services/documentStorage.js'

const documentTypeValues = ['quote_pdf', 'render_image', 'cad_import', 'email', 'contract', 'other'] as const
const documentSourceKindValues = ['manual_upload', 'quote_export', 'render_job', 'import_job'] as const

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
  storage_version: true,
  external_url: true,
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

export async function documentRoutes(app: FastifyInstance) {
  await app.register(multipart)

  app.post<{ Params: { id: string } }>('/projects/:id/documents', async (request, reply) => {
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
      let document

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
          buffer,
        })
      }

      return reply.status(201).send({
        ...document,
        download_url: getDownloadUrl(document.project_id, document.id),
      })
    } catch (error) {
      return sendServerError(reply, error instanceof Error ? error.message : 'Document upload failed')
    }
  })

  app.get<{ Params: { id: string }; Querystring: { type?: typeof documentTypeValues[number]; tag?: string } }>(
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
        },
        orderBy: { uploaded_at: 'desc' },
        select: documentSelect,
      })

      return reply.send(
        documents.map((document) => ({
          ...document,
          download_url: getDownloadUrl(document.project_id, document.id),
        })),
      )
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

    return reply.status(204).send()
  })
}
