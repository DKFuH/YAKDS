import { api } from './client.js'
import { createProject as createDemoProject, deleteProject as deleteDemoProject, getProject as getDemoProject, listProjects as listDemoProjects, updateProject as updateDemoProject } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'

export interface Project {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  project_status: 'lead' | 'planning' | 'quoted' | 'contract' | 'production' | 'installed' | 'archived'
  deadline: string | null
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  advisor: string | null
  sales_rep: string | null
  progress_pct: number
  lead_status?: 'new' | 'qualified' | 'quoted' | 'won' | 'lost'
  quote_value?: number | null
  close_probability?: number | null
  created_at: string
  updated_at: string
  _count?: { rooms: number; quotes?: number }
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
const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export interface ProjectBoardFilters {
  user_id?: string
  branch_id?: string
  status_filter?: Project['project_status']
  search?: string
  sales_rep?: string
}

export interface ProjectAssignmentUpdate {
  assigned_to?: string | null
  priority?: Project['priority']
  deadline?: string | null
  progress_pct?: number
}

export const projectsApi = {
  list: async (userId = USER_ID_PLACEHOLDER) => {
    try {
      return await api.get<Project[]>(`/projects?user_id=${userId}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return listDemoProjects()
      throw error
    }
  },
  board: async (filters: ProjectBoardFilters = {}) => {
    const query = new URLSearchParams({ user_id: filters.user_id ?? USER_ID_PLACEHOLDER })
    if (filters.branch_id) {
      query.set('branch_id', filters.branch_id)
    }
    if (filters.status_filter) {
      query.set('status_filter', filters.status_filter)
    }
    try {
      return await api.get<Project[]>(`/projects/board?${query.toString()}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        const projects = listDemoProjects()
        return filters.status_filter
          ? projects.filter((project) => project.project_status === filters.status_filter)
          : projects
      }
      throw error
    }
  },
  gantt: async (branch_id?: string, userId = USER_ID_PLACEHOLDER) => {
    const query = new URLSearchParams({ user_id: userId })
    if (branch_id) {
      query.set('branch_id', branch_id)
    }
    try {
      return await api.get<Array<Project & { start_at: string; end_at: string | null }>>(`/projects/gantt?${query.toString()}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        const projects = listDemoProjects()
        return projects.map((project) => ({
          ...project,
          start_at: project.created_at,
          end_at: project.deadline,
        })).sort((left, right) => {
          const leftDate = left.end_at ?? left.start_at
          const rightDate = right.end_at ?? right.start_at
          return leftDate.localeCompare(rightDate)
        })
      }
      throw error
    }
  },
  get: async (id: string) => {
    try {
      return await api.get<ProjectDetail>(`/projects/${id}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemoProject(id)
      throw error
    }
  },
  create: async (data: { name: string; description?: string }) => {
    try {
      return await api.post<Project>('/projects', { ...data, user_id: USER_ID_PLACEHOLDER }, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoProject(data)
      throw error
    }
  },
  update: async (id: string, data: { name?: string; description?: string; status?: string }) => {
    try {
      return await api.put<Project>(`/projects/${id}`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  updateStatus: async (id: string, data: { project_status: Project['project_status']; progress_pct?: number }) => {
    try {
      return await api.patch<Project>(`/projects/${id}/status`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  assign: async (id: string, data: ProjectAssignmentUpdate) => {
    try {
      return await api.patch<Project>(`/projects/${id}/assign`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  delete: async (id: string) => {
    try {
      return await api.delete(`/projects/${id}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return deleteDemoProject(id)
      throw error
    }
  },
  threeDots: async (id: string, action: 'duplicate' | 'archive' | 'unarchive') => {
    try {
      return await api.patch<Project>(`/projects/${id}/3dots?action=${action}`, {}, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        if (action === 'duplicate') {
          const project = getDemoProject(id)
          return createDemoProject({ name: `${project.name} (Kopie)` })
        }
        return updateDemoProject(id, { status: action === 'archive' ? 'archived' : 'active' })
      }
      throw error
    }
  },
  advisor: async (id: string, data: { advisor: string | null; sales_rep?: string | null }) => {
    try {
      return await api.patch<Project>(`/projects/${id}/advisor`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
}
