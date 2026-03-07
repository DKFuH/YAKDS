import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('./client.js', () => ({
  api: apiMock,
}))

import { mediaCaptureApi } from './mediaCapture.js'

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('mediaCaptureApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { origin: 'https://okp.local' },
        __OKP_RUNTIME_CONTEXT__: { tenantId: TENANT_ID },
      },
    })
  })

  it('uploadScreenshot forwards tenant header and resolves relative links to absolute URLs', async () => {
    apiMock.post.mockResolvedValue({
      project_id: 'project-1',
      document_id: 'doc-1',
      filename: 'capture.png',
      mime_type: 'image/png',
      download_url: '/api/v1/projects/project-1/documents/doc-1/download',
      preview_url: '/api/v1/projects/project-1/documents/doc-1/download',
      width_px: 1280,
      height_px: 720,
    })

    const result = await mediaCaptureApi.uploadScreenshot('project-1', {
      image_base64: 'Zm9v',
      mime_type: 'image/png',
    })

    expect(apiMock.post).toHaveBeenCalledWith(
      '/projects/project-1/screenshot',
      expect.objectContaining({ image_base64: 'Zm9v' }),
      { 'X-Tenant-Id': TENANT_ID },
    )

    expect(result.download_url).toBe('https://okp.local/api/v1/projects/project-1/documents/doc-1/download')
    expect(result.preview_url).toBe('https://okp.local/api/v1/projects/project-1/documents/doc-1/download')
  })

  it('createExport360 forwards payload with tenant header', async () => {
    apiMock.post.mockResolvedValue({
      project_id: 'project-1',
      job_id: 'job-1',
      status: 'queued',
      status_url: '/api/v1/projects/project-1/export-360/job-1',
    })

    await mediaCaptureApi.createExport360('project-1', {
      preset: 'balanced',
      width_px: 4096,
      height_px: 2048,
      format: 'png',
      quality: 0.92,
    })

    expect(apiMock.post).toHaveBeenCalledWith(
      '/projects/project-1/export-360',
      expect.objectContaining({ preset: 'balanced' }),
      { 'X-Tenant-Id': TENANT_ID },
    )
  })

  it('getExport360Status normalizes relative preview and download URLs', async () => {
    apiMock.get.mockResolvedValue({
      project_id: 'project-1',
      job_id: 'job-1',
      status: 'done',
      error_message: null,
      preview_url: '/api/v1/projects/project-1/documents/doc-render/download',
      download_url: '/api/v1/projects/project-1/documents/doc-render/download',
      width_px: 4096,
      height_px: 2048,
      render_time_ms: 1200,
    })

    const status = await mediaCaptureApi.getExport360Status('project-1', 'job-1')

    expect(apiMock.get).toHaveBeenCalledWith(
      '/projects/project-1/export-360/job-1',
      { 'X-Tenant-Id': TENANT_ID },
    )
    expect(status.preview_url).toBe('https://okp.local/api/v1/projects/project-1/documents/doc-render/download')
    expect(status.download_url).toBe('https://okp.local/api/v1/projects/project-1/documents/doc-render/download')
  })
})
