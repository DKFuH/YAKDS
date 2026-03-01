/**
 * manufacturers.ts – Sprint 20 / TASK-20-A01
 * Herstellerkatalog: Manufacturer, CatalogArticle, ArticleOption, ArticleVariant, ArticlePrice
 * Import-Pipeline + Konfigurator-Snapshot Endpoint
 */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import multipart from '@fastify/multipart'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseIdmArticles, parseIdmZip } from '../services/idmParser.js'

// ─── Zod Schemas ───────────────────────────────────────────────

const ArticleTypeSchema = z.enum([
    'base_cabinet',
    'wall_cabinet',
    'tall_cabinet',
    'worktop',
    'plinth',
    'accessory',
    'trim',
    'appliance',
])

const ManufacturerCreateSchema = z.object({
    name: z.string().min(1).max(120),
    code: z.string().min(1).max(32).toUpperCase(),
    tenant_id: z.string().uuid().optional(),
})

const ManufacturerIdSchema = z.object({ id: z.string().uuid() })

const ArticleOptionSchema = z.object({
    option_key: z.string().min(1).max(64),
    option_type: z.enum(['enum', 'dimension', 'boolean', 'text']),
    constraints_json: z.record(z.unknown()).default({}),
})

const ArticleVariantSchema = z.object({
    variant_key: z.string().min(1).max(64),
    variant_values_json: z.record(z.unknown()),
    dims_override_json: z.record(z.unknown()).default({}),
})

const CatalogArticleCreateSchema = z.object({
    sku: z.string().min(1).max(64),
    name: z.string().min(1).max(255),
    article_type: ArticleTypeSchema.default('base_cabinet'),
    base_dims_json: z.object({
        width_mm: z.number().positive(),
        height_mm: z.number().positive(),
        depth_mm: z.number().positive(),
    }),
    meta_json: z.record(z.unknown()).default({}),
    tenant_id: z.string().uuid().optional(),
    options: z.array(ArticleOptionSchema).default([]),
    variants: z.array(ArticleVariantSchema).default([]),
})

const ArticlePriceSchema = z.object({
    price_list_id: z.string().min(1),
    valid_from: z.coerce.date(),
    valid_to: z.coerce.date().optional(),
    list_net: z.number().nonnegative(),
    dealer_net: z.number().nonnegative(),
    tax_group_id: z.string().uuid().optional(),
})

// Bulk import body
const ManufacturerImportSchema = z.object({
    manufacturer: ManufacturerCreateSchema,
    articles: z.array(CatalogArticleCreateSchema).max(2000),
})

// Konfigurator-Snapshot (Sprint 20)
const ConfiguratorSnapshotSchema = z.object({
    project_id: z.string().uuid(),
    room_id: z.string().uuid(),
    catalog_article_id: z.string().uuid(),
    chosen_options: z.record(z.string()),   // { option_key: chosen_value }
    placement_meta: z.record(z.unknown()).default({}),
})

// ─── Route Handler ───────────────────────────────────────────────

