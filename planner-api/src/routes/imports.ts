import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { parseDxf } from '@yakds/dxf-import'
import { parseSkp } from '@yakds/skp-import'
import type { CadLayer } from '@yakds/shared-schemas'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'

const LegacyImportJobSchema = z.object({
  project_id: z.string().uuid(),
  source_format: z.enum(['dxf', 'dwg', 'skp']),
  source_filename: z.string().min(1).max(255),
})

const Base64Schema = z.string().min(1).regex(/^[A-Za-z0-9+/=]+$/)

const DxfPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  dxf: z.string().min(1),
})

const SkpPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  file_base64: Base64Schema,
})

const LayerMappingSchema = z.object({
  action: z.enum(['imported', 'ignored', 'needs_review']),
  reason: z.string().min(1).max(500).optional(),
})

const ComponentMappingSchema = z.object({
  target_type: z.enum(['cabinet', 'appliance', 'reference_object', 'ignored']),
  catalog_item_id: z.string().min(1).max(255).nullable().optional(),
  label: z.string().min(1).max(255).nullable().optional(),
})

const CadImportSchema = z
  .object({
    project_id: z.string().uuid(),
    source_filename: z.string().min(1).max(255),
    source_format: z.enum(['dxf', 'dwg']).optional(),
    dxf: z.string().min(1).optional(),
    file_base64: Base64Schema.optional(),
    layer_mapping: z.record(LayerMappingSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const format = deriveCadSourceFormat(value.source_filename, value.source_format)

    if (format === 'dxf' && !value.dxf && !value.file_base64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DXF imports require either dxf or file_base64 payload data.',
      })
    }

    if (format === 'dwg' && !value.file_base64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DWG imports currently require a base64 encoded file payload.',
      })
    }
  })

const SkpImportSchema = z.object({
  project_id: z.string().uuid(),
  source_filename: z.string().min(1).max(255),
  file_base64: Base64Schema,
  component_mapping: z.record(ComponentMappingSchema).optional(),
})

const ImportJobParamsSchema = z.object({
  id: z.string().uuid(),
})

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

function nowIsoString(): string {
  return new Date().toISOString()
}

function deriveCadSourceFormat(
  sourceFilename: string,
  explicit?: 'dxf' | 'dwg',
): 'dxf' | 'dwg' {
  if (explicit) {
    return explicit
  }

  return sourceFilename.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf'
}

function getImportMimeType(sourceFormat: 'dxf' | 'dwg' | 'skp'): string {
  if (sourceFormat === 'dxf') {
    return 'application/dxf'
  }

  if (sourceFormat === 'dwg') {
    return 'application/acad'
  }

  return 'application/octet-stream'
}

function emptyCadImportAsset(
  importJobId: string,
  sourceFilename: string,
  sourceFormat: 'dxf' | 'dwg',
  protocol: Array<{ entity_id: string | null; status: 'imported' | 'ignored' | 'needs_review'; reason: string }>,
  rawUploadBase64?: string,
) {
  return {
    id: randomUUID(),
    import_job_id: importJobId,
    source_format: sourceFormat,
    source_filename: sourceFilename,
    layers: [],
    entities: [],
    bounding_box: {
      min: { x_mm: 0, y_mm: 0 },
      max: { x_mm: 0, y_mm: 0 },
    },
    units: 'mm',
    created_at: nowIsoString(),
    protocol,
    ...(rawUploadBase64 ? { raw_upload_base64: rawUploadBase64 } : {}),
  }
}

function applyCadLayerMapping(
  asset: ReturnType<typeof parseDxf>,
  layerMapping?: Record<string, z.infer<typeof LayerMappingSchema>>,
) {
  if (!layerMapping) {
    return asset
  }

  const ignoredLayerIds = new Set(
    asset.layers
      .filter((layer) => layerMapping[layer.name]?.action === 'ignored')
      .map((layer) => layer.id),
  )

  const entities = asset.entities.filter((entity) => !ignoredLayerIds.has(entity.layer_id))
  const layers = asset.layers.map((layer) => {
    const isIgnored = layerMapping[layer.name]?.action === 'ignored'
    return {
      ...layer,
      visible: isIgnored ? false : layer.visible,
      entity_count: entities.filter((entity) => entity.layer_id === layer.id).length,
    }
  })

  const protocol = [
    ...asset.protocol,
    ...Object.entries(layerMapping).map(([layerName, entry]) => ({
      entity_id: null,
      status: entry.action,
      reason: entry.reason ?? `Layer ${layerName} marked as ${entry.action}.`,
    })),
  ]

  return {
    ...asset,
    layers,
    entities,
    protocol,
    mapping_state: {
      layers: layerMapping,
    },
  }
}

function createCadProtocol(
  asset: ReturnType<typeof applyCadLayerMapping>,
  sourceFilename: string,
) {
  if (asset.protocol.length > 0) {
    return asset.protocol
  }

  return [
    {
      entity_id: null,
      status: 'imported' as const,
      reason: `Parsed ${asset.entities.length} CAD entities from ${sourceFilename}.`,
    },
  ]
}

