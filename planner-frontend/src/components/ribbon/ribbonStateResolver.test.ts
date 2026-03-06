import { describe, expect, it } from 'vitest'
import { resolveEditorActionStates, type EditorActionContext } from '../../editor/actionStateResolver.js'
import {
  resolveRibbonState,
  type RibbonStateInput,
} from './ribbonStateResolver.js'

function buildActionContext(overrides: Partial<EditorActionContext> = {}): EditorActionContext {
  return {
    hasProjectId: true,
    compactLayout: false,
    hasSelectedRoom: true,
    hasSelectedSectionLine: true,
    hasSelectedAlternative: true,
    presentationEnabled: true,
    daylightEnabled: true,
    hasProjectEnvironment: true,
    materialsEnabled: true,
    autoCompleteLoading: false,
    previewPopoutOpen: false,
    gltfExportLoading: false,
    bulkDeliveredLoading: false,
    screenshotBusy: false,
    export360Busy: false,
    ...overrides,
  }
}

function buildRibbonInput(overrides: Partial<RibbonStateInput> = {}): RibbonStateInput {
  const actionStates = resolveEditorActionStates(buildActionContext())
  return {
    projectId: 'proj-1',
    actionStates,
    workflowStep: 'walls',
    editorMode: 'wallCreate',
    backendEntries: [],
    availablePlugins: [],
    mcpActions: [],
    enabledPluginIds: [],
    activeTabId: 'start',
    ...overrides,
  }
}

describe('resolveRibbonState – primary tabs', () => {
  it('returns all 8 primary tabs', () => {
    const state = resolveRibbonState(buildRibbonInput())
    const tabIds = state.primaryTabs.map((tab) => tab.id)
    expect(tabIds).toEqual(['datei', 'start', 'einfuegen', 'cad', 'ansicht', 'render', 'daten', 'plugins'])
  })

  it('preserves the activeTabId passed in', () => {
    const state = resolveRibbonState(buildRibbonInput({ activeTabId: 'cad' }))
    expect(state.activeTabId).toBe('cad')
  })

  it('each primary tab has a labelKey and at least one group', () => {
    const state = resolveRibbonState(buildRibbonInput())
    for (const tab of state.primaryTabs) {
      expect(tab.labelKey).toMatch(/^ribbon\.tabs\./)
      expect(tab.groups.length).toBeGreaterThan(0)
    }
  })
})

describe('resolveRibbonState – quick access', () => {
  it('returns quick access commands', () => {
    const state = resolveRibbonState(buildRibbonInput())
    expect(state.quickAccess.length).toBeGreaterThan(0)
  })

  it('next-step quick access is disabled when on last workflow step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'furniture' }))
    const nextCmd = state.quickAccess.find((c) => c.id === 'qa-next-step')
    expect(nextCmd).toBeDefined()
    expect(nextCmd?.enabled).toBe(false)
    expect(nextCmd?.reasonKey).toBe('ribbon.reasons.alreadyLastStep')
  })

  it('next-step quick access is enabled when not on last workflow step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'walls' }))
    const nextCmd = state.quickAccess.find((c) => c.id === 'qa-next-step')
    expect(nextCmd?.enabled).toBe(true)
  })
})

