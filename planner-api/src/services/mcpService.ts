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

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
  }
}
