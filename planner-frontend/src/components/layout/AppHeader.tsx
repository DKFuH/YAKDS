import {
  Badge,
  Body1Strong,
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tab,
  TabList,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ResolvedActionState } from '../../editor/actionStateResolver.js'
import type { AppShellState } from '../../editor/appShellState.js'
import { resolveBackendFeatureCoverage } from '../../integration/backendCapabilityMap.js'
import { resolvePluginSlotEntries } from '../../plugins/pluginSlotRegistry.js'
import { LanguageSwitcher } from '../LanguageSwitcher.js'
import { McpQuickActions } from '../mcp/McpQuickActions.js'
import type { AppShellEditorBridgeState } from './AppShellEditorBridge.js'

interface HeaderNavItem {
  key: string
  path: string
  labelKey: string
  actionState?: ResolvedActionState
}

interface AppHeaderProps {
  shellState: AppShellState
  editorBridgeState?: AppShellEditorBridgeState | null
}

const useStyles = makeStyles({
  shell: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'grid',
    rowGap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow2,
    '@media (max-width: 900px)': {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    },
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  brandBlock: {
    display: 'grid',
    rowGap: tokens.spacingVerticalXS,
  },
  brandName: {
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  statusCluster: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  tabList: {
    overflowX: 'auto',
    width: '100%',
    maxWidth: '100%',
    scrollbarWidth: 'thin',
  },
  tabWrapper: {
    display: 'inline-flex',
  },
})

function resolveSelectedPath(pathname: string, items: HeaderNavItem[]): string {
  const matchingItem = [...items]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => {
      if (item.path === '/') return pathname === '/'
      return pathname === item.path || pathname.startsWith(`${item.path}/`)
    })

  return matchingItem?.path ?? '/'
}

function getActionDisabledReason(actionState: ResolvedActionState | undefined, fallback: string): string | undefined {
  if (!actionState || actionState.enabled) return undefined
  return actionState.reasonIfDisabled ?? fallback
}

