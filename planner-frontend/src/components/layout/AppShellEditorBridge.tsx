import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { EditorActionStates } from '../../editor/actionStateResolver.js'
import type { WorkflowStep } from '../../editor/workflowStateStore.js'
import type { TenantPluginsResponse } from '../../api/tenantSettings.js'
import type { PlannerViewMode } from '../../pages/plannerViewSettings.js'

export interface AppShellEditorBridgeState {
  workflowStep: WorkflowStep
  modeLabel: string
  canGoNext: boolean
  canGoPrevious: boolean
  goToNextStep: () => void
  goToPreviousStep: () => void
  actionStates: EditorActionStates
  tenantPlugins: TenantPluginsResponse | null
  /** Display info */
  projectName: string
  lockStateLabel: string | null
  /** View mode control */
  viewMode: PlannerViewMode
  onSetViewMode: (mode: PlannerViewMode) => void
  /** Panel toggles: navigation | camera | capture | renderEnvironment | daylight | material */
  onTogglePanel: (panel: string) => void
  /** Direct editor commands: screenshot | export360 | autoComplete | gltfExport | markDelivered */
  onEditorCommand: (cmd: string) => void
}

interface AppShellEditorBridgeContextValue {
  editorBridgeState: AppShellEditorBridgeState | null
  setEditorBridgeState: Dispatch<SetStateAction<AppShellEditorBridgeState | null>>
}

const AppShellEditorBridgeContext = createContext<AppShellEditorBridgeContextValue | null>(null)

interface AppShellEditorBridgeProviderProps {
  editorBridgeState: AppShellEditorBridgeState | null
  setEditorBridgeState: Dispatch<SetStateAction<AppShellEditorBridgeState | null>>
  children: ReactNode
}

export function AppShellEditorBridgeProvider({
  editorBridgeState,
  setEditorBridgeState,
  children,
}: AppShellEditorBridgeProviderProps) {
  return (
    <AppShellEditorBridgeContext.Provider value={{ editorBridgeState, setEditorBridgeState }}>
      {children}
    </AppShellEditorBridgeContext.Provider>
  )
}

export function useAppShellEditorBridge() {
  const context = useContext(AppShellEditorBridgeContext)
  if (!context) {
    return null
  }
  return context
}
