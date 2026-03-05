import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const PresetParamsSchema = z.object({
  id: z.string().uuid(),
  presetId: z.string().uuid(),
})

const CameraVectorSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
})

const CameraModeSchema = z.enum(['orbit', 'visitor'])

const CameraPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  position: CameraVectorSchema,
  target: CameraVectorSchema,
  fov: z.number().min(20).max(110),
  mode: CameraModeSchema,
  is_default: z.boolean().optional(),
})

const CameraPresetPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  position: CameraVectorSchema.optional(),
  target: CameraVectorSchema.optional(),
  fov: z.number().min(20).max(110).optional(),
  mode: CameraModeSchema.optional(),
  is_default: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
})

type CameraVector = {
  x: number
  y: number
  z: number
}

type CameraPreset = {
  id: string
  name: string
  position: CameraVector
  target: CameraVector
  fov: number
  mode: 'orbit' | 'visitor'
  is_default: boolean
  created_at: string
  updated_at: string
}

type CameraPresetStore = {
  presets: CameraPreset[]
  active_preset_id: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function normalizeVector(value: unknown): CameraVector | null {
  const candidate = asRecord(value)
  if (!candidate) {
    return null
  }

  if (typeof candidate.x !== 'number' || !Number.isFinite(candidate.x)) {
    return null
  }
  if (typeof candidate.y !== 'number' || !Number.isFinite(candidate.y)) {
    return null
  }
  if (typeof candidate.z !== 'number' || !Number.isFinite(candidate.z)) {
    return null
  }

  return {
    x: candidate.x,
    y: candidate.y,
    z: candidate.z,
  }
}

function normalizePreset(value: unknown): CameraPreset | null {
  const candidate = asRecord(value)
  if (!candidate) {
    return null
  }

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null
  }

  const position = normalizeVector(candidate.position)
  const target = normalizeVector(candidate.target)
  if (!position || !target) {
    return null
  }

  if (typeof candidate.fov !== 'number' || !Number.isFinite(candidate.fov)) {
    return null
  }

  const mode = candidate.mode
  if (mode !== 'orbit' && mode !== 'visitor') {
    return null
  }

  const nowIso = new Date().toISOString()
  const createdAt = typeof candidate.created_at === 'string' ? candidate.created_at : nowIso
  const updatedAt = typeof candidate.updated_at === 'string' ? candidate.updated_at : createdAt

  return {
    id: candidate.id,
    name: candidate.name,
    position,
    target,
    fov: Math.max(20, Math.min(110, candidate.fov)),
    mode,
    is_default: candidate.is_default === true,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function normalizeStore(configJson: unknown): CameraPresetStore {
  const root = asRecord(configJson)
  const rawPresets = Array.isArray(root?.camera_presets) ? root.camera_presets : []

  const presets: CameraPreset[] = []
  for (const entry of rawPresets) {
    const normalized = normalizePreset(entry)
    if (normalized) {
      presets.push(normalized)
    }
  }

  let activePresetId: string | null = null
  if (typeof root?.active_camera_preset_id === 'string') {
    activePresetId = root.active_camera_preset_id
  }

  if (activePresetId && !presets.some((entry) => entry.id === activePresetId)) {
    activePresetId = null
  }

  return {
    presets,
    active_preset_id: activePresetId,
  }
}

function withSingleDefault(presets: CameraPreset[], defaultPresetId: string | null): CameraPreset[] {
  if (!defaultPresetId) {
    return presets
  }

  return presets.map((preset) => ({
    ...preset,
    is_default: preset.id === defaultPresetId,
  }))
}

function mergeStoreConfig(existing: Record<string, unknown>, store: CameraPresetStore): Record<string, unknown> {
  return {
    ...existing,
    camera_presets: store.presets,
    active_camera_preset_id: store.active_preset_id,
  }
}

async function resolveScopedProject(projectId: string, tenantId: string): Promise<{ id: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, tenant_id: true },
  })

  if (!project || project.tenant_id !== tenantId) {
    return null
  }

  return { id: project.id }
}

async function saveStore(projectId: string, tenantId: string, nextStore: CameraPresetStore): Promise<void> {
  const existingEnvironment = await prisma.projectEnvironment.findUnique({
    where: { project_id: projectId },
    select: {
      id: true,
      config_json: true,
    },
  })

  const currentConfig = asRecord(existingEnvironment?.config_json) ?? {}
  const nextConfig = mergeStoreConfig(currentConfig, nextStore)

  if (existingEnvironment?.id) {
    await prisma.projectEnvironment.update({
      where: { project_id: projectId },
      data: {
        config_json: nextConfig as Prisma.InputJsonValue,
      },
    })
    return
  }

  await prisma.projectEnvironment.create({
    data: {
      tenant_id: tenantId,
      project_id: projectId,
      north_angle_deg: 0,
      daylight_enabled: true,
      config_json: nextConfig as Prisma.InputJsonValue,
    },
  })
}

