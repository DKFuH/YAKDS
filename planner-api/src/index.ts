import Fastify from 'fastify'
import cors from '@fastify/cors'
import { projectRoutes } from './routes/projects.js'
import { documentRoutes } from './routes/documents.js'
import { dashboardRoutes } from './routes/dashboards.js'
import { catalogIndexRoutes } from './routes/catalogIndices.js'
import { platformRoutes } from './routes/platform.js'
import { ceilingConstraintRoutes } from './routes/ceilingConstraints.js'
import { roomRoutes } from './routes/rooms.js'
import { validateRoutes } from './routes/validate.js'
import { catalogRoutes } from './routes/catalog.js'
import { importRoutes } from './routes/imports.js'
import { openingRoutes } from './routes/openings.js'
import { placementRoutes } from './routes/placements.js'
import { bomRoutes } from './routes/bom.js'
import { exportRoutes } from './routes/exports.js'
import { pricingRoutes } from './routes/pricing.js'
import { quoteRoutes } from './routes/quotes.js'
import { renderJobRoutes } from './routes/renderJobs.js'
import { businessRoutes } from './routes/business.js'
import { blockRoutes } from './routes/blocks.js'
// Phase 2
import { manufacturerRoutes } from './routes/manufacturers.js'
import { autoCompletionRoutes } from './routes/autoCompletion.js'
import { validateV2Routes } from './routes/validateV2.js'
import { biRoutes } from './routes/bi.js'
import { leadRoutes } from './routes/leads.js'
import { contactRoutes } from './routes/contacts.js'
import { wallRoutes } from './routes/walls.js'
import { worktopRoutes } from './routes/worktops.js'
import { annotationRoutes } from './routes/annotations.js'
import { roomDecorationRoutes } from './routes/roomDecoration.js'
import { lightingRoutes } from './routes/lighting.js'
import { quoteLineRoutes } from './routes/quotelines.js'
import { macroRoutes } from './routes/macros.js'
import { tenantMiddleware } from './tenantMiddleware.js'
import { prisma } from './db.js'
// Phase 4
import { areaRoutes } from './routes/areas.js'
import { workspaceLayoutRoutes } from './routes/workspaceLayout.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
})

// Tenant-Middleware (Phase 2)
await app.register(tenantMiddleware)

// Routes
await app.register(projectRoutes, { prefix: '/api/v1' })
await app.register(documentRoutes, { prefix: '/api/v1' })
await app.register(dashboardRoutes, { prefix: '/api/v1' })
await app.register(catalogIndexRoutes, { prefix: '/api/v1' })
await app.register(platformRoutes, { prefix: '/api/v1' })
await app.register(ceilingConstraintRoutes, { prefix: '/api/v1' })
await app.register(roomRoutes, { prefix: '/api/v1' })
await app.register(catalogRoutes, { prefix: '/api/v1' })
await app.register(validateRoutes, { prefix: '/api/v1' })
await app.register(importRoutes, { prefix: '/api/v1' })
await app.register(openingRoutes, { prefix: '/api/v1' })
await app.register(placementRoutes, { prefix: '/api/v1' })
await app.register(bomRoutes, { prefix: '/api/v1' })
await app.register(exportRoutes, { prefix: '/api/v1' })
await app.register(pricingRoutes, { prefix: '/api/v1' })
await app.register(quoteRoutes, { prefix: '/api/v1' })
await app.register(renderJobRoutes, { prefix: '/api/v1' })
await app.register(businessRoutes, { prefix: '/api/v1' })
await app.register(blockRoutes, { prefix: '/api/v1' })
// Phase 2 Routes
await app.register(manufacturerRoutes, { prefix: '/api/v1' })
await app.register(autoCompletionRoutes, { prefix: '/api/v1' })
await app.register(validateV2Routes, { prefix: '/api/v1' })
await app.register(biRoutes, { prefix: '/api/v1' })
await app.register(leadRoutes, { prefix: '/api/v1' })
await app.register(contactRoutes, { prefix: '/api/v1' })
await app.register(wallRoutes, { prefix: '/api/v1' })
await app.register(worktopRoutes, { prefix: '/api/v1' })
await app.register(annotationRoutes, { prefix: '/api/v1' })
await app.register(roomDecorationRoutes, { prefix: '/api/v1' })
await app.register(lightingRoutes, { prefix: '/api/v1' })
await app.register(quoteLineRoutes, { prefix: '/api/v1' })
await app.register(macroRoutes, { prefix: '/api/v1' })
// Phase 4 Routes
await app.register(areaRoutes, { prefix: '/api/v1' })
await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

// Health check
app.get('/health', async () => ({ status: 'ok' }))

// Graceful shutdown
const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
