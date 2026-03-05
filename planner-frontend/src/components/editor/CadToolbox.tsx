import {
  Badge,
  Body1Strong,
  Button,
  Switch,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { EditorActionStates, ResolvedActionState } from '../../editor/actionStateResolver.js'
import type { EditorMode } from '../../editor/editorModeStore.js'
import type { EditorSettings } from '../../editor/usePolygonEditor.js'
import type { WorkflowStep } from '../../editor/workflowStateStore.js'

interface CadToolboxProps {
  mode: EditorMode
  onSetMode: (mode: EditorMode) => void
  workflowStep: WorkflowStep
  onSetWorkflowStep: (step: WorkflowStep) => void
  deleteVertexAction: ResolvedActionState
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  canAddPlacement: boolean
  onAddOpeningForSelectedEdge: () => void
  onAddPlacementForSelectedEdge: () => void
  onDeleteSelectedVertex: () => void
  safeEditMode: boolean
  onSetSafeEditMode: (next: boolean) => void
  editorSettings: Pick<EditorSettings, 'magnetismEnabled' | 'axisMagnetismEnabled' | 'angleSnap'>
  onUpdateEditorSettings: (settings: Partial<EditorSettings>) => void
  showAreasPanel: boolean
  onSetShowAreasPanel: (next: boolean) => void
  actionStates: Pick<EditorActionStates, 'toggleAreasPanel'>
}

const useStyles = makeStyles({
  root: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'grid',
    gap: tokens.spacingVerticalS,
    '@media (max-width: 900px)': {
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    },
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  group: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    minWidth: '210px',
    flex: '1 1 220px',
  },
  groupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  disabledWrapper: {
    display: 'inline-flex',
  },
})

function ReasonedButton({
  label,
  active,
  action,
  onClick,
}: {
  label: string
  active?: boolean
  action: ResolvedActionState
  onClick: () => void
}) {
  const styles = useStyles()
  const button = (
    <Button
      size='small'
      appearance={active ? 'primary' : 'subtle'}
      disabled={!action.enabled}
      onClick={onClick}
    >
      {label}
    </Button>
  )

  if (action.enabled) {
    return button
  }

  return (
    <Tooltip content={action.reasonIfDisabled ?? 'Aktion nicht verfuegbar'} relationship='label'>
      <span className={styles.disabledWrapper}>{button}</span>
    </Tooltip>
  )
}

function staticAction(enabled: boolean, reasonIfDisabled?: string): ResolvedActionState {
  return enabled
    ? { enabled: true, visible: true }
    : { enabled: false, visible: true, reasonIfDisabled }
}

