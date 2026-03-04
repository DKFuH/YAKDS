import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { suggestLayouts, type RoomGeometry } from './kitchenAssistant.js'

// ─────────────────────────────────────────
// MCP Tool Definitions
// ─────────────────────────────────────────

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_projects',
    description: 'Liste alle Küchenplanungs-Projekte (optional gefiltert nach tenant_id).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'Optionale Tenant-ID zur Filterung' },
        limit: { type: 'number', description: 'Maximale Anzahl Ergebnisse (1–100)', default: 20 },
        offset: { type: 'number', description: 'Offset für Paginierung', default: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_project',
    description: 'Gibt Details zu einem einzelnen Küchenplanungs-Projekt zurück.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'UUID des Projekts' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'suggest_kitchen_layout',
    description:
      'Schlägt Küchenlayouts (Einzeiler, L-Form, U-Form …) für eine Raumgeometrie vor. ' +
      'Gibt bis zu 3 bewertete Vorschläge zurück.',
    inputSchema: {
      type: 'object',
      required: ['wall_segments', 'ceiling_height_mm'],
      properties: {
        wall_segments: {
          type: 'array',
          description: 'Wandsegmente des Raums',
          items: {
            type: 'object',
            required: ['id', 'x0_mm', 'y0_mm', 'x1_mm', 'y1_mm'],
            properties: {
              id: { type: 'string' },
              x0_mm: { type: 'number' },
              y0_mm: { type: 'number' },
              x1_mm: { type: 'number' },
              y1_mm: { type: 'number' },
              has_opening: { type: 'boolean', default: false },
            },
            additionalProperties: false,
          },
        },
        ceiling_height_mm: { type: 'number', description: 'Deckenhöhe in mm' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_catalog_articles',
    description: 'Durchsucht den Artikelkatalog nach Küchenmöbeln und Geräten.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string', description: 'Optionale Tenant-ID zur Filterung' },
        collection: { type: 'string', description: 'Kollektion / Serie filtern' },
        family: { type: 'string', description: 'Produktfamilie filtern' },
        search: { type: 'string', description: 'Freitextsuche nach Name oder SKU' },
        limit: { type: 'number', description: 'Maximale Anzahl Ergebnisse (1–100)', default: 20 },
        offset: { type: 'number', description: 'Offset für Paginierung', default: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_bom',
    description: 'Gibt die Stückliste (Bill of Materials) eines Projekts zurück.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'UUID des Projekts' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_rooms',
    description: 'Listet alle Räume eines Projekts mit Name, Fläche und Deckenhöhe.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'UUID des Projekts' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_room_detail',
    description:
      'Gibt Raumpolygon, Wände (mit Längen), Öffnungen (Türen/Fenster) und platzierte Artikel zurück.',
    inputSchema: {
      type: 'object',
      required: ['room_id'],
      properties: {
        room_id: { type: 'string', description: 'UUID des Raums' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_placements',
    description:
      'Gibt alle platzierten Artikel in einem Raum zurück (Artikel-ID, Name, Position, Abmessungen).',
    inputSchema: {
      type: 'object',
      required: ['room_id'],
      properties: {
        room_id: { type: 'string', description: 'UUID des Raums' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_quote',
    description:
      'Gibt das aktuelle Angebot eines Projekts zurück (Positionen, Netto/Brutto-Summen, Status).',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'UUID des Projekts' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search_contacts',
    description: 'Sucht nach Kunden/Leads anhand von Name oder E-Mail.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name oder E-Mail-Fragment' },
        tenant_id: { type: 'string', description: 'Optionale Tenant-ID' },
        limit: { type: 'number', default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_project',
    description: 'Legt ein neues Planungsprojekt an.',
    inputSchema: {
      type: 'object',
      required: ['name', 'tenant_id'],
      properties: {
        name: { type: 'string', description: 'Projektname' },
        tenant_id: { type: 'string', description: 'Tenant-UUID' },
        user_id: { type: 'string', description: 'Optionale User-UUID als Projekt-Owner' },
        branch_id: { type: 'string', description: 'Optionale Branch-UUID' },
        description: { type: 'string', description: 'Optionale Beschreibung' },
        lead_id: { type: 'string', description: 'Optionale Lead/Kunden-UUID' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_project_status',
    description:
      'Schaltet den Status eines Projekts weiter (lead → planning → quoted → contract → production → installed).',
    inputSchema: {
      type: 'object',
      required: ['project_id', 'status'],
      properties: {
        project_id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['lead', 'planning', 'quoted', 'contract', 'production', 'installed'],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'add_placement',
    description: 'Platziert einen Katalogartikel in einem Raum an einer Wand.',
    inputSchema: {
      type: 'object',
      required: ['room_id', 'article_id', 'wall_id', 'offset_mm'],
      properties: {
        room_id: { type: 'string', description: 'UUID des Raums' },
        article_id: { type: 'string', description: 'UUID des Katalogartikels' },
        wall_id: { type: 'string', description: 'UUID der Wand' },
        offset_mm: { type: 'number', description: 'Abstand vom Wand-Startpunkt in mm' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'remove_placement',
    description: 'Entfernt eine Platzierung aus einem Raum.',
    inputSchema: {
      type: 'object',
      required: ['placement_id'],
      properties: {
        placement_id: { type: 'string', description: 'UUID der Platzierung' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_quote_from_bom',
    description: 'Erzeugt ein neues Angebot aus der aktuellen Stückliste des Projekts.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string' },
        valid_days: {
          type: 'number',
          description: 'Gültigkeitsdauer in Tagen (default 30)',
          default: 30,
        },
        free_text: { type: 'string', description: 'Optionaler Angebotstext' },
      },
      additionalProperties: false,
    },
  },
]

type BoundaryVertex = {
  id?: string
  x_mm?: number
  y_mm?: number
}

type BoundaryWall = {
  id?: string
  start_vertex_id?: string
  end_vertex_id?: string
  length_mm?: number
}

type RoomBoundary = {
  vertices?: BoundaryVertex[]
  wall_segments?: BoundaryWall[]
}

function getBoundaryVertices(boundary: unknown): Array<{ x_mm: number; y_mm: number }> {
  if (!boundary || typeof boundary !== 'object') return []
  const vertices = (boundary as RoomBoundary).vertices
  if (!Array.isArray(vertices)) return []

  return vertices
    .map((vertex) => ({ x_mm: Number(vertex.x_mm), y_mm: Number(vertex.y_mm) }))
    .filter((vertex) => Number.isFinite(vertex.x_mm) && Number.isFinite(vertex.y_mm))
}

function calculateAreaSqm(boundary: unknown): number {
  const vertices = getBoundaryVertices(boundary)
  if (vertices.length < 3) return 0

  let areaTimesTwo = 0
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]
    const next = vertices[(index + 1) % vertices.length]
    areaTimesTwo += current.x_mm * next.y_mm - next.x_mm * current.y_mm
  }

  const areaSqMm = Math.abs(areaTimesTwo) / 2
  const areaSqM = areaSqMm / 1_000_000
  return Math.round(areaSqM * 100) / 100
}

function deriveWalls(boundary: unknown) {
  if (!boundary || typeof boundary !== 'object') return []

  const boundaryData = boundary as RoomBoundary
  const vertices = Array.isArray(boundaryData.vertices) ? boundaryData.vertices : []
  const wallSegments = Array.isArray(boundaryData.wall_segments) ? boundaryData.wall_segments : []

  return wallSegments.map((wall) => {
    const start = vertices.find((vertex) => vertex.id === wall.start_vertex_id)
    const end = vertices.find((vertex) => vertex.id === wall.end_vertex_id)
    const derivedLength =
      start && end
        ? Math.hypot(Number(end.x_mm ?? 0) - Number(start.x_mm ?? 0), Number(end.y_mm ?? 0) - Number(start.y_mm ?? 0))
        : undefined

    return {
      id: wall.id ?? null,
      start_vertex_id: wall.start_vertex_id ?? null,
      end_vertex_id: wall.end_vertex_id ?? null,
      length_mm: Number.isFinite(Number(wall.length_mm))
        ? Number(wall.length_mm)
        : Number.isFinite(derivedLength)
          ? Math.round((derivedLength ?? 0) * 10) / 10
          : null,
    }
  })
}

function buildQuoteNumber(version: number): string {
  const year = new Date().getFullYear()
  return `ANG-${year}-${String(version).padStart(4, '0')}`
}

// ─────────────────────────────────────────
// MCP Tool Handlers
// ─────────────────────────────────────────

export interface McpToolCallResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  db: PrismaClient,
): Promise<McpToolCallResult> {
  // Cast to any for models that are defined in the schema but not yet in the generated client
  const anyDb = db as any
  switch (name) {
    case 'list_projects': {
      const tenantId = args.tenant_id as string | undefined
      const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)))
      const offset = Math.max(0, Number(args.offset ?? 0))

      const where: Record<string, unknown> = {}
      if (tenantId) where.tenant_id = tenantId

      const [projects, total] = await Promise.all([
        anyDb.project.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            name: true,
            description: true,
            project_status: true,
            priority: true,
            progress_pct: true,
            tenant_id: true,
            created_at: true,
          },
        }),
        anyDb.project.count({ where }),
      ])

      return {
        content: [{ type: 'text', text: JSON.stringify({ total, projects }) }],
      }
    }

    case 'get_project': {
      const projectId = args.project_id as string
      if (!projectId) {
        return {
          content: [{ type: 'text', text: 'project_id is required' }],
          isError: true,
        }
      }

      const project = await anyDb.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          description: true,
          project_status: true,
          priority: true,
          progress_pct: true,
          deadline: true,
          tenant_id: true,
          created_at: true,
          updated_at: true,
        },
      })

      if (!project) {
        return {
          content: [{ type: 'text', text: `Project ${projectId} not found` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(project) }],
      }
    }

    case 'suggest_kitchen_layout': {
      const wallSegments = args.wall_segments as RoomGeometry['wall_segments'] | undefined
      const ceilingHeight = Number(args.ceiling_height_mm ?? 2500)

      if (!Array.isArray(wallSegments) || wallSegments.length === 0) {
        return {
          content: [{ type: 'text', text: 'wall_segments must be a non-empty array' }],
          isError: true,
        }
      }

      const geometry: RoomGeometry = {
        wall_segments: wallSegments,
        ceiling_height_mm: ceilingHeight,
      }

      const suggestions = suggestLayouts(geometry)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              suggestions,
              message:
                suggestions.length === 0
                  ? 'Kein Layout-Vorschlag möglich für diese Raumgeometrie'
                  : `${suggestions.length} Layout-Vorschläge gefunden`,
            }),
          },
        ],
      }
    }

    case 'get_catalog_articles': {
      const tenantId = args.tenant_id as string | undefined
      const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)))
      const offset = Math.max(0, Number(args.offset ?? 0))

      const where: Record<string, unknown> = {}
      if (tenantId) where.tenant_id = tenantId
      if (args.collection) where.collection = args.collection
      if (args.family) where.family = args.family
      if (args.search) {
        where.OR = [
          { name: { contains: args.search, mode: 'insensitive' } },
          { sku: { contains: args.search, mode: 'insensitive' } },
        ]
      }

      const [articles, total] = await Promise.all([
        anyDb.catalogArticle.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            collection: true,
            family: true,
            style_tag: true,
            width_mm: true,
            depth_mm: true,
            height_mm: true,
          },
        }),
        anyDb.catalogArticle.count({ where }),
      ])

      return {
        content: [{ type: 'text', text: JSON.stringify({ total, articles }) }],
      }
    }

    case 'get_bom': {
      const projectId = args.project_id as string
      if (!projectId) {
        return {
          content: [{ type: 'text', text: 'project_id is required' }],
          isError: true,
        }
      }

      const project = await anyDb.project.findUnique({ where: { id: projectId } })
      if (!project) {
        return {
          content: [{ type: 'text', text: `Project ${projectId} not found` }],
          isError: true,
        }
      }

      const items = await anyDb.projectLineItem.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          article_id: true,
          sku: true,
          name: true,
          quantity: true,
          unit_price: true,
          total_price: true,
          currency: true,
        },
      })

      return {
        content: [{ type: 'text', text: JSON.stringify({ project_id: projectId, items }) }],
      }
    }

    case 'get_rooms': {
      const projectId = args.project_id as string
      if (!projectId) {
        return {
          content: [{ type: 'text', text: 'project_id is required' }],
          isError: true,
        }
      }

      const rooms = await anyDb.room.findMany({
        where: { project_id: projectId },
        select: {
          id: true,
          name: true,
          ceiling_height_mm: true,
          boundary: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      })

      const normalized = rooms.map((room: any) => ({
        id: room.id,
        name: room.name,
        area_sqm: calculateAreaSqm(room.boundary),
        ceiling_height_mm: room.ceiling_height_mm,
        created_at: room.created_at,
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify({ rooms: normalized, count: normalized.length }) }],
      }
    }

    case 'get_room_detail': {
      const roomId = args.room_id as string
      if (!roomId) {
        return {
          content: [{ type: 'text', text: 'room_id is required' }],
          isError: true,
        }
      }

      const room = await anyDb.room.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          project_id: true,
          name: true,
          ceiling_height_mm: true,
          boundary: true,
          openings: true,
          placements: true,
          created_at: true,
          updated_at: true,
        },
      })

      if (!room) {
        return {
          content: [{ type: 'text', text: `Room ${roomId} not found` }],
          isError: true,
        }
      }

      const placements = Array.isArray(room.placements) ? (room.placements as any[]) : []
      const articleIds = placements
        .map((placement) =>
          typeof placement.catalog_article_id === 'string'
            ? placement.catalog_article_id
            : typeof placement.article_id === 'string'
              ? placement.article_id
              : null,
        )
        .filter((id): id is string => Boolean(id))

      const articles =
        articleIds.length > 0
          ? await anyDb.catalogArticle.findMany({
              where: { id: { in: [...new Set(articleIds)] } },
              select: { id: true, name: true, sku: true, base_dims_json: true },
            })
          : []

      const articleMap = new Map(articles.map((article: any) => [article.id, article]))
      const enrichedPlacements = placements.map((placement) => {
        const articleId =
          typeof placement.catalog_article_id === 'string'
            ? placement.catalog_article_id
            : typeof placement.article_id === 'string'
              ? placement.article_id
              : null
        const article = articleId ? (articleMap.get(articleId) as any) : null
        return {
          ...placement,
          article: article
            ? {
                id: article.id,
                name: article.name,
                sku: article.sku,
                dimensions: article.base_dims_json ?? null,
              }
            : null,
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: room.id,
              project_id: room.project_id,
              name: room.name,
              area_sqm: calculateAreaSqm(room.boundary),
              ceiling_height_mm: room.ceiling_height_mm,
              boundary: room.boundary,
              walls: deriveWalls(room.boundary),
              openings: Array.isArray(room.openings) ? room.openings : [],
              placements: enrichedPlacements,
              created_at: room.created_at,
              updated_at: room.updated_at,
            }),
          },
        ],
      }
    }

    case 'get_placements': {
      const roomId = args.room_id as string
      if (!roomId) {
        return {
          content: [{ type: 'text', text: 'room_id is required' }],
          isError: true,
        }
      }

      const room = await anyDb.room.findUnique({
        where: { id: roomId },
        select: { placements: true },
      })

      if (!room) {
        return {
          content: [{ type: 'text', text: `Room ${roomId} not found` }],
          isError: true,
        }
      }

      const placements = Array.isArray(room.placements) ? room.placements : []
      return {
        content: [{ type: 'text', text: JSON.stringify({ placements, count: placements.length }) }],
      }
    }

    case 'get_quote': {
      const projectId = args.project_id as string
      if (!projectId) {
        return {
          content: [{ type: 'text', text: 'project_id is required' }],
          isError: true,
        }
      }

      const quote = await anyDb.quote.findFirst({
        where: { project_id: projectId },
        orderBy: { version: 'desc' },
        include: { items: { orderBy: { position: 'asc' } } },
      })

      if (!quote) {
        return {
          content: [{ type: 'text', text: 'No quote found for project' }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(quote) }],
      }
    }

    case 'search_contacts': {
      const query = (args.query as string | undefined)?.trim()
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)))
      const tenantId = args.tenant_id as string | undefined

      const where: Record<string, unknown> = {}
      if (tenantId) where.tenant_id = tenantId
      if (query) {
        where.OR = [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ]
      }

      const contacts = await anyDb.contact.findMany({
        where,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          company: true,
          created_at: true,
        },
      })

      const normalized = contacts.map((contact: any) => ({
        id: contact.id,
        name: [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || contact.company,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        created_at: contact.created_at,
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify({ contacts: normalized, count: normalized.length }) }],
      }
    }

    case 'create_project': {
      const name = args.name as string
      const tenantId = args.tenant_id as string
      const userId = args.user_id as string | undefined
      const branchId = args.branch_id as string | undefined
      const description = args.description as string | undefined

      if (!name || !tenantId) {
        return {
          content: [{ type: 'text', text: 'name and tenant_id are required' }],
          isError: true,
        }
      }

      const user = userId
        ? await anyDb.user.findUnique({ where: { id: userId }, select: { id: true, branch_id: true } })
        : await anyDb.user.findFirst({
            where: { tenant_id: tenantId },
            orderBy: { created_at: 'asc' },
            select: { id: true, branch_id: true },
          })

      if (!user) {
        return {
          content: [{ type: 'text', text: 'No eligible user found for project owner' }],
          isError: true,
        }
      }

      const project = await anyDb.project.create({
        data: {
          name,
          description: description ?? null,
          user_id: user.id,
          tenant_id: tenantId,
          branch_id: branchId ?? user.branch_id ?? null,
          project_status: 'lead',
        },
        select: {
          id: true,
          name: true,
          project_status: true,
          tenant_id: true,
          created_at: true,
        },
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              project_id: project.id,
              name: project.name,
              status: project.project_status,
              tenant_id: project.tenant_id,
              created_at: project.created_at,
            }),
          },
        ],
      }
    }

    case 'update_project_status': {
      const projectId = args.project_id as string
      const status = args.status as string
      const validStatuses = ['lead', 'planning', 'quoted', 'contract', 'production', 'installed']

      if (!projectId || !status) {
        return {
          content: [{ type: 'text', text: 'project_id and status are required' }],
          isError: true,
        }
      }

      if (!validStatuses.includes(status)) {
        return {
          content: [{ type: 'text', text: `Invalid status. Allowed: ${validStatuses.join(', ')}` }],
          isError: true,
        }
      }

      const project = await anyDb.project
        .update({
          where: { id: projectId },
          data: { project_status: status },
          select: { id: true, name: true, project_status: true },
        })
        .catch(() => null)

      if (!project) {
        return {
          content: [{ type: 'text', text: `Project ${projectId} not found` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(project) }],
      }
    }

    case 'add_placement': {
      const roomId = args.room_id as string
      const articleId = args.article_id as string
      const wallId = args.wall_id as string
      const offsetMm = Number(args.offset_mm)

      if (!roomId || !articleId || !wallId || !Number.isFinite(offsetMm)) {
        return {
          content: [{ type: 'text', text: 'room_id, article_id, wall_id and numeric offset_mm are required' }],
          isError: true,
        }
      }

      const [room, article] = await Promise.all([
        anyDb.room.findUnique({ where: { id: roomId }, select: { id: true, placements: true } }),
        anyDb.catalogArticle.findUnique({
          where: { id: articleId },
          select: { id: true, name: true, sku: true, base_dims_json: true },
        }),
      ])

      if (!room) {
        return {
          content: [{ type: 'text', text: `Room ${roomId} not found` }],
          isError: true,
        }
      }

      if (!article) {
        return {
          content: [{ type: 'text', text: `Article ${articleId} not found` }],
          isError: true,
        }
      }

      const dims =
        article.base_dims_json && typeof article.base_dims_json === 'object'
          ? (article.base_dims_json as { width_mm?: number; depth_mm?: number; height_mm?: number })
          : {}

      const placement = {
        id: randomUUID(),
        article_id: article.id,
        catalog_article_id: article.id,
        name: article.name,
        sku: article.sku,
        wall_id: wallId,
        offset_mm: offsetMm,
        width_mm: Number(dims.width_mm ?? 600),
        depth_mm: Number(dims.depth_mm ?? 560),
        height_mm: Number(dims.height_mm ?? 720),
      }

      const placements = Array.isArray(room.placements) ? room.placements : []
      await anyDb.room.update({
        where: { id: roomId },
        data: { placements: [...placements, placement] },
      })

      return {
        content: [{ type: 'text', text: JSON.stringify({ placement_id: placement.id }) }],
      }
    }

    case 'remove_placement': {
      const placementId = args.placement_id as string
      if (!placementId) {
        return {
          content: [{ type: 'text', text: 'placement_id is required' }],
          isError: true,
        }
      }

      const rooms = await anyDb.room.findMany({
        select: { id: true, placements: true },
      })
      const target = rooms.find((room: any) =>
        Array.isArray(room.placements)
          ? room.placements.some((entry: any) => entry?.id === placementId)
          : false,
      )

      if (!target) {
        return {
          content: [{ type: 'text', text: `Placement ${placementId} not found` }],
          isError: true,
        }
      }

      const nextPlacements = (target.placements as any[]).filter((entry: any) => entry?.id !== placementId)
      await anyDb.room.update({ where: { id: target.id }, data: { placements: nextPlacements } })

      return {
        content: [{ type: 'text', text: JSON.stringify({ removed: placementId }) }],
      }
    }

    case 'create_quote_from_bom': {
      const projectId = args.project_id as string
      if (!projectId) {
        return {
          content: [{ type: 'text', text: 'project_id is required' }],
          isError: true,
        }
      }

      const validDays = Math.min(365, Math.max(1, Number(args.valid_days ?? 30)))
      const freeText = args.free_text as string | undefined

      const bom = await anyDb.projectLineItem.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'asc' },
      })
      if (bom.length === 0) {
        return {
          content: [{ type: 'text', text: 'No BOM items found' }],
          isError: true,
        }
      }

      const existing = await anyDb.quote.findFirst({
        where: { project_id: projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      const version = (existing?.version ?? 0) + 1
      const validUntil = new Date(Date.now() + validDays * 86_400_000)

      const quote = await anyDb.quote.create({
        data: {
          project_id: projectId,
          version,
          quote_number: buildQuoteNumber(version),
          valid_until: validUntil,
          free_text: freeText ?? null,
          items: {
            create: bom.map((item: any, index: number) => ({
              position: index + 1,
              type: item.source_type ?? 'manual',
              description: item.description,
              qty: item.qty,
              unit: item.unit,
              unit_price_net: item.unit_price_net,
              line_net: item.line_net,
              tax_rate: item.tax_rate,
              line_gross: item.line_net * (1 + item.tax_rate),
              show_on_quote: true,
            })),
          },
        },
        include: { items: true },
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ quote_id: quote.id, version: quote.version, lines: quote.items.length }),
          },
        ],
      }
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
  }
}
