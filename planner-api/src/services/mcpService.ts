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

  // ── get_rooms ────────────────────────────────────────────────────────────────
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

  // ── get_room_detail ──────────────────────────────────────────────────────────
  {
    name: 'get_room_detail',
    description: 'Gibt Raumpolygon, Wände (mit Längen), Öffnungen (Türen/Fenster) und platzierte Artikel zurück.',
    inputSchema: {
      type: 'object',
      required: ['room_id'],
      properties: {
        room_id: { type: 'string', description: 'UUID des Raums' },
      },
      additionalProperties: false,
    },
  },

  // ── get_placements ───────────────────────────────────────────────────────────
  {
    name: 'get_placements',
    description: 'Gibt alle platzierten Artikel in einem Raum zurück (Artikel-ID, Name, Position, Abmessungen).',
    inputSchema: {
      type: 'object',
      required: ['room_id'],
      properties: {
        room_id: { type: 'string', description: 'UUID des Raums' },
      },
      additionalProperties: false,
    },
  },

  // ── get_quote ────────────────────────────────────────────────────────────────
  {
    name: 'get_quote',
    description: 'Gibt das aktuelle Angebot eines Projekts zurück (Positionen, Netto/Brutto-Summen, Status).',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'UUID des Projekts' },
      },
      additionalProperties: false,
    },
  },

  // ── search_contacts ──────────────────────────────────────────────────────────
  {
    name: 'search_contacts',
    description: 'Sucht nach Kunden/Leads anhand von Name oder E-Mail.',
    inputSchema: {
      type: 'object',
      properties: {
        query:     { type: 'string', description: 'Name oder E-Mail-Fragment' },
        tenant_id: { type: 'string', description: 'Optionale Tenant-ID' },
        limit:     { type: 'number', default: 10 },
      },
      additionalProperties: false,
    },
  },

  // ── create_project ───────────────────────────────────────────────────────────
  {
    name: 'create_project',
    description: 'Legt ein neues Planungsprojekt an.',
    inputSchema: {
      type: 'object',
      required: ['name', 'tenant_id'],
      properties: {
        name:        { type: 'string', description: 'Projektname' },
        tenant_id:   { type: 'string', description: 'Tenant-UUID' },
        description: { type: 'string', description: 'Optionale Beschreibung' },
        lead_id:     { type: 'string', description: 'Optionale Lead/Kunden-UUID' },
      },
      additionalProperties: false,
    },
  },

  // ── update_project_status ────────────────────────────────────────────────────
  {
    name: 'update_project_status',
    description: 'Schaltet den Status eines Projekts weiter (lead → planning → quoted → contract → production → installed).',
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

  // ── add_placement ────────────────────────────────────────────────────────────
  {
    name: 'add_placement',
    description: 'Platziert einen Katalogartikel in einem Raum an einer Wand.',
    inputSchema: {
      type: 'object',
      required: ['room_id', 'article_id', 'wall_id', 'offset_mm'],
      properties: {
        room_id:    { type: 'string', description: 'UUID des Raums' },
        article_id: { type: 'string', description: 'UUID des Katalogartikels' },
        wall_id:    { type: 'string', description: 'UUID der Wand' },
        offset_mm:  { type: 'number', description: 'Abstand vom Wand-Startpunkt in mm' },
      },
      additionalProperties: false,
    },
  },

  // ── remove_placement ─────────────────────────────────────────────────────────
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

  // ── create_quote_from_bom ────────────────────────────────────────────────────
  {
    name: 'create_quote_from_bom',
    description: 'Erzeugt ein neues Angebot aus der aktuellen Stückliste des Projekts.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id:  { type: 'string' },
        valid_days:  { type: 'number', description: 'Gültigkeitsdauer in Tagen (default 30)', default: 30 },
        free_text:   { type: 'string', description: 'Optionaler Angebotstext' },
      },
      additionalProperties: false,
    },
  },
]

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
      if (!projectId) return { content: [{ type: 'text', text: 'project_id required' }], isError: true }
      const rooms = await anyDb.room.findMany({
        where: { project_id: projectId },
        select: { id: true, name: true, area_sqm: true, ceiling_height_mm: true, created_at: true },
        orderBy: { created_at: 'asc' },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ rooms, count: rooms.length }) }] }
    }

    case 'get_room_detail': {
      const roomId = args.room_id as string
      if (!roomId) return { content: [{ type: 'text', text: 'room_id required' }], isError: true }
      const room = await anyDb.room.findUnique({
        where: { id: roomId },
        include: {
          walls: { include: { openings: true } },
          placements: { include: { catalog_article: { select: { name: true, sku: true, width_mm: true, depth_mm: true, height_mm: true } } } },
        },
      })
      if (!room) return { content: [{ type: 'text', text: `Room ${roomId} not found` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(room) }] }
    }

    case 'get_placements': {
      const roomId = args.room_id as string
      if (!roomId) return { content: [{ type: 'text', text: 'room_id required' }], isError: true }
      const placements = await anyDb.placement.findMany({
        where: { room_id: roomId },
        include: { catalog_article: { select: { name: true, sku: true, width_mm: true, depth_mm: true } } },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ placements, count: placements.length }) }] }
    }

    case 'get_quote': {
      const projectId = args.project_id as string
      if (!projectId) return { content: [{ type: 'text', text: 'project_id required' }], isError: true }
      const quote = await anyDb.quote.findFirst({
        where: { project_id: projectId },
        orderBy: { version: 'desc' },
        include: { lines: { orderBy: { position: 'asc' } } },
      })
      if (!quote) return { content: [{ type: 'text', text: 'No quote found for project' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(quote) }] }
    }

    case 'search_contacts': {
      const query = args.query as string | undefined
      const limit = Math.min(50, Number(args.limit ?? 10))
      const where: Record<string, unknown> = {}
      if (args.tenant_id) where.tenant_id = args.tenant_id
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ]
      }
      const contacts = await anyDb.lead.findMany({
        where, take: limit,
        select: { id: true, name: true, email: true, phone: true, created_at: true },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ contacts, count: contacts.length }) }] }
    }

    case 'create_project': {
      const { name, tenant_id, description, lead_id } = args as Record<string, string>
      if (!name || !tenant_id) return { content: [{ type: 'text', text: 'name and tenant_id required' }], isError: true }
      const project = await anyDb.project.create({
        data: { name, tenant_id, description: description ?? null, lead_id: lead_id ?? null, project_status: 'lead' },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ project_id: project.id, name: project.name, status: project.project_status }) }] }
    }

    case 'update_project_status': {
      const projectId = args.project_id as string
      const status = args.status as string
      const validStatuses = ['lead', 'planning', 'quoted', 'contract', 'production', 'installed']
      if (!validStatuses.includes(status)) {
        return { content: [{ type: 'text', text: `Invalid status. Allowed: ${validStatuses.join(', ')}` }], isError: true }
      }
      const project = await anyDb.project.update({
        where: { id: projectId },
        data: { project_status: status as never },
        select: { id: true, name: true, project_status: true },
      })
      return { content: [{ type: 'text', text: JSON.stringify(project) }] }
    }

    case 'add_placement': {
      const { room_id, article_id, wall_id, offset_mm } = args as Record<string, unknown>
      if (!room_id || !article_id || !wall_id) {
        return { content: [{ type: 'text', text: 'room_id, article_id and wall_id required' }], isError: true }
      }
      const article = await anyDb.catalogArticle.findUnique({ where: { id: article_id as string } })
      if (!article) return { content: [{ type: 'text', text: `Article ${article_id} not found` }], isError: true }
      const placement = await anyDb.placement.create({
        data: {
          room_id: room_id as string,
          article_id: article_id as string,
          wall_id: wall_id as string,
          offset_mm: Number(offset_mm ?? 0),
          width_mm: article.width_mm,
          depth_mm: article.depth_mm,
          height_mm: article.height_mm,
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ placement_id: placement.id }) }] }
    }

    case 'remove_placement': {
      const placementId = args.placement_id as string
      await anyDb.placement.delete({ where: { id: placementId } }).catch(() => null)
      return { content: [{ type: 'text', text: JSON.stringify({ removed: placementId }) }] }
    }

    case 'create_quote_from_bom': {
      const projectId = args.project_id as string
      if (!projectId) return { content: [{ type: 'text', text: 'project_id required' }], isError: true }
      const validDays = Number(args.valid_days ?? 30)
      const freeText = args.free_text as string | undefined

      const bom = await anyDb.projectLineItem.findMany({ where: { project_id: projectId } })
      if (bom.length === 0) return { content: [{ type: 'text', text: 'No BOM items found' }], isError: true }

      const existing = await anyDb.quote.findFirst({ where: { project_id: projectId }, orderBy: { version: 'desc' } })
      const version = (existing?.version ?? 0) + 1
      const validUntil = new Date(Date.now() + validDays * 86_400_000)

      const quote = await anyDb.quote.create({
        data: {
          project_id: projectId,
          version,
          valid_until: validUntil,
          free_text: freeText ?? null,
          lines: {
            create: bom.map((item: Record<string, unknown>, idx: number) => ({
              position: idx + 1,
              description: item.name,
              qty: item.quantity,
              unit: 'Stk',
              unit_price_net: item.unit_price ?? 0,
              line_net: item.total_price ?? 0,
              tax_rate: 19,
              show_on_quote: true,
            })),
          },
        },
        include: { lines: true },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ quote_id: quote.id, version, lines: quote.lines.length }) }] }
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
  }
}
