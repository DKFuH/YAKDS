import { useEffect, useState } from 'react'
import type { Vertex, Point2D } from '@shared/types'
import type { Opening } from '../../api/openings.js'
import type { Placement } from '../../api/placements.js'
import type { Dimension } from '../../api/dimensions.js'
import type { DrawingGroup, DrawingGroupConfigPatch, DrawingGroupKind, DrawingGroupMember } from '../../api/drawingGroups.js'
import type { Room } from '../../api/projects.js'
import type { BuildingLevel } from '../../api/levels.js'
import type { AcousticGridMeta } from '../../api/acoustics.js'
import type { UnifiedCatalogItem, CatalogArticle } from '../../api/catalog.js'
import type { ValidateResponse } from '../../api/validate.js'
import type { AutoDollhousePatch, AutoDollhouseSettings } from '../../api/visibility.js'
import { previewBom, toQuoteBomLines, type BomPreviewRequest } from '../../api/bom.js'
import { QuoteExportPanel } from '../quotes/QuoteExportPanel.js'
import { ProtectPanel } from './ProtectPanel.js'
import { WallFeaturesPanel } from './WallFeaturesPanel.js'
import { RoomFeaturesPanel } from './RoomFeaturesPanel.js'
import { MacrosPanel } from './MacrosPanel.js'
import { KitchenAssistantPanel } from '../../pages/KitchenAssistantPanel.js'
import { ConstraintsPanel } from '../../pages/ConstraintsPanel.js'
import { VisibilityPanel } from './VisibilityPanel.js'
import { LockPanel } from './LockPanel.js'
import { GroupsPanel } from './GroupsPanel.js'
import type { DimensionAssistSegment } from '../../editor/roomTopology.js'
import styles from './RightSidebar.module.css'

export interface CeilingConstraint {
  id?: string
  wall_id: string
  wall_start: Point2D
  wall_end: Point2D
  kniestock_height_mm: number
  slope_angle_deg: number
  depth_into_room_mm: number
}

export interface ConfiguredDimensions {
  width_mm: number
  height_mm: number
  depth_mm: number
}

interface Props {
  projectId: string
  room: Room | null
  levels: BuildingLevel[]
  activeLevelId: string | null
  selectedVertexIndex: number | null
  selectedVertex: Vertex | null
  selectedEdgeIndex: number | null
  dimensions: Dimension[]
  edgeLengthMm: number | null
  dimensionAssistSegments: DimensionAssistSegment[]
  selectedOpening: Opening | null
  selectedPlacement: Placement | null
  selectedCatalogItem: UnifiedCatalogItem | null
  configuredDimensions: ConfiguredDimensions | null
  onConfigureDimensions: (dims: ConfiguredDimensions) => void
  chosenOptions: Record<string, string>
  onSetChosenOptions: (options: Record<string, string>) => void
  ceilingConstraints: CeilingConstraint[]
  selectedWallGeom: { id: string; start: Point2D; end: Point2D } | null
  selectedWallVisible: boolean | null
  selectedWallLocked: boolean | null
  onMoveVertex: (index: number, pos: Point2D) => void
  onSetEdgeLength: (edgeIndex: number, lengthMm: number, options?: { fineStep?: boolean }) => void
  onEdgeLengthDraftChange: (lengthMm: number | null) => void
  onUpdateOpening: (opening: Opening) => void
  onDeleteOpening: (openingId: string) => void
  onUpdatePlacement: (placement: Placement) => void
  onDeletePlacement: (placementId: string) => void
  onSaveCeilingConstraints: (constraints: CeilingConstraint[]) => void
  validationResult: ValidateResponse | null
  validationLoading: boolean
  onRunValidation: () => void
  placements: Placement[]
  selectedRoomId: string | null
  acousticEnabled: boolean
  acousticOpacityPct: number
  acousticVariable: 'spl_db' | 'spl_dba' | 't20_s' | 'sti'
  acousticGrids: AcousticGridMeta[]
  activeAcousticGridId: string | null
  acousticMin: number | null
  acousticMax: number | null
  acousticBusy: boolean
  onToggleAcoustics: (enabled: boolean) => void
  onSetAcousticOpacityPct: (value: number) => void
  onSetAcousticVariable: (value: 'spl_db' | 'spl_dba' | 't20_s' | 'sti') => void
  onAcousticUpload: (file: File) => void
  onSelectAcousticGrid: (gridId: string | null) => void
  onDeleteAcousticGrid: (gridId: string) => void
  safeEditMode: boolean
  onToggleSafeEditMode: (enabled: boolean) => void
  onToggleActiveLevelVisibility: (next: boolean) => void
  onSetDimensionsVisible: (next: boolean) => void
  onSetPlacementsVisible: (next: boolean) => void
  onSetSelectedWallVisible: (next: boolean) => void
  autoDollhouse: AutoDollhouseSettings | null
  autoDollhouseSaving: boolean
  onSaveAutoDollhouse: (patch: AutoDollhousePatch) => void
  onSetActiveLevelLocked: (next: boolean) => void
  onSetDimensionsLocked: (next: boolean) => void
  onSetSelectedPlacementLocked: (next: boolean) => void
  onSetSelectedWallLocked: (next: boolean) => void
  drawingGroups: DrawingGroup[]
  selectedDrawingGroupId: string | null
  currentSelectionMembers: DrawingGroupMember[]
  onSelectDrawingGroup: (groupId: string | null) => void
  onCreateDrawingGroup: (payload: {
    name: string
    kind: DrawingGroupKind
    members_json: DrawingGroupMember[]
  }) => void
  onDeleteDrawingGroup: (groupId: string) => void
  onApplyDrawingGroupTransform: (groupId: string, payload: {
    translate?: { x_mm: number; y_mm: number }
    rotation_deg?: number
  }) => void
  onSyncDrawingGroupConfig: (groupId: string, config: DrawingGroupConfigPatch) => void
}

