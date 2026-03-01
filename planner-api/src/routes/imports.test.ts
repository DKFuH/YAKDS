import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const importJobId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    importJob: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

const { registerProjectDocumentMock } = vi.hoisted(() => ({
  registerProjectDocumentMock: vi.fn(),
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../services/documentRegistry.js', () => ({
  registerProjectDocument: registerProjectDocumentMock,
}))

import { importRoutes } from './imports.js'
import { tenantMiddleware } from '../tenantMiddleware.js'

function createMinimalDxf(): string {
  return [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'LINE',
    '5',
    'A1',
    '8',
    'Walls',
    '10',
    '0',
    '20',
    '0',
    '11',
    '1000',
    '21',
    '0',
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n')
}

function createSkpPayload() {
  return Buffer.from(
    JSON.stringify({
      project_id: projectId,
      import_job_id: 'job-7',
      components: [
        {
          name: 'US_60',
          guid: 'guid-1',
          instance_guid: 'guid-1',
          position: { x_mm: 100, y_mm: 200, z_mm: 0 },
          vertices: [
            { x_mm: 0, y_mm: 0, z_mm: 0 },
            { x_mm: 600, y_mm: 0, z_mm: 0 },
            { x_mm: 600, y_mm: 580, z_mm: 720 },
          ],
        },
      ],
    }),
    'utf8',
  ).toString('base64')
}

function createImportJob(overrides: Record<string, unknown> = {}) {
  return {
    id: importJobId,
    project_id: projectId,
    status: 'queued',
    source_format: 'dxf',
    source_filename: 'import.dxf',
    file_size_bytes: 0,
    import_asset: null,
    protocol: [],
    error_message: null,
    created_at: new Date('2026-03-01T10:00:00.000Z'),
    completed_at: null,
    ...overrides,
  }
}

describe('importRoutes', () => {
  let persistedJob: ReturnType<typeof createImportJob> | null

  beforeEach(() => {
    vi.clearAllMocks()
    persistedJob = null
    registerProjectDocumentMock.mockResolvedValue({ id: 'doc-import-1' })

    prismaMock.project.findFirst.mockResolvedValue({ id: projectId, tenant_id: tenantId })
    prismaMock.importJob.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      persistedJob = createImportJob(data)
      return persistedJob
    })
    prismaMock.importJob.update.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        persistedJob = {
          ...(persistedJob ?? createImportJob({ id: where.id })),
          ...data,
          id: where.id,
        }
        return persistedJob
      },
    )
    prismaMock.importJob.findFirst.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (persistedJob?.id === where.id) {
        return persistedJob
      }

      return null
    })
  })

  it('returns a parsed DXF preview asset', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/preview/dxf',
      payload: {
        source_filename: 'preview.dxf',
        dxf: createMinimalDxf(),
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.source_filename).toBe('preview.dxf')
    expect(body.entities).toHaveLength(1)
    expect(body.entities[0]).toMatchObject({
      id: 'A1',
      type: 'line',
    })

    await app.close()
  })

  it('returns a parsed SKP preview model from base64 payloads', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/preview/skp',
      payload: {
        source_filename: 'preview.skp',
        file_base64: createSkpPayload(),
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.source_filename).toBe('preview.skp')
    expect(body.components).toHaveLength(1)
    expect(body.components[0].mapping.target_type).toBe('cabinet')

    await app.close()
  })

  it('creates and stores a processed DXF import job', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/cad',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
        source_filename: 'room.dxf',
        dxf: createMinimalDxf(),
        layer_mapping: {
          Walls: {
            action: 'ignored',
            reason: 'Layer filtered out by user.',
          },
        },
      },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()
    expect(body.status).toBe('done')
    expect(body.source_format).toBe('dxf')
    expect(body.import_asset.import_job_id).toBe(importJobId)
    expect(body.import_asset.entities).toHaveLength(0)
    expect(body.import_asset.mapping_state.layers.Walls.action).toBe('ignored')
    expect(body.protocol).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'ignored',
          reason: 'Layer filtered out by user.',
        }),
      ]),
    )
    expect(prismaMock.importJob.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.importJob.update).toHaveBeenCalledTimes(2)
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        tenantId,
        type: 'cad_import',
        sourceKind: 'import_job',
        sourceId: importJobId,
      }),
    )

    await app.close()
  })

  it('stores DWG uploads as reviewable import jobs', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/cad',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
        source_filename: 'room.dwg',
        source_format: 'dwg',
        file_base64: Buffer.from('dwg-binary').toString('base64'),
      },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()
    expect(body.status).toBe('done')
    expect(body.source_format).toBe('dwg')
    expect(body.import_asset.raw_upload_base64).toBe(Buffer.from('dwg-binary').toString('base64'))
    expect(body.protocol[0]).toMatchObject({
      status: 'needs_review',
    })
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['import', 'dwg'],
      }),
    )

    await app.close()
  })

  it('creates and stores a processed SKP import job with mapping overrides', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/skp',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
        source_filename: 'reference.skp',
        file_base64: createSkpPayload(),
        component_mapping: {
          'guid-1': {
            target_type: 'ignored',
            label: 'Do not import',
          },
        },
      },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()
    expect(body.status).toBe('done')
    expect(body.source_format).toBe('skp')
    expect(body.import_asset.import_job_id).toBe(importJobId)
    expect(body.import_asset.components[0].mapping.target_type).toBe('ignored')
    expect(body.import_asset.mapping_state.components['guid-1'].target_type).toBe('ignored')
    expect(body.protocol[0]).toMatchObject({
      status: 'ignored',
    })
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['import', 'skp'],
      }),
    )

    await app.close()
  })

  it('returns a stored import job by id', async () => {
    persistedJob = createImportJob({
      id: importJobId,
      status: 'done',
      source_format: 'skp',
      source_filename: 'reference.skp',
      import_asset: {
        id: 'asset-1',
        import_job_id: importJobId,
      },
      protocol: [
        {
          entity_id: null,
          status: 'imported',
          reason: 'Stored import.',
        },
      ],
      completed_at: new Date('2026-03-01T10:05:00.000Z'),
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: importJobId,
      status: 'done',
      source_filename: 'reference.skp',
    })

    await app.close()
  })

  it('returns stored CAD layers for an import job', async () => {
    persistedJob = createImportJob({
      id: importJobId,
      status: 'done',
      source_format: 'dxf',
      source_filename: 'room.dxf',
      import_asset: {
        id: 'asset-2',
        import_job_id: importJobId,
        layers: [
          {
            id: 'layer-Walls',
            name: 'Walls',
            color: '7',
            visible: true,
            entity_count: 1,
          },
          {
            id: 'layer-Dims',
            name: 'Dims',
            color: '3',
            visible: false,
            entity_count: 0,
          },
        ],
      },
      completed_at: new Date('2026-03-01T10:05:00.000Z'),
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}/layers`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: 'layer-Walls',
        name: 'Walls',
        color: '7',
        visible: true,
        entity_count: 1,
      },
      {
        id: 'layer-Dims',
        name: 'Dims',
        color: '3',
        visible: false,
        entity_count: 0,
      },
    ])

    await app.close()
  })

  it('returns stored mapping state for an import job', async () => {
    persistedJob = createImportJob({
      id: importJobId,
      status: 'done',
      source_format: 'skp',
      source_filename: 'reference.skp',
      import_asset: {
        id: 'asset-3',
        import_job_id: importJobId,
        mapping_state: {
          components: {
            'guid-1': {
              target_type: 'appliance',
              catalog_item_id: 'appl-60',
              label: 'Backofen',
            },
          },
        },
      },
      completed_at: new Date('2026-03-01T10:05:00.000Z'),
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}/mapping-state`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      components: {
        'guid-1': {
          target_type: 'appliance',
          catalog_item_id: 'appl-60',
          label: 'Backofen',
        },
      },
    })

    await app.close()
  })

  it('returns 409 when layers are requested before an import asset exists', async () => {
    persistedJob = createImportJob({
      id: importJobId,
      status: 'processing',
      import_asset: null,
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}/layers`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'IMPORT_ASSET_NOT_READY',
      message: 'Import asset is not available yet.',
    })

    await app.close()
  })

  it('returns 409 when mapping state is requested before an import asset exists', async () => {
    persistedJob = createImportJob({
      id: importJobId,
      status: 'processing',
      import_asset: null,
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}/mapping-state`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'IMPORT_ASSET_NOT_READY',
      message: 'Import asset is not available yet.',
    })

    await app.close()
  })

  it('rejects malformed CAD import payloads', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/cad',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
        source_filename: 'room.dxf',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('BAD_REQUEST')

    await app.close()
  })

  it('returns 404 when the project for an import job does not exist', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/skp',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
        source_filename: 'missing-project.skp',
        file_base64: createSkpPayload(),
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Project not found in tenant scope',
    })

    await app.close()
  })

  it('returns 404 for unknown import jobs', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/33333333-3333-3333-3333-333333333333',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Import job not found in tenant scope',
    })

    await app.close()
  })

  it('returns 404 for unknown import job layers', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/33333333-3333-3333-3333-333333333333/layers',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Import job not found in tenant scope',
    })

    await app.close()
  })

  it('returns 404 for unknown import job mapping state', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/33333333-3333-3333-3333-333333333333/mapping-state',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Import job not found in tenant scope',
    })

    await app.close()
  })

  it('returns 403 when tenant header is missing for CAD imports', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/cad',
      payload: {
        project_id: projectId,
        source_filename: 'room.dxf',
        dxf: createMinimalDxf(),
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' })

    await app.close()
  })

  it('returns 403 when tenant header is missing for import job reads', async () => {
    persistedJob = createImportJob({ id: importJobId, status: 'done' })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importJobId}`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' })

    await app.close()
  })
})
