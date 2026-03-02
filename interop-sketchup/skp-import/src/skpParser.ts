import { randomUUID } from 'node:crypto';

import type {
  BoundingBox3D,
  Point3D,
  Rotation3D,
  SkpComponent,
  SkpComponentMapping,
  SkpReferenceModel
} from '@okp/shared-schemas';

type MockComponentPayload = {
  name?: string;
  guid?: string;
  instance_guid?: string;
  position?: Partial<Point3D>;
  rotation?: Partial<Rotation3D>;
  metadata?: Record<string, unknown>;
  vertices?: Array<Partial<Point3D>>;
  dimensions?: { width_mm?: number; height_mm?: number; depth_mm?: number };
};

type MockSkpPayload = {
  project_id?: string;
  import_job_id?: string;
  raw_geometry_url?: string;
  components?: MockComponentPayload[];
};

function nowIsoString(): string {
  return new Date().toISOString();
}

function toPoint3D(value?: Partial<Point3D>): Point3D {
  return {
    x_mm: value?.x_mm ?? 0,
    y_mm: value?.y_mm ?? 0,
    z_mm: value?.z_mm ?? 0
  };
}

function toRotation3D(value?: Partial<Rotation3D>): Rotation3D {
  return {
    x_deg: value?.x_deg ?? 0,
    y_deg: value?.y_deg ?? 0,
    z_deg: value?.z_deg ?? 0
  };
}

function toMetadata(value?: Record<string, unknown>): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}

function computeDimensions(
  vertices: Point3D[],
  explicitDimensions?: { width_mm?: number; height_mm?: number; depth_mm?: number }
): { width_mm: number; height_mm: number; depth_mm: number } | null {
  if (
    explicitDimensions?.width_mm !== undefined &&
    explicitDimensions?.height_mm !== undefined &&
    explicitDimensions?.depth_mm !== undefined
  ) {
    return {
      width_mm: explicitDimensions.width_mm,
      height_mm: explicitDimensions.height_mm,
      depth_mm: explicitDimensions.depth_mm
    };
  }

  if (vertices.length === 0) {
    return null;
  }

  const xs = vertices.map((vertex) => vertex.x_mm);
  const ys = vertices.map((vertex) => vertex.y_mm);
  const zs = vertices.map((vertex) => vertex.z_mm);

  return {
    width_mm: Math.max(...xs) - Math.min(...xs),
    depth_mm: Math.max(...ys) - Math.min(...ys),
    height_mm: Math.max(...zs) - Math.min(...zs)
  };
}

function emptyBoundingBox(): BoundingBox3D {
  return {
    min: { x_mm: 0, y_mm: 0, z_mm: 0 },
    max: { x_mm: 0, y_mm: 0, z_mm: 0 }
  };
}

function computeBoundingBox(points: Point3D[]): BoundingBox3D {
  if (points.length === 0) {
    return emptyBoundingBox();
  }

  const xs = points.map((point) => point.x_mm);
  const ys = points.map((point) => point.y_mm);
  const zs = points.map((point) => point.z_mm);

  return {
    min: {
      x_mm: Math.min(...xs),
      y_mm: Math.min(...ys),
      z_mm: Math.min(...zs)
    },
    max: {
      x_mm: Math.max(...xs),
      y_mm: Math.max(...ys),
      z_mm: Math.max(...zs)
    }
  };
}

function decodeMockPayload(fileBuffer: Buffer): MockSkpPayload | null {
  try {
    return JSON.parse(fileBuffer.toString('utf8')) as MockSkpPayload;
  } catch {
    return null;
  }
}

export function autoMapComponent(component: SkpComponent): SkpComponentMapping {
  const haystack = [component.skp_component_name, ...Object.values(component.metadata)].join(' ').toLowerCase();
  const isCabinetKeyword =
    haystack.includes('us_') ||
    haystack.includes('unterschrank') ||
    haystack.includes('hs_') ||
    haystack.includes('hängeschrank') ||
    haystack.includes('haengeschrank');
  const isApplianceKeyword =
    haystack.includes('kühlschrank') ||
    haystack.includes('kuehlschrank') ||
    haystack.includes('herd') ||
    haystack.includes('spüle') ||
    haystack.includes('spuele') ||
    haystack.includes('oven') ||
    haystack.includes('fridge');

  if (isCabinetKeyword) {
    return {
      component_id: component.id,
      target_type: 'cabinet',
      catalog_item_id: null,
      label: component.skp_component_name
    };
  }

  if (isApplianceKeyword) {
    return {
      component_id: component.id,
      target_type: 'appliance',
      catalog_item_id: null,
      label: component.skp_component_name
    };
  }

  const dimensions = component.dimensions;
  if (
    dimensions &&
    dimensions.height_mm >= 720 &&
    dimensions.height_mm <= 900 &&
    dimensions.depth_mm >= 500 &&
    dimensions.depth_mm <= 700
  ) {
    return {
      component_id: component.id,
      target_type: 'cabinet',
      catalog_item_id: null,
      label: component.skp_component_name
    };
  }

  return {
    component_id: component.id,
    target_type: 'reference_object',
    catalog_item_id: null,
    label: component.skp_component_name
  };
}

export function parseSkp(fileBuffer: Buffer, sourceFilename: string): SkpReferenceModel {
  const payload = decodeMockPayload(fileBuffer);
  const referenceModelId = randomUUID();

  const components: SkpComponent[] = (payload?.components ?? []).map((componentPayload, index) => {
    const componentId = randomUUID();
    const position = toPoint3D(componentPayload.position);
    const rotation = toRotation3D(componentPayload.rotation);
    const vertices = (componentPayload.vertices ?? []).map((vertex) => toPoint3D(vertex));
    const metadata = toMetadata(componentPayload.metadata);
    const component: SkpComponent = {
      id: componentId,
      reference_model_id: referenceModelId,
      skp_component_name: componentPayload.name ?? `Component ${index + 1}`,
      skp_instance_guid: componentPayload.instance_guid ?? componentPayload.guid ?? randomUUID(),
      position,
      rotation,
      dimensions: computeDimensions(vertices, componentPayload.dimensions),
      metadata,
      mapping: null
    };

    component.mapping = autoMapComponent(component);
    return component;
  });

  const bboxPoints = components.flatMap((component) => {
    const dimensions = component.dimensions;

    if (!dimensions) {
      return [component.position];
    }

    return [
      component.position,
      {
        x_mm: component.position.x_mm + dimensions.width_mm,
        y_mm: component.position.y_mm + dimensions.depth_mm,
        z_mm: component.position.z_mm + dimensions.height_mm
      }
    ];
  });

  return {
    id: referenceModelId,
    project_id: payload?.project_id ?? 'skp-project',
    import_job_id: payload?.import_job_id ?? randomUUID(),
    source_filename: sourceFilename,
    components,
    raw_geometry_url:
      payload?.raw_geometry_url ?? `data:application/octet-stream;base64,${fileBuffer.toString('base64')}`,
    bounding_box: computeBoundingBox(bboxPoints),
    created_at: nowIsoString()
  };
}
