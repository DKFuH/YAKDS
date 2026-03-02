import { api } from './client.js'

export interface WorkspaceLayout {
  user_id: string
  layout_json: Record<string, unknown>
}

const USER_ID_PLACEHOLDER = 'dev-user-id'

export const workspaceLayoutApi = {
  get: async (userId = USER_ID_PLACEHOLDER): Promise<WorkspaceLayout> => {
    return api.get<WorkspaceLayout>(`/user/workspace-layout?user_id=${userId}`)
  },
  save: async (layoutJson: Record<string, unknown>, userId = USER_ID_PLACEHOLDER): Promise<WorkspaceLayout> => {
    return api.put<WorkspaceLayout>(`/user/workspace-layout?user_id=${userId}`, { layout_json: layoutJson })
  },
}
