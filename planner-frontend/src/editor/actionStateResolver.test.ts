import { describe, expect, it } from 'vitest'
import {
  resolveEditorActionStates,
  resolvePolygonShortcutStates,
  resolveViewModeShortcut,
  type EditorActionContext,
} from './actionStateResolver.js'

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

describe('actionStateResolver', () => {
  it('disables room-bound actions when no room is selected', () => {
    const states = resolveEditorActionStates(buildActionContext({
      hasSelectedRoom: false,
      hasSelectedSectionLine: false,
      hasSelectedAlternative: false,
    }))

    expect(states.viewElevation.enabled).toBe(false)
    expect(states.viewSection.enabled).toBe(false)
    expect(states.autoComplete.enabled).toBe(false)
    expect(states.previewPopout.enabled).toBe(false)
    expect(states.panelMaterial.enabled).toBe(false)
  })

  it('disables split view on compact layouts', () => {
    const states = resolveEditorActionStates(buildActionContext({
      compactLayout: true,
    }))

    expect(states.viewSplit.enabled).toBe(false)
    expect(states.viewSplit.reasonIfDisabled).toContain('Split')
  })

  it('disables export actions without selected alternative', () => {
    const states = resolveEditorActionStates(buildActionContext({
      hasSelectedAlternative: false,
    }))

    expect(states.gltfExport.enabled).toBe(false)
    expect(states.markAllDelivered.enabled).toBe(false)
  })

  it('disables daylight panel action when plugin is inactive', () => {
    const states = resolveEditorActionStates(buildActionContext({
      daylightEnabled: false,
      hasProjectEnvironment: false,
    }))

    expect(states.panelDaylight.enabled).toBe(false)
    expect(states.panelDaylight.reasonIfDisabled).toContain('Plugin')
  })

  it('disables daylight panel action while daylight data is unavailable', () => {
    const states = resolveEditorActionStates(buildActionContext({
      hasProjectEnvironment: false,
    }))

    expect(states.panelDaylight.enabled).toBe(false)
    expect(states.panelDaylight.reasonIfDisabled).toContain('geladen')
  })

  it('disables presentation mode when plugin is inactive', () => {
    const states = resolveEditorActionStates(buildActionContext({
      presentationEnabled: false,
    }))

    expect(states.presentationMode.enabled).toBe(false)
    expect(states.presentationMode.reasonIfDisabled).toContain('Praesentationsmodus')
  })

  it('disables render-environment panel action without project id', () => {
    const states = resolveEditorActionStates(buildActionContext({
      hasProjectId: false,
    }))

    expect(states.panelRenderEnvironment.enabled).toBe(false)
    expect(states.navQuoteLines.enabled).toBe(false)
    expect(states.navPanoramaTours.enabled).toBe(false)
    expect(states.navSpecificationPackages.enabled).toBe(false)
    expect(states.navViewerExports.enabled).toBe(false)
    expect(states.toggleAreasPanel.enabled).toBe(false)
    expect(states.gltfExport.enabled).toBe(false)
    expect(states.markAllDelivered.enabled).toBe(false)
    expect(states.panelRenderEnvironment.reasonIfDisabled).toContain('Projekt')
    expect(states.gltfExport.reasonIfDisabled).toContain('Projekt')
    expect(states.markAllDelivered.reasonIfDisabled).toContain('Projekt')
  })

  it('returns all actions enabled in happy path', () => {
    const states = resolveEditorActionStates(buildActionContext())

    expect(states.viewSplit.enabled).toBe(true)
    expect(states.viewElevation.enabled).toBe(true)
    expect(states.viewSection.enabled).toBe(true)
    expect(states.panelNavigation.enabled).toBe(true)
    expect(states.panelCamera.enabled).toBe(true)
    expect(states.panelCapture.enabled).toBe(true)
    expect(states.panelRenderEnvironment.enabled).toBe(true)
    expect(states.panelDaylight.enabled).toBe(true)
    expect(states.panelMaterial.enabled).toBe(true)
    expect(states.presentationMode.enabled).toBe(true)
    expect(states.navQuoteLines.enabled).toBe(true)
    expect(states.navPanoramaTours.enabled).toBe(true)
    expect(states.navSpecificationPackages.enabled).toBe(true)
    expect(states.navViewerExports.enabled).toBe(true)
    expect(states.toggleAreasPanel.enabled).toBe(true)
    expect(states.autoComplete.enabled).toBe(true)
    expect(states.previewPopout.enabled).toBe(true)
    expect(states.gltfExport.enabled).toBe(true)
    expect(states.markAllDelivered.enabled).toBe(true)
    expect(states.captureScreenshot.enabled).toBe(true)
    expect(states.capture360.enabled).toBe(true)
  })

  it('maps numeric shortcuts to expected view modes', () => {
    const states = resolveEditorActionStates(buildActionContext())

    expect(resolveViewModeShortcut('1', states)).toBe('2d')
    expect(resolveViewModeShortcut('2', states)).toBe('split')
    expect(resolveViewModeShortcut('3', states)).toBe('3d')
    expect(resolveViewModeShortcut('4', states)).toBe('elevation')
    expect(resolveViewModeShortcut('5', states)).toBe('section')
  })

  it('falls back or blocks shortcuts when target modes are disabled', () => {
    const states = resolveEditorActionStates(buildActionContext({
      compactLayout: true,
      hasSelectedRoom: false,
      hasSelectedSectionLine: false,
    }))

    expect(resolveViewModeShortcut('2', states)).toBe('2d')
    expect(resolveViewModeShortcut('4', states)).toBe(null)
    expect(resolveViewModeShortcut('5', states)).toBe(null)
    expect(resolveViewModeShortcut('9', states)).toBe(null)
  })

  it('disables delete shortcut in safe-edit mode', () => {
    const states = resolvePolygonShortcutStates({
      safeEditMode: true,
      selectedVertexIndex: 2,
      selectedEdgeIndex: null,
      selectedVertexLocked: false,
    })

    expect(states.deleteVertex.enabled).toBe(false)
    expect(states.deleteVertex.reasonIfDisabled).toContain('Safe-Edit')
  })

  it('enables delete shortcut only when unlocked vertex is selected', () => {
    const enabledStates = resolvePolygonShortcutStates({
      safeEditMode: false,
      selectedVertexIndex: 1,
      selectedEdgeIndex: null,
      selectedVertexLocked: false,
    })
    const lockedStates = resolvePolygonShortcutStates({
      safeEditMode: false,
      selectedVertexIndex: 1,
      selectedEdgeIndex: null,
      selectedVertexLocked: true,
    })

    expect(enabledStates.deleteVertex.enabled).toBe(true)
    expect(lockedStates.deleteVertex.enabled).toBe(false)
    expect(lockedStates.deleteVertex.reasonIfDisabled).toContain('gesperrt')
  })

  it('enables clear-selection only with an active selection', () => {
    const noSelection = resolvePolygonShortcutStates({
      safeEditMode: false,
      selectedVertexIndex: null,
      selectedEdgeIndex: null,
      selectedVertexLocked: false,
    })
    const withEdgeSelection = resolvePolygonShortcutStates({
      safeEditMode: false,
      selectedVertexIndex: null,
      selectedEdgeIndex: 0,
      selectedVertexLocked: false,
    })

    expect(noSelection.clearSelection.enabled).toBe(false)
    expect(withEdgeSelection.clearSelection.enabled).toBe(true)
  })
})