describe('resolveRibbonState – context tabs', () => {
  it('wandtools context tab is active during walls workflow step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'walls' }))
    const wandtools = state.contextTabs.find((ct) => ct.id === 'wandtools')
    expect(wandtools?.active).toBe(true)
    expect(state.activeContextTabId).toBe('wandtools')
  })

  it('oeffnung context tab is active during openings workflow step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'openings', editorMode: 'selection' }))
    const oeffnung = state.contextTabs.find((ct) => ct.id === 'oeffnung')
    expect(oeffnung?.active).toBe(true)
    expect(state.activeContextTabId).toBe('oeffnung')
  })

  it('objekt context tab is active during furniture workflow step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'furniture', editorMode: 'selection' }))
    const objekt = state.contextTabs.find((ct) => ct.id === 'objekt')
    expect(objekt?.active).toBe(true)
    expect(state.activeContextTabId).toBe('objekt')
  })

  it('presentation context tab is active when presentation is enabled and project exists', () => {
    const ctx = buildActionContext({ presentationEnabled: true, hasProjectId: true })
    const actionStates = resolveEditorActionStates(ctx)
    const state = resolveRibbonState(buildRibbonInput({
      projectId: 'p1',
      actionStates,
      workflowStep: 'furniture',
      editorMode: 'selection',
    }))
    const presTab = state.contextTabs.find((ct) => ct.id === 'presentation')
    expect(presTab?.active).toBe(true)
  })

  it('presentation context tab is inactive without project context', () => {
    const ctx = buildActionContext({ presentationEnabled: true, hasProjectId: false })
    const actionStates = resolveEditorActionStates(ctx)
    const state = resolveRibbonState(buildRibbonInput({
      projectId: null,
      actionStates,
      workflowStep: 'walls',
      editorMode: 'wallCreate',
    }))
    const presTab = state.contextTabs.find((ct) => ct.id === 'presentation')
    expect(presTab?.active).toBe(false)
  })

  it('context tabs have groups with commands', () => {
    const state = resolveRibbonState(buildRibbonInput())
    for (const ct of state.contextTabs) {
      expect(ct.groups.length).toBeGreaterThan(0)
      for (const grp of ct.groups) {
        expect(grp.commands.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resolveRibbonState – action state integration', () => {
  it('disables view-split command when compactLayout is true', () => {
    const ctx = buildActionContext({ compactLayout: true })
    const actionStates = resolveEditorActionStates(ctx)
    const state = resolveRibbonState(buildRibbonInput({ actionStates, activeTabId: 'ansicht' }))
    const ansichtTab = state.primaryTabs.find((tab) => tab.id === 'ansicht')
    const viewGroup = ansichtTab?.groups.find((g) => g.id === 'ansicht-view')
    const splitCmd = viewGroup?.commands.find((c) => c.id === 'cmd-view-split')
    expect(splitCmd?.enabled).toBe(false)
    expect(splitCmd?.reasonKey).toBeTruthy()
  })

  it('hides presentation command when presentation is not enabled', () => {
    const ctx = buildActionContext({ presentationEnabled: false })
    const actionStates = resolveEditorActionStates(ctx)
    const state = resolveRibbonState(buildRibbonInput({ actionStates, activeTabId: 'render' }))
    const renderTab = state.primaryTabs.find((tab) => tab.id === 'render')
    // When presentationEnabled is false, the command is filtered out (visible: false)
    const presGroup = renderTab?.groups.find((g) => g.id === 'render-presentation')
    const presCmd = presGroup?.commands.find((c) => c.id === 'cmd-presentation')
    // Command is not visible/included in group when presentation is disabled
    expect(presCmd).toBeUndefined()
  })

  it('disables screenshot command when screenshot is busy', () => {
    const ctx = buildActionContext({ screenshotBusy: true })
    const actionStates = resolveEditorActionStates(ctx)
    const state = resolveRibbonState(buildRibbonInput({ actionStates, activeTabId: 'render' }))
    const renderTab = state.primaryTabs.find((tab) => tab.id === 'render')
    const screenshotGroup = renderTab?.groups.find((g) => g.id === 'render-screenshot')
    const screenshotCmd = screenshotGroup?.commands.find((c) => c.id === 'cmd-screenshot')
    expect(screenshotCmd?.enabled).toBe(false)
  })
})

describe('resolveRibbonState – workflow step commands', () => {
  it('disables previous-step when on first step (walls)', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'walls', activeTabId: 'start' }))
    const startTab = state.primaryTabs.find((tab) => tab.id === 'start')
    const workflowGroup = startTab?.groups.find((g) => g.id === 'start-workflow')
    const prevCmd = workflowGroup?.commands.find((c) => c.id === 'cmd-prev-step')
    expect(prevCmd?.enabled).toBe(false)
    expect(prevCmd?.reasonKey).toBe('ribbon.reasons.alreadyFirstStep')
  })

  it('enables previous-step when not on first step', () => {
    const state = resolveRibbonState(buildRibbonInput({ workflowStep: 'openings', activeTabId: 'start' }))
    const startTab = state.primaryTabs.find((tab) => tab.id === 'start')
    const workflowGroup = startTab?.groups.find((g) => g.id === 'start-workflow')
    const prevCmd = workflowGroup?.commands.find((c) => c.id === 'cmd-prev-step')
    expect(prevCmd?.enabled).toBe(true)
  })
})

