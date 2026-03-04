import { api } from './client.js'

export type ImportStatus =
  | 'queued'
  | 'processing'
  | 'done'
  | 'failed'

export interface ImportProtocolEntry {
  entity_id: string | null
  status: 'imported' | 'ignored' | 'needs_review'
  reason: string
}

export interface LayerMappingEntry {
  action: 'imported' | 'ignored' | 'needs_review'
  reason?: string
}

export interface ComponentMappingEntry {
  target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored'
  catalog_item_id?: string | null
  label?: string | null
}

export interface MappingState {
  layers?: Record<string, LayerMappingEntry>
  components?: Record<string, ComponentMappingEntry>
}

export interface ImportAsset {
  id: string
  import_job_id: string
  source_format: 'dxf' | 'dwg' | 'skp' | string
  source_filename: string
  units: 'mm' | 'cm' | 'm' | 'inch' | 'feet' | string
  layers: unknown[]
  entities: unknown[]
  protocol: ImportProtocolEntry[] | unknown
  created_at: string
  mapping_state?: MappingState
}

export interface ImportJob {
  id: string
  project_id: string
  status: ImportStatus | string
  source_format: 'dxf' | 'dwg' | 'skp' | string
  source_filename: string
  file_size_bytes: number
  import_asset: ImportAsset | null
  protocol: ImportProtocolEntry[] | unknown
  error_message: string | null
  mapping_state?: MappingState
  created_at: string
  completed_at: string | null
}

export interface RaumaufmassDiagnosticEntry {
  code: string
  path: string
  message: string
}

export interface RaumaufmassDiagnostics {
  warnings: RaumaufmassDiagnosticEntry[]
  errors: RaumaufmassDiagnosticEntry[]
}

export interface RaumaufmassPreviewRoom {
  index: number
  name: string
  height_mm: number
  boundary_vertices: number
  wall_segments: number
  openings_count: number
  warning_count: number
}

export interface RaumaufmassValidationResult {
  valid: boolean
  source_filename: string
  diagnostics: RaumaufmassDiagnostics
  preview: {
    rooms: RaumaufmassPreviewRoom[]
    summary: {
      room_count: number
      opening_count: number
      warning_count: number
      error_count: number
    }
  }
}

export interface RaumaufmassImportResult {
  job_id: string
  imported_rooms: number
  room_ids: string[]
  diagnostics: RaumaufmassDiagnostics
  preview: RaumaufmassValidationResult['preview']
}

export type LayerMapping = Record<string, {
  action: 'imported' | 'ignored' | 'needs_review'
  reason?: string
}>

export type ComponentMapping = Record<string, {
  target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored'
  catalog_item_id?: string | null
  label?: string | null
}>

export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => {
      reject(new Error('Datei konnte nicht als Base64 gelesen werden.'))
    }

    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Ungültiger Dateiinhalt.'))
        return
      }

      const base64 = result.includes(',') ? result.split(',')[1] : result
      if (!base64) {
        reject(new Error('Leerer Base64-Inhalt.'))
        return
      }

      resolve(base64)
    }

    reader.readAsDataURL(file)
  })
}

async function fileToText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => {
      reject(new Error('Datei konnte nicht als Text gelesen werden.'))
    }

    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Ungültiger Textinhalt.'))
        return
      }
      resolve(result)
    }

    reader.readAsText(file)
  })
}

export async function createCadImportJob(input: {
  project_id: string
  file: File
  layer_mapping?: LayerMapping
}): Promise<ImportJob> {
  const ext = input.file.name.toLowerCase().split('.').pop()

  if (ext === 'dxf') {
    const dxf = await fileToText(input.file)
    return api.post<ImportJob>('/imports/cad', {
      project_id: input.project_id,
      source_filename: input.file.name,
      source_format: 'dxf',
      dxf,
      layer_mapping: input.layer_mapping,
    })
  }

  if (ext === 'dwg') {
    const file_base64 = await fileToBase64(input.file)
    return api.post<ImportJob>('/imports/cad', {
      project_id: input.project_id,
      source_filename: input.file.name,
      source_format: 'dwg',
      file_base64,
      layer_mapping: input.layer_mapping,
    })
  }

  throw new Error('Nur .dxf oder .dwg sind für CAD-Import erlaubt.')
}

export async function createSkpImportJob(input: {
  project_id: string
  file: File
  component_mapping?: ComponentMapping
}): Promise<ImportJob> {
  const ext = input.file.name.toLowerCase().split('.').pop()
  if (ext !== 'skp') {
    throw new Error('Nur .skp ist für SKP-Import erlaubt.')
  }

  const file_base64 = await fileToBase64(input.file)

  return api.post<ImportJob>('/imports/skp', {
    project_id: input.project_id,
    source_filename: input.file.name,
    file_base64,
    component_mapping: input.component_mapping,
  })
}

export function getImportJob(id: string): Promise<ImportJob> {
  return api.get<ImportJob>(`/imports/${id}`)
}

export function validateRaumaufmass(projectId: string, payload: unknown, sourceFilename?: string): Promise<RaumaufmassValidationResult> {
  const normalizedPayload = (
    payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : { rooms: [] }
  )

  return api.post<RaumaufmassValidationResult>(
    `/projects/${projectId}/validate/raumaufmass`,
    {
      ...normalizedPayload,
      ...(sourceFilename ? { source_filename: sourceFilename } : {}),
    },
  )
}

export function importRaumaufmass(projectId: string, payload: unknown, sourceFilename?: string): Promise<RaumaufmassImportResult> {
  const normalizedPayload = (
    payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : { rooms: [] }
  )

  return api.post<RaumaufmassImportResult>(
    `/projects/${projectId}/import/raumaufmass`,
    {
      ...normalizedPayload,
      ...(sourceFilename ? { source_filename: sourceFilename } : {}),
    },
  )
}

export function listRaumaufmassJobs(projectId: string): Promise<ImportJob[]> {
  return api.get<ImportJob[]>(`/projects/${projectId}/raumaufmass-jobs`)
}
