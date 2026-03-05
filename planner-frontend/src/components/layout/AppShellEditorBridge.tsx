import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { EditorActionStates } from '../../editor/actionStateResolver.js'
import type { WorkflowStep } from '../../editor/workflowStateStore.js'

export interface AppShellEditorBridgeState {
  workflowStep: WorkflowStep
  modeLabel: string
  canGoNext: boolean
  canGoPrevious: boolean
  goToNextStep: () => void
  goToPreviousStep: () => void
  actionStates: EditorActionStates
}

interface AppShellEditorBridgeContextValue {
  setEditorBridgeState: Dispatch<SetStateAction<AppShellEditorBridgeState | null>>
}

const AppShellEditorBridgeContext = createContext<AppShellEditorBridgeContextValue | null>(null)

interface AppShellEditorBridgeProviderProps {
  setEditorBridgeState: Dispatch<SetStateAction<AppShellEditorBridgeState | null>>
  children: ReactNode
}

export function AppShellEditorBridgeProvider({
  setEditorBridgeState,
  children,
}: AppShellEditorBridgeProviderProps) {
  return (
    <AppShellEditorBridgeContext.Provider value={{ setEditorBridgeState }}>
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
