import type { Opening } from '@shared/types'
import { api } from './client.js'

export type { Opening }

export const openingsApi = {
  list: (roomId: string): Promise<Opening[]> =>
    api.get<Opening[]>(`/rooms/${roomId}/openings`),

  save: (roomId: string, openings: Opening[]): Promise<Opening[]> =>
    api.put<Opening[]>(`/rooms/${roomId}/openings`, { openings }),

  create: (roomId: string, opening: Omit<Opening, 'id'>): Promise<Opening> =>
    api.post<Opening>(`/rooms/${roomId}/openings`, opening),

  delete: (roomId: string, openingId: string): Promise<void> =>
    api.delete(`/rooms/${roomId}/openings/${openingId}`),
}
