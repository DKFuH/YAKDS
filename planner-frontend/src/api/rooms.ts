import { api } from './client.js'
import { createRoom as createDemoRoom, updateRoom as updateDemoRoom } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'
import type { Vertex, WallSegment } from '@shared/types'

export interface RoomBoundaryPayload {
  vertices: Vertex[]
  wall_segments: WallSegment[]
}

export interface RoomPayload {
  id: string
  project_id: string
  name: string
  ceiling_height_mm: number
  boundary: RoomBoundaryPayload
  ceiling_constraints: unknown[]
  openings: unknown[]
  placements: unknown[]
  created_at: string
  updated_at: string
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
}