export function CadToolbox({
  mode,
  onSetMode,
  workflowStep,
  onSetWorkflowStep,
  deleteVertexAction,
  selectedVertexIndex,
  selectedEdgeIndex,
  canAddPlacement,
  onAddOpeningForSelectedEdge,
  onAddPlacementForSelectedEdge,
  onDeleteSelectedVertex,
  safeEditMode,
  onSetSafeEditMode,
  editorSettings,
  onUpdateEditorSettings,
  showAreasPanel,
  onSetShowAreasPanel,
  actionStates,
}: CadToolboxProps) {
  const styles = useStyles()

  const openingAction = staticAction(selectedEdgeIndex !== null, 'Wandkante auswaehlen, um eine Oeffnung hinzuzufuegen')
  const placementAction = staticAction(
    selectedEdgeIndex !== null && canAddPlacement,
    selectedEdgeIndex === null
      ? 'Wandkante auswaehlen, um ein Objekt zu platzieren'
      : 'Katalogobjekt auswaehlen, bevor platziert werden kann',
  )

  return (
    <section className={styles.root} aria-label='CAD Toolbox'>
      <div className={styles.row}>
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <Body1Strong>Zeichnen</Body1Strong>
            <Badge appearance='tint'>{workflowStep}</Badge>
          </div>
          <div className={styles.buttonRow}>
            <Button size='small' appearance={workflowStep === 'walls' ? 'primary' : 'subtle'} onClick={() => onSetWorkflowStep('walls')}>Waende</Button>
            <Button size='small' appearance={workflowStep === 'openings' ? 'primary' : 'subtle'} onClick={() => onSetWorkflowStep('openings')}>Oeffnungen</Button>
            <Button size='small' appearance={workflowStep === 'furniture' ? 'primary' : 'subtle'} onClick={() => onSetWorkflowStep('furniture')}>Moebel</Button>
          </div>
          <div className={styles.buttonRow}>
            <Button size='small' appearance={mode === 'wallCreate' ? 'primary' : 'subtle'} onClick={() => onSetMode('wallCreate')}>Wand</Button>
            <Button size='small' appearance={mode === 'roomCreate' ? 'primary' : 'subtle'} onClick={() => onSetMode('roomCreate')}>Raum</Button>
            <Button size='small' appearance={mode === 'polylineCreate' ? 'primary' : 'subtle'} onClick={() => onSetMode('polylineCreate')}>Polyline</Button>
            <Button size='small' appearance={mode === 'dimCreate' ? 'primary' : 'subtle'} onClick={() => onSetMode('dimCreate')}>Bemassung</Button>
            <Button size='small' appearance={mode === 'labelCreate' ? 'primary' : 'subtle'} onClick={() => onSetMode('labelCreate')}>Label</Button>
          </div>
        </div>

        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <Body1Strong>Bearbeiten</Body1Strong>
            <Badge appearance='outline'>
              {selectedVertexIndex !== null ? 'Punkt aktiv' : selectedEdgeIndex !== null ? 'Kante aktiv' : 'Keine Auswahl'}
            </Badge>
          </div>
          <div className={styles.buttonRow}>
            <Button size='small' appearance={mode === 'selection' ? 'primary' : 'subtle'} onClick={() => onSetMode('selection')}>Auswahl</Button>
            <Button size='small' appearance={mode === 'pan' ? 'primary' : 'subtle'} onClick={() => onSetMode('pan')}>Pan</Button>
            <Button size='small' appearance={mode === 'calibrate' ? 'primary' : 'subtle'} onClick={() => onSetMode('calibrate')}>Kalibrieren</Button>
            <ReasonedButton label='Punkt loeschen' action={deleteVertexAction} onClick={onDeleteSelectedVertex} />
          </div>
          <div className={styles.toggleRow}>
            <Switch
              checked={safeEditMode}
              label='Safe Edit'
              onChange={(_event, data) => onSetSafeEditMode(Boolean(data.checked))}
            />
          </div>
        </div>

        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <Body1Strong>Snap</Body1Strong>
          </div>
          <div className={styles.toggleRow}>
            <Switch
              checked={editorSettings.magnetismEnabled}
              label='Punktfang'
              onChange={(_event, data) => onUpdateEditorSettings({ magnetismEnabled: Boolean(data.checked) })}
            />
            <Switch
              checked={editorSettings.axisMagnetismEnabled}
              label='Achsenfang'
              onChange={(_event, data) => onUpdateEditorSettings({ axisMagnetismEnabled: Boolean(data.checked) })}
            />
            <Switch
              checked={editorSettings.angleSnap}
              label='Winkelfang'
              onChange={(_event, data) => onUpdateEditorSettings({ angleSnap: Boolean(data.checked) })}
            />
          </div>
        </div>

        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <Body1Strong>Objekte</Body1Strong>
          </div>
          <div className={styles.buttonRow}>
            <ReasonedButton label='+ Oeffnung' action={openingAction} onClick={onAddOpeningForSelectedEdge} />
            <ReasonedButton label='+ Platzieren' action={placementAction} onClick={onAddPlacementForSelectedEdge} />
            <ReasonedButton
              label={showAreasPanel ? 'Bereiche ausblenden' : 'Bereiche anzeigen'}
              action={actionStates.toggleAreasPanel}
              onClick={() => onSetShowAreasPanel(!showAreasPanel)}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
