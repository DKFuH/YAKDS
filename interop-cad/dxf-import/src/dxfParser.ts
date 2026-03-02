import { randomUUID } from 'node:crypto';

import DxfParser from 'dxf-parser';

import type {
  BoundingBox2D,
  CadEntity,
  CadEntityType,
  CadGeometry,
  CadLayer,
  CadUnits,
  ImportAsset,
  ImportProtocolEntry,
  Point2D
} from '@okp/shared-schemas';

type DxfEntity = Record<string, any>;
type DxfLayer = { color?: number; name?: string; visible?: boolean; frozen?: boolean };
type DxfDocument = {
  header?: { $INSUNITS?: number };
  tables?: { layer?: { layers?: Record<string, DxfLayer> } };
  entities?: DxfEntity[];
};
type DxfParserConstructor = new () => { parseSync(input: string): unknown };

const DXF_UNIT_FACTORS: Record<number, { units: CadUnits; factor: number }> = {
  1: { units: 'inch', factor: 25.4 },
  2: { units: 'feet', factor: 304.8 },
  4: { units: 'mm', factor: 1 },
  5: { units: 'cm', factor: 10 },
  6: { units: 'm', factor: 1000 }
};

function nowIsoString(): string {
  return new Date().toISOString();
}

function toMillimeters(value: number | undefined, factor: number): number {
  return (value ?? 0) * factor;
}

function toPoint(point: { x?: number; y?: number }, factor: number): Point2D {
  return {
    x_mm: toMillimeters(point.x, factor),
    y_mm: toMillimeters(point.y, factor)
  };
}

function defaultBoundingBox(): BoundingBox2D {
  return {
    min: { x_mm: 0, y_mm: 0 },
    max: { x_mm: 0, y_mm: 0 }
  };
}

function updateBoundingBox(boundingBox: BoundingBox2D, point: Point2D): BoundingBox2D {
  return {
    min: {
      x_mm: Math.min(boundingBox.min.x_mm, point.x_mm),
      y_mm: Math.min(boundingBox.min.y_mm, point.y_mm)
    },
    max: {
      x_mm: Math.max(boundingBox.max.x_mm, point.x_mm),
      y_mm: Math.max(boundingBox.max.y_mm, point.y_mm)
    }
  };
}

function geometryPoints(geometry: CadGeometry): Point2D[] {
  switch (geometry.type) {
    case 'line':
      return [geometry.start, geometry.end];
    case 'polyline':
      return geometry.points;
    case 'arc':
      return [
        { x_mm: geometry.center.x_mm - geometry.radius_mm, y_mm: geometry.center.y_mm - geometry.radius_mm },
        { x_mm: geometry.center.x_mm + geometry.radius_mm, y_mm: geometry.center.y_mm + geometry.radius_mm }
      ];
    case 'circle':
      return [
        { x_mm: geometry.center.x_mm - geometry.radius_mm, y_mm: geometry.center.y_mm - geometry.radius_mm },
        { x_mm: geometry.center.x_mm + geometry.radius_mm, y_mm: geometry.center.y_mm + geometry.radius_mm }
      ];
    case 'text':
      return [geometry.position];
    case 'block_ref':
      return [geometry.position];
  }
}

function entityHasPositiveZ(entity: DxfEntity): boolean {
  const vertices = Array.isArray(entity.vertices) ? entity.vertices : [];
  const points = [entity.center, entity.position, entity.startPoint, entity.endPoint, ...vertices].filter(Boolean) as Array<{
    z?: number;
  }>;

  return points.some((point) => (point.z ?? 0) > 0);
}

function toLayerMap(document: DxfDocument): Map<string, CadLayer> {
  const layerEntries = Object.entries(document.tables?.layer?.layers ?? {});

  return new Map(
    layerEntries.map(([name, layer]) => [
      name,
      {
        id: `layer-${name}`,
        name,
        color: typeof layer.color === 'number' ? String(layer.color) : null,
        visible: layer.visible !== false && layer.frozen !== true,
        entity_count: 0
      }
    ])
  );
}

function toGeometry(entity: DxfEntity, factor: number): CadGeometry | null {
  switch (entity.type) {
    case 'LINE':
      if (!entity.vertices?.[0] || !entity.vertices?.[1]) {
        return null;
      }

      return {
        type: 'line',
        start: toPoint(entity.vertices[0], factor),
        end: toPoint(entity.vertices[1], factor)
      };
    case 'LWPOLYLINE':
    case 'POLYLINE':
      if (!Array.isArray(entity.vertices) || entity.vertices.length === 0) {
        return null;
      }

      return {
        type: 'polyline',
        points: entity.vertices.map((vertex: { x?: number; y?: number }) => toPoint(vertex, factor)),
        closed: entity.shape === true
      };
    case 'ARC':
      if (!entity.center || typeof entity.radius !== 'number') {
        return null;
      }

      return {
        type: 'arc',
        center: toPoint(entity.center, factor),
        radius_mm: toMillimeters(entity.radius, factor),
        start_angle: ((entity.startAngle ?? 0) * 180) / Math.PI,
        end_angle: ((entity.endAngle ?? 0) * 180) / Math.PI
      };
    case 'CIRCLE':
      if (!entity.center || typeof entity.radius !== 'number') {
        return null;
      }

      return {
        type: 'circle',
        center: toPoint(entity.center, factor),
        radius_mm: toMillimeters(entity.radius, factor)
      };
    case 'TEXT':
    case 'MTEXT':
      if (!entity.startPoint && !entity.position) {
        return null;
      }

      return {
        type: 'text',
        position: toPoint(entity.startPoint ?? entity.position, factor),
        content: entity.text ?? '',
        height_mm: toMillimeters(entity.textHeight ?? entity.height, factor)
      };
    case 'INSERT':
      if (!entity.position) {
        return null;
      }

      return {
        type: 'block_ref',
        block_name: entity.name ?? 'UNKNOWN_BLOCK',
        position: toPoint(entity.position, factor),
        rotation_deg: entity.rotation ?? 0
      };
    default:
      return null;
  }
}