function applySkpComponentMapping(
  referenceModel: ReturnType<typeof parseSkp>,
  componentMapping?: Record<string, z.infer<typeof ComponentMappingSchema>>,
) {
  if (!componentMapping) {
    return referenceModel
  }

  const components = referenceModel.components.map((component) => {
    const override =
      componentMapping[component.skp_instance_guid] ?? componentMapping[component.skp_component_name]

    if (!override) {
      return component
    }

    return {
      ...component,
      mapping: {
        component_id: component.id,
        target_type: override.target_type,
        catalog_item_id: override.catalog_item_id ?? null,
        label: override.label ?? component.skp_component_name,
      },
    }
  })

  return {
    ...referenceModel,
    components,
    mapping_state: {
      components: componentMapping,
    },
  }
}

function createSkpProtocol(referenceModel: ReturnType<typeof applySkpComponentMapping>) {
  if (referenceModel.components.length === 0) {
    return [
      {
        entity_id: null,
        status: 'needs_review' as const,
        reason: 'No components were parsed from the SKP payload.',
      },
    ]
  }

  return referenceModel.components.map((component) => {
    const targetType = component.mapping?.target_type ?? 'reference_object'

    if (targetType === 'ignored') {
      return {
        entity_id: component.id,
        status: 'ignored' as const,
        reason: `Component ${component.skp_component_name} was ignored.`,
      }
    }

    if (targetType === 'reference_object') {
      return {
        entity_id: component.id,
        status: 'needs_review' as const,
        reason: `Component ${component.skp_component_name} requires manual mapping review.`,
      }
    }

    return {
      entity_id: component.id,
      status: 'imported' as const,
      reason: `Component ${component.skp_component_name} mapped as ${targetType}.`,
    }
  })
}

async function createQueuedImportJob(
  projectId: string,
  sourceFormat: 'dxf' | 'dwg' | 'skp',
  sourceFilename: string,
  fileSizeBytes: number,
) {
  const queuedJob = await prisma.importJob.create({
    data: {
      project_id: projectId,
      status: 'queued',
      source_format: sourceFormat,
      source_filename: sourceFilename,
      file_size_bytes: fileSizeBytes,
      protocol: [] as Prisma.InputJsonValue,
    },
  })

  await prisma.importJob.update({
    where: { id: queuedJob.id },
    data: { status: 'processing' },
  })

  return queuedJob
}

async function finalizeImportJob(
  importJobId: string,
  importAsset: unknown,
  protocol: unknown,
) {
  return prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'done',
      import_asset: importAsset as Prisma.InputJsonValue,
      protocol: protocol as Prisma.InputJsonValue,
      completed_at: new Date(),
      error_message: null,
    },
  })
}

async function failImportJob(importJobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Import processing failed.'

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'failed',
      error_message: message,
      completed_at: new Date(),
    },
  })

  return message
}

function getImportAssetLayers(importAsset: unknown): CadLayer[] {
  if (!importAsset || typeof importAsset !== 'object' || !('layers' in importAsset)) {
    return []
  }

  const layers = (importAsset as { layers?: unknown }).layers
  if (!Array.isArray(layers)) {
    return []
  }

  return layers.filter((layer): layer is CadLayer => {
    return (
      typeof layer === 'object' &&
      layer !== null &&
      'id' in layer &&
      'name' in layer &&
      'visible' in layer &&
      'entity_count' in layer
    )
  })
}

function getImportAssetMappingState(importAsset: unknown): Record<string, unknown> {
  if (!importAsset || typeof importAsset !== 'object' || !('mapping_state' in importAsset)) {
    return {}
  }

  const mappingState = (importAsset as { mapping_state?: unknown }).mapping_state
  if (!mappingState || typeof mappingState !== 'object' || Array.isArray(mappingState)) {
    return {}
  }

  return mappingState as Record<string, unknown>
}

function getTenantId(request: unknown): string | null {
  const scopedTenantId = (request as { tenantId?: string | null }).tenantId
  if (scopedTenantId) {
    return scopedTenantId
  }

  const header = (request as { headers?: Record<string, string | string[] | undefined> }).headers?.['x-tenant-id']
  if (!header) {
    return null
  }

  return Array.isArray(header) ? (header[0] ?? null) : header
}

async function findProjectInTenantScope(projectId: string, tenantId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: { id: true, tenant_id: true },
  })
}

async function findImportJobInTenantScope(importJobId: string, tenantId: string) {
  return prisma.importJob.findFirst({
    where: {
      id: importJobId,
      project: {
        tenant_id: tenantId,
      },
    },
  })
}

