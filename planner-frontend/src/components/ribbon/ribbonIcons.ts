/**
 * Maps ribbon command IDs to Fluent icon components.
 * Add new entries here when adding commands to ribbonStateResolver.ts.
 */
import type { FluentIcon } from '@fluentui/react-icons'
import {
  AddRegular,
  ArrowUploadRegular,
  BuildingRegular,
  BuildingHomeRegular,
  AppsRegular,
  ArchiveRegular,
  ArrowMaximizeRegular,
  ArrowRedoRegular,
  ArrowUndoRegular,
  CameraRegular,
  ChartMultipleRegular,
  ClipboardPasteRegular,
  ContentViewRegular,
  CopyRegular,
  CubeRegular,
  CursorHoverRegular,
  CutRegular,
  DeleteRegular,
  DoorRegular,
  DocumentRegular,
  EraserRegular,
  FolderOpenRegular,
  GlobeRegular,
  GlobeVideoRegular,
  GridRegular,
  HomeRegular,
  InfoRegular,
  LineRegular,
  NavigationRegular,
  PanelLeftRegular,
  PanelRightRegular,
  LayoutColumnFourRegular,
  LayoutColumnThreeRegular,
  OpenRegular,
  PeopleRegular,
  PlugConnectedRegular,
  ProjectionScreenRegular,
  PuzzlePieceRegular,
  QuestionCircleRegular,
  RulerRegular,
  SaveRegular,
  ShapesRegular,
  SelectAllOnRegular,
  SettingsRegular,
  Video360Regular,
  ViewDesktopRegular,
  WindowRegular,
} from '@fluentui/react-icons'

export const RIBBON_ICONS: Record<string, FluentIcon> = {
  // Datei tab
  'cmd-new': AddRegular,
  'cmd-open': FolderOpenRegular,
  'cmd-save': SaveRegular,
  'cmd-duplicate': CopyRegular,
  'cmd-gltf-export': ArrowMaximizeRegular,
  'cmd-exports': OpenRegular,

  // Start tab – clipboard
  'cmd-undo': ArrowUndoRegular,
  'cmd-redo': ArrowRedoRegular,
  'cmd-cut': CutRegular,
  'cmd-copy': CopyRegular,
  'cmd-paste': ClipboardPasteRegular,

  // Start tab – selection
  'cmd-select-all': SelectAllOnRegular,
  'cmd-deselect': EraserRegular,

  // Start tab – workflow
  'cmd-prev-step': ArrowUndoRegular,
  'cmd-next-step': ArrowRedoRegular,
  'cmd-autocomplete': AppsRegular,

  // Einfügen tab
  'cmd-insert-window': WindowRegular,
  'cmd-insert-door': DoorRegular,
  'cmd-insert-furniture': BuildingHomeRegular,
  'cmd-insert-label': DocumentRegular,
  'cmd-insert-dim': RulerRegular,
  'cmd-asset-library': GridRegular,
  'cmd-insert-stairs': BuildingRegular,
  'cmd-insert-roof-slope': BuildingRegular,
  'cmd-import-file': ArrowUploadRegular,
  'cmd-import-dxf': ArrowUploadRegular,
  'cmd-import-ifc': ArrowUploadRegular,
  'cmd-import-sketchup': ArrowUploadRegular,

  // CAD tab
  'cmd-wall': ShapesRegular,
  'cmd-room': HomeRegular,
  'cmd-polyline': RulerRegular,
  'cmd-select': CursorHoverRegular,
  'cmd-pan': NavigationRegular,
  'cmd-calibrate': CameraRegular,
  'cmd-snap-align': GridRegular,
  'cmd-topology': AppsRegular,

  // Ansicht tab
  'cmd-view-2d': ViewDesktopRegular,
  'cmd-view-split': LayoutColumnThreeRegular,
  'cmd-view-split3': LayoutColumnFourRegular,
  'cmd-view-3d': CubeRegular,
  'cmd-view-elevation': ContentViewRegular,
  'cmd-view-section': LineRegular,
  'cmd-panel-navigation': NavigationRegular,
  'cmd-panel-camera': CameraRegular,
  'cmd-panel-left': PanelLeftRegular,
  'cmd-panel-right': PanelRightRegular,

  // Render tab
  'cmd-screenshot': CameraRegular,
  'cmd-360': Video360Regular,
  'cmd-panel-capture': CameraRegular,
  'cmd-panel-render-env': CubeRegular,
  'cmd-panel-daylight': GlobeRegular,
  'cmd-panel-material': ShapesRegular,
  'cmd-presentation': ProjectionScreenRegular,
  'cmd-panorama': GlobeVideoRegular,

  // Daten tab
  'cmd-reports': ChartMultipleRegular,
  'cmd-quote-lines': DocumentRegular,
  'cmd-spec-packages': DocumentRegular,
  'cmd-documents': FolderOpenRegular,
  'cmd-contacts': PeopleRegular,

  // Plugins tab
  'cmd-plugin-settings': PuzzlePieceRegular,
  'mcp-menu': PlugConnectedRegular,

  // Kanban – Projekt tab
  'cmd-kb-new-project': AddRegular,
  'cmd-kb-open-editor': OpenRegular,
  'cmd-kb-documents': FolderOpenRegular,
  'cmd-kb-archive': ArchiveRegular,
  'cmd-kb-delete': DeleteRegular,

  // Kanban – Ändern tab
  'cmd-kb-status-lead': InfoRegular,
  'cmd-kb-status-planning': AppsRegular,
  'cmd-kb-status-quoted': DocumentRegular,
  'cmd-kb-status-contract': ChartMultipleRegular,
  'cmd-kb-status-production': GridRegular,
  'cmd-kb-status-installed': HomeRegular,
  'cmd-kb-duplicate': CopyRegular,
  'cmd-kb-customer-data': PeopleRegular,

  // Kanban – Einstellungen tab
  'cmd-kb-settings': SettingsRegular,
  'cmd-kb-plugins': PuzzlePieceRegular,
  'cmd-kb-company': SettingsRegular,

  // Kanban – Hilfe tab
  'cmd-kb-help': QuestionCircleRegular,
  'cmd-kb-about': InfoRegular,

  // Quick Access Bar
  'qa-undo': ArrowUndoRegular,
  'qa-redo': ArrowRedoRegular,
  'qa-save': SaveRegular,
  'qa-next-step': ArrowRedoRegular,
  'qa-screenshot': CameraRegular,
  'qa-kb-new-project': AddRegular,

  // Context tabs
  'cmd-ct-wall': ShapesRegular,
  'cmd-ct-room': HomeRegular,
  'cmd-ct-select': CursorHoverRegular,
  'cmd-ct-snap': GridRegular,
  'cmd-ct-door': DoorRegular,
  'cmd-ct-window': WindowRegular,
  'cmd-ct-furniture': BuildingHomeRegular,
  'cmd-ct-asset-library': GridRegular,
  'cmd-ct-material': AppsRegular,
  'cmd-ct-autocomplete': AppsRegular,
  'cmd-ct-presentation': ProjectionScreenRegular,
  'cmd-ct-screenshot': CameraRegular,
  'cmd-ct-360': Video360Regular,
}