describe('resolveRibbonState – plugins tab', () => {
  it('includes MCP actions in plugins tab', () => {
    const mcpActions = [
      { id: 'mcp-hub', labelKey: 'shell.mcp.openHub', kind: 'navigate' as const, targetPath: '/settings/mcp', enabled: true },
    ]
    const state = resolveRibbonState(buildRibbonInput({ mcpActions, activeTabId: 'plugins' }))
    const pluginsTab = state.primaryTabs.find((tab) => tab.id === 'plugins')
    const mcpGroup = pluginsTab?.groups.find((g) => g.id === 'plugins-mcp')
    expect(mcpGroup?.commands.length).toBeGreaterThan(0)
    const mcpCmd = mcpGroup?.commands.find((c) => c.id === 'mcp-ribbon-mcp-hub')
    expect(mcpCmd).toBeDefined()
    expect(mcpCmd?.enabled).toBe(true)
  })

  it('disables MCP actions that require project context when none is present', () => {
    const mcpActions = [
      {
        id: 'mcp-hub-project-context',
        labelKey: 'shell.mcp.openProjectContext',
        kind: 'navigate' as const,
        targetPath: '/settings/mcp',
        enabled: false,
        reasonIfDisabled: 'shell.reasons.projectContextMissing',
      },
    ]
    const state = resolveRibbonState(buildRibbonInput({ projectId: null, mcpActions, activeTabId: 'plugins' }))
    const pluginsTab = state.primaryTabs.find((tab) => tab.id === 'plugins')
    const mcpGroup = pluginsTab?.groups.find((g) => g.id === 'plugins-mcp')
    const cmd = mcpGroup?.commands.find((c) => c.id === 'mcp-ribbon-mcp-hub-project-context')
    expect(cmd?.enabled).toBe(false)
    expect(cmd?.reasonKey).toBe('shell.reasons.projectContextMissing')
  })

  it('preserves MCP copy-prompt payload for execution in RibbonShell', () => {
    const mcpActions = [
      {
        id: 'mcp-copy-validation-prompt',
        labelKey: 'shell.mcp.copyValidationPrompt',
        kind: 'copy-prompt' as const,
        prompt: 'validate project',
        enabled: true,
      },
    ]

    const state = resolveRibbonState(buildRibbonInput({ mcpActions, activeTabId: 'plugins' }))
    const pluginsTab = state.primaryTabs.find((tab) => tab.id === 'plugins')
    const mcpGroup = pluginsTab?.groups.find((g) => g.id === 'plugins-mcp')
    const cmd = mcpGroup?.commands.find((c) => c.id === 'mcp-ribbon-mcp-copy-validation-prompt')

    expect(cmd?.mcpActionKind).toBe('copy-prompt')
    expect(cmd?.clipboardText).toBe('validate project')
    expect(cmd?.targetPath).toBeUndefined()
  })

  it('assigns tenant plugin target path via plugin slot resolver', () => {
    const state = resolveRibbonState(buildRibbonInput({
      projectId: 'p1',
      availablePlugins: [{ id: 'presentation', name: 'Presentation' }],
      enabledPluginIds: ['presentation'],
      activeTabId: 'plugins',
    }))

    const pluginsTab = state.primaryTabs.find((tab) => tab.id === 'plugins')
    const pluginsGroup = pluginsTab?.groups.find((g) => g.id === 'plugins-tenant')
    const cmd = pluginsGroup?.commands.find((c) => c.id === 'plugin-presentation')

    expect(cmd?.enabled).toBe(true)
    expect(cmd?.targetPath).toBe('/projects/p1/presentation')
  })

  it('disables project-scoped tenant plugin command without project context', () => {
    const state = resolveRibbonState(buildRibbonInput({
      projectId: null,
      availablePlugins: [{ id: 'presentation', name: 'Presentation' }],
      enabledPluginIds: ['presentation'],
      activeTabId: 'plugins',
    }))

    const pluginsTab = state.primaryTabs.find((tab) => tab.id === 'plugins')
    const pluginsGroup = pluginsTab?.groups.find((g) => g.id === 'plugins-tenant')
    const cmd = pluginsGroup?.commands.find((c) => c.id === 'plugin-presentation')

    expect(cmd?.enabled).toBe(false)
    expect(cmd?.reasonKey).toBe('shell.reasons.projectContextMissing')
  })
})

describe('resolveRibbonState – i18n key coverage', () => {
  it('all commands reference ribbon.commands.* or shell.* labelKeys', () => {
    const state = resolveRibbonState(buildRibbonInput())
    const allCommands = state.primaryTabs.flatMap((tab) =>
      tab.groups.flatMap((g) => g.commands),
    )
    for (const cmd of allCommands) {
      expect(cmd.labelKey).toMatch(/^(ribbon\.|shell\.|plugin\.)/)
    }
  })

  it('all groups reference ribbon.groups.* labelKeys', () => {
    const state = resolveRibbonState(buildRibbonInput())
    const allGroups = state.primaryTabs.flatMap((tab) => tab.groups)
    for (const grp of allGroups) {
      expect(grp.labelKey).toMatch(/^ribbon\.groups\./)
    }
  })
})
