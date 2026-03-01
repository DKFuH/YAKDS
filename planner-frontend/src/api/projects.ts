import { api } from './client.js'
import { createProject as createDemoProject, deleteProject as deleteDemoProject, getProject as getDemoProject, listProjects as listDemoProjects, updateProject as updateDemoProject } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'

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
  list: async () => {
    try {
      return await api.get<Project[]>(`/projects?user_id=${USER_ID_PLACEHOLDER}`)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return listDemoProjects()
      throw error
    }
  },
  get: async (id: string) => {
    try {
      return await api.get<ProjectDetail>(`/projects/${id}`)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemoProject(id)
      throw error
    }
  },
  create: async (data: { name: string; description?: string }) => {
    try {
      return await api.post<Project>('/projects', { ...data, user_id: USER_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoProject(data)
      throw error
    }
  },
  update: async (id: string, data: { name?: string; description?: string; status?: string }) => {
    try {
      return await api.put<Project>(`/projects/${id}`, data)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  delete: async (id: string) => {
    try {
      return await api.delete(`/projects/${id}`)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return deleteDemoProject(id)
      throw error
    }
  },
}