export function RightSidebar({
  projectId,
  room,
  levels,
  activeLevelId,
  selectedVertexIndex, selectedVertex,
  selectedEdgeIndex, edgeLengthMm,
  dimensions,
  dimensionAssistSegments,
  selectedOpening,
  selectedPlacement,
  selectedCatalogItem,
  configuredDimensions,
  onConfigureDimensions,
  chosenOptions,
  onSetChosenOptions,
  ceilingConstraints,
  selectedWallGeom,
  selectedWallVisible,
  selectedWallLocked,
  onMoveVertex, onSetEdgeLength, onEdgeLengthDraftChange,
  onUpdateOpening, onDeleteOpening,
  onUpdatePlacement, onDeletePlacement,
  onSaveCeilingConstraints,
  validationResult, validationLoading, onRunValidation,
  placements,
  selectedRoomId,
  acousticEnabled,
  acousticOpacityPct,
  acousticVariable,
  acousticGrids,
  activeAcousticGridId,
  acousticMin,
  acousticMax,
  acousticBusy,
  onToggleAcoustics,
  onSetAcousticOpacityPct,
  onSetAcousticVariable,
  onAcousticUpload,
  onSelectAcousticGrid,
  onDeleteAcousticGrid,
  safeEditMode,
  onToggleSafeEditMode,
  onToggleActiveLevelVisibility,
  onSetDimensionsVisible,
  onSetPlacementsVisible,
  onSetSelectedWallVisible,
  autoDollhouse,
  autoDollhouseSaving,
  onSaveAutoDollhouse,
  onSetActiveLevelLocked,
  onSetDimensionsLocked,
  onSetSelectedPlacementLocked,
  onSetSelectedWallLocked,
  drawingGroups,
  selectedDrawingGroupId,
  currentSelectionMembers,
  onSelectDrawingGroup,
  onCreateDrawingGroup,
  onDeleteDrawingGroup,
  onApplyDrawingGroupTransform,
  onSyncDrawingGroupConfig,
}: Props) {
  const activeLevel = levels.find((level) => level.id === activeLevelId) ?? null
  const dimensionsVisible = dimensions.length > 0 ? dimensions.every((dimension) => dimension.visible !== false) : null
  const dimensionsLocked = dimensions.length > 0 ? dimensions.every((dimension) => dimension.locked === true) : null
  const placementsVisible = placements.length > 0 ? placements.every((placement) => placement.visible !== false) : null

  async function buildQuoteCreatePayload() {
    const taxGroupId = 'tax-default'
    const taxRate = 0.19

    const placementWithPricing = placements.filter((placement) => placement.list_price_net != null)
    const priceListItems = placementWithPricing
      .filter((placement) => !placement.catalog_article_id)
      .map((placement) => ({
      catalog_item_id: placement.catalog_item_id,
      list_price_net: placement.list_price_net ?? 0,
      dealer_price_net: placement.dealer_price_net ?? 0,
    }))

    const articlePrices = placementWithPricing
      .filter((placement) => placement.catalog_article_id)
      .map((placement) => ({
        article_id: placement.catalog_article_id as string,
        ...(placement.article_variant_id ? { article_variant_id: placement.article_variant_id } : {}),
        list_net: placement.list_price_net ?? 0,
        dealer_net: placement.dealer_price_net ?? 0,
        tax_group_id: placement.tax_group_id ?? taxGroupId,
      }))

    const cabinets: BomPreviewRequest['project']['cabinets'] = placements.map((placement) => ({
      ...placement,
      id: placement.id,
      tax_group_id: placement.tax_group_id ?? taxGroupId,
      qty: 1,
      pricing_group_discount_pct: 0,
      position_discount_pct: 0,
      flags: {
        requires_customization: false,
        height_variant: null,
        labor_surcharge: false,
        special_trim_needed: false,
      },
    }))

    const payload: BomPreviewRequest = {
      project: {
        id: projectId,
        cabinets,
        appliances: [],
        accessories: [],
        articlePrices,
        priceListItems,
        taxGroups: [{ id: taxGroupId, name: 'Standard', tax_rate: taxRate }],
        quoteSettings: {
          freight_flat_rate: 89,
          assembly_rate_per_item: 45,
        },
      },
      ...(selectedRoomId
        ? {
            options: {
              includeGeneratedItems: true,
              room_id: selectedRoomId,
            },
          }
        : {}),
    }

    const preview = await previewBom(payload)
    return {
      bom_lines: toQuoteBomLines(preview.lines),
      price_summary: {
        subtotal_net: preview.totals.total_net_after_discounts,
        total_gross: preview.totals.total_net_after_discounts * (1 + taxRate),
      },
    }
  }

  return (
    <aside className={styles.sidebar}>
      <VisibilityPanel
        activeLevelName={activeLevel?.name ?? null}
        activeLevelVisible={activeLevel ? activeLevel.visible : null}
        dimensionsVisible={dimensionsVisible}
        placementsVisible={placementsVisible}
        selectedWallVisible={selectedWallVisible}
        autoDollhouse={autoDollhouse}
        autoDollhouseSaving={autoDollhouseSaving}
        onToggleActiveLevelVisibility={onToggleActiveLevelVisibility}
        onSetDimensionsVisible={onSetDimensionsVisible}
        onSetPlacementsVisible={onSetPlacementsVisible}
        onSetSelectedWallVisible={onSetSelectedWallVisible}
        onSaveAutoDollhouse={onSaveAutoDollhouse}
      />

      <LockPanel
        safeEditMode={safeEditMode}
        activeLevelLocked={activeLevel ? activeLevel.locked : null}
        dimensionsLocked={dimensionsLocked}
        selectedPlacementLocked={selectedPlacement ? Boolean(selectedPlacement.locked) : null}
        selectedWallLocked={selectedWallLocked}
        onToggleSafeEditMode={onToggleSafeEditMode}
        onSetActiveLevelLocked={onSetActiveLevelLocked}
        onSetDimensionsLocked={onSetDimensionsLocked}
        onSetSelectedPlacementLocked={onSetSelectedPlacementLocked}
        onSetSelectedWallLocked={onSetSelectedWallLocked}
      />

      <GroupsPanel
        groups={drawingGroups}
        selectedGroupId={selectedDrawingGroupId}
        selectionMembers={currentSelectionMembers}
        onSelectGroup={onSelectDrawingGroup}
        onCreateGroup={onCreateDrawingGroup}
        onDeleteGroup={onDeleteDrawingGroup}
        onApplyTransform={onApplyDrawingGroupTransform}
        onSyncConfig={onSyncDrawingGroupConfig}
      />

      {selectedOpening ? (
        <OpeningPanel
          key={selectedOpening.id}
          opening={selectedOpening}
          onUpdate={onUpdateOpening}
          onDelete={onDeleteOpening}
        />
      ) : selectedPlacement ? (
        <PlacementPanel
          key={selectedPlacement.id}
          placement={selectedPlacement}
          onUpdate={onUpdatePlacement}
          onDelete={onDeletePlacement}
        />
      ) : selectedVertex !== null && selectedVertexIndex !== null ? (
        <VertexPanel
          key={selectedVertex.id}
          index={selectedVertexIndex}
          vertex={selectedVertex}
          onMove={onMoveVertex}
        />
      ) : selectedEdgeIndex !== null && edgeLengthMm !== null ? (
        <EdgePanel
          key={selectedEdgeIndex}
          edgeIndex={selectedEdgeIndex}
          lengthMm={edgeLengthMm}
          dimensionAssistSegments={dimensionAssistSegments}
          onSetLength={onSetEdgeLength}
          onDraftChange={onEdgeLengthDraftChange}
        />
      ) : (
        <>
          {selectedCatalogItem && configuredDimensions ? (
            <KonfiguratorPanel
              key={selectedCatalogItem.id}
              item={selectedCatalogItem}
              dimensions={configuredDimensions}
              onChange={onConfigureDimensions}
              chosenOptions={chosenOptions}
              onSetOptions={onSetChosenOptions}
            />
          ) : (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Eigenschaften</h3>
              {room ? (
                <dl className={styles.props}>
                  <dt>Raumhöhe</dt>
                  <dd>{(room.ceiling_height_mm / 1000).toFixed(2)} m</dd>
                  <dt>Platzierungen</dt>
                  <dd>{(room.placements as unknown[]).length}</dd>
                </dl>
              ) : (
                <p className={styles.empty}>Kein Objekt ausgewählt</p>
              )}
            </div>
          )}
        </>
      )}

      <AcousticPanel
        enabled={acousticEnabled}
        opacityPct={acousticOpacityPct}
        variable={acousticVariable}
        grids={acousticGrids}
        activeGridId={activeAcousticGridId}
        min={acousticMin}
        max={acousticMax}
        busy={acousticBusy}
        onToggle={onToggleAcoustics}
        onSetOpacityPct={onSetAcousticOpacityPct}
        onSetVariable={onSetAcousticVariable}
        onUpload={onAcousticUpload}
        onSelectGrid={onSelectAcousticGrid}
        onDeleteGrid={onDeleteAcousticGrid}
      />

      <ValidationPanel
        result={validationResult}
        loading={validationLoading}
        onRun={onRunValidation}
      />

      <CeilingConstraintPanel
        constraints={ceilingConstraints}
        wallGeom={selectedWallGeom}
        onSave={onSaveCeilingConstraints}
      />

      {selectedRoomId && (
        <ConstraintsPanel roomId={selectedRoomId} />
      )}

      {/* Wand-Objekte, Installationen & Operationen (Sprints 31-33) */}
      {selectedWallGeom && selectedRoomId && (
        <WallFeaturesPanel
          roomId={selectedRoomId}
          wallId={selectedWallGeom.id}
          wallLengthMm={edgeLengthMm ?? 1000}
        />
      )}

      {/* Raumgestaltung: Arbeitsflächen, Annotationen, Deko, Beleuchtung (Sprints 36-39) */}
      {selectedRoomId && room && (
        <RoomFeaturesPanel roomId={selectedRoomId} />
      )}

      {/* Makros (Sprint 35) */}
      {selectedRoomId && (
        <MacrosPanel
          projectId={projectId}
          currentPlacements={placements}
        />
      )}

      <KitchenAssistantPanel roomId={selectedRoomId} placements={placements} />

      <ProtectPanel
        projectId={projectId}
        roomId={selectedRoomId}
        placements={placements}
        ceilingHeightMm={room?.ceiling_height_mm ?? 2500}
      />

      <QuoteExportPanel
        projectId={projectId}
        buildCreatePayload={buildQuoteCreatePayload}
      />
    </aside>
  )
}

