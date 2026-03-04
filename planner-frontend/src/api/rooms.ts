import { api } from './client.js'
import { createRoom as createDemoRoom, updateRoom as updateDemoRoom } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'
import type { Vertex, WallSegment, WallObject, WallInstallation, WorktopSchema, MeasureLine, SectionLine, Comment, RoomColoring, DecoObject, LightingProfile } from '@shared/types'

export interface RoomBoundaryPayload {
  vertices: Vertex[]
  wall_segments: WallSegment[]
}

export interface ReferenceImagePayload {
  url: string
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

export interface RoomPayload {
  id: string
  project_id: string
  name: string
  ceiling_height_mm: number
  boundary: RoomBoundaryPayload
  coloring?: RoomColoring
  ceiling_constraints: unknown[]
  openings: unknown[]
  placements: unknown[]
  reference_image?: ReferenceImagePayload | null
  created_at: string
  updated_at: string
}

export interface MeasurementImportSegmentPayload {
  start: {
    x_mm: number
    y_mm: number
  }
  end: {
    x_mm: number
    y_mm: number
  }
  label?: string
}

export interface MeasurementImportPayload {
  segments: MeasurementImportSegmentPayload[]
  reference_image?: ReferenceImagePayload
}

export interface MeasurementImportResponse {
  room: RoomPayload
  imported_segments: number
}

export const roomsApi = {
  list: (projectId: string) =>
    api.get<RoomPayload[]>(`/projects/${projectId}/rooms`),

  create: async (data: {
    project_id: string
    name: string
    ceiling_height_mm?: number
    boundary: RoomBoundaryPayload
  }) => {
    try {
      return await api.post<RoomPayload>('/rooms', data)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoRoom(data)
      throw error
    }
  },

  update: async (id: string, data: Partial<{
    name: string
    ceiling_height_mm: number
    boundary: RoomBoundaryPayload
    ceiling_constraints: unknown[]
    openings: unknown[]
    placements: unknown[]
  }>) => {
    try {
      return await api.put<RoomPayload>(`/rooms/${id}`, data)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoRoom(id, data)
      throw error
    }
  },

  delete: (id: string) => api.delete(`/rooms/${id}`),

  updateReferenceImage: (id: string, data: ReferenceImagePayload) =>
    api.put<RoomPayload>(`/rooms/${id}/reference-image`, data),

  removeReferenceImage: (id: string) =>
    api.delete(`/rooms/${id}/reference-image`),

  measurementImport: (id: string, payload: MeasurementImportPayload) =>
    api.post<MeasurementImportResponse>(`/rooms/${id}/measurement-import`, payload),
}

// Wall operations
export const wallsApi = {
  shift: (wallId: string, roomId: string, deltaMm: number) =>
    api.patch(`/walls/${wallId}/shift`, { room_id: roomId, delta_mm: deltaMm }),

  split: (wallId: string, roomId: string, offsetMm: number) =>
    api.post(`/walls/${wallId}/split`, { room_id: roomId, offset_mm: offsetMm }),

  completeRoom: (roomId: string, mode = '90deg') =>
    api.post(`/rooms/${roomId}/complete?mode=${mode}`, {}),
}

// Wall objects (doors/windows)
export const wallObjectsApi = {
  listByRoom: (roomId: string) =>
    api.get<WallObject[]>(`/rooms/${roomId}/wall-objects`),

  create: (wallId: string, roomId: string, wallObject: Omit<WallObject, 'id' | 'wall_id' | 'room_id'>) =>
    api.post<WallObject>(`/walls/${wallId}/wall-objects`, { room_id: roomId, wall_object: wallObject }),

  updateHingeSide: (objId: string, roomId: string, hingeSide: 'left' | 'right') =>
    api.patch(`/wall-objects/${objId}/hinge-side`, { room_id: roomId, hinge_side: hingeSide }),

  updateVisibility: (objId: string, roomId: string, options: { show_in_plan?: boolean; show_in_view?: boolean }) =>
    api.patch(`/wall-objects/${objId}/show-in-view`, { room_id: roomId, ...options }),
}

// Installations (sockets, water, etc.)
export const installationsApi = {
  listByRoom: (roomId: string) =>
    api.get<WallInstallation[]>(`/rooms/${roomId}/installations`),

  create: (wallId: string, roomId: string, installation: Omit<WallInstallation, 'id' | 'wall_id' | 'room_id'>) =>
    api.post<WallInstallation>(`/walls/${wallId}/installations`, { room_id: roomId, installation }),
}

// Worktops
export const worktopsApi = {
  list: (roomId: string) =>
    api.get<WorktopSchema[]>(`/rooms/${roomId}/worktop-schemas`),

  create: (roomId: string, schema: Omit<WorktopSchema, 'id' | 'room_id' | 'created_at'>) =>
    api.post<WorktopSchema>(`/rooms/${roomId}/worktop-schemas`, schema),

  delete: (roomId: string, schemaId: string) =>
    api.delete(`/rooms/${roomId}/worktop-schemas/${schemaId}`),
}

// Annotations (measure lines, section lines, comments)
export const annotationsApi = {
  listMeasureLines: (roomId: string) =>
    api.get<MeasureLine[]>(`/rooms/${roomId}/measure-lines`),

  createMeasureLine: (roomId: string, line: Omit<MeasureLine, 'id' | 'room_id'>) =>
    api.post<MeasureLine>(`/rooms/${roomId}/measure-lines`, line),

  deleteMeasureLine: (roomId: string, lineId: string) =>
    api.delete(`/rooms/${roomId}/measure-lines/${lineId}`),

  listSectionLines: (roomId: string) =>
    api.get<SectionLine[]>(`/rooms/${roomId}/section-lines`),

  createSectionLine: (roomId: string, line: Omit<SectionLine, 'id' | 'room_id'>) =>
    api.post<SectionLine>(`/rooms/${roomId}/section-lines`, line),

  listComments: (roomId: string) =>
    api.get<Comment[]>(`/rooms/${roomId}/comments`),

  createComment: (roomId: string, comment: Omit<Comment, 'id' | 'room_id'>) =>
    api.post<Comment>(`/rooms/${roomId}/comments`, comment),

  deleteComment: (roomId: string, commentId: string) =>
    api.delete(`/rooms/${roomId}/comments/${commentId}`),
}

// Room decoration (coloring, deco objects)
export const roomDecorationApi = {
  getColoring: (roomId: string) =>
    api.get<RoomColoring>(`/rooms/${roomId}/coloring`),

  updateColoring: (roomId: string, coloring: Pick<RoomColoring, 'surfaces'>) =>
    api.put<Pick<RoomColoring, 'surfaces'>>(`/rooms/${roomId}/coloring`, coloring),

  listDecoObjects: (roomId: string) =>
    api.get<DecoObject[]>(`/rooms/${roomId}/deco-objects`),

  createDecoObject: (roomId: string, obj: Omit<DecoObject, 'id' | 'room_id'>) =>
    api.post<DecoObject>(`/rooms/${roomId}/deco-objects`, obj),

  deleteDecoObject: (roomId: string, decoId: string) =>
    api.delete(`/rooms/${roomId}/deco-objects/${decoId}`),
}

// Lighting
export const lightingApi = {
  listProfiles: (roomId: string) =>
    api.get<LightingProfile[]>(`/rooms/${roomId}/lighting-profiles`),

  createProfile: (roomId: string, profile: Omit<LightingProfile, 'id' | 'room_id'>) =>
    api.post<LightingProfile>(`/rooms/${roomId}/lighting-profiles`, profile),

  deleteProfile: (roomId: string, profileId: string) =>
    api.delete(`/rooms/${roomId}/lighting-profiles/${profileId}`),
}
