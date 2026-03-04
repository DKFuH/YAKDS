import { api } from './client.js'

export interface OfflineBundleResponse {
  project: Record<string, unknown>
  rooms: Record<string, unknown>[]
  site_surveys: Record<string, unknown>[]
  offline_sync_pending: number
  generated_at: string
}

export interface OfflineSyncJobInput {
  tenant_id?: string
  project_id?: string
  entity_type: string
  payload_json: unknown
}

export interface OfflineSyncQueueResponse {
  queued: number
  pending_total: number
}

export interface OfflineSyncPendingResponse {
  pending_total: number
  jobs: Array<Record<string, unknown>>
}

export const offlineSyncApi = {
  getProjectOfflineBundle: (projectId: string) =>
    api.get<OfflineBundleResponse>(`/projects/${projectId}/offline-bundle`),

  queueJobs: (jobs: OfflineSyncJobInput[]) =>
    api.post<OfflineSyncQueueResponse>('/offline-sync', { jobs }),

  pending: () =>
    api.get<OfflineSyncPendingResponse>('/offline-sync/pending'),
}