export async function manufacturerRoutes(app: FastifyInstance) {
    await app.register(multipart, { attachFieldsToBody: false })

    // ── Manufacturer CRUD ─────────────────────────────────────────

    /** GET /manufacturers */
    app.get('/manufacturers', async (_request, reply) => {
        const list = await prisma.manufacturer.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { articles: true } } },
        })
        return reply.send(list)
    })

    /** POST /manufacturers */
    app.post('/manufacturers', async (request, reply) => {
        const parsed = ManufacturerCreateSchema.safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

        const manufacturer = await prisma.manufacturer.create({ data: parsed.data })
        return reply.status(201).send(manufacturer)
    })

    /** GET /manufacturers/:id */
    app.get<{ Params: { id: string } }>('/manufacturers/:id', async (request, reply) => {
        const params = ManufacturerIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const mfr = await prisma.manufacturer.findUnique({
            where: { id: params.data.id },
            include: {
                articles: {
                    include: {
                        options: true,
                        variants: true,
                        prices: { orderBy: { valid_from: 'desc' }, take: 1 },
                    },
                },
            },
        })
        if (!mfr) return sendNotFound(reply, 'Manufacturer not found')
        return reply.send(mfr)
    })

    /** DELETE /manufacturers/:id */
    app.delete<{ Params: { id: string } }>('/manufacturers/:id', async (request, reply) => {
        const params = ManufacturerIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        await prisma.manufacturer.delete({ where: { id: params.data.id } }).catch(() => null)
        return reply.status(204).send()
    })

    // ── CatalogArticle CRUD ───────────────────────────────────────

    /** GET /manufacturers/:id/articles */
    app.get<{ Params: { id: string } }>('/manufacturers/:id/articles', async (request, reply) => {
        const params = ManufacturerIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const articles = await prisma.catalogArticle.findMany({
            where: { manufacturer_id: params.data.id },
            include: { options: true, variants: true, prices: { orderBy: { valid_from: 'desc' }, take: 1 } },
        })
        return reply.send(articles)
    })

    /** POST /manufacturers/:id/articles */
    app.post<{ Params: { id: string } }>('/manufacturers/:id/articles', async (request, reply) => {
        const params = ManufacturerIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const body = CatalogArticleCreateSchema.safeParse(request.body)
        if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

        const { options, variants, ...articleData } = body.data

        const article = await prisma.catalogArticle.create({
            data: {
                ...articleData,
                manufacturer_id: params.data.id,
                base_dims_json: articleData.base_dims_json as Prisma.InputJsonValue,
                meta_json: articleData.meta_json as Prisma.InputJsonValue,
                options: { create: options.map((o) => ({ ...o, constraints_json: o.constraints_json as Prisma.InputJsonValue })) },
                variants: { create: variants.map((v) => ({ ...v, variant_values_json: v.variant_values_json as Prisma.InputJsonValue, dims_override_json: v.dims_override_json as Prisma.InputJsonValue })) },
            },
            include: { options: true, variants: true },
        })
        return reply.status(201).send(article)
    })

    /** POST /catalog-articles/:id/prices */
    app.post<{ Params: { id: string } }>('/catalog-articles/:id/prices', async (request, reply) => {
        const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const body = ArticlePriceSchema.safeParse(request.body)
        if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

        const price = await prisma.articlePrice.create({
            data: { ...body.data, article_id: params.data.id },
        })
        return reply.status(201).send(price)
    })

    // ── Bulk Import ───────────────────────────────────────────────

    /**
     * POST /import/idm
     * Accepts a multifile/multipart upload with .ART/.PRE files or a .ZIP container (IDM standard)
     */
    app.post('/import/idm', async (request, reply) => {
        const upload = await request.file()
        if (!upload) return sendBadRequest(reply, 'No file uploaded')

        try {
            const buffer = await upload.toBuffer()
            const isZip = upload.filename.toLowerCase().endsWith('.zip') || upload.mimetype === 'application/zip'
            const raw = isZip ? await parseIdmZip(buffer) : await parseIdmArticles(buffer)

            if (raw.length === 0) {
                return reply.send({ message: 'No articles found in IDM file', created: 0 })
            }

            const manufacturerCode = raw[0].manufacturerCode || 'IDM-VENDOR'
            const manufacturerName = raw[0].manufacturerName || manufacturerCode

            const mfr = await prisma.manufacturer.upsert({
                where: { code: manufacturerCode },
                update: { name: manufacturerName },
                create: {
                    name: manufacturerName,
                    code: manufacturerCode,
                    tenant_id: (request as any).tenantId || null
                },
            })

            let created = 0
            for (const article of raw) {
                await prisma.catalogArticle.upsert({
                    where: { manufacturer_id_sku: { manufacturer_id: mfr.id, sku: article.sku } },
                    update: {
                        name: article.name,
                        article_type: (article.articleType as any) || 'base_cabinet',
                        base_dims_json: {
                            width_mm: article.widthMm,
                            height_mm: article.heightMm,
                            depth_mm: article.depthMm,
                        } as Prisma.InputJsonValue,
                        meta_json: (article.meta_json as any) || {}
                    },
                    create: {
                        sku: article.sku,
                        name: article.name,
                        article_type: (article.articleType as any) || 'base_cabinet',
                        manufacturer_id: mfr.id,
                        base_dims_json: {
                            width_mm: article.widthMm,
                            height_mm: article.heightMm,
                            depth_mm: article.depthMm,
                        } as Prisma.InputJsonValue,
                        meta_json: (article.meta_json as any) || {}
                    }
                })
                created++
            }

            return reply.status(201).send({
                manufacturer_id: mfr.id,
                articles_created: created,
                source_filename: upload.filename
            })
        } catch (error) {
            console.error('IDM Import Error:', error)
            return sendBadRequest(reply, `Failed to parse IDM: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    })

    /**
     * POST /import/manufacturer
     * Importiert einen Herstellerkatalog mit allen Artikeln auf einmal.
     * Format: { manufacturer: {...}, articles: [...] }
     */
    app.post('/import/manufacturer', async (request, reply) => {
        const parsed = ManufacturerImportSchema.safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

        const { manufacturer: mfrData, articles } = parsed.data

        // Upsert manufacturer by code
        const mfr = await prisma.manufacturer.upsert({
            where: { code: mfrData.code },
            update: { name: mfrData.name },
            create: mfrData,
        })

        let created = 0
        let skipped = 0

        for (const art of articles) {
            const { options, variants, ...articleCore } = art
            try {
                await prisma.catalogArticle.upsert({
                    where: { manufacturer_id_sku: { manufacturer_id: mfr.id, sku: art.sku } },
                    update: {
                        name: art.name,
                        article_type: art.article_type,
                        base_dims_json: art.base_dims_json as Prisma.InputJsonValue,
                        meta_json: art.meta_json as Prisma.InputJsonValue,
                    },
                    create: {
                        ...articleCore,
                        manufacturer_id: mfr.id,
                        base_dims_json: articleCore.base_dims_json as Prisma.InputJsonValue,
                        meta_json: articleCore.meta_json as Prisma.InputJsonValue,
                        options: { create: options.map((o) => ({ ...o, constraints_json: o.constraints_json as Prisma.InputJsonValue })) },
                        variants: { create: variants.map((v) => ({ ...v, variant_values_json: v.variant_values_json as Prisma.InputJsonValue, dims_override_json: v.dims_override_json as Prisma.InputJsonValue })) },
                    },
                })
                created++
            } catch {
                skipped++
            }
        }

        return reply.status(201).send({
            manufacturer_id: mfr.id,
            articles_created: created,
            articles_skipped: skipped,
        })
    })

    // ── Konfigurator-Snapshot ─────────────────────────────────────

    /**
     * POST /configurator/snapshot
     * Speichert die Auswahl des Benutzers für einen konfigurierbaren Schrank
     * als Datensatz (für BOM / Pricing Downstream).
     */
    app.post('/configurator/snapshot', async (request, reply) => {
        const parsed = ConfiguratorSnapshotSchema.safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

        const { project_id, room_id, catalog_article_id, chosen_options, placement_meta } = parsed.data

        // Verify article exists
        const article = await prisma.catalogArticle.findUnique({
            where: { id: catalog_article_id },
            include: { prices: { orderBy: { valid_from: 'desc' }, take: 1 } },
        })
        if (!article) return sendNotFound(reply, 'CatalogArticle not found')

        // Resolve price
        const latestPrice = article.prices[0] ?? null

        const snapshot = {
            project_id,
            room_id,
            catalog_article_id,
            sku: article.sku,
            name: article.name,
            article_type: article.article_type,
            base_dims: article.base_dims_json,
            chosen_options,
            placement_meta,
            price: latestPrice
                ? { list_net: latestPrice.list_net, dealer_net: latestPrice.dealer_net }
                : null,
            created_at: new Date().toISOString(),
        }

        // Persist snapshot as a GeneratedItem of type "other" so it participates in BOM
        const generatedItem = await prisma.generatedItem.create({
            data: {
                project_id,
                room_id,
                catalog_article_id,
                item_type: 'other',
                label: `${article.name} (konfiguriert)`,
                qty: 1,
                unit: 'Stk',
                params_json: { chosen_options, placement_meta } as Prisma.InputJsonValue,
            },
        })

        return reply.status(201).send({ snapshot, generated_item_id: generatedItem.id })
    })
}
