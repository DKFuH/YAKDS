import Fastify from 'fastify'
import cors from '@fastify/cors'
import { projectRoutes } from './routes/projects.js'
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
import { prisma } from './db.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
})

// Routes
await app.register(projectRoutes, { prefix: '/api/v1' })
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
