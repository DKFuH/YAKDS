import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const documentId = '22222222-2222-2222-2222-222222222222'

const { prismaMock, registerProjectDocumentMock, readDocumentBlobMock, deleteDocumentBlobMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
  registerProjectDocumentMock: vi.fn(),
  readDocumentBlobMock: vi.fn(),
  deleteDocumentBlobMock: vi.fn(),
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../services/documentRegistry.js', () => ({
  registerProjectDocument: registerProjectDocumentMock,
}))

vi.mock('../services/documentStorage.js', () => ({
  readDocumentBlob: readDocumentBlobMock,
  deleteDocumentBlob: deleteDocumentBlobMock,
}))

import { documentRoutes } from './documents.js'
import { tenantMiddleware } from '../tenantMiddleware.js'

function createDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: documentId,
    project_id: projectId,
    tenant_id: tenantId,
    filename: 'angebot-001.pdf',
    original_filename: 'angebot-001.pdf',
    mime_type: 'application/pdf',
    size_bytes: 152340,
    uploaded_by: 'dev-user-id',
    uploaded_at: new Date('2026-03-01T11:00:00.000Z'),
    type: 'quote_pdf',
    source_kind: 'manual_upload',
    source_id: null,
    storage_provider: 'local_fs',
    storage_bucket: null,
    storage_key: 'tenant/project/doc.pdf',
    storage_path: 'tenant/project/doc.pdf',
    storage_version: 1,
    version_no: 1,
    checksum: 'checksum-v1',
    external_url: null,
    sent_at: null,
    archived_at: null,
    version_metadata: {},
    conflict_marker: false,
    tags: ['quote', 'customer'],
    is_public: false,
    ...overrides,
  }
}

