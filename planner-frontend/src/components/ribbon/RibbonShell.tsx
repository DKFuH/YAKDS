import { Body1Strong, Caption1, makeStyles, tokens } from '@fluentui/react-components'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { resolveBackendFeatureCoverage } from '../../integration/backendCapabilityMap.js'
import { resolveMcpQuickActions } from '../../mcp/mcpActionBridge.js'
import type { AppShellEditorBridgeState } from '../layout/AppShellEditorBridge.js'
import { LanguageSwitcher } from '../LanguageSwitcher.js'
import { QuickAccessBar } from './QuickAccessBar.js'
import { RibbonTabBar } from './RibbonTabBar.js'
import {
  resolveRibbonState,
  type RibbonCommand,
  type RibbonContextTabId,
  type RibbonTabId,
} from './ribbonStateResolver.js'
import type { AppShellState } from '../../editor/appShellState.js'

interface RibbonShellProps {
  shellState: AppShellState
  editorBridgeState?: AppShellEditorBridgeState | null
}

const useStyles = makeStyles({
  shell: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow2,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalM,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  brandName: {
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  brandTagline: {
    color: tokens.colorNeutralForeground3,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
})

export function RibbonShell({ shellState, editorBridgeState = null }: RibbonShellProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const tenantPlugins = editorBridgeState?.tenantPlugins ?? null

  const [activeTabId, setActiveTabId] = useState<RibbonTabId>('start')
  const [activeContextTabId, setActiveContextTabId] = useState<RibbonContextTabId | null>(null)

  const backendEntries = useMemo(
    () =>
      resolveBackendFeatureCoverage({
        projectId: shellState.projectId,
        actionStates: shellState.actionStates,
      }),
    [shellState.actionStates, shellState.projectId],
  )

  const mcpActions = useMemo(
    () => resolveMcpQuickActions({ projectId: shellState.projectId }),
    [shellState.projectId],
  )

  const enabledPluginIds = useMemo(() => {
    if (!tenantPlugins) return []
    return tenantPlugins.enabled
  }, [tenantPlugins])

  const availablePlugins = useMemo(() => {
    if (!tenantPlugins) return []
    return tenantPlugins.available
  }, [tenantPlugins])

  const ribbonState = useMemo(
    () =>
      resolveRibbonState({
        projectId: shellState.projectId,
        actionStates: shellState.actionStates,
        workflowStep: shellState.workflowStep,
        editorMode: shellState.mode,
        backendEntries,
        availablePlugins,
        mcpActions,
        enabledPluginIds,
        activeTabId,
      }),
    [
      shellState.projectId,
      shellState.actionStates,
      shellState.workflowStep,
      shellState.mode,
      backendEntries,
      availablePlugins,
      mcpActions,
      enabledPluginIds,
      activeTabId,
    ],
  )

  // Sync context tab with resolved state when it changes
  const resolvedContextTabId = ribbonState.activeContextTabId
  const currentContextTabId = activeContextTabId ?? resolvedContextTabId

  const handleTabChange = useCallback((tabId: RibbonTabId) => {
    setActiveTabId(tabId)
    setActiveContextTabId(null)
  }, [])

  const handleContextTabChange = useCallback((tabId: string) => {
    setActiveContextTabId(tabId as RibbonContextTabId)
  }, [])

  const handleExecute = useCallback(
    (command: RibbonCommand) => {
      if (command.workflowAction === 'next') {
        shellState.goToNextStep()
        return
      }
      if (command.workflowAction === 'previous') {
        shellState.goToPreviousStep()
        return
      }
      if (command.targetMode) {
        shellState.setMode(command.targetMode)
        return
      }
      if (command.mcpActionKind === 'copy-prompt') {
        if (!command.clipboardText) {
          return
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(command.clipboardText).catch(() => undefined)
        }
        return
      }
      if (command.targetPath) {
        navigate(command.targetPath)
        return
      }
    },
    [shellState, navigate],
  )

  return (
    <header className={styles.shell} data-testid='ribbon-shell'>
      {/* Top bar: brand + quick access + language switcher */}
      <div className={styles.topBar}>
        <div className={styles.brandBlock}>
          <Body1Strong className={styles.brandName}>{t('shell.brandName')}</Body1Strong>
          <Caption1 className={styles.brandTagline}>{t('shell.brandTagline')}</Caption1>
        </div>

        <QuickAccessBar commands={ribbonState.quickAccess} onExecute={handleExecute} />

        <div className={styles.topBarRight}>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Ribbon tab bar */}
      <RibbonTabBar
        primaryTabs={ribbonState.primaryTabs}
        contextTabs={ribbonState.contextTabs}
        activeTabId={ribbonState.activeTabId}
        activeContextTabId={currentContextTabId}
        onTabChange={handleTabChange}
        onContextTabChange={handleContextTabChange}
        onExecute={handleExecute}
        compact={shellState.compactLayout}
      />
    </header>
  )
}