export async function importRoutes(app: FastifyInstance) {
  app.post('/imports/preview/dxf', async (request, reply) => {
    const parsed = DxfPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseDxf(parsed.data.dxf, parsed.data.source_filename))
  })

  app.post('/imports/preview/skp', async (request, reply) => {
    const parsed = SkpPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseSkp(decodeBase64(parsed.data.file_base64), parsed.data.source_filename))
  })

  app.post('/imports/cad', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = CadImportSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsed.data.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const sourceFormat = deriveCadSourceFormat(parsed.data.source_filename, parsed.data.source_format)
    const sourceBuffer =
      parsed.data.dxf !== undefined
        ? Buffer.from(parsed.data.dxf, 'utf8')
        : decodeBase64(parsed.data.file_base64 ?? '')
    const fileSizeBytes =
      parsed.data.dxf !== undefined
        ? Buffer.byteLength(parsed.data.dxf, 'utf8')
        : decodeBase64(parsed.data.file_base64 ?? '').byteLength
    const importJob = await createQueuedImportJob(
      project.id,
      sourceFormat,
      parsed.data.source_filename,
      fileSizeBytes,
    )

    try {
      let importAsset: unknown
      let protocol: unknown

      if (sourceFormat === 'dwg') {
        const dwgProtocol = [
          {
            entity_id: null,
            status: 'needs_review' as const,
            reason: 'DWG upload stored, but binary DWG parsing is not wired yet.',
          },
          ...Object.entries(parsed.data.layer_mapping ?? {}).map(([layerName, entry]) => ({
            entity_id: null,
            status: entry.action,
            reason: entry.reason ?? `Layer ${layerName} marked as ${entry.action}.`,
          })),
        ]

        importAsset = {
          ...emptyCadImportAsset(
            importJob.id,
            parsed.data.source_filename,
            'dwg',
            dwgProtocol,
            parsed.data.file_base64,
          ),
          ...(parsed.data.layer_mapping
            ? {
              mapping_state: {
                layers: parsed.data.layer_mapping,
              },
            }
            : {}),
        }
        protocol = dwgProtocol
      } else {
        const dxfString =
          parsed.data.dxf ?? decodeBase64(parsed.data.file_base64 ?? '').toString('utf8')
        const parsedAsset = parseDxf(dxfString, parsed.data.source_filename)
        const mappedAsset = applyCadLayerMapping(
          {
            ...parsedAsset,
            import_job_id: importJob.id,
            source_format: sourceFormat,
          },
          parsed.data.layer_mapping,
        )

        protocol = createCadProtocol(mappedAsset, parsed.data.source_filename)
        importAsset = {
          ...mappedAsset,
          protocol,
        }
      }

      const completedJob = await finalizeImportJob(importJob.id, importAsset, protocol)
      await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: parsed.data.source_filename,
        originalFilename: parsed.data.source_filename,
        mimeType: getImportMimeType(sourceFormat),
        uploadedBy: 'system:import',
        type: 'cad_import',
        tags: ['import', sourceFormat],
        sourceKind: 'import_job',
        sourceId: importJob.id,
        buffer: sourceBuffer,
      })
      return reply.status(201).send(completedJob)
    } catch (error) {
      const message = await failImportJob(importJob.id, error)
      return sendServerError(reply, message)
    }
  })

  app.post('/imports/skp', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = SkpImportSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsed.data.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const fileBuffer = decodeBase64(parsed.data.file_base64)
    const importJob = await createQueuedImportJob(
      project.id,
      'skp',
      parsed.data.source_filename,
      fileBuffer.byteLength,
    )

    try {
      const parsedModel = parseSkp(fileBuffer, parsed.data.source_filename)
      const mappedModel = applySkpComponentMapping(
        {
          ...parsedModel,
          project_id: project.id,
          import_job_id: importJob.id,
        },
        parsed.data.component_mapping,
      )
      const protocol = createSkpProtocol(mappedModel)
      const completedJob = await finalizeImportJob(importJob.id, mappedModel, protocol)
      await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: parsed.data.source_filename,
        originalFilename: parsed.data.source_filename,
        mimeType: getImportMimeType('skp'),
        uploadedBy: 'system:import',
        type: 'cad_import',
        tags: ['import', 'skp'],
        sourceKind: 'import_job',
        sourceId: importJob.id,
        buffer: fileBuffer,
      })

      return reply.status(201).send(completedJob)
    } catch (error) {
      const message = await failImportJob(importJob.id, error)
      return sendServerError(reply, message)
    }
  })

  app.get('/imports/:id', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    return reply.send(importJob)
  })

  app.get('/imports/:id/layers', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    if (!importJob.import_asset) {
      return reply.status(409).send({
        error: 'IMPORT_ASSET_NOT_READY',
        message: 'Import asset is not available yet.',
      })
    }

    return reply.send(getImportAssetLayers(importJob.import_asset))
  })

  app.get('/imports/:id/mapping-state', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    if (!importJob.import_asset) {
      return reply.status(409).send({
        error: 'IMPORT_ASSET_NOT_READY',
        message: 'Import asset is not available yet.',
      })
    }

    return reply.send(getImportAssetMappingState(importJob.import_asset))
  })

  app.post('/imports', async (request, reply) => {
    const parsed = LegacyImportJobSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return sendBadRequest(
      reply,
      `Use /imports/${parsed.data.source_format === 'skp' ? 'skp' : 'cad'} for concrete import jobs.`,
    )
  })
}
