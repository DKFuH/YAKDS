import type { AppArea } from '../../editor/appShellState.js'
import type { EditorActionStates, ResolvedActionState } from '../../editor/actionStateResolver.js'
import type { EditorMode } from '../../editor/editorModeStore.js'
import type { WorkflowStep } from '../../editor/workflowStateStore.js'
import type { BackendFeatureEntry } from '../../integration/backendCapabilityMap.js'
import type { McpQuickAction } from '../../mcp/mcpActionBridge.js'
import type { TenantPluginInfo } from '../../api/tenantSettings.js'
import { resolvePluginSlotEntries } from '../../plugins/pluginSlotRegistry.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RibbonTabId =
  | 'datei'
  | 'start'
  | 'einfuegen'
  | 'cad'
  | 'ansicht'
  | 'render'
  | 'daten'
  | 'plugins'
  // Kanban area tabs
  | 'projekt'
  | 'aendern'
  | 'einstellungen'
  | 'hilfe'

export type RibbonContextTabId =
  | 'wandtools'
  | 'oeffnung'
  | 'objekt'
  | 'presentation'

export type RibbonCommandId = string

export interface RibbonCommand {
  id: RibbonCommandId
  labelKey: string
  /** Optional reason i18n key shown when disabled */
  reasonKey?: string
  enabled: boolean
  visible: boolean
  /** For navigation commands */
  targetPath?: string
  /** For mode-switching commands */
  targetMode?: EditorMode
  /** For workflow step navigation */
  workflowAction?: 'next' | 'previous'
  /** For MCP copy actions */
  mcpActionKind?: McpQuickAction['kind']
  clipboardText?: string
  /** For kanban board actions */
  kanbanAction?: string
  /** For editor view/panel actions: "view:2d", "panel:camera", etc. */
  editorAction?: string
}

export interface RibbonGroup {
  id: string
  labelKey: string
  commands: RibbonCommand[]
}

export interface RibbonTab {
  id: RibbonTabId
  labelKey: string
  groups: RibbonGroup[]
}

export interface RibbonContextTab {
  id: RibbonContextTabId
  labelKey: string
  /** True when this context tab should be shown */
  active: boolean
  groups: RibbonGroup[]
}

export interface RibbonState {
  primaryTabs: RibbonTab[]
  contextTabs: RibbonContextTab[]
  /** The id of the currently active primary tab */
  activeTabId: RibbonTabId
  /** Currently active context tab id, if any */
  activeContextTabId: RibbonContextTabId | null
  /** Quick access commands */
  quickAccess: RibbonCommand[]
}

