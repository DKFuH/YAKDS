import type { Opening } from '@shared/types'
import { api } from './client.js'
import { saveOpenings as saveDemoOpenings } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'

export type { Opening }

export const openingsApi = {
  list: (roomId: string): Promise<Opening[]> =>
    api.get<Opening[]>(`/rooms/${roomId}/openings`),

  save: async (roomId: string, openings: Opening[]): Promise<Opening[]> => {
    try {
      return await api.put<Opening[]>(`/rooms/${roomId}/openings`, { openings })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return saveDemoOpenings(roomId, openings)
      throw error
    }
  },

  create: (roomId: string, opening: Omit<Opening, 'id'>): Promise<Opening> =>
    api.post<Opening>(`/rooms/${roomId}/openings`, opening),

  delete: (roomId: string, openingId: string): Promise<void> =>
    api.delete(`/rooms/${roomId}/openings/${openingId}`),
}
