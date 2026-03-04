import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { sendForbidden, sendNotFound } from '../errors.js'
import {
  extractBoundaryVertices,
  renderHtmlViewer,
  renderLayoutSheetSvg,
  renderPlanSvg,
} from '../services/vectorExportService.js'

type SheetConfig = {
  show_arc_annotations?: unknown
  arc_dimension_style?: unknown
  show_north_arrow?: unknown
}

function parseConfig(value: unknown): SheetConfig {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as SheetConfig
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SheetConfig
      }
    } catch {
      return {}
    }
  }

  return {}
}

function getTenantId(request: {
  tenantId?: string | null
  headers?: Record<string, string | string[] | undefined>
}): string | null {
  if (request.tenantId) {
    return request.tenantId
  }

  const tenantHeader = request.headers?.['x-tenant-id']
  if (!tenantHeader) {
    return null
  }

  return Array.isArray(tenantHeader) ? (tenantHeader[0] ?? null) : tenantHeader
}

function buildHtmlFilename(projectId: string): string {
  return `project-${projectId}.html`
}

function buildSvgFilename(suffix: string, id: string): string {
  return `${suffix}-${id}.svg`
}

export async function viewerExportsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/export/html-viewer', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      select: { id: true, name: true, tenant_id: true },
    })

    if (!project || project.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const rooms = await prisma.room.findMany({
      where: { project_id: project.id },
      select: { name: true, boundary: true },
      take: 1,
      orderBy: { created_at: 'asc' },
    })

    const firstRoom = rooms[0] ?? null
    const vertices = extractBoundaryVertices(firstRoom?.boundary)

    const html = renderHtmlViewer({
      projectId: project.id,
      projectName: project.name,
      roomName: firstRoom?.name ?? null,
      vertices,
    })

    reply.header('content-disposition', `attachment; filename="${buildHtmlFilename(project.id)}"`)
    reply.type('text/html; charset=utf-8')
    return reply.send(html)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/export/plan-svg', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      select: { id: true, name: true, tenant_id: true },
    })

    if (!project || project.tenant_id !== tenantId) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const rooms = await prisma.room.findMany({
      where: { project_id: project.id },
      select: { name: true, boundary: true },
      take: 1,
      orderBy: { created_at: 'asc' },
    })

    const firstRoom = rooms[0] ?? null
    const vertices = extractBoundaryVertices(firstRoom?.boundary)

    const svg = renderPlanSvg({
      projectName: project.name,
      roomName: firstRoom?.name ?? null,
      vertices,
    })

    reply.header('content-disposition', `attachment; filename="${buildSvgFilename('project-plan', project.id)}"`)
    reply.type('image/svg+xml')
    return reply.send(svg)
  })

  app.post<{ Params: { id: string } }>('/layout-sheets/:id/export/svg', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const sheet = await prisma.layoutSheet.findUnique({
      where: { id: request.params.id },
      select: { id: true, name: true, project_id: true, config: true },
    })

    if (!sheet) {
      return sendNotFound(reply, 'Layout sheet not found')
    }

    const project = await prisma.project.findFirst({
      where: {
        id: sheet.project_id,
        tenant_id: tenantId,
      },
      select: { id: true },
    })

    if (!project) {
      return sendNotFound(reply, 'Layout sheet not found in tenant scope')
    }

    const config = parseConfig(sheet.config)
    const showArc = Boolean(config.show_arc_annotations)
    const showNorthArrow = Boolean(config.show_north_arrow)
    const arcStyle = String(config.arc_dimension_style ?? 'radius-first')
    const arcLabel = arcStyle === 'length-first' ? 'L=1571 mm' : 'R=1000 mm'

    const environment = showNorthArrow
      ? await prisma.projectEnvironment.findUnique({
          where: { project_id: project.id },
          select: { north_angle_deg: true },
        })
      : null

    const svg = renderLayoutSheetSvg({
      sheetName: sheet.name,
      showArcAnnotation: showArc,
      arcLabel,
      showNorthArrow,
      northAngleDeg: environment?.north_angle_deg ?? 0,
    })

    reply.header('content-disposition', `attachment; filename="${buildSvgFilename('layout-sheet', sheet.id)}"`)
    reply.type('image/svg+xml')
    return reply.send(svg)
  })
}
