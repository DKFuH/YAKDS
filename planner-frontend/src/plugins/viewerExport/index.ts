export type ViewerExportArtifactKind = 'html-viewer' | 'plan-svg' | 'layout-sheet-svg'

export interface ViewerExportArtifactType {
  kind: ViewerExportArtifactKind
  label: string
  extension: 'html' | 'svg'
}

export const VIEWER_EXPORT_ARTIFACTS: readonly ViewerExportArtifactType[] = [
  {
    kind: 'html-viewer',
    label: 'HTML Viewer',
    extension: 'html',
  },
  {
    kind: 'plan-svg',
    label: 'SVG Grundriss',
    extension: 'svg',
  },
  {
    kind: 'layout-sheet-svg',
    label: 'SVG Sheet',
    extension: 'svg',
  },
]
