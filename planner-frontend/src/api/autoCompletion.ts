import { api } from './client.js'

export interface AutoCompleteOptions {
  worktopOverhangFront_mm?: number
  worktopOverhangSide_mm?: number
  plinthHeight_mm?: number
  plinthDepth_mm?: number
  maxWorktopLength_mm?: number
  addSidePanels?: boolean
}

export interface AutoCompleteItem {
  type: string
  label: string
  qty: number
  unit: string
}

export interface AutoCompleteResult {
  project_id: string
  room_id: string
  deleted: number
  created: number
  items: AutoCompleteItem[]
}

export const autoCompletionApi = {
  run: (
    projectId: string,
    roomId: string,
    options?: AutoCompleteOptions,
  ): Promise<AutoCompleteResult> =>
    api.post<AutoCompleteResult>(
      `/projects/${projectId}/rooms/${roomId}/auto-complete`,
      options ?? {},
    ),

  list: (projectId: string, roomId: string): Promise<unknown[]> =>
    api.get<unknown[]>(`/projects/${projectId}/rooms/${roomId}/auto-complete`),
}