export interface RibbonStateInput {
  projectId: string | null
  actionStates: EditorActionStates
  workflowStep: WorkflowStep
  editorMode: EditorMode
  backendEntries: BackendFeatureEntry[]
  availablePlugins: TenantPluginInfo[]
  mcpActions: McpQuickAction[]
  enabledPluginIds: string[]
  area: AppArea
  selectedKanbanProjectId: string | null
  viewMode: string
  openPanels: Record<string, boolean>
  /** The currently active primary tab (controlled externally) */
  activeTabId: RibbonTabId
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cmd(
  id: RibbonCommandId,
  labelKey: string,
  state: ResolvedActionState,
  options: { targetPath?: string; targetMode?: EditorMode; workflowAction?: 'next' | 'previous' } = {},
): RibbonCommand {
  return {
    id,
    labelKey,
    enabled: state.enabled,
    visible: state.visible !== false,
    reasonKey: state.reasonIfDisabled,
    ...options,
  }
}

function enabledCmd(
  id: RibbonCommandId,
  labelKey: string,
  options: { targetPath?: string; targetMode?: EditorMode; workflowAction?: 'next' | 'previous' } = {},
): RibbonCommand {
  return {
    id,
    labelKey,
    enabled: true,
    visible: true,
    ...options,
  }
}

function group(id: string, labelKey: string, commands: RibbonCommand[]): RibbonGroup {
  return { id, labelKey, commands: commands.filter((c) => c.visible) }
}

// ---------------------------------------------------------------------------
// Tab Builders
// ---------------------------------------------------------------------------

function buildDateiTab(
  projectId: string | null,
  actionStates: EditorActionStates,
): RibbonTab {
  const projectRoot = projectId ? `/projects/${projectId}` : null

  const dateiGroup = group('datei-main', 'ribbon.groups.file', [
    enabledCmd('cmd-new', 'ribbon.commands.new', { targetPath: '/' }),
    enabledCmd('cmd-open', 'ribbon.commands.open', { targetPath: '/' }),
    enabledCmd('cmd-save', 'ribbon.commands.save'),
    enabledCmd('cmd-duplicate', 'ribbon.commands.duplicate'),
  ])

  const exportGroup = group('datei-export', 'ribbon.groups.export', [
    cmd('cmd-gltf-export', 'ribbon.commands.gltfExport', actionStates.gltfExport),
    cmd('cmd-exports', 'ribbon.commands.viewerExports', actionStates.navViewerExports, {
      targetPath: projectRoot ? `${projectRoot}/exports` : '/',
    }),
  ])

  return {
    id: 'datei',
    labelKey: 'ribbon.tabs.datei',
    groups: [dateiGroup, exportGroup].filter((g) => g.commands.length > 0),
  }
}

function buildStartTab(
  actionStates: EditorActionStates,
  workflowStep: WorkflowStep,
): RibbonTab {
  const clipboardGroup = group('start-clipboard', 'ribbon.groups.clipboard', [
    enabledCmd('cmd-undo', 'ribbon.commands.undo'),
    enabledCmd('cmd-redo', 'ribbon.commands.redo'),
    enabledCmd('cmd-cut', 'ribbon.commands.cut'),
    enabledCmd('cmd-copy', 'ribbon.commands.copy'),
    enabledCmd('cmd-paste', 'ribbon.commands.paste'),
  ])

  const selectionGroup = group('start-selection', 'ribbon.groups.selection', [
    enabledCmd('cmd-select-all', 'ribbon.commands.selectAll'),
    enabledCmd('cmd-deselect', 'ribbon.commands.deselect'),
  ])

  const workflowGroup = group('start-workflow', 'ribbon.groups.workflow', [
    cmd(
      'cmd-prev-step',
      'ribbon.commands.previousStep',
      {
        enabled: workflowStep !== 'walls',
        visible: true,
        reasonIfDisabled: 'ribbon.reasons.alreadyFirstStep',
      },
      { workflowAction: 'previous' },
    ),
    cmd(
      'cmd-next-step',
      'ribbon.commands.nextStep',
      {
        enabled: workflowStep !== 'furniture',
        visible: true,
        reasonIfDisabled: 'ribbon.reasons.alreadyLastStep',
      },
      { workflowAction: 'next' },
    ),
    cmd('cmd-autocomplete', 'ribbon.commands.autoComplete', actionStates.autoComplete),
  ])

  return {
    id: 'start',
    labelKey: 'ribbon.tabs.start',
    groups: [clipboardGroup, selectionGroup, workflowGroup].filter((g) => g.commands.length > 0),
  }
}

function buildEinfuegenTab(_projectId: string | null): RibbonTab {
  const elementeGroup = group('einfuegen-elemente', 'ribbon.groups.elements', [
    enabledCmd('cmd-insert-window', 'ribbon.commands.insertWindow', {
      targetMode: 'wallCreate',
    }),
    enabledCmd('cmd-insert-door', 'ribbon.commands.insertDoor', {
      targetMode: 'wallCreate',
    }),
    enabledCmd('cmd-insert-furniture', 'ribbon.commands.insertFurniture'),
  ])

  const annotationGroup = group('einfuegen-annotation', 'ribbon.groups.annotation', [
    enabledCmd('cmd-insert-label', 'ribbon.commands.insertLabel', {
      targetMode: 'labelCreate',
    }),
    enabledCmd('cmd-insert-dim', 'ribbon.commands.insertDim', {
      targetMode: 'dimCreate',
    }),
  ])

  const assetsGroup = group('einfuegen-assets', 'ribbon.groups.assets', [
    enabledCmd('cmd-asset-library', 'ribbon.commands.assetLibrary', {
      targetPath: '/catalog',
    }),
  ])

  return {
    id: 'einfuegen',
    labelKey: 'ribbon.tabs.einfuegen',
    groups: [elementeGroup, annotationGroup, assetsGroup].filter((g) => g.commands.length > 0),
  }
}

function buildCadTab(_editorMode: EditorMode): RibbonTab {
  const zeichnenGroup = group('cad-draw', 'ribbon.groups.draw', [
    enabledCmd('cmd-wall', 'ribbon.commands.wall', { targetMode: 'wallCreate' }),
    enabledCmd('cmd-room', 'ribbon.commands.room', { targetMode: 'roomCreate' }),
    enabledCmd('cmd-polyline', 'ribbon.commands.polyline', { targetMode: 'polylineCreate' }),
  ])

  const bearbeitenGroup = group('cad-edit', 'ribbon.groups.edit', [
    enabledCmd('cmd-select', 'ribbon.commands.select', { targetMode: 'selection' }),
    enabledCmd('cmd-pan', 'ribbon.commands.pan', { targetMode: 'pan' }),
    enabledCmd('cmd-calibrate', 'ribbon.commands.calibrate', { targetMode: 'calibrate' }),
  ])

  const snapGroup = group('cad-snap', 'ribbon.groups.snap', [
    enabledCmd('cmd-snap-align', 'ribbon.commands.snapAlign'),
    enabledCmd('cmd-topology', 'ribbon.commands.topology'),
  ])

  return {
    id: 'cad',
    labelKey: 'ribbon.tabs.cad',
    groups: [zeichnenGroup, bearbeitenGroup, snapGroup].filter((g) => g.commands.length > 0),
  }
}

function buildAnsichtTab(actionStates: EditorActionStates, _viewMode: string, openPanels: Record<string, boolean>): RibbonTab {
  function viewCmd(id: string, labelKey: string, mode: string, state: ResolvedActionState = { enabled: true, visible: true }): RibbonCommand {
    return { id, labelKey, enabled: state.enabled, visible: state.visible !== false, reasonKey: state.reasonIfDisabled, editorAction: 'view:' + mode }
  }

  const viewGroup = group('ansicht-view', 'ribbon.groups.view', [
    viewCmd('cmd-view-2d', 'ribbon.commands.view2d', '2d'),
    viewCmd('cmd-view-split', 'ribbon.commands.viewSplit', 'split', actionStates.viewSplit),
    viewCmd('cmd-view-split3', 'ribbon.commands.viewSplit3', 'split3', actionStates.viewSplit),
    viewCmd('cmd-view-3d', 'ribbon.commands.view3d', '3d'),
    viewCmd('cmd-view-elevation', 'ribbon.commands.viewElevation', 'elevation', actionStates.viewElevation),
    viewCmd('cmd-view-section', 'ribbon.commands.viewSection', 'section', actionStates.viewSection),
  ])

  const panelGroup = group('ansicht-panels', 'ribbon.groups.panels', [
    { id: 'cmd-panel-navigation', labelKey: 'ribbon.commands.navigationPanel', enabled: actionStates.panelNavigation.enabled, visible: true, reasonKey: actionStates.panelNavigation.reasonIfDisabled, editorAction: 'panel:navigation' },
    { id: 'cmd-panel-camera', labelKey: openPanels.camera ? 'ribbon.commands.cameraPanelClose' : 'ribbon.commands.cameraPanel', enabled: actionStates.panelCamera.enabled, visible: true, reasonKey: actionStates.panelCamera.reasonIfDisabled, editorAction: 'panel:camera' },
    { id: 'cmd-panel-left', labelKey: 'ribbon.commands.toggleLeftSidebar', enabled: true, visible: true, editorAction: 'panel:leftSidebar' },
    { id: 'cmd-panel-right', labelKey: 'ribbon.commands.toggleRightSidebar', enabled: true, visible: true, editorAction: 'panel:rightSidebar' },
  ])

  return {
    id: 'ansicht',
    labelKey: 'ribbon.tabs.ansicht',
    groups: [viewGroup, panelGroup].filter((g) => g.commands.length > 0),
  }
}

function buildRenderTab(actionStates: EditorActionStates, projectId: string | null): RibbonTab {
  const screenshotGroup = group('render-screenshot', 'ribbon.groups.screenshot', [
    cmd('cmd-screenshot', 'ribbon.commands.screenshot', actionStates.captureScreenshot),
    cmd('cmd-360', 'ribbon.commands.capture360', actionStates.capture360),
    { ...cmd('cmd-panel-capture', 'ribbon.commands.capturePanel', actionStates.panelCapture), editorAction: 'panel:capture' },
  ])

  const environmentGroup = group('render-environment', 'ribbon.groups.renderEnvironment', [
    { ...cmd('cmd-panel-render-env', 'ribbon.commands.renderEnvironmentPanel', actionStates.panelRenderEnvironment), editorAction: 'panel:renderEnvironment' },
    { ...cmd('cmd-panel-daylight', 'ribbon.commands.daylightPanel', actionStates.panelDaylight), editorAction: 'panel:daylight' },
    { ...cmd('cmd-panel-material', 'ribbon.commands.materialPanel', actionStates.panelMaterial), editorAction: 'panel:material' },
  ])

  const presentationGroup = group('render-presentation', 'ribbon.groups.presentation', [
    cmd(
      'cmd-presentation',
      'ribbon.commands.presentationMode',
      actionStates.presentationMode,
      { targetPath: projectId ? `/projects/${projectId}/presentation` : '/' },
    ),
    cmd('cmd-panorama', 'ribbon.commands.panoramaTours', actionStates.navPanoramaTours, {
      targetPath: projectId ? `/projects/${projectId}/panorama-tours` : '/',
    }),
  ])

  return {
    id: 'render',
    labelKey: 'ribbon.tabs.render',
    groups: [screenshotGroup, environmentGroup, presentationGroup].filter((g) => g.commands.length > 0),
  }
}

function buildDatenTab(
  actionStates: EditorActionStates,
  backendEntries: BackendFeatureEntry[],
  projectId: string | null,
): RibbonTab {
  const workflowGroup = group('daten-workflow', 'ribbon.groups.workflows', [
    enabledCmd('cmd-reports', 'ribbon.commands.reports', { targetPath: '/reports' }),
    cmd('cmd-quote-lines', 'ribbon.commands.quoteLines', actionStates.navQuoteLines, {
      targetPath: projectId ? `/projects/${projectId}/quote-lines` : '/',
    }),
    cmd('cmd-spec-packages', 'ribbon.commands.specificationPackages', actionStates.navSpecificationPackages, {
      targetPath: projectId ? `/projects/${projectId}/specification-packages` : '/',
    }),
  ])

  const interopGroup = group('daten-interop', 'ribbon.groups.interop', [
    enabledCmd('cmd-documents', 'ribbon.commands.documents', { targetPath: '/documents' }),
    enabledCmd('cmd-contacts', 'ribbon.commands.contacts', { targetPath: '/contacts' }),
  ])

  // Extend from backend entries
  const extraEntries = backendEntries
    .filter((entry) => !['quote-lines', 'panorama-tours', 'specification-packages', 'viewer-exports', 'presentation'].includes(entry.id))
    .map((entry): RibbonCommand => ({
      id: `backend-${entry.id}`,
      labelKey: entry.labelKey,
      enabled: entry.enabled,
      visible: entry.visible,
      reasonKey: entry.reasonIfDisabled,
      targetPath: entry.targetPath,
    }))

  const erpGroup = group('daten-erp', 'ribbon.groups.erpHooks', extraEntries)

  return {
    id: 'daten',
    labelKey: 'ribbon.tabs.daten',
    groups: [workflowGroup, interopGroup, ...(erpGroup.commands.length > 0 ? [erpGroup] : [])],
  }
}

function buildPluginsTab(
  projectId: string | null,
  availablePlugins: TenantPluginInfo[],
  enabledPluginIds: string[],
  mcpActions: McpQuickAction[],
): RibbonTab {
  const pluginSlotEntries = resolvePluginSlotEntries({
    slot: 'header',
    projectId,
    availablePlugins,
    enabledPluginIds,
  })

  const tenantPluginCommands: RibbonCommand[] = pluginSlotEntries
    .filter((entry) => Boolean(entry.pluginId))
    .map((entry) => ({
      id: `plugin-${entry.pluginId}`,
      labelKey: `plugin.${entry.pluginId}.label`,
      enabled: entry.enabled,
      visible: true,
      reasonKey: entry.reasonIfDisabled,
      targetPath: entry.path,
    }))

  const pluginsGroup = group('plugins-tenant', 'ribbon.groups.tenantPlugins', [
    enabledCmd('cmd-plugin-settings', 'ribbon.commands.pluginSettings', { targetPath: '/settings/plugins' }),
    ...tenantPluginCommands,
  ])

  const mcpCommands: RibbonCommand[] = mcpActions.map((action) => ({
    id: `mcp-ribbon-${action.id}`,
    labelKey: action.labelKey,
    enabled: action.enabled,
    visible: true,
    reasonKey: action.reasonIfDisabled,
    targetPath: action.targetPath,
    mcpActionKind: action.kind,
    clipboardText: action.prompt,
  }))

  const mcpGroup = group('plugins-mcp', 'ribbon.groups.mcpActions', [
    ...mcpCommands,
  ])

  return {
    id: 'plugins',
    labelKey: 'ribbon.tabs.plugins',
    groups: [pluginsGroup, mcpGroup].filter((g) => g.commands.length > 0),
  }
}

// ---------------------------------------------------------------------------
// Context Tabs
// ---------------------------------------------------------------------------

function buildContextTabs(
  workflowStep: WorkflowStep,
  editorMode: EditorMode,
  actionStates: EditorActionStates,
  projectId: string | null,
): RibbonContextTab[] {
  const wallsActive = workflowStep === 'walls' || editorMode === 'wallCreate'
  const openingsActive = workflowStep === 'openings'
  const furnitureActive = workflowStep === 'furniture'
  const presentationActive = Boolean(projectId) && actionStates.presentationMode.enabled

  const wandtoolsTab: RibbonContextTab = {
    id: 'wandtools',
    labelKey: 'ribbon.contextTabs.wandtools',
    active: wallsActive,
    groups: [
      group('wt-draw', 'ribbon.groups.draw', [
        enabledCmd('cmd-ct-wall', 'ribbon.commands.wall', { targetMode: 'wallCreate' }),
        enabledCmd('cmd-ct-room', 'ribbon.commands.room', { targetMode: 'roomCreate' }),
      ]),
      group('wt-edit', 'ribbon.groups.edit', [
        enabledCmd('cmd-ct-select', 'ribbon.commands.select', { targetMode: 'selection' }),
        enabledCmd('cmd-ct-snap', 'ribbon.commands.snapAlign'),
      ]),
    ],
  }

  const oeffnungTab: RibbonContextTab = {
    id: 'oeffnung',
    labelKey: 'ribbon.contextTabs.oeffnung',
    active: openingsActive,
    groups: [
      group('oe-insert', 'ribbon.groups.elements', [
        enabledCmd('cmd-ct-door', 'ribbon.commands.insertDoor', { targetMode: 'wallCreate' }),
        enabledCmd('cmd-ct-window', 'ribbon.commands.insertWindow', { targetMode: 'wallCreate' }),
      ]),
    ],
  }

  const objektTab: RibbonContextTab = {
    id: 'objekt',
    labelKey: 'ribbon.contextTabs.objekt',
    active: furnitureActive,
    groups: [
      group('obj-insert', 'ribbon.groups.assets', [
        enabledCmd('cmd-ct-furniture', 'ribbon.commands.insertFurniture'),
        enabledCmd('cmd-ct-asset-library', 'ribbon.commands.assetLibrary', { targetPath: '/catalog' }),
      ]),
      group('obj-mat', 'ribbon.groups.material', [
        cmd('cmd-ct-material', 'ribbon.commands.materialPanel', actionStates.panelMaterial),
        cmd('cmd-ct-autocomplete', 'ribbon.commands.autoComplete', actionStates.autoComplete),
      ]),
    ],
  }

  const presentationTab: RibbonContextTab = {
    id: 'presentation',
    labelKey: 'ribbon.contextTabs.presentation',
    active: presentationActive,
    groups: [
      group('pres-main', 'ribbon.groups.presentation', [
        cmd(
          'cmd-ct-presentation',
          'ribbon.commands.presentationMode',
          actionStates.presentationMode,
          { targetPath: projectId ? `/projects/${projectId}/presentation` : '/' },
        ),
        cmd('cmd-ct-screenshot', 'ribbon.commands.screenshot', actionStates.captureScreenshot),
        cmd('cmd-ct-360', 'ribbon.commands.capture360', actionStates.capture360),
      ]),
    ],
  }

  return [wandtoolsTab, oeffnungTab, objektTab, presentationTab]
}

// ---------------------------------------------------------------------------
// Quick Access
// ---------------------------------------------------------------------------

function buildQuickAccess(
  actionStates: EditorActionStates,
  workflowStep: WorkflowStep,
): RibbonCommand[] {
  return [
    enabledCmd('qa-undo', 'ribbon.commands.undo'),
    enabledCmd('qa-redo', 'ribbon.commands.redo'),
    enabledCmd('qa-save', 'ribbon.commands.save'),
    cmd(
      'qa-next-step',
      'ribbon.commands.nextStep',
      {
        enabled: workflowStep !== 'furniture',
        visible: true,
        reasonIfDisabled: 'ribbon.reasons.alreadyLastStep',
      },
      { workflowAction: 'next' },
    ),
    cmd('qa-screenshot', 'ribbon.commands.screenshot', actionStates.captureScreenshot),
  ]
}


// ---------------------------------------------------------------------------
// Kanban Tab Builders
// ---------------------------------------------------------------------------

function buildKanbanProjektTab(selectedKanbanProjectId: string | null): RibbonTab {
  const noSel = { enabled: false, visible: true, reasonIfDisabled: 'ribbon.reasons.noProjectSelected' }
  const editorPath = selectedKanbanProjectId ? '/projects/' + selectedKanbanProjectId : null

  const newGroup = group('kb-new', 'ribbon.groups.newProject', [
    enabledCmd('cmd-kb-new-project', 'ribbon.commands.newProject', { targetPath: '/?new=1' }),
  ])

  const projectGroup = group('kb-project', 'ribbon.groups.projectActions', [
    cmd(
      'cmd-kb-open-editor',
      'ribbon.commands.openInEditor',
      editorPath ? { enabled: true, visible: true } : noSel,
      { targetPath: editorPath ?? '/' },
    ),
    enabledCmd('cmd-kb-documents', 'ribbon.commands.documents', { targetPath: '/documents' }),
  ])

  const hasSel = selectedKanbanProjectId !== null
  const manageGroup = group('kb-manage', 'ribbon.groups.manage', [
    { id: 'cmd-kb-archive', labelKey: 'ribbon.commands.archiveProject', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : 'ribbon.reasons.noProjectSelected', kanbanAction: 'archive' },
    { id: 'cmd-kb-delete', labelKey: 'ribbon.commands.deleteProject', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : 'ribbon.reasons.noProjectSelected', kanbanAction: 'delete' },
  ])

  return {
    id: 'projekt',
    labelKey: 'ribbon.tabs.projekt',
    groups: [newGroup, projectGroup, manageGroup].filter((g) => g.commands.length > 0),
  }
}

function buildKanbanAendernTab(selectedKanbanProjectId: string | null): RibbonTab {
  const hasSel = selectedKanbanProjectId !== null
  const noSelReason = 'ribbon.reasons.noProjectSelected'

  const statusGroup = group('kb-status', 'ribbon.groups.status', [
    { id: 'cmd-kb-status-lead', labelKey: 'ribbon.commands.statusLead', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:lead' },
    { id: 'cmd-kb-status-planning', labelKey: 'ribbon.commands.statusPlanning', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:planning' },
    { id: 'cmd-kb-status-quoted', labelKey: 'ribbon.commands.statusQuoted', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:quoted' },
    { id: 'cmd-kb-status-contract', labelKey: 'ribbon.commands.statusContract', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:contract' },
    { id: 'cmd-kb-status-production', labelKey: 'ribbon.commands.statusProduction', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:production' },
    { id: 'cmd-kb-status-installed', labelKey: 'ribbon.commands.statusInstalled', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'status:installed' },
  ])

  const projectGroup = group('kb-change', 'ribbon.groups.projectChange', [
    { id: 'cmd-kb-duplicate', labelKey: 'ribbon.commands.duplicateProject', enabled: hasSel, visible: true, reasonKey: hasSel ? undefined : noSelReason, kanbanAction: 'duplicate' },
    enabledCmd('cmd-kb-customer-data', 'ribbon.commands.customerData', { targetPath: '/contacts' }),
  ])

  return {
    id: 'aendern',
    labelKey: 'ribbon.tabs.aendern',
    groups: [statusGroup, projectGroup].filter((g) => g.commands.length > 0),
  }
}

function buildEinstellungenTab(): RibbonTab {
  const systemGroup = group('kb-system', 'ribbon.groups.system', [
    enabledCmd('cmd-kb-settings', 'ribbon.commands.save', { targetPath: '/settings' }),
    enabledCmd('cmd-kb-plugins', 'ribbon.commands.pluginSettings', { targetPath: '/settings/plugins' }),
    enabledCmd('cmd-kb-company', 'ribbon.commands.companySettings', { targetPath: '/settings/company' }),
  ])

  return {
    id: 'einstellungen',
    labelKey: 'ribbon.tabs.einstellungen',
    groups: [systemGroup],
  }
}

function buildHilfeTab(): RibbonTab {
  const infoGroup = group('kb-info', 'ribbon.groups.info', [
    enabledCmd('cmd-kb-help', 'ribbon.commands.help'),
    enabledCmd('cmd-kb-about', 'ribbon.commands.about'),
  ])

  return {
    id: 'hilfe',
    labelKey: 'ribbon.tabs.hilfe',
    groups: [infoGroup],
  }
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export function resolveRibbonState(input: RibbonStateInput): RibbonState {
  const {
    projectId,
    actionStates,
    workflowStep,
    editorMode,
    backendEntries,
    availablePlugins,
    mcpActions,
    enabledPluginIds,
    area,
    selectedKanbanProjectId,
    viewMode,
    openPanels,
    activeTabId,
  } = input

  // Kanban area: project management tabs
  if (area === 'kanban') {
    return {
      primaryTabs: [
        buildKanbanProjektTab(selectedKanbanProjectId),
        buildKanbanAendernTab(selectedKanbanProjectId),
        buildEinstellungenTab(),
        buildHilfeTab(),
      ],
      contextTabs: [],
      activeTabId,
      activeContextTabId: null,
      quickAccess: [
        enabledCmd('qa-kb-new-project', 'ribbon.commands.newProject', { targetPath: '/?new=1' }),
      ],
    }
  }

  // Editor and other areas: CAD tabs
  const primaryTabs: RibbonTab[] = [
    buildDateiTab(projectId, actionStates),
    buildStartTab(actionStates, workflowStep),
    buildEinfuegenTab(projectId),
    buildCadTab(editorMode),
    buildAnsichtTab(actionStates, viewMode, openPanels),
    buildRenderTab(actionStates, projectId),
    buildDatenTab(actionStates, backendEntries, projectId),
    buildPluginsTab(projectId, availablePlugins, enabledPluginIds, mcpActions),
  ]

  const contextTabs = buildContextTabs(workflowStep, editorMode, actionStates, projectId)
  const activeContextTab = contextTabs.find((tab) => tab.active) ?? null

  return {
    primaryTabs,
    contextTabs,
    activeTabId,
    activeContextTabId: activeContextTab?.id ?? null,
    quickAccess: buildQuickAccess(actionStates, workflowStep),
  }
}
