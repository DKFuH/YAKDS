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
// Phase 4 Routes
import { areaRoutes } from './routes/areas.js'
import { workspaceLayoutRoutes } from './routes/workspaceLayout.js'
// Phase 5 Routes
import { fillerPiecesRoutes } from './routes/fillerPieces.js'
import { purchaseOrderRoutes } from './routes/purchaseOrders.js'
import { alternativeWorkflowRoutes } from './routes/alternativeWorkflow.js'
import { userFavoritesRoutes } from './routes/userFavorites.js'
import { batchPrintRoutes } from './routes/batchPrint.js'
import { shareLinkRoutes } from './routes/shareLinks.js'
import { coverPanelRoutes } from './routes/coverPanels.js'
// Phase 6 Routes
import { productionOrderRoutes } from './routes/productionOrders.js'
import { siteSurveyRoutes } from './routes/siteSurveys.js'
import { checklistRoutes } from './routes/checklists.js'
import { erpConnectorRoutes } from './routes/erpConnectors.js'
import { reportRoutes } from './routes/reports.js'
import { complianceRoutes } from './routes/compliance.js'
import { ifcInteropRoutes } from './routes/ifcInterop.js'
import { cadInteropRoutes } from './routes/cadInterop.js'
import { articleConfiguratorRoutes } from './routes/articleConfigurator.js'
import { dimensionRoutes } from './routes/dimensions.js'
import { kitchenAssistantRoutes } from './routes/kitchenAssistant.js'
import { layoutSheetRoutes } from './routes/layoutSheets.js'
// Sprint 61
import { tenantSettingsRoutes } from './routes/tenantSettings.js'
// Plugin-System
import { getPlugins } from './plugins/pluginRegistry.js'
import { bootstrapPlugins } from './plugins/index.js'
import { mcpRoutes } from './routes/mcp.js'

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
// Phase 5 Routes
await app.register(fillerPiecesRoutes, { prefix: '/api/v1' })
await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })
await app.register(alternativeWorkflowRoutes, { prefix: '/api/v1' })
await app.register(userFavoritesRoutes, { prefix: '/api/v1' })
await app.register(batchPrintRoutes, { prefix: '/api/v1' })
await app.register(shareLinkRoutes, { prefix: '/api/v1' })
await app.register(coverPanelRoutes, { prefix: '/api/v1' })
// Phase 6 Routes
await app.register(productionOrderRoutes, { prefix: '/api/v1' })
await app.register(siteSurveyRoutes, { prefix: '/api/v1' })
await app.register(checklistRoutes, { prefix: '/api/v1' })
await app.register(erpConnectorRoutes, { prefix: '/api/v1' })
await app.register(reportRoutes, { prefix: '/api/v1' })
await app.register(complianceRoutes, { prefix: '/api/v1' })
await app.register(ifcInteropRoutes, { prefix: '/api/v1' })
await app.register(cadInteropRoutes, { prefix: '/api/v1' })
await app.register(articleConfiguratorRoutes, { prefix: '/api/v1' })
await app.register(dimensionRoutes, { prefix: '/api/v1' })
await app.register(layoutSheetRoutes, { prefix: '/api/v1' })
await app.register(kitchenAssistantRoutes, { prefix: '/api/v1' })
await app.register(tenantSettingsRoutes, { prefix: '/api/v1' })

// Branche-Plugins bootstrappen und einhängen
bootstrapPlugins()
for (const plugin of getPlugins()) {
  await app.register(plugin.register, { prefix: '/api/v1' })
}
await app.register(mcpRoutes, { prefix: '/api/v1' })

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