function toCadEntityType(entityType: string): CadEntityType | null {
  switch (entityType) {
    case 'LINE':
      return 'line';
    case 'LWPOLYLINE':
    case 'POLYLINE':
      return 'polyline';
    case 'ARC':
      return 'arc';
    case 'CIRCLE':
      return 'circle';
    case 'TEXT':
    case 'MTEXT':
      return 'text';
    case 'INSERT':
      return 'block_ref';
    default:
      return null;
  }
}

function buildEmptyImportAsset(sourceFilename: string): ImportAsset {
  return {
    id: randomUUID(),
    import_job_id: randomUUID(),
    source_format: 'dxf',
    source_filename: sourceFilename,
    layers: [],
    entities: [],
    bounding_box: defaultBoundingBox(),
    units: 'mm',
    created_at: nowIsoString(),
    protocol: []
  };
}

function createUnitProtocolEntry(document: DxfDocument, units: CadUnits): ImportProtocolEntry | null {
  const insUnits = document.header?.$INSUNITS;

  if (insUnits === undefined) {
    return {
      entity_id: null,
      status: 'needs_review',
      reason: 'DXF header did not specify $INSUNITS. Millimeters were assumed.'
    };
  }

  if (!(insUnits in DXF_UNIT_FACTORS)) {
    return {
      entity_id: null,
      status: 'needs_review',
      reason: `DXF uses unsupported INSUNITS code ${insUnits}. Millimeters were assumed.`
    };
  }

  if (units !== 'mm') {
    return {
      entity_id: null,
      status: 'imported',
      reason: `DXF units ${units} were normalized to millimeters.`
    };
  }

  return null;
}

export function parseDxf(dxfString: string, sourceFilename: string): ImportAsset {
  if (dxfString.trim().length === 0) {
    return buildEmptyImportAsset(sourceFilename);
  }

  let document: DxfDocument;

  try {
    document = new (DxfParser as unknown as DxfParserConstructor)().parseSync(dxfString) as DxfDocument;
  } catch {
    return buildEmptyImportAsset(sourceFilename);
  }

  const unitConfig = DXF_UNIT_FACTORS[document.header?.$INSUNITS ?? 4] ?? DXF_UNIT_FACTORS[4];
  const layerMap = toLayerMap(document);
  const protocol: ImportProtocolEntry[] = [];
  const entities: CadEntity[] = [];
  let boundingBox = defaultBoundingBox();
  let hasBoundingPoints = false;

  (document.entities ?? []).forEach((entity, index) => {
    const entityId = entity.handle ? String(entity.handle) : `${entity.type}-${index}`;
    const layerName = entity.layer ?? '0';

    if (!layerMap.has(layerName)) {
      layerMap.set(layerName, {
        id: `layer-${layerName}`,
        name: layerName,
        color: null,
        visible: true,
        entity_count: 0
      });
    }

    if (entityHasPositiveZ(entity)) {
      protocol.push({
        entity_id: entityId,
        status: 'ignored',
        reason: 'Entity has positive z coordinates and was ignored.'
      });
      return;
    }

    const cadEntityType = toCadEntityType(entity.type);

    if (cadEntityType === null) {
      protocol.push({
        entity_id: entityId,
        status: 'ignored',
        reason: `Unsupported entity type ${entity.type}.`
      });
      return;
    }

    const geometry = toGeometry(entity, unitConfig.factor);

    if (geometry === null) {
      protocol.push({
        entity_id: entityId,
        status: 'needs_review',
        reason: `Incomplete geometry for entity type ${entity.type}.`
      });
      return;
    }

    const layer = layerMap.get(layerName)!;
    layer.entity_count += 1;

    const cadEntity: CadEntity = {
      id: entityId,
      layer_id: layer.id,
      type: cadEntityType,
      geometry
    };

    entities.push(cadEntity);
    protocol.push({
      entity_id: entityId,
      status: 'imported',
      reason: `Imported ${entity.type} entity.`
    });

    geometryPoints(geometry).forEach((point) => {
      boundingBox = hasBoundingPoints ? updateBoundingBox(boundingBox, point) : { min: point, max: point };
      hasBoundingPoints = true;
    });
  });

  const unitProtocolEntry = createUnitProtocolEntry(document, unitConfig.units);
  if (unitProtocolEntry) {
    protocol.unshift(unitProtocolEntry);
  }

  return {
    id: randomUUID(),
    import_job_id: randomUUID(),
    source_format: 'dxf',
    source_filename: sourceFilename,
    layers: [...layerMap.values()],
    entities,
    bounding_box: hasBoundingPoints ? boundingBox : defaultBoundingBox(),
    units: unitConfig.units,
    created_at: nowIsoString(),
    protocol
  };
}