// ─── Öffnungs-Panel ───────────────────────────────────────────────────────────

const OPENING_LABELS: Record<string, string> = {
  door: 'Tür',
  window: 'Fenster',
  'pass-through': 'Durchgang',
  radiator: 'Heizkörper',
  socket: 'Steckdose',
  switch: 'Schalter',
  niche: 'Nische',
  pipe: 'Rohrleitung',
  custom: 'Benutzerdefiniert',
}

function OpeningPanel({ opening, onUpdate, onDelete }: {
  opening: Opening
  onUpdate: (o: Opening) => void
  onDelete: (id: string) => void
}) {
  const [offset, setOffset] = useState(String(Math.round(opening.offset_mm)))
  const [width, setWidth] = useState(String(Math.round(opening.width_mm)))
  const [height, setHeight] = useState(String(opening.height_mm ? Math.round(opening.height_mm) : ''))
  const [sill, setSill] = useState(String(opening.sill_height_mm ? Math.round(opening.sill_height_mm) : '0'))
  const [wallOffsetDepth, setWallOffsetDepth] = useState(
    String(opening.wall_offset_depth_mm ? Math.round(opening.wall_offset_depth_mm) : '0'),
  )

  useEffect(() => {
    setOffset(String(Math.round(opening.offset_mm)))
    setWidth(String(Math.round(opening.width_mm)))
    setHeight(String(opening.height_mm ? Math.round(opening.height_mm) : ''))
    setSill(String(opening.sill_height_mm ? Math.round(opening.sill_height_mm) : '0'))
    setWallOffsetDepth(String(opening.wall_offset_depth_mm ? Math.round(opening.wall_offset_depth_mm) : '0'))
  }, [opening.id])

  function commitField(field: keyof Opening, raw: string, min = 0) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < min) return
    onUpdate({ ...opening, [field]: n })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {OPENING_LABELS[opening.type ?? 'door'] ?? 'Öffnung'}
      </h3>

      {/* Typ-Auswahl */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Typ</label>
        <select
          aria-label="Öffnungstyp"
          className={styles.fieldInput}
          value={opening.type ?? 'door'}
          onChange={e => onUpdate({ ...opening, type: e.target.value as Opening['type'] })}
        >
          <option value="door">Tür</option>
          <option value="window">Fenster</option>
          <option value="pass-through">Durchgang</option>
          <option value="radiator">Heizkörper</option>
          <option value="socket">Steckdose</option>
          <option value="switch">Schalter</option>
          <option value="niche">Nische</option>
          <option value="pipe">Rohrleitung</option>
          <option value="custom">Benutzerdefiniert</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Abstand (mm)</label>
        <input
          aria-label="Abstand vom Wandstart in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={offset}
          onChange={e => setOffset(e.target.value)}
          onBlur={() => commitField('offset_mm', offset)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('offset_mm', offset) }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Breite (mm)</label>
        <input
          aria-label="Öffnungsbreite in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={width}
          onChange={e => setWidth(e.target.value)}
          onBlur={() => commitField('width_mm', width, 1)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('width_mm', width, 1) }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Höhe (mm)</label>
        <input
          aria-label="Öffnungshöhe in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={height}
          onChange={e => setHeight(e.target.value)}
          onBlur={() => commitField('height_mm', height, 1)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('height_mm', height, 1) }}
        />
      </div>

      {opening.type === 'window' && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Brüstung (mm)</label>
          <input
            aria-label="Brüstungshöhe in mm"
            className={styles.fieldInput}
            type="number"
            min={0}
            value={sill}
            onChange={e => setSill(e.target.value)}
            onBlur={() => commitField('sill_height_mm', sill)}
            onKeyDown={e => { if (e.key === 'Enter') commitField('sill_height_mm', sill) }}
          />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tiefenversatz (mm)</label>
        <input
          aria-label="Tiefenversatz in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={wallOffsetDepth}
          onChange={e => setWallOffsetDepth(e.target.value)}
          onBlur={() => commitField('wall_offset_depth_mm', wallOffsetDepth)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('wall_offset_depth_mm', wallOffsetDepth) }}
        />
      </div>

      <button
        type="button"
        className={styles.deleteBtn}
        onClick={() => onDelete(opening.id)}
      >
        Öffnung löschen
      </button>
    </div>
  )
}

