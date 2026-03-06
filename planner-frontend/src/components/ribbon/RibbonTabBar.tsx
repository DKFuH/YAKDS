import { Button, makeStyles, tokens } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { RibbonGroup } from './RibbonGroup.js'
import type {
  RibbonCommand,
  RibbonContextTab,
  RibbonTab,
  RibbonTabId,
} from './ribbonStateResolver.js'

interface RibbonTabBarProps {
  primaryTabs: RibbonTab[]
  contextTabs: RibbonContextTab[]
  activeTabId: RibbonTabId
  activeContextTabId: string | null
  onTabChange: (tabId: RibbonTabId) => void
  onContextTabChange: (tabId: string) => void
  onExecute: (command: RibbonCommand) => void
  compact?: boolean
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tabStrip: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  tabButton: {
    borderRadius: 0,
    borderBottom: '2px solid transparent',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    minWidth: 'unset',
  },
  tabButtonActive: {
    borderBottom: `2px solid ${tokens.colorBrandForeground1}`,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  tabButtonContext: {
    color: tokens.colorPaletteGoldForeground2,
  },
  tabButtonContextActive: {
    borderBottom: `2px solid ${tokens.colorPaletteGoldForeground2}`,
    color: tokens.colorPaletteGoldForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    overflowX: 'auto',
    minHeight: '56px',
  },
})

export function RibbonTabBar({
  primaryTabs,
  contextTabs,
  activeTabId,
  activeContextTabId,
  onTabChange,
  onContextTabChange,
  onExecute,
  compact = false,
}: RibbonTabBarProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  const activeContextTab = contextTabs.find((ct) => ct.active && ct.id === activeContextTabId) ?? null
  const activePrimaryTab = primaryTabs.find((tab) => tab.id === activeTabId)

  // Determine which content to show: prefer context tab when one is active
  const isContextActive = activeContextTab !== null
  const activeGroups = isContextActive ? activeContextTab.groups : (activePrimaryTab?.groups ?? [])

  return (
    <div className={styles.root} data-testid='ribbon-tabbar'>
      {/* Tab strip */}
      <div className={styles.tabStrip} role='tablist' aria-label={t('shell.navigationAriaLabel')}>
        {primaryTabs.map((tab) => {
          const isActive = tab.id === activeTabId && !isContextActive
          return (
            <Button
              key={tab.id}
              appearance='subtle'
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
              role='tab'
              aria-selected={isActive}
              data-testid={`ribbon-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
            >
              {t(tab.labelKey)}
            </Button>
          )
        })}

        {/* Context tabs */}
        {contextTabs
          .filter((ct) => ct.active)
          .map((ct) => {
            const isActive = isContextActive && ct.id === activeContextTabId
            return (
              <Button
                key={ct.id}
                appearance='subtle'
                className={`${styles.tabButton} ${isActive ? styles.tabButtonContextActive : styles.tabButtonContext}`}
                role='tab'
                aria-selected={isActive}
                data-testid={`ribbon-context-tab-${ct.id}`}
                onClick={() => onContextTabChange(ct.id)}
              >
                {t(ct.labelKey)}
              </Button>
            )
          })}
      </div>

      {/* Group content area */}
      <div className={styles.contentArea} role='tabpanel' aria-label={t(activePrimaryTab?.labelKey ?? 'ribbon.tabs.start')}>
        {activeGroups.map((grp, index) => (
          <RibbonGroup
            key={grp.id}
            group={grp}
            onExecute={onExecute}
            compact={compact}
            showDivider={index < activeGroups.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