describe('documentRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findFirst.mockResolvedValue({ id: projectId, tenant_id: tenantId })
  })

  it('creates a document record from base64 payloads', async () => {
    registerProjectDocumentMock.mockResolvedValue(createDocument())

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/documents`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        filename: 'angebot-001.pdf',
        mime_type: 'application/pdf',
        file_base64: Buffer.from('pdf-content').toString('base64'),
        uploaded_by: 'dev-user-id',
        type: 'quote_pdf',
        tags: ['quote', 'customer'],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      id: documentId,
      project_id: projectId,
      type: 'quote_pdf',
      download_url: `/api/v1/projects/${projectId}/documents/${documentId}/download`,
    })
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        tenantId,
        filename: 'angebot-001.pdf',
        mimeType: 'application/pdf',
        uploadedBy: 'dev-user-id',
        type: 'quote_pdf',
      }),
    )

    await app.close()
  })

  it('creates a document via upload alias endpoint', async () => {
    registerProjectDocumentMock.mockResolvedValue(createDocument())

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/documents/upload`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        filename: 'angebot-002.pdf',
        mime_type: 'application/pdf',
        file_base64: Buffer.from('pdf-content').toString('base64'),
        uploaded_by: 'dev-user-id',
        type: 'quote_pdf',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'angebot-002.pdf',
      type: 'quote_pdf',
    }))

    await app.close()
  })

  it('lists documents filtered by type, tag, source and created range', async () => {
    prismaMock.document.findMany.mockResolvedValue([
      createDocument(),
      createDocument({
        id: '33333333-3333-3333-3333-333333333333',
        filename: 'render-001.png',
        mime_type: 'image/png',
        type: 'render_image',
        tags: ['render'],
      }),
    ])

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents?type=quote_pdf&tag=quote&source_kind=manual_upload&created_from=2026-03-01T00:00:00.000Z&created_to=2026-03-31T23:59:59.000Z`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(2)
    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: {
        project_id: projectId,
        tenant_id: tenantId,
        type: 'quote_pdf',
        tags: { has: 'quote' },
        source_kind: 'manual_upload',
        conflict_marker: false,
        uploaded_at: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-31T23:59:59.000Z'),
        },
      },
      orderBy: [{ version_no: 'desc' }, { uploaded_at: 'desc' }],
      select: expect.any(Object),
    })

    await app.close()
  })

  it('includes conflict entries when include_conflicts=true', async () => {
    prismaMock.document.findMany.mockResolvedValue([createDocument({ conflict_marker: true })])

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents?include_conflicts=true`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: {
        project_id: projectId,
        tenant_id: tenantId,
      },
      orderBy: [{ version_no: 'desc' }, { uploaded_at: 'desc' }],
      select: expect.any(Object),
    })

    await app.close()
  })

  it('archives a new document version from existing blob', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument())
    readDocumentBlobMock.mockResolvedValue(Buffer.from('pdf-content'))
    registerProjectDocumentMock.mockResolvedValue(createDocument({
      id: '44444444-4444-4444-4444-444444444444',
      version_no: 2,
      archived_at: new Date('2026-03-05T09:00:00.000Z'),
      source_kind: 'archive_version',
    }))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/documents/${documentId}/archive-version`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        uploaded_by: 'archive-user',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(readDocumentBlobMock).toHaveBeenCalledWith('tenant/project/doc.pdf')
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      tenantId,
      uploadedBy: 'archive-user',
      archivedAt: expect.any(Date),
    }))

    await app.close()
  })

  it('archives conflict versions with conflict markers', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument())
    readDocumentBlobMock.mockResolvedValue(Buffer.from('pdf-content'))
    registerProjectDocumentMock.mockResolvedValue(createDocument({
      id: '55555555-5555-5555-5555-555555555555',
      type: 'conflict_entry',
      source_kind: 'conflict_local',
      conflict_marker: true,
      version_no: 3,
    }))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/documents/${documentId}/archive-version`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        mark_conflict: true,
        conflict_reason: 'Lokale Änderungen kollidieren mit Serverstand',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'conflict_entry',
      sourceKind: 'conflict_local',
      conflictMarker: true,
      versionMetadata: expect.objectContaining({
        conflict_reason: 'Lokale Änderungen kollidieren mit Serverstand',
      }),
    }))

    await app.close()
  })

  it('returns missing_on_server when no version exists', async () => {
    prismaMock.document.findFirst.mockResolvedValue(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents/version-check?filename=angebot-001.pdf`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'missing_on_server',
      latest_document: null,
    })

    await app.close()
  })

  it('returns local_newer when local checksum differs and local timestamp is newer', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument({
      uploaded_at: new Date('2026-03-01T09:00:00.000Z'),
      checksum: 'server-checksum',
    }))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents/version-check?filename=angebot-001.pdf&local_checksum=local-checksum&local_updated_at=2026-03-02T09:00:00.000Z`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'local_newer',
    })

    await app.close()
  })

  it('returns server_newer when local timestamp is older', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument({
      uploaded_at: new Date('2026-03-03T09:00:00.000Z'),
      checksum: 'server-checksum',
    }))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents/version-check?filename=angebot-001.pdf&local_checksum=local-checksum&local_updated_at=2026-03-01T09:00:00.000Z`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'server_newer',
    })

    await app.close()
  })

  it('returns conflict when server document is marked as conflict marker', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument({
      conflict_marker: true,
      checksum: 'same-checksum',
    }))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents/version-check?filename=angebot-001.pdf&local_checksum=same-checksum`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'conflict',
    })

    await app.close()
  })

  it('downloads a stored document blob', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument())
    readDocumentBlobMock.mockResolvedValue(Buffer.from('pdf-content'))

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents/${documentId}/download`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/pdf')
    expect(response.body).toBe('pdf-content')
    expect(readDocumentBlobMock).toHaveBeenCalledWith('tenant/project/doc.pdf')

    await app.close()
  })

  it('deletes a document and removes its stored blob', async () => {
    prismaMock.document.findFirst.mockResolvedValue(createDocument())
    prismaMock.document.delete.mockResolvedValue(createDocument())

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${projectId}/documents/${documentId}`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(204)
    expect(prismaMock.document.delete).toHaveBeenCalledWith({
      where: { id: documentId },
    })
    expect(deleteDocumentBlobMock).toHaveBeenCalledWith('tenant/project/doc.pdf')

    await app.close()
  })

  it('rejects requests without tenant scope', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      error: 'FORBIDDEN',
      message: 'Tenant scope is required',
    })

    await app.close()
  })

  it('returns 404 when project is outside tenant scope', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(documentRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/documents`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Project not found in tenant scope',
    })

    await app.close()
  })
})
