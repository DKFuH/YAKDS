type NumericPoint = {
  x: number
  y: number
}

type RoomVertex = {
  x_mm?: unknown
  y_mm?: unknown
  x?: unknown
  y?: unknown
}

type RoomBoundaryShape = {
  vertices?: unknown
}

type PlanSvgInput = {
  projectName: string
  roomName?: string | null
  vertices: NumericPoint[]
}

type LayoutSheetSvgInput = {
  sheetName: string
  showArcAnnotation: boolean
  arcLabel?: string
  showNorthArrow: boolean
  northAngleDeg: number
}

type HtmlViewerInput = {
  projectId: string
  projectName: string
  roomName?: string | null
  vertices: NumericPoint[]
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

function parseJsonValue<T>(value: unknown): T | null {
  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseBoundaryShape(boundary: unknown): RoomBoundaryShape | null {
  if (boundary && typeof boundary === 'object' && !Array.isArray(boundary)) {
    return boundary as RoomBoundaryShape
  }

  return parseJsonValue<RoomBoundaryShape>(boundary)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtml(value: string): string {
  return escapeXml(value)
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function toSvgPoints(vertices: NumericPoint[]): string {
  return vertices.map((vertex) => `${vertex.x.toFixed(2)},${vertex.y.toFixed(2)}`).join(' ')
}

function normalizePlanVertices(vertices: NumericPoint[]): NumericPoint[] {
  if (vertices.length < 3) {
    return []
  }

  const minX = Math.min(...vertices.map((point) => point.x))
  const maxX = Math.max(...vertices.map((point) => point.x))
  const minY = Math.min(...vertices.map((point) => point.y))
  const maxY = Math.max(...vertices.map((point) => point.y))
  const width = maxX - minX
  const height = maxY - minY

  if (width <= 0 || height <= 0) {
    return []
  }

  const canvasWidth = 800
  const canvasHeight = 500
  const margin = 40
  const scale = Math.min(
    (canvasWidth - margin * 2) / width,
    (canvasHeight - margin * 2) / height,
  )

  return vertices.map((vertex) => ({
    x: margin + (vertex.x - minX) * scale,
    y: margin + (vertex.y - minY) * scale,
  }))
}

export function extractBoundaryVertices(boundary: unknown): NumericPoint[] {
  const shape = parseBoundaryShape(boundary)
  const rawVertices = shape?.vertices
  if (!Array.isArray(rawVertices)) {
    return []
  }

  const parsed: NumericPoint[] = []

  for (const rawVertex of rawVertices) {
    if (!rawVertex || typeof rawVertex !== 'object') {
      continue
    }

    const vertex = rawVertex as RoomVertex
    const x = toFiniteNumber(vertex.x_mm) ?? toFiniteNumber(vertex.x)
    const y = toFiniteNumber(vertex.y_mm) ?? toFiniteNumber(vertex.y)

    if (x === null || y === null) {
      continue
    }

    parsed.push({ x, y })
  }

  return parsed
}

export function renderPlanSvg(input: PlanSvgInput): string {
  const normalized = normalizePlanVertices(input.vertices)

  if (normalized.length < 3) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect x="0" y="0" width="900" height="600" fill="#ffffff" />
  <text x="40" y="60" font-size="24" font-family="Arial">${escapeXml(input.projectName)}</text>
  <text x="40" y="100" font-size="16" font-family="Arial">No valid room geometry available</text>
</svg>`
  }

  const roomLabel = input.roomName ? ` \u2014 ${input.roomName}` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect x="0" y="0" width="900" height="600" fill="#ffffff" />
  <text x="40" y="40" font-size="20" font-family="Arial">${escapeXml(input.projectName + roomLabel)}</text>
  <polygon points="${toSvgPoints(normalized)}" fill="#e2e8f0" stroke="#0f172a" stroke-width="2" />
</svg>`
}

export function renderLayoutSheetSvg(input: LayoutSheetSvgInput): string {
  const northArrowSvg = input.showNorthArrow
    ? `<g transform="translate(760 90) rotate(${input.northAngleDeg})">
  <line x1="0" y1="18" x2="0" y2="-18" stroke="#0f172a" stroke-width="2" />
  <polygon points="0,-30 -7,-16 7,-16" fill="#0f172a" />
  <text x="0" y="-36" text-anchor="middle" font-size="14" font-family="Arial">N</text>
</g>`
    : ''

  const arcText = input.showArcAnnotation
    ? `<text x="300" y="250" font-size="14" font-family="Arial">${escapeXml(input.arcLabel ?? 'R=1000 mm')}</text>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect x="0" y="0" width="900" height="600" fill="#ffffff" />
  <text x="40" y="40" font-size="20" font-family="Arial">${escapeXml(input.sheetName)}</text>
  <path d="M 200 300 A 120 120 0 0 1 440 300" stroke="#1f2937" fill="none" stroke-width="2" />
  ${arcText}
  ${northArrowSvg}
</svg>`
}

export function renderHtmlViewer(input: HtmlViewerInput): string {
  const payload = {
    project_id: input.projectId,
    project_name: input.projectName,
    room_name: input.roomName ?? null,
    vertices_mm: input.vertices,
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.projectName)} \u2013 Viewer Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; background: #f8fafc; color: #0f172a; }
    .frame { background: #ffffff; border: 1px solid #cbd5e1; padding: 12px; }
    canvas { width: 100%; max-width: 900px; height: 440px; border: 1px dashed #94a3b8; background: #ffffff; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.projectName)}</h1>
  <p>Read-only viewer export.</p>
  <div class="frame">
    <canvas id="viewer-canvas" width="900" height="440" aria-label="Plan preview placeholder"></canvas>
  </div>
  <script id="viewer-data" type="application/json">${escapeJsonForHtml(payload)}</script>
  <script>
    const raw = document.getElementById('viewer-data')?.textContent || '{}';
    const data = JSON.parse(raw);
    const canvas = document.getElementById('viewer-canvas');
    const ctx = canvas.getContext('2d');
    if (ctx && Array.isArray(data.vertices_mm) && data.vertices_mm.length >= 3) {
      const xs = data.vertices_mm.map((p) => Number(p.x) || 0);
      const ys = data.vertices_mm.map((p) => Number(p.y) || 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const margin = 24;
      const scale = Math.min((canvas.width - margin * 2) / width, (canvas.height - margin * 2) / height);
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.vertices_mm.forEach((p, idx) => {
        const px = margin + ((Number(p.x) || 0) - minX) * scale;
        const py = margin + ((Number(p.y) || 0) - minY) * scale;
        if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (ctx) {
      ctx.fillStyle = '#334155';
      ctx.font = '16px Arial';
      ctx.fillText('No valid room geometry available', 24, 36);
    }
  </script>
</body>
</html>`
}