export async function cameraPresetRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/camera-presets', async (request, reply) => {
    if (!request.tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await resolveScopedProject(parsedParams.data.id, request.tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })

    const store = normalizeStore(environment?.config_json)
    return reply.send({
      project_id: project.id,
      presets: store.presets,
      active_preset_id: store.active_preset_id,
    })
  })

  app.post<{ Params: { id: string } }>('/projects/:id/camera-presets', async (request, reply) => {
    if (!request.tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const parsedBody = CameraPresetCreateSchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid camera preset payload')
    }

    const project = await resolveScopedProject(parsedParams.data.id, request.tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })
    const store = normalizeStore(environment?.config_json)

    const nowIso = new Date().toISOString()
    const presetId = randomUUID()
    const createdPreset: CameraPreset = {
      id: presetId,
      name: parsedBody.data.name,
      position: parsedBody.data.position,
      target: parsedBody.data.target,
      fov: parsedBody.data.fov,
      mode: parsedBody.data.mode,
      is_default: parsedBody.data.is_default === true,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const defaultPresetId = createdPreset.is_default ? createdPreset.id : null
    const nextPresets = withSingleDefault([...store.presets, createdPreset], defaultPresetId)
    const nextStore: CameraPresetStore = {
      presets: nextPresets,
      active_preset_id: createdPreset.is_default ? createdPreset.id : store.active_preset_id,
    }

    await saveStore(project.id, request.tenantId, nextStore)

    return reply.status(201).send({
      project_id: project.id,
      preset: nextPresets.find((entry) => entry.id === createdPreset.id) ?? createdPreset,
      presets: nextStore.presets,
      active_preset_id: nextStore.active_preset_id,
    })
  })

  app.patch<{ Params: { id: string; presetId: string } }>('/projects/:id/camera-presets/:presetId', async (request, reply) => {
    if (!request.tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsedParams = PresetParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const parsedBody = CameraPresetPatchSchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid camera preset payload')
    }

    const project = await resolveScopedProject(parsedParams.data.id, request.tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })
    const store = normalizeStore(environment?.config_json)

    const presetIndex = store.presets.findIndex((entry) => entry.id === parsedParams.data.presetId)
    if (presetIndex < 0) {
      return sendNotFound(reply, 'Camera preset not found')
    }

    const current = store.presets[presetIndex]
    const updatedPreset: CameraPreset = {
      ...current,
      ...(parsedBody.data.name !== undefined ? { name: parsedBody.data.name } : {}),
      ...(parsedBody.data.position !== undefined ? { position: parsedBody.data.position } : {}),
      ...(parsedBody.data.target !== undefined ? { target: parsedBody.data.target } : {}),
      ...(parsedBody.data.fov !== undefined ? { fov: parsedBody.data.fov } : {}),
      ...(parsedBody.data.mode !== undefined ? { mode: parsedBody.data.mode } : {}),
      ...(parsedBody.data.is_default !== undefined ? { is_default: parsedBody.data.is_default } : {}),
      updated_at: new Date().toISOString(),
    }

    const nextPresets = [...store.presets]
    nextPresets[presetIndex] = updatedPreset

    let normalizedPresets = nextPresets
    if (parsedBody.data.is_default === true) {
      normalizedPresets = withSingleDefault(nextPresets, updatedPreset.id)
    }

    const nextStore: CameraPresetStore = {
      presets: normalizedPresets,
      active_preset_id: store.active_preset_id,
    }

    await saveStore(project.id, request.tenantId, nextStore)

    return reply.send({
      project_id: project.id,
      preset: normalizedPresets[presetIndex],
      presets: nextStore.presets,
      active_preset_id: nextStore.active_preset_id,
    })
  })

  app.delete<{ Params: { id: string; presetId: string } }>('/projects/:id/camera-presets/:presetId', async (request, reply) => {
    if (!request.tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsedParams = PresetParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const project = await resolveScopedProject(parsedParams.data.id, request.tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })
    const store = normalizeStore(environment?.config_json)

    const exists = store.presets.some((entry) => entry.id === parsedParams.data.presetId)
    if (!exists) {
      return sendNotFound(reply, 'Camera preset not found')
    }

    const nextPresets = store.presets.filter((entry) => entry.id !== parsedParams.data.presetId)
    const nextActive = store.active_preset_id === parsedParams.data.presetId ? null : store.active_preset_id

    await saveStore(project.id, request.tenantId, {
      presets: nextPresets,
      active_preset_id: nextActive,
    })

    return reply.status(204).send()
  })

  app.post<{ Params: { id: string; presetId: string } }>('/projects/:id/camera-presets/:presetId/apply', async (request, reply) => {
    if (!request.tenantId) {
      return sendForbidden(reply, 'Missing tenant scope')
    }

    const parsedParams = PresetParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const project = await resolveScopedProject(parsedParams.data.id, request.tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })
    const store = normalizeStore(environment?.config_json)

    const preset = store.presets.find((entry) => entry.id === parsedParams.data.presetId)
    if (!preset) {
      return sendNotFound(reply, 'Camera preset not found')
    }

    const nextStore: CameraPresetStore = {
      presets: store.presets,
      active_preset_id: preset.id,
    }

    await saveStore(project.id, request.tenantId, nextStore)

    return reply.send({
      project_id: project.id,
      preset,
      active_preset_id: preset.id,
    })
  })
}