export function AppHeader({ shellState, editorBridgeState = null }: AppHeaderProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const tenantPlugins = editorBridgeState?.tenantPlugins ?? null

  const navItems = useMemo<HeaderNavItem[]>(() => {
    const baseItems: HeaderNavItem[] = [
      { key: 'projects', path: '/', labelKey: 'shell.navigation.projects' },
      { key: 'catalog', path: '/catalog', labelKey: 'shell.navigation.catalog' },
      { key: 'documents', path: '/documents', labelKey: 'shell.navigation.documents' },
      { key: 'contacts', path: '/contacts', labelKey: 'shell.navigation.contacts' },
      { key: 'reports', path: '/reports', labelKey: 'shell.navigation.reports' },
      { key: 'settings', path: '/settings', labelKey: 'shell.navigation.settings' },
    ]

    if (!shellState.projectId) {
      return baseItems
    }

    const projectRoot = `/projects/${shellState.projectId}`

    return [
      ...baseItems,
      {
        key: 'editor',
        path: projectRoot,
        labelKey: 'shell.navigation.editor',
      },
      {
        key: 'presentation',
        path: `${projectRoot}/presentation`,
        labelKey: 'shell.navigation.presentation',
        actionState: shellState.actionStates.presentationMode,
      },
      {
        key: 'exports',
        path: `${projectRoot}/exports`,
        labelKey: 'shell.navigation.exports',
        actionState: shellState.actionStates.navViewerExports,
      },
      {
        key: 'panoramaTours',
        path: `${projectRoot}/panorama-tours`,
        labelKey: 'shell.navigation.panoramaTours',
        actionState: shellState.actionStates.navPanoramaTours,
      },
      {
        key: 'quoteLines',
        path: `${projectRoot}/quote-lines`,
        labelKey: 'shell.navigation.quoteLines',
        actionState: shellState.actionStates.navQuoteLines,
      },
      {
        key: 'specificationPackages',
        path: `${projectRoot}/specification-packages`,
        labelKey: 'shell.navigation.specificationPackages',
        actionState: shellState.actionStates.navSpecificationPackages,
      },
    ]
  }, [shellState.actionStates, shellState.projectId])

  const selectedPath = useMemo(() => resolveSelectedPath(location.pathname, navItems), [location.pathname, navItems])
  const itemByPath = useMemo(() => new Map(navItems.map((item) => [item.path, item])), [navItems])

  const backendEntries = useMemo(
    () => resolveBackendFeatureCoverage({
      projectId: shellState.projectId,
      actionStates: shellState.actionStates,
    }),
    [shellState.actionStates, shellState.projectId],
  )

  const pluginSlotEntries = useMemo(() => {
    if (!tenantPlugins) {
      return []
    }

    return resolvePluginSlotEntries({
      slot: 'header',
      projectId: shellState.projectId,
      availablePlugins: tenantPlugins.available,
      enabledPluginIds: tenantPlugins.enabled,
    })
  }, [shellState.projectId, tenantPlugins])

  const previousDisabledReason = shellState.canGoPrevious
    ? undefined
    : t('shell.actions.previousStepDisabled')

  const nextDisabledReason = shellState.canGoNext
    ? undefined
    : t('shell.actions.nextStepDisabled')

  return (
    <header className={styles.shell}>
      <div className={styles.topRow}>
        <div className={styles.brandBlock}>
          <Body1Strong className={styles.brandName}>{t('shell.brandName')}</Body1Strong>
          <Caption1>{t('shell.brandTagline')}</Caption1>
        </div>

        <div className={styles.statusCluster}>
          <Badge appearance='filled' data-testid='shell-workflow-badge'>
            {t(`shell.workflow.steps.${shellState.workflowStep}`)}
          </Badge>
          <Badge appearance='tint' data-testid='shell-mode-badge'>
            {t('shell.mode.label')}: {shellState.modeLabel}
          </Badge>
          <Badge appearance={shellState.projectId ? 'filled' : 'outline'} data-testid='shell-project-scope-badge'>
            {shellState.projectId ? t('shell.badges.projectBound') : t('shell.badges.globalContext')}
          </Badge>
        </div>

        <div className={styles.navRow}>
          <Tooltip content={previousDisabledReason ?? t('shell.actions.previousStep')} relationship='label'>
            <span>
              <Button
                appearance='subtle'
                onClick={() => shellState.goToPreviousStep()}
                disabled={!shellState.canGoPrevious}
              >
                {t('shell.actions.previousStep')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip content={nextDisabledReason ?? t('shell.actions.nextStep')} relationship='label'>
            <span>
              <Button
                appearance='primary'
                onClick={() => shellState.goToNextStep()}
                disabled={!shellState.canGoNext}
              >
                {t('shell.actions.nextStep')}
              </Button>
            </span>
          </Tooltip>

          {backendEntries.length > 0 && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance='subtle' data-testid='header-backend-menu-trigger'>{t('shell.backend.menu')}</Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {backendEntries.map((entry) => (
                    <MenuItem
                      key={entry.id}
                      disabled={!entry.enabled}
                      title={entry.reasonIfDisabled ? t(entry.reasonIfDisabled) : undefined}
                      data-testid={`header-backend-feature-${entry.id}`}
                      onClick={() => {
                        if (!entry.enabled) return
                        navigate(entry.targetPath)
                      }}
                    >
                      {t(entry.labelKey)}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}

          {pluginSlotEntries.length > 0 && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance='subtle' data-testid='header-plugins-menu-trigger'>{t('shell.plugins.menu')}</Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {pluginSlotEntries.map((entry) => (
                    <MenuItem
                      key={entry.id}
                      disabled={!entry.enabled}
                      title={entry.reasonIfDisabled ? t(entry.reasonIfDisabled) : undefined}
                      data-testid={`header-plugin-slot-${entry.pluginId ?? entry.id}`}
                      onClick={() => {
                        if (!entry.enabled) return
                        navigate(entry.path)
                      }}
                    >
                      {entry.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}

          <McpQuickActions projectId={shellState.projectId} onNavigate={navigate} testIdPrefix='header' />
          <LanguageSwitcher />
        </div>
      </div>

      <TabList
        aria-label={t('shell.navigationAriaLabel')}
        selectedValue={selectedPath}
        className={styles.tabList}
        onTabSelect={(_event, data) => {
          const targetPath = String(data.value ?? '')
          const item = itemByPath.get(targetPath)

          if (!item) return
          if (item.actionState && !item.actionState.enabled) return

          navigate(targetPath)
        }}
      >
        {navItems.map((item) => {
          const disabledReason = getActionDisabledReason(item.actionState, t('shell.actions.disabledFallback'))
          const tab = (
            <Tab key={item.key} value={item.path} disabled={Boolean(disabledReason)}>
              {t(item.labelKey)}
            </Tab>
          )

          if (!disabledReason) return tab

          return (
            <Tooltip key={item.key} content={disabledReason} relationship='label'>
              <span className={styles.tabWrapper}>{tab}</span>
            </Tooltip>
          )
        })}
      </TabList>
    </header>
  )
}