// ─── Vertex-Panel ─────────────────────────────────────────────────────────────

function VertexPanel({ index, vertex, onMove }: {
  index: number
  vertex: Vertex
  onMove: (i: number, pos: Point2D) => void
}) {
  const [xVal, setXVal] = useState(String(Math.round(vertex.x_mm)))
  const [yVal, setYVal] = useState(String(Math.round(vertex.y_mm)))

  useEffect(() => {
    setXVal(String(Math.round(vertex.x_mm)))
    setYVal(String(Math.round(vertex.y_mm)))
  }, [vertex.x_mm, vertex.y_mm])

  function commitX() {
    const n = parseFloat(xVal)
    if (!Number.isFinite(n)) { setXVal(String(Math.round(vertex.x_mm))); return }
    onMove(index, { x_mm: n, y_mm: vertex.y_mm })
  }

  function commitY() {
    const n = parseFloat(yVal)
    if (!Number.isFinite(n)) { setYVal(String(Math.round(vertex.y_mm))); return }
    onMove(index, { x_mm: vertex.x_mm, y_mm: n })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Punkt {index + 1}</h3>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>X (mm)</label>
        <input
          aria-label="X-Koordinate in mm"
          className={styles.fieldInput}
          type="number"
          value={xVal}
          onChange={e => setXVal(e.target.value)}
          onBlur={commitX}
          onKeyDown={e => { if (e.key === 'Enter') commitX() }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Y (mm)</label>
        <input
          aria-label="Y-Koordinate in mm"
          className={styles.fieldInput}
          type="number"
          value={yVal}
          onChange={e => setYVal(e.target.value)}
          onBlur={commitY}
          onKeyDown={e => { if (e.key === 'Enter') commitY() }}
        />
      </div>
    </div>
  )
}

// ─── Kanten-Panel ─────────────────────────────────────────────────────────────

function EdgePanel({ edgeIndex, lengthMm, dimensionAssistSegments, onSetLength, onDraftChange }: {
  edgeIndex: number
  lengthMm: number
  dimensionAssistSegments: DimensionAssistSegment[]
  onSetLength: (i: number, mm: number, options?: { fineStep?: boolean }) => void
  onDraftChange: (mm: number | null) => void
}) {
  const [lenVal, setLenVal] = useState(String(Math.round(lengthMm)))
  const [isFineStepModifierDown, setIsFineStepModifierDown] = useState(false)

  useEffect(() => {
    setLenVal(String(Math.round(lengthMm)))
    onDraftChange(null)
  }, [lengthMm, onDraftChange])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsFineStepModifierDown(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setIsFineStepModifierDown(false)
      }
    }

    const onBlur = () => setIsFineStepModifierDown(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  function commit(fineStep = false) {
    const n = parseFloat(lenVal)
    if (!Number.isFinite(n) || n <= 0) {
      setLenVal(String(Math.round(lengthMm)))
      onDraftChange(null)
      return
    }
    onSetLength(edgeIndex, n, { fineStep })
    onDraftChange(null)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Kante {edgeIndex + 1}</h3>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Länge (mm)</label>
        <input
          aria-label="Kantenlänge in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={lenVal}
          onChange={(e) => {
            const value = e.target.value
            setLenVal(value)
            const numeric = parseFloat(value)
            onDraftChange(Number.isFinite(numeric) && numeric > 0 ? numeric : null)
          }}
          onBlur={() => commit(isFineStepModifierDown)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.ctrlKey || isFineStepModifierDown) }}
        />
      </div>
      <p className={styles.hint}>{(lengthMm / 1000).toFixed(3)} m · Ctrl = Feinschritt (halbes Raster)</p>
      {dimensionAssistSegments.length > 0 && (
        <div className={styles.assistBlock}>
          <p className={styles.hint}>Dimension Assist</p>
          <ul className={styles.assistList}>
            {dimensionAssistSegments.slice(0, 8).map((segment) => (
              <li key={segment.id} className={styles.assistItem}>
                <span>{segment.from_label} {'->'} {segment.to_label}</span>
                <strong>{Math.round(segment.length_mm)} mm</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Validierungs-Panel ───────────────────────────────────────────────────────

const SEVERITY_LABELS = { error: 'Fehler', warning: 'Warnung', hint: 'Hinweis' } as const
const SEVERITY_CLASS = {
  error: styles.severityError,
  warning: styles.severityWarning,
  hint: styles.severityHint,
} as const

function resolveVariantId(article: CatalogArticle, chosenOptions: Record<string, string>): string | undefined {
  if (!article.variants || article.variants.length === 0) {
    return undefined
  }

  for (const variant of article.variants) {
    const values = (variant.variant_values_json ?? {}) as Record<string, unknown>
    const keys = Object.keys(values)
    if (keys.length === 0) {
      continue
    }

    const matches = keys.every((key) => {
      const selected = chosenOptions[key]
      if (selected == null || selected.trim() === '') {
        return false
      }
      return String(values[key]) === selected
    })

    if (matches) {
      return variant.id
    }
  }

  return undefined
}

function resolveVariantPrice(article: CatalogArticle, variantId?: string) {
  const prices = article.prices ?? []
  if (prices.length === 0) {
    return undefined
  }

  if (variantId) {
    const variantPrice = prices.find((price) => price.article_variant_id === variantId)
    if (variantPrice) {
      return variantPrice
    }
  }

  const defaultPrice = prices.find((price) => !price.article_variant_id)
  return defaultPrice ?? prices[0]
}

function ValidationPanel({ result, loading, onRun }: {
  result: ValidateResponse | null
  loading: boolean
  onRun: () => void
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Prüfungen</h3>
      <button type="button" className={styles.addConstraintBtn} onClick={onRun} disabled={loading}>
        {loading ? 'Prüfe…' : 'Jetzt prüfen'}
      </button>
      {result && (
        <div className={styles.validationResult}>
          <p className={result.valid ? styles.validOk : styles.validError}>
            {result.valid ? '✓ Keine Fehler' : `${result.errors.length} Fehler, ${result.warnings.length} Warnungen`}
          </p>
          {result.violations.slice(0, 10).map((v, i) => (
            <div key={i} className={`${styles.violation} ${SEVERITY_CLASS[v.severity]}`}>
              <span className={styles.violationBadge}>{SEVERITY_LABELS[v.severity]}</span>
              <span className={styles.violationMsg}>{v.message}</span>
            </div>
          ))}
          {result.violations.length > 10 && (
            <p className={styles.hint}>… und {result.violations.length - 10} weitere</p>
          )}
        </div>
      )}
    </div>
  )
}

function AcousticPanel({
  enabled,
  opacityPct,
  variable,
  grids,
  activeGridId,
  min,
  max,
  busy,
  onToggle,
  onSetOpacityPct,
  onSetVariable,
  onUpload,
  onSelectGrid,
  onDeleteGrid,
}: {
  enabled: boolean
  opacityPct: number
  variable: 'spl_db' | 'spl_dba' | 't20_s' | 'sti'
  grids: AcousticGridMeta[]
  activeGridId: string | null
  min: number | null
  max: number | null
  busy: boolean
  onToggle: (enabled: boolean) => void
  onSetOpacityPct: (value: number) => void
  onSetVariable: (value: 'spl_db' | 'spl_dba' | 't20_s' | 'sti') => void
  onUpload: (file: File) => void
  onSelectGrid: (gridId: string | null) => void
  onDeleteGrid: (gridId: string) => void
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Akustik</h3>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Overlay aktiv</label>
        <input
          aria-label="Akustik-Overlay aktiv"
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Akustikgröße</label>
        <select
          aria-label="Akustikgröße"
          className={styles.fieldInput}
          value={variable}
          onChange={(event) => onSetVariable(event.target.value as 'spl_db' | 'spl_dba' | 't20_s' | 'sti')}
        >
          <option value="spl_db">SPL dB</option>
          <option value="spl_dba">SPL dBA</option>
          <option value="t20_s">T20</option>
          <option value="sti">STI</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Deckkraft: {opacityPct}%</label>
        <input
          aria-label="Akustik Deckkraft"
          type="range"
          min={0}
          max={100}
          value={opacityPct}
          onChange={(event) => onSetOpacityPct(Number(event.target.value))}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>CNIVG-Datei</label>
        <input
          aria-label="CNIVG Datei hochladen"
          type="file"
          accept=".cnivg,.txt,text/plain"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onUpload(file)
            }
            event.currentTarget.value = ''
          }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Grid-Auswahl</label>
        <select
          aria-label="Akustik-Grid"
          className={styles.fieldInput}
          value={activeGridId ?? ''}
          onChange={(event) => onSelectGrid(event.target.value || null)}
        >
          <option value="">Kein Grid</option>
          {grids.map((grid) => (
            <option key={grid.id} value={grid.id}>
              {grid.filename}
            </option>
          ))}
        </select>
      </div>

      {activeGridId && (
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => onDeleteGrid(activeGridId)}
        >
          Grid löschen
        </button>
      )}

      {min != null && max != null && (
        <div className={styles.validationResult}>
          <p className={styles.hint}>Farblegende</p>
          <div className={styles.hint}>Min: {min.toFixed(2)}</div>
          <div className={styles.hint}>25%: {(min + (max - min) * 0.25).toFixed(2)}</div>
          <div className={styles.hint}>50%: {(min + (max - min) * 0.5).toFixed(2)}</div>
          <div className={styles.hint}>75%: {(min + (max - min) * 0.75).toFixed(2)}</div>
          <div className={styles.hint}>Max: {max.toFixed(2)}</div>
        </div>
      )}
    </div>
  )
}

// ─── Platzierungs-Panel ───────────────────────────────────────────────────────

function PlacementPanel({ placement, onUpdate, onDelete }: {
  placement: Placement
  onUpdate: (p: Placement) => void
  onDelete: (id: string) => void
}) {
  const [offset, setOffset] = useState(String(Math.round(placement.offset_mm)))
  const [width, setWidth] = useState(String(Math.round(placement.width_mm)))
  const [depth, setDepth] = useState(String(Math.round(placement.depth_mm)))
  const [height, setHeight] = useState(String(Math.round(placement.height_mm)))

  useEffect(() => {
    setOffset(String(Math.round(placement.offset_mm)))
    setWidth(String(Math.round(placement.width_mm)))
    setDepth(String(Math.round(placement.depth_mm)))
    setHeight(String(Math.round(placement.height_mm)))
  }, [placement.id])

  function commit(field: keyof Placement, raw: string, min = 0) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < min) return
    onUpdate({ ...placement, [field]: n })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Platzierung</h3>
      <p className={styles.hint}>{placement.catalog_item_id.slice(0, 8)}…</p>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Abstand (mm)</label>
        <input aria-label="Abstand vom Wandstart in mm" className={styles.fieldInput} type="number" min={0}
          value={offset} onChange={e => setOffset(e.target.value)}
          onBlur={() => commit('offset_mm', offset)} onKeyDown={e => { if (e.key === 'Enter') commit('offset_mm', offset) }} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Breite (mm)</label>
        <input aria-label="Breite der Platzierung in mm" className={styles.fieldInput} type="number" min={1}
          value={width} onChange={e => setWidth(e.target.value)}
          onBlur={() => commit('width_mm', width, 1)} onKeyDown={e => { if (e.key === 'Enter') commit('width_mm', width, 1) }} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tiefe (mm)</label>
        <input aria-label="Tiefe der Platzierung in mm" className={styles.fieldInput} type="number" min={1}
          value={depth} onChange={e => setDepth(e.target.value)}
          onBlur={() => commit('depth_mm', depth, 1)} onKeyDown={e => { if (e.key === 'Enter') commit('depth_mm', depth, 1) }} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Höhe (mm)</label>
        <input aria-label="Höhe der Platzierung in mm" className={styles.fieldInput} type="number" min={1}
          value={height} onChange={e => setHeight(e.target.value)}
          onBlur={() => commit('height_mm', height, 1)} onKeyDown={e => { if (e.key === 'Enter') commit('height_mm', height, 1) }} />
      </div>

      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(placement.id)}>
        Platzierung löschen
      </button>
    </div>
  )
}

