import { api } from './client.js'
import { createProject as createDemoProject, deleteProject as deleteDemoProject, getProject as getDemoProject, listProjects as listDemoProjects, updateProject as updateDemoProject } from './demoBackend.js'
import { offlineSyncApi } from './offlineSync.js'
import { shouldUseDemoFallback } from './client.js'
import { getRuntimeUserId, tenantScopedHeaders } from './runtimeContext.js'

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
  archived_at?: string | null
  retention_until?: string | null
  archive_reason?: string | null
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

export interface ProjectLockState {
  project_id: string
  locked: boolean
  alternative_id: string | null
  locked_by_user: string | null
  locked_by_host: string | null
  locked_at: string | null
}

export interface AlternativeBulkDeliveryResult {
  updated_count: number
  order_ids: string[]
}

export interface Room {
  id: string
  project_id: string
  level_id?: string | null
  name: string
  ceiling_height_mm: number
  boundary: unknown
  ceiling_constraints: unknown[]
  openings: unknown[]
  placements: unknown[]
  reference_image?: unknown | null
  created_at: string
  updated_at: string
}

const RECENT_PROJECT_DETAILS_CACHE_KEY = 'okp.recent-project-details.v1'
const MAX_RECENT_PROJECT_DETAILS = 3

type RecentProjectDetailsCache = ProjectDetail[]

const isBrowserAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const isRoom = (value: unknown): value is Room => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.project_id === 'string' && typeof record.name === 'string'
}

const readRecentProjectDetailsCache = (): RecentProjectDetailsCache => {
  if (!isBrowserAvailable()) {
    return []
  }

  try {
    const rawCache = window.localStorage.getItem(RECENT_PROJECT_DETAILS_CACHE_KEY)
    if (!rawCache) {
      return []
    }
    const parsed = JSON.parse(rawCache) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is ProjectDetail => typeof item === 'object' && item !== null && typeof (item as ProjectDetail).id === 'string').slice(0, MAX_RECENT_PROJECT_DETAILS)
  } catch {
    return []
  }
}

const writeRecentProjectDetailsCache = (cache: RecentProjectDetailsCache) => {
  if (!isBrowserAvailable()) {
    return
  }

  try {
    window.localStorage.setItem(RECENT_PROJECT_DETAILS_CACHE_KEY, JSON.stringify(cache.slice(0, MAX_RECENT_PROJECT_DETAILS)))
  } catch {
    return
  }
}

const upsertRecentProjectDetailsCacheEntry = (cache: RecentProjectDetailsCache, detail: ProjectDetail): RecentProjectDetailsCache => {
  const nextCache = [detail, ...cache.filter((entry) => entry.id !== detail.id)]
  return nextCache.slice(0, MAX_RECENT_PROJECT_DETAILS)
}

const cachedDetailsToProjectListFallback = (cache: RecentProjectDetailsCache): Project[] => cache.map(({ rooms, quotes, ...project }) => ({
  ...project,
  _count: project._count ?? { rooms: rooms.length, quotes: quotes.length },
}))

const mergeProjectRooms = (detail: ProjectDetail, bundleRooms: unknown[]): ProjectDetail => {
  const roomMap = new Map<string, Room>()

  for (const room of detail.rooms) {
    roomMap.set(room.id, room)
  }

  for (const room of bundleRooms) {
    if (isRoom(room)) {
      roomMap.set(room.id, room)
    }
  }

  const mergedRooms = Array.from(roomMap.values())
  return {
    ...detail,
    rooms: mergedRooms,
    _count: detail._count ? { ...detail._count, rooms: mergedRooms.length } : detail._count,
  }
}

const buildCachedProjectDetail = async (detail: ProjectDetail): Promise<ProjectDetail> => {
  try {
    const offlineBundle = await offlineSyncApi.getProjectOfflineBundle(detail.id)
    if (!Array.isArray(offlineBundle.rooms) || offlineBundle.rooms.length === 0) {
      return detail
    }

    return mergeProjectRooms(detail, offlineBundle.rooms)
  } catch {
    return detail
  }
}

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

export interface ProjectArchiveFilters {
  search?: string
  archive_reason?: string
  retention_until_before?: string
  retention_until_after?: string
}

