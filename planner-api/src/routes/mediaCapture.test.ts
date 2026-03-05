import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const jobId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    projectEnvironment: {
      findUnique: vi.fn(),
    },
    renderJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
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

import { mediaCaptureRoutes } from './mediaCapture.js'

async function createApp(tenantScope: string | null = tenantId) {
  const app = Fastify()
  app.addHook('preHandler', async (request) => {
    request.tenantId = tenantScope
  })
  await app.register(mediaCaptureRoutes, { prefix: '/api/v1' })
  return app
}

describe('mediaCaptureRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findFirst.mockResolvedValue({ id: projectId })
    prismaMock.projectEnvironment.findUnique.mockResolvedValue(null)

    registerProjectDocumentMock.mockResolvedValue({
      id: 'doc-1',
      filename: 'screenshot.png',
      mime_type: 'image/png',
    })

    prismaMock.renderJob.create.mockResolvedValue({
      id: jobId,
      project_id: projectId,
      status: 'queued',
    })

    prismaMock.renderJob.findUnique.mockResolvedValue({
      id: jobId,
      project_id: projectId,
      status: 'queued',
      error_message: null,
      result: null,
    })
  })

  it('POST /projects/:id/screenshot returns 403 without tenant scope', async () => {
    const app = await createApp(null)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/screenshot`,
      payload: { image_base64: Buffer.from('x').toString('base64') },
    })

    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it('POST /projects/:id/screenshot rejects invalid payload', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/screenshot`,
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })

  it('POST /projects/:id/screenshot returns 404 when project is out of scope', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/screenshot`,
      payload: { image_base64: Buffer.from('x').toString('base64') },
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('POST /projects/:id/screenshot stores document and returns download URL', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/screenshot`,
      payload: {
        image_base64: Buffer.from('png').toString('base64'),
        mime_type: 'image/png',
        width_px: 1280,
        height_px: 720,
        view_mode: 'split',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      project_id: projectId,
      document_id: 'doc-1',
      preview_url: `/api/v1/projects/${projectId}/documents/doc-1/download`,
      download_url: `/api/v1/projects/${projectId}/documents/doc-1/download`,
      width_px: 1280,
      height_px: 720,
    })

    expect(registerProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'render_image',
        sourceKind: 'manual_upload',
        tags: expect.arrayContaining(['screenshot', 'view:split']),
      }),
    )

    await app.close()
  })

  it('POST /projects/:id/export-360 returns 403 without tenant scope', async () => {
    const app = await createApp(null)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export-360`,
      payload: {},
    })

    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it('POST /projects/:id/export-360 creates queued render job with defaults', async () => {
    prismaMock.projectEnvironment.findUnique.mockResolvedValue({
      config_json: {
        render_environment: {
          preset_id: 'interior',
          intensity: 0.8,
          rotation_deg: 280,
          ground_tint: '#8e7967',
        },
      },
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export-360`,
      payload: {},
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      project_id: projectId,
      job_id: jobId,
      status: 'queued',
    })

    expect(prismaMock.renderJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scene_payload: expect.objectContaining({
            render_preset: 'balanced',
            presentation_source: { kind: 'manual-camera' },
            export_360: expect.objectContaining({
              enabled: true,
              width_px: 4096,
              height_px: 2048,
              format: 'png',
            }),
            render_environment: {
              preset_id: 'interior',
              intensity: 0.8,
              rotation_deg: 280,
              ground_tint: '#8E7967',
            },
          }),
        }),
      }),
    )

    await app.close()
  })

  it('POST /projects/:id/export-360 accepts explicit environment payload', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export-360`,
      payload: {
        preset: 'best',
        width_px: 6144,
        height_px: 3072,
        format: 'jpeg',
        quality: 0.86,
        environment: {
          preset_id: 'studio',
          intensity: 1.4,
          rotation_deg: 24,
          ground_tint: '#ccddee',
        },
      },
    })

    expect(response.statusCode).toBe(202)
    expect(prismaMock.renderJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scene_payload: expect.objectContaining({
            render_preset: 'best',
            export_360: expect.objectContaining({
              format: 'jpeg',
              quality: 0.86,
              width_px: 6144,
              height_px: 3072,
            }),
            render_environment: {
              preset_id: 'studio',
              intensity: 1.4,
              rotation_deg: 24,
              ground_tint: '#CCDDEE',
            },
          }),
        }),
      }),
    )

    await app.close()
  })

  it('GET /projects/:id/export-360/:jobId returns queued status', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/export-360/${jobId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      project_id: projectId,
      job_id: jobId,
      status: 'queued',
      preview_url: null,
    })

    await app.close()
  })

  it('GET /projects/:id/export-360/:jobId returns done status with download URL', async () => {
    prismaMock.renderJob.findUnique.mockResolvedValue({
      id: jobId,
      project_id: projectId,
      status: 'done',
      error_message: null,
      result: {
        image_url: `/api/v1/projects/${projectId}/documents/doc-render/download`,
        width_px: 4096,
        height_px: 2048,
        render_time_ms: 1234,
      },
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/export-360/${jobId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'done',
      preview_url: `/api/v1/projects/${projectId}/documents/doc-render/download`,
      download_url: `/api/v1/projects/${projectId}/documents/doc-render/download`,
      width_px: 4096,
      height_px: 2048,
    })

    await app.close()
  })

  it('GET /projects/:id/export-360/:jobId returns 404 for foreign project job', async () => {
    prismaMock.renderJob.findUnique.mockResolvedValue({
      id: jobId,
      project_id: '99999999-9999-9999-9999-999999999999',
      status: 'queued',
      error_message: null,
      result: null,
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/export-360/${jobId}`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
