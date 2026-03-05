import { makeStyles, tokens } from '@fluentui/react-components'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppShellState } from '../../editor/appShellState.js'
import { AppHeader } from './AppHeader.js'
import {
  AppShellEditorBridgeProvider,
  type AppShellEditorBridgeState,
} from './AppShellEditorBridge.js'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  content: {
    minHeight: 0,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    '@media (max-width: 900px)': {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    },
  },
})

export function AppShell() {
  const styles = useStyles()
  const location = useLocation()
  const [editorBridgeState, setEditorBridgeState] = useState<AppShellEditorBridgeState | null>(null)

  const shellState = useAppShellState({
    pathname: location.pathname,
  })

  useEffect(() => {
    const onEditorRoute = /^\/projects\/[^/]+$/.test(location.pathname)
    if (!onEditorRoute) {
      setEditorBridgeState(null)
    }
  }, [location.pathname])

  const mergedShellState = useMemo(() => {
    if (!editorBridgeState) {
      return shellState
    }

    return {
      ...shellState,
      workflowStep: editorBridgeState.workflowStep,
      modeLabel: editorBridgeState.modeLabel,
      canGoNext: editorBridgeState.canGoNext,
      canGoPrevious: editorBridgeState.canGoPrevious,
      goToNextStep: editorBridgeState.goToNextStep,
      goToPreviousStep: editorBridgeState.goToPreviousStep,
      actionStates: editorBridgeState.actionStates,
    }
  }, [editorBridgeState, shellState])

  return (
    <AppShellEditorBridgeProvider setEditorBridgeState={setEditorBridgeState}>
      <div className={styles.root}>
        <AppHeader shellState={mergedShellState} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </AppShellEditorBridgeProvider>
  )
}
