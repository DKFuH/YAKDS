import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { MCP_TOOLS, callMcpTool } from '../services/mcpService.js'

// JSON-RPC 2.0 error codes
const JSON_RPC_PARSE_ERROR = -32700
const JSON_RPC_INVALID_REQUEST = -32600
const JSON_RPC_METHOD_NOT_FOUND = -32601
const JSON_RPC_INVALID_PARAMS = -32602

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

export async function mcpRoutes(app: FastifyInstance) {
  // GET /mcp – MCP server info & capability discovery
  app.get('/mcp', async (_request, reply) => {
    return reply.send({
      name: 'open-kitchen-planner',
      version: '1.0.0',
      description: 'MCP-Server für den Open Kitchen Planner – Küchen planen mit KI und externen Systemen',
      protocol: 'MCP/1.0',
      capabilities: {
        tools: true,
      },
    })
  })

  // POST /mcp – JSON-RPC 2.0 message handler
  app.post('/mcp', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null | undefined

    if (!body || typeof body !== 'object') {
      return reply.status(400).send(rpcError(null, JSON_RPC_PARSE_ERROR, 'Parse error'))
    }

    const { jsonrpc, id, method, params } = body as {
      jsonrpc?: unknown
      id?: unknown
      method?: unknown
      params?: unknown
    }

    if (jsonrpc !== '2.0' || typeof method !== 'string') {
      return reply.status(400).send(rpcError(id, JSON_RPC_INVALID_REQUEST, 'Invalid Request'))
    }

    // ── initialize ──────────────────────────────────────────────────────────
    if (method === 'initialize') {
      return reply.send(
        rpcResult(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'open-kitchen-planner', version: '1.0.0' },
          capabilities: { tools: {} },
        }),
      )
    }

    // ── tools/list ──────────────────────────────────────────────────────────
    if (method === 'tools/list') {
      return reply.send(
        rpcResult(id, {
          tools: MCP_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        }),
      )
    }

    // ── tools/call ──────────────────────────────────────────────────────────
    if (method === 'tools/call') {
      if (!params || typeof params !== 'object') {
        return reply.status(400).send(rpcError(id, JSON_RPC_INVALID_PARAMS, 'params required for tools/call'))
      }

      const { name, arguments: toolArgs } = params as { name?: unknown; arguments?: unknown }

      if (typeof name !== 'string') {
        return reply.status(400).send(rpcError(id, JSON_RPC_INVALID_PARAMS, 'params.name must be a string'))
      }

      const knownTool = MCP_TOOLS.find((t) => t.name === name)
      if (!knownTool) {
        return reply.status(400).send(rpcError(id, JSON_RPC_METHOD_NOT_FOUND, `Unknown tool: ${name}`))
      }

      const args = (toolArgs ?? {}) as Record<string, unknown>
      const result = await callMcpTool(name, args, prisma)

      return reply.send(rpcResult(id, result))
    }

    return reply.status(400).send(rpcError(id, JSON_RPC_METHOD_NOT_FOUND, `Method not found: ${method}`))
  })
}
