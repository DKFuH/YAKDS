export interface Point2D {
  x_mm: number;
  y_mm: number;
}

export interface Point3D {
  x_mm: number;
  y_mm: number;
  z_mm: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Rotation3D {
  x_deg: number;
  y_deg: number;
  z_deg: number;
}

export interface Vertex extends Point2D {
  id: string;
  index: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WallSegment {
  id: string;
  room_id?: string;
  index?: number;
  start_vertex_id?: string;
  end_vertex_id?: string;
  length_mm: number;
  inner_normal?: Vector2D;
  thickness_mm?: number;
  is_inner_wall?: boolean;
  is_hidden?: boolean;
}

export interface WallSegment2D {
  id: string;
  start: Point2D;
  end: Point2D;
  length_mm: number;
}

export interface Opening {
  id: string;
  wall_id: string;
  type?: 'door' | 'window' | 'pass-through';
  offset_mm: number;
  width_mm: number;
  height_mm?: number;
  sill_height_mm?: number;
  source?: 'manual' | 'cad_import';
}

export interface OpeningCandidate {
  offset_mm: number;
  width_mm: number;
  confidence: 'high' | 'low';
}

export interface CeilingConstraint {
  id?: string;
  room_id?: string;
  wall_id: string;
  wall_start: Point2D;
  wall_end: Point2D;
  kniestock_height_mm: number;
  slope_angle_deg: number;
  depth_into_room_mm: number;
}

export interface RuleViolation {
  severity: 'error' | 'warning' | 'hint';
  code: string;
  message: string;
  affected_ids: string[];
}

export interface PlacedObject {
  id: string;
  wall_id: string;
  offset_mm: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  worldPos?: Point2D;
  flags?: PlacementFlags;
}

export interface Placement extends PlacedObject {
  room_id?: string;
  catalog_item_id: string;
  catalog_article_id?: string;
  description?: string;
  chosen_options?: Record<string, string>;
  list_price_net?: number;
  dealer_price_net?: number;
}

export interface PlacementFlags {
  requires_customization: boolean;
  height_variant: string | null;
  labor_surcharge: boolean;
  special_trim_needed: boolean;
  variant_surcharge?: number;
  object_surcharges?: number;
}

export interface PlacedItem {
  id: string;
  wall_id: string;
  offset_mm: number;
  width_mm: number;
}

export interface Rect2D {
  min: Point2D;
  max: Point2D;
}

export type BOMLineType =
  | 'cabinet'
  | 'appliance'
  | 'accessory'
  | 'surcharge'
  | 'assembly'
  | 'freight'
  | 'extra';

export interface BOMLine {
  id: string;
  project_id: string;
  type: BOMLineType;
  catalog_item_id: string | null;
  description: string;
  qty: number;
  unit: 'stk' | 'm' | 'm2' | 'pauschal';
  list_price_net: number;
  dealer_price_net?: number;
  variant_surcharge: number;
  object_surcharges: number;
  position_discount_pct: number;
  pricing_group_discount_pct: number;
  line_net_after_discounts: number;
  tax_group_id: string;
  tax_rate: number;
}

export interface PriceComponent {
  step: number;
  label: string;
  value: number;
  cumulative: number;
}

export interface PriceSummary {
  project_id: string;
  calculated_at: string;
  total_list_price_net: number;
  total_variant_surcharges: number;
  total_object_surcharges: number;
  total_position_discounts: number;
  total_group_discounts: number;
  total_global_discount: number;
  total_extra_costs: number;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  dealer_price_net: number;
  contribution_margin_net: number;
  markup_pct: number;
  bom_lines: BOMLine[];
  components: PriceComponent[];
  total_purchase_price_net?: number;
  total_sell_price_net?: number;
  total_points?: number;
}

export interface ExtraCost {
  id: string;
  label: string;
  amount_net: number;
  tax_group_id: string;
  type: 'freight' | 'assembly' | 'other';
}

export interface GlobalDiscountSettings {
  project_id: string;
  global_discount_pct: number;
  extra_costs: ExtraCost[];
}

export interface PriceListItem {
  catalog_item_id: string;
  list_price_net: number;
  dealer_price_net: number;
}

export interface TaxGroup {
  id: string;
  name: string;
  tax_rate: number;
}

export interface ProjectQuoteSettings {
  freight_flat_rate: number;
  assembly_rate_per_item: number;
}

export interface CatalogPlacementBase {
  id: string;
  catalog_item_id: string;
  catalog_article_id?: string;
  description?: string;
  chosen_options?: Record<string, string>;
  qty?: number;
  list_price_net?: number;
  dealer_price_net?: number;
  tax_group_id: string;
  pricing_group_discount_pct?: number;
  position_discount_pct?: number;
  flags: PlacementFlags;
}

export interface PlacedCabinet extends CatalogPlacementBase {
  type?: 'cabinet';
}

export interface PlacedAppliance extends CatalogPlacementBase {
  type?: 'appliance';
}

export interface ProjectSnapshot {
  id: string;
  cabinets: PlacedCabinet[];
  appliances: PlacedAppliance[];
  accessories?: CatalogPlacementBase[];
  priceListItems: PriceListItem[];
  taxGroups: TaxGroup[];
  quoteSettings: ProjectQuoteSettings;
}

export interface BoundingBox2D {
  min: Point2D;
  max: Point2D;
}

export interface BoundingBox3D {
  min: Point3D;
  max: Point3D;
}

export type CadUnits = 'mm' | 'cm' | 'm' | 'inch' | 'feet';

export interface CadLayer {
  id: string;
  name: string;
  color: string | null;
  visible: boolean;
  entity_count: number;
}

export type CadEntityType = 'line' | 'polyline' | 'arc' | 'circle' | 'text' | 'block_ref';

export type CadGeometry =
  | { type: 'line'; start: Point2D; end: Point2D }
  | { type: 'polyline'; points: Point2D[]; closed: boolean }
  | { type: 'arc'; center: Point2D; radius_mm: number; start_angle: number; end_angle: number }
  | { type: 'circle'; center: Point2D; radius_mm: number }
  | { type: 'text'; position: Point2D; content: string; height_mm: number }
  | { type: 'block_ref'; block_name: string; position: Point2D; rotation_deg: number };

export interface CadEntity {
  id: string;
  layer_id: string;
  type: CadEntityType | string;
  geometry: CadGeometry;
}

export interface ImportProtocolEntry {
  entity_id: string | null;
  status: 'imported' | 'ignored' | 'needs_review';
  reason: string;
}

export interface ImportAsset {
  id: string;
  import_job_id: string;
  source_format: 'dxf' | 'dwg' | 'skp';
  source_filename: string;
  layers: CadLayer[];
  entities: CadEntity[];
  bounding_box: BoundingBox2D;
  units: CadUnits;
  created_at: string;
  protocol: ImportProtocolEntry[];
}

export interface PlacedObjectBounds {
  id: string;
  footprintRect: Rect2D;
}

export interface ExportPayload {
  room: { boundary: Vertex[] };
  wallSegments: WallSegment2D[];
  openings: Opening[];
  furniture: PlacedObjectBounds[];
  includeFurniture: boolean;
}

export interface HeightViolation extends RuleViolation {
  available_mm: number;
  required_mm: number;
  flags: {
    requires_customization: boolean;
    height_variant: string | null;
    labor_surcharge: boolean;
  };
}

export interface BlockTier {
  min_value: number;
  discount_pct: number;
}

export interface BlockDefinition {
  id: string;
  name: string;
  basis: 'purchase_price' | 'sell_price' | 'points';
  tiers: BlockTier[];
}

export interface BlockEvaluation {
  block_id: string;
  block_name: string;
  basis_value: number;
  applied_discount_pct: number;
  price_advantage_net: number;
  recommended: boolean;
}

export interface SkpComponentMapping {
  component_id: string;
  target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored';
  catalog_item_id: string | null;
  label: string | null;
}

export interface SkpComponent {
  id: string;
  reference_model_id: string;
  skp_component_name: string;
  skp_instance_guid: string;
  position: Point3D;
  rotation: Rotation3D;
  dimensions: { width_mm: number; height_mm: number; depth_mm: number } | null;
  metadata: Record<string, string>;
  mapping: SkpComponentMapping | null;
}

export interface SkpReferenceModel {
  id: string;
  project_id: string;
  import_job_id: string;
  source_filename: string;
  components: SkpComponent[];
  raw_geometry_url: string;
  bounding_box: BoundingBox3D;
  created_at: string;
}

// Sprint 32 - WallObject
export interface WallObject {
  id: string;
  wall_id: string;
  room_id?: string;
  type: 'door_single' | 'door_double' | 'pass_through' | 'window_single' | 'window_double' | 'window_casement';
  offset_mm: number;
  width_mm: number;
  height_mm?: number;
  sill_height_mm?: number;
  hinge_side?: 'left' | 'right';
  door_direction?: 'inward' | 'outward';
  frame_type?: string;
  leibung_depth_mm?: number;
  show_in_plan?: boolean;
  show_in_view?: boolean;
}

// Sprint 33 - Installation
export interface WallInstallation {
  id: string;
  wall_id: string;
  room_id?: string;
  installation_type: 'socket_single' | 'socket_double' | 'socket_triple' | 'water' | 'drain' | 'gas' | '400v_floor';
  offset_mm: number;
  height_from_floor_mm?: number;
  floor_object?: boolean;
  offset_from_wall2_mm?: number;
  show_in_plan?: boolean;
  show_in_view?: boolean;
  symbol_type?: 'installation_symbol' | 'installation_object';
}

// Sprint 34 - PlanningCursor
export interface PlanningCursor {
  wall_id: string;
  offset_mm: number;
  direction_deg: number;
}

export interface SnapPoint {
  type: 'midpoint' | 'front_corner' | 'back_corner' | 'front_edge' | 'grid';
  placement_id?: string;
  position: Point2D;
}

export interface GridSettings {
  step_mm: number;
  angle_step_deg: number;
}

// Sprint 35 - Articles/Macros
export interface LinkedArticle {
  id: string;
  parent_placement_id: string;
  catalog_item_id: string;
  catalog_article_id?: string;
  description?: string;
  qty: number;
  list_price_net?: number;
  dealer_price_net?: number;
  tax_group_id?: string;
}

export interface Macro {
  id: string;
  name: string;
  placements: Placement[];
  created_at?: string;
}

// Sprint 36 - Worktop Schema
export type EdgeType = 'none' | 'straight' | 'rounded' | 'profiled';

export interface WorktopEdge {
  edge_index: number;
  type: EdgeType;
  article_number?: string;
}

export interface WorktopSchema {
  id: string;
  room_id: string;
  polygon: Point2D[];
  edges: WorktopEdge[];
  article_number?: string;
  thickness_mm?: number;
  overhang_mm?: number;
  generated?: boolean;
  created_at?: string;
}

// Sprint 37 - Dimensions/Sections/Comments
export interface MeasureLine {
  id: string;
  room_id: string;
  points: Point2D[];
  label?: string;
  is_chain?: boolean;
}

export interface SectionLine {
  id: string;
  room_id: string;
  start: Point2D;
  end: Point2D;
  label?: string;
}

export interface Comment {
  id: string;
  room_id: string;
  position: Point2D;
  text: string;
  image_url?: string;
  font_size?: number;
  background_color?: string;
  show_in_plan?: boolean;
  show_in_perspective?: boolean;
  arrow_target?: Point2D;
}

// Sprint 38 - Room Colors
export interface RoomSurfaceColor {
  surface: 'floor' | 'ceiling' | 'wall_north' | 'wall_south' | 'wall_east' | 'wall_west';
  color_hex?: string;
  material_id?: string;
  texture_url?: string;
}

export interface RoomColoring {
  id: string;
  room_id: string;
  surfaces: RoomSurfaceColor[];
}

export interface DecoObject {
  id: string;
  room_id: string;
  catalog_item_id: string;
  position: Point2D;
  rotation_deg: number;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
}

// Sprint 39 - Lighting
export type LightingProfileType = 'general' | 'spotlights' | 'ambient' | 'task';

export interface LightSource {
  id: string;
  type: LightingProfileType;
  position: Point3D;
  intensity: number;
  color_temp_k?: number;
}

export interface LightingProfile {
  id: string;
  room_id: string;
  name: string;
  lights: LightSource[];
}

// Sprint 40 - Quote mode
export type QuoteLineType = 'standard' | 'custom' | 'text';

export interface QuoteLine {
  id: string;
  project_id: string;
  parent_id?: string;
  type: QuoteLineType;
  catalog_item_id?: string;
  description: string;
  qty: number;
  unit: 'stk' | 'm' | 'm2' | 'pauschal';
  list_price_net: number;
  dealer_price_net?: number;
  position_discount_pct: number;
  pricing_group_id?: string;
  exclude_from_order?: boolean;
  exclude_from_quote?: boolean;
  sort_order?: number;
}

export interface PricingGroup {
  id: string;
  project_id: string;
  name: string;
  discount_pct: number;
}

export interface BWASummary {
  project_id: string;
  total_list_net: number;
  total_dealer_net: number;
  contribution_margin: number;
  markup_pct: number;
}