// ─── Dachschrägen-Panel ───────────────────────────────────────────────────────

function CeilingConstraintPanel({ constraints, wallGeom, onSave }: {
  constraints: CeilingConstraint[]
  wallGeom: { id: string; start: Point2D; end: Point2D } | null
  onSave: (constraints: CeilingConstraint[]) => void
}) {
  const wallConstraints = wallGeom
    ? constraints.filter(c => c.wall_id === wallGeom.id)
    : []

  function addConstraint() {
    if (!wallGeom) return
    const newC: CeilingConstraint = {
      id: crypto.randomUUID(),
      wall_id: wallGeom.id,
      wall_start: wallGeom.start,
      wall_end: wallGeom.end,
      kniestock_height_mm: 1200,
      slope_angle_deg: 45,
      depth_into_room_mm: 600,
    }
    onSave([...constraints, newC])
  }

  function updateConstraint(updated: CeilingConstraint) {
    onSave(constraints.map(c => c.id === updated.id ? updated : c))
  }

  function deleteConstraint(id: string) {
    onSave(constraints.filter(c => c.id !== id))
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Dachschrägen</h3>

      {!wallGeom ? (
        <p className={styles.empty}>Wand auswählen</p>
      ) : (
        <>
          {wallConstraints.length === 0 && (
            <p className={styles.empty}>Keine Dachschräge an dieser Wand</p>
          )}
          {wallConstraints.map(c => (
            <ConstraintRow
              key={c.id}
              constraint={c}
              onUpdate={updateConstraint}
              onDelete={() => deleteConstraint(c.id!)}
            />
          ))}
          <button type="button" className={styles.addConstraintBtn} onClick={addConstraint}>
            + Dachschräge hinzufügen
          </button>
        </>
      )}
    </div>
  )
}