export const projectsApi = {
  list: async (userId = getRuntimeUserId()) => {
    try {
      return await api.get<Project[]>(`/projects?user_id=${encodeURIComponent(userId)}`, tenantScopedHeaders())
    } catch (error) {
      const cachedProjects = cachedDetailsToProjectListFallback(readRecentProjectDetailsCache())
      if (cachedProjects.length > 0) {
        return cachedProjects
      }
      if (shouldUseDemoFallback(error)) return listDemoProjects()
      throw error
    }
  },
  board: async (filters: ProjectBoardFilters = {}) => {
    const query = new URLSearchParams({ user_id: filters.user_id ?? getRuntimeUserId() })
    if (filters.branch_id) {
      query.set('branch_id', filters.branch_id)
    }
    if (filters.status_filter) {
      query.set('status_filter', filters.status_filter)
    }
    try {
      return await api.get<Project[]>(`/projects/board?${query.toString()}`, tenantScopedHeaders())
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
  archiveList: async (filters: ProjectArchiveFilters = {}) => {
    const query = new URLSearchParams()
    if (filters.search?.trim()) {
      query.set('search', filters.search.trim())
    }
    if (filters.archive_reason?.trim()) {
      query.set('archive_reason', filters.archive_reason.trim())
    }
    if (filters.retention_until_before) {
      query.set('retention_until_before', filters.retention_until_before)
    }
    if (filters.retention_until_after) {
      query.set('retention_until_after', filters.retention_until_after)
    }

    const suffix = query.toString() ? `?${query.toString()}` : ''

    try {
      return await api.get<Project[]>(`/projects/archive${suffix}`, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return listDemoProjects().filter((project) => project.status === 'archived')
      }
      throw error
    }
  },
  gantt: async (branch_id?: string, userId = getRuntimeUserId()) => {
    const query = new URLSearchParams({ user_id: userId })
    if (branch_id) {
      query.set('branch_id', branch_id)
    }
    try {
      return await api.get<Array<Project & { start_at: string; end_at: string | null }>>(`/projects/gantt?${query.toString()}`, tenantScopedHeaders())
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
      const projectDetail = await api.get<ProjectDetail>(`/projects/${id}`, tenantScopedHeaders())
      const enrichedCacheDetail = await buildCachedProjectDetail(projectDetail)
      const updatedCache = upsertRecentProjectDetailsCacheEntry(readRecentProjectDetailsCache(), enrichedCacheDetail)
      writeRecentProjectDetailsCache(updatedCache)
      return projectDetail
    } catch (error) {
      const cachedDetail = readRecentProjectDetailsCache().find((project) => project.id === id)
      if (cachedDetail) {
        return cachedDetail
      }
      if (shouldUseDemoFallback(error)) return getDemoProject(id)
      throw error
    }
  },
  lockState: async (id: string) => {
    try {
      return await api.get<ProjectLockState>(`/projects/${id}/lock-state`, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          project_id: id,
          locked: false,
          alternative_id: null,
          locked_by_user: null,
          locked_by_host: null,
          locked_at: null,
        }
      }
      throw error
    }
  },
  markAlternativeOrdersDelivered: async (alternativeId: string) => {
    try {
      return await api.post<AlternativeBulkDeliveryResult>(`/alternatives/${alternativeId}/orders/mark-delivered`, {}, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          updated_count: 0,
          order_ids: [],
        }
      }
      throw error
    }
  },
  create: async (data: { name: string; description?: string }) => {
    try {
      return await api.post<Project>(
        '/projects',
        { ...data, user_id: getRuntimeUserId() },
        tenantScopedHeaders(),
      )
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoProject(data)
      throw error
    }
  },
  update: async (id: string, data: { name?: string; description?: string; status?: string }) => {
    try {
      return await api.put<Project>(`/projects/${id}`, data, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  updateStatus: async (id: string, data: { project_status: Project['project_status']; progress_pct?: number }) => {
    try {
      return await api.patch<Project>(`/projects/${id}/status`, data, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  assign: async (id: string, data: ProjectAssignmentUpdate) => {
    try {
      return await api.patch<Project>(`/projects/${id}/assign`, data, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
  delete: async (id: string) => {
    try {
      return await api.delete(`/projects/${id}`, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return deleteDemoProject(id)
      throw error
    }
  },
  threeDots: async (id: string, action: 'duplicate' | 'archive' | 'unarchive') => {
    try {
      return await api.patch<Project>(`/projects/${id}/3dots?action=${action}`, {}, tenantScopedHeaders())
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
  archive: async (id: string, payload?: { archive_reason?: string; retention_days?: number }) => {
    try {
      return await api.post<Project>(`/projects/${id}/archive`, payload ?? {}, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, { status: 'archived' })
      throw error
    }
  },
  restore: async (id: string) => {
    try {
      return await api.post<Project>(`/projects/${id}/restore`, {}, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, { status: 'active' })
      throw error
    }
  },
  advisor: async (id: string, data: { advisor: string | null; sales_rep?: string | null }) => {
    try {
      return await api.patch<Project>(`/projects/${id}/advisor`, data, tenantScopedHeaders())
    } catch (error) {
      if (shouldUseDemoFallback(error)) return updateDemoProject(id, data)
      throw error
    }
  },
}
