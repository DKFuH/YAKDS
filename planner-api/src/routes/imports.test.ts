import { randomUUID } from 'node:crypto'
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
    room: {
      create: vi.fn(),
    },
    importJob: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

function createDwgPayload() {
  return Buffer.from('AC1015stub-dwg-payload', 'ascii').toString('base64')
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

function createRaumaufmassPayload() {
  return {
    source_filename: 'aufmass.json',
    rooms: [
      {
        name: 'Kueche',
        width_mm: 4200,
        depth_mm: 2800,
        height_mm: 2550,
        openings: [
          {
            kind: 'door',
            wall_index: 1,
            width_mm: 900,
            height_mm: 2100,
            offset_mm: 1000,
          },
        ],
      },
    ],
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
    prismaMock.importJob.findMany.mockResolvedValue([])
    prismaMock.room.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: randomUUID(),
      ...data,
    }))
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

  it('parses DWG uploads into reviewable import jobs', async () => {
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
        file_base64: createDwgPayload(),
      },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()
    expect(body.status).toBe('done')
    expect(body.source_format).toBe('dwg')
    expect(body.import_asset.raw_upload_base64).toBe(createDwgPayload())
    expect(body.import_asset.wall_segments).toEqual([])
    expect(body.import_asset.arc_entities_detected).toBe(0)
    expect(body.import_asset.needs_review).toBe(true)
    expect(body.protocol[0]).toMatchObject({
      status: 'needs_review',
      reason: expect.stringContaining('DWG'),
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

  it('validates a raumaufmass payload with preview and diagnostics', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: createRaumaufmassPayload(),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      valid: true,
      source_filename: 'aufmass.json',
      preview: {
        summary: {
          room_count: 1,
          opening_count: 1,
          error_count: 0,
        },
      },
    })

    await app.close()
  })

  it('returns structured validation errors for malformed raumaufmass payloads', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        source_filename: 'broken.json',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      valid: false,
      diagnostics: {
        errors: expect.arrayContaining([
          expect.objectContaining({ code: 'custom' }),
        ]),
      },
    })

    await app.close()
  })

  it('adds a fallback room name warning when room name is missing', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        rooms: [{ width_mm: 3000, depth_mm: 2200 }],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'room_name_fallback' }),
      ]),
    )

    await app.close()
  })

  it('adds opening wall diagnostics when wall index is out of range', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        rooms: [
          {
            name: 'Test',
            width_mm: 3000,
            depth_mm: 2200,
            openings: [{ wall_index: 99, width_mm: 1000 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'opening_wall_out_of_range' }),
      ]),
    )

    await app.close()
  })

  it('validates rooms from explicit boundary vertices', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        rooms: [{
          name: 'BoundaryRoom',
          boundary: {
            vertices: [
              { x_mm: 0, y_mm: 0 },
              { x_mm: 3200, y_mm: 0 },
              { x_mm: 3200, y_mm: 2600 },
            ],
          },
        }],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().preview.rooms[0]).toMatchObject({
      boundary_vertices: 3,
      wall_segments: 3,
    })

    await app.close()
  })

  it('can derive boundary geometry from wall extents', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/validate/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        rooms: [{
          name: 'WallRoom',
          walls: [
            { start: { x_mm: 0, y_mm: 0 }, end: { x_mm: 3500, y_mm: 0 } },
            { start: { x_mm: 3500, y_mm: 0 }, end: { x_mm: 3500, y_mm: 2400 } },
            { start: { x_mm: 3500, y_mm: 2400 }, end: { x_mm: 0, y_mm: 2400 } },
          ],
        }],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'boundary_derived_from_walls' }),
      ]),
    )

    await app.close()
  })

  it('imports valid raumaufmass payloads into rooms and stores import jobs', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: createRaumaufmassPayload(),
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      imported_rooms: 1,
      diagnostics: {
        errors: [],
      },
    })
    expect(prismaMock.room.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.importJob.create).toHaveBeenCalledTimes(1)
    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        tenantId,
        mimeType: 'application/json',
      }),
    )

    await app.close()
  })

  it('rejects invalid raumaufmass imports with structured diagnostics', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        rooms: [{
          name: 'InvalidRoom',
          openings: [{ width_mm: 900 }],
        }],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      valid: false,
      diagnostics: {
        errors: expect.arrayContaining([
          expect.objectContaining({ code: 'room_geometry_missing' }),
        ]),
      },
    })
    expect(prismaMock.room.create).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 403 for raumaufmass imports without tenant scope', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/raumaufmass`,
      payload: createRaumaufmassPayload(),
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('returns 404 for raumaufmass imports when project is missing', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/raumaufmass`,
      headers: { 'x-tenant-id': tenantId },
      payload: createRaumaufmassPayload(),
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('lists raumaufmass import jobs for a project', async () => {
    prismaMock.importJob.findMany.mockResolvedValue([
      createImportJob({
        id: '77777777-7777-7777-7777-777777777777',
        source_format: 'raumaufmass_json',
        source_filename: 'aufmass-a.json',
      }),
      createImportJob({
        id: '88888888-8888-8888-8888-888888888888',
        source_format: 'raumaufmass_json',
        source_filename: 'aufmass-b.json',
      }),
    ])

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/raumaufmass-jobs`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(2)
    expect(prismaMock.importJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project_id: projectId,
          source_format: 'raumaufmass_json',
        }),
      }),
    )

    await app.close()
  })

  it('returns 403 for raumaufmass job list without tenant scope', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/raumaufmass-jobs`,
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('returns 404 for raumaufmass job list when project is missing', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(importRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/raumaufmass-jobs`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)

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