function ConstraintRow({ constraint, onUpdate, onDelete }: {
  constraint: CeilingConstraint
  onUpdate: (c: CeilingConstraint) => void
  onDelete: () => void
}) {
  const [kniestock, setKniestock] = useState(String(Math.round(constraint.kniestock_height_mm)))
  const [angle, setAngle] = useState(String(constraint.slope_angle_deg))
  const [depth, setDepth] = useState(String(Math.round(constraint.depth_into_room_mm)))

  function commit(field: keyof CeilingConstraint, raw: string, min = 0) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < min) return
    onUpdate({ ...constraint, [field]: n })
  }

  return (
    <div className={styles.constraintRow}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Kniestock (mm)</label>
        <input
          aria-label="Kniestockhöhe in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={kniestock}
          onChange={e => setKniestock(e.target.value)}
          onBlur={() => commit('kniestock_height_mm', kniestock)}
          onKeyDown={e => { if (e.key === 'Enter') commit('kniestock_height_mm', kniestock) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Neigung (°)</label>
        <input
          aria-label="Dachneigung in Grad"
          className={styles.fieldInput}
          type="number"
          min={0}
          max={90}
          step={0.5}
          value={angle}
          onChange={e => setAngle(e.target.value)}
          onBlur={() => commit('slope_angle_deg', angle)}
          onKeyDown={e => { if (e.key === 'Enter') commit('slope_angle_deg', angle) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tiefe ins Zimmer (mm)</label>
        <input
          aria-label="Tiefe der Dachschräge ins Zimmer in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={depth}
          onChange={e => setDepth(e.target.value)}
          onBlur={() => commit('depth_into_room_mm', depth)}
          onKeyDown={e => { if (e.key === 'Enter') commit('depth_into_room_mm', depth) }}
        />
      </div>
      <button type="button" className={styles.deleteBtn} onClick={onDelete}>
        Dachschräge löschen
      </button>
    </div>
  )
}

// ─── Konfigurator-Panel ───────────────────────────────────────────────────────

function KonfiguratorPanel({ item, dimensions, onChange, chosenOptions, onSetOptions }: {
  item: UnifiedCatalogItem
  dimensions: ConfiguredDimensions
  onChange: (dims: ConfiguredDimensions) => void
  chosenOptions: Record<string, string>
  onSetOptions: (opts: Record<string, string>) => void
}) {
  const [w, setW] = useState(String(Math.round(dimensions.width_mm)))
  const [h, setH] = useState(String(Math.round(dimensions.height_mm)))
  const [d, setD] = useState(String(Math.round(dimensions.depth_mm)))

  const isArticle = 'base_dims_json' in item
  const article = isArticle ? item as CatalogArticle : null
  const matchedVariantId = article ? resolveVariantId(article, chosenOptions) : undefined
  const matchedVariant = matchedVariantId
    ? article?.variants?.find((variant) => variant.id === matchedVariantId)
    : undefined
  const previewPrice = article ? resolveVariantPrice(article, matchedVariantId) : undefined

  useEffect(() => {
    setW(String(Math.round(dimensions.width_mm)))
    setH(String(Math.round(dimensions.height_mm)))
    setD(String(Math.round(dimensions.depth_mm)))
  }, [item.id, dimensions.width_mm, dimensions.height_mm, dimensions.depth_mm])

  function commit(field: 'width_mm' | 'height_mm' | 'depth_mm', raw: string) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n <= 0) return
    onChange({ ...dimensions, [field]: n })
  }

  function handleOptionChange(key: string, val: string) {
    onSetOptions({ ...chosenOptions, [key]: val })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Konfigurator</h3>
      <p className={styles.konfigName}>{item.name}</p>
      <p className={styles.hint}>{item.sku}</p>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Breite (mm)</label>
        <input
          aria-label="Breite in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={w}
          onChange={e => setW(e.target.value)}
          onBlur={() => commit('width_mm', w)}
          onKeyDown={e => { if (e.key === 'Enter') commit('width_mm', w) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Höhe (mm)</label>
        <input
          aria-label="Höhe in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={h}
          onChange={e => setH(e.target.value)}
          onBlur={() => commit('height_mm', h)}
          onKeyDown={e => { if (e.key === 'Enter') commit('height_mm', h) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tiefe (mm)</label>
        <input
          aria-label="Tiefe in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={d}
          onChange={e => setD(e.target.value)}
          onBlur={() => commit('depth_mm', d)}
          onKeyDown={e => { if (e.key === 'Enter') commit('depth_mm', d) }}
        />
      </div>

      {article?.options && article.options.length > 0 && (
        <div className={styles.optionsBlock}>
          <h4 className={styles.subTitle}>Optionen</h4>
          {article.options.map(opt => (
            <div key={opt.id} className={styles.field}>
              <label className={styles.fieldLabel}>{opt.option_key}</label>
              {opt.option_type === 'enum' && Array.isArray(opt.constraints_json?.values) ? (
                <select
                  aria-label={`Option ${opt.option_key}`}
                  className={styles.fieldInput}
                  value={chosenOptions[opt.option_key] ?? ''}
                  onChange={e => handleOptionChange(opt.option_key, e.target.value)}
                >
                  <option value="">Wählen…</option>
                  {opt.constraints_json.values.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={`Option ${opt.option_key}`}
                  className={styles.fieldInput}
                  type="text"
                  value={chosenOptions[opt.option_key] ?? ''}
                  onChange={e => handleOptionChange(opt.option_key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {article && (
        <div className={styles.optionsBlock}>
          <h4 className={styles.subTitle}>Varianten-Preview</h4>
          <p className={styles.hint}>
            {matchedVariant
              ? `Variante: ${matchedVariant.variant_key}`
              : 'Variante: wird aus den gewählten Optionen bestimmt'}
          </p>
          <p className={styles.hint}>
            {previewPrice
              ? `Preis netto: ${previewPrice.list_net.toFixed(2)} €`
              : 'Preis netto: nicht verfügbar'}
          </p>
        </div>
      )}

      <p className={styles.hint}>
        Maße anpassen → dann Wand anklicken und "+ Platzieren"
      </p>
    </div>
  )
}
