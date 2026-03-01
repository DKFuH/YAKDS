import { api } from './client.js'

export interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  _count?: { rooms: number }
}

export interface ProjectDetail extends Project {
  rooms: Room[]
  quotes: { id: string; version: number; quote_number: string; status: string; valid_until: string }[]
}

export interface Room {
  id: string
  project_id: string
  name: string
  ceiling_height_mm: number
  boundary: unknown
  ceiling_constraints: unknown[]
  openings: unknown[]
  placements: unknown[]
  created_at: string
  updated_at: string
}

const USER_ID_PLACEHOLDER = 'dev-user-id' // wird durch Auth ersetzt

export const projectsApi = {
  list: () => api.get<Project[]>(`/projects?user_id=${USER_ID_PLACEHOLDER}`),
  get: (id: string) => api.get<ProjectDetail>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post<Project>('/projects', { ...data, user_id: USER_ID_PLACEHOLDER }),
  update: (id: string, data: { name?: string; description?: string; status?: string }) =>
    api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
}
