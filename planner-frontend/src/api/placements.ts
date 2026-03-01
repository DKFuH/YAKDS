import { api } from './client.js'
import { savePlacements as saveDemoPlacements } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'

export interface Placement {
  id: string
  catalog_item_id: string
  wall_id: string
  offset_mm: number
  width_mm: number
  depth_mm: number
  height_mm: number
  worldPos?: { x_mm: number; y_mm: number }
}

export const placementsApi = {
  list: (roomId: string): Promise<Placement[]> =>
    api.get<Placement[]>(`/rooms/${roomId}/placements`),

  save: async (roomId: string, placements: Placement[]): Promise<Placement[]> => {
    try {
      return await api.put<Placement[]>(`/rooms/${roomId}/placements`, { placements })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return saveDemoPlacements(roomId, placements)
      throw error
    }
  },

  create: (roomId: string, placement: Omit<Placement, 'id'>): Promise<Placement> =>
    api.post<Placement>(`/rooms/${roomId}/placements`, placement),

  delete: (roomId: string, placementId: string): Promise<void> =>
    api.delete(`/rooms/${roomId}/placements/${placementId}`),
}
