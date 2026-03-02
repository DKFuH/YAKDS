# Sprint 54 – Konfigurierbare Artikel & Abhängigkeitslogik (OFML-Parität)

**Branch:** `feature/sprint-54-ofml-konfigurator`
**Gruppe:** C
**Status:** `done`

---

## Ziel

Katalog-Artikel erhalten konfigurierbare Merkmale mit Abhängigkeitsregeln.
Preis ändert sich bei Variantenwechsel automatisch.

---

## 1. Prisma-Schema-Ergänzungen

```prisma
// ─────────────────────────────────────────
// PHASE 7 – Sprint 54: OFML-Konfigurator
// ─────────────────────────────────────────

model CatalogArticleProperty {
  id          String         @id @default(uuid())
  article_id  String
  key         String         @db.VarChar(100) // z.B. "front_color"
  label       String         @db.VarChar(200) // z.B. "Frontfarbe"
  type        String         @db.VarChar(50)  // "enum" | "dimension" | "boolean"
  options     Json           @default("[]")   // [{ value: "white", label: "Weiß" }]
  depends_on  Json           @default("{}")   // { "corpus_color": ["light_oak", "white"] }
  sort_order  Int            @default(0)
  created_at  DateTime       @default(now())

  article     CatalogArticle @relation(fields: [article_id], references: [id], onDelete: Cascade)

  @@unique([article_id, key])
  @@index([article_id])
  @@map("catalog_article_properties")
}

model CatalogArticlePriceTable {
  id                   String         @id @default(uuid())
  article_id           String
  property_combination Json           // { "front_color": "white", "width_mm": 600 }
  price_net            Float
  created_at           DateTime       @default(now())
  updated_at           DateTime       @updatedAt

  article              CatalogArticle @relation(fields: [article_id], references: [id], onDelete: Cascade)

  @@index([article_id])
  @@map("catalog_article_price_tables")
}

model UserArticleProfile {
  id             String   @id @default(uuid())
  user_id        String
  tenant_id      String?
  name           String   @db.VarChar(100)
  article_id     String
  property_values Json    @default("{}")  // { "front_color": "white", "width_mm": 600 }
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  @@index([user_id])
  @@index([article_id])
  @@map("user_article_profiles")
}
```

Außerdem in `model CatalogArticle` (bestehend):
```prisma
  properties    CatalogArticleProperty[]
  price_tables  CatalogArticlePriceTable[]
```

---

## 2. Neue Datei: `planner-api/src/services/ofmlEngine.ts`

```typescript
// OFML-Abhängigkeits-Engine: prüft ob eine Eigenschaftskombination gültig ist

export interface PropertyDefinition {
  key: string
  type: string
  options: { value: string; label: string }[]
  depends_on: Record<string, string[]>  // { "corpus_color": ["light_oak"] }
}

export interface PropertyValues {
  [key: string]: string | number | boolean
}

export interface ValidationResult {
  valid: boolean
  errors: { property: string; message: string }[]
  available: Record<string, string[]> // welche Optionen sind für jede Property verfügbar
}

export function validatePropertyCombination(
  properties: PropertyDefinition[],
  values: PropertyValues,
): ValidationResult {
  const errors: ValidationResult['errors'] = []
  const available: Record<string, string[]> = {}

  for (const prop of properties) {
    const selectedValue = values[prop.key]

    // Abhängigkeiten prüfen
    let isAvailable = true
    for (const [depKey, allowedValues] of Object.entries(prop.depends_on)) {
      const depValue = values[depKey]
      if (depValue !== undefined && !allowedValues.includes(String(depValue))) {
        isAvailable = false
        break
      }
    }

    // Verfügbare Optionen berechnen
    available[prop.key] = isAvailable
      ? prop.options.map(o => o.value)
      : []

    // Prüfen ob ausgewählter Wert gültig
    if (selectedValue !== undefined) {
      if (!isAvailable) {
        errors.push({
          property: prop.key,
          message: `Property '${prop.key}' ist nicht verfügbar mit aktuellen Abhängigkeiten`,
        })
      } else if (prop.type === 'enum' && !available[prop.key].includes(String(selectedValue))) {
        errors.push({
          property: prop.key,
          message: `Wert '${selectedValue}' nicht erlaubt für '${prop.key}'. Erlaubt: ${available[prop.key].join(', ')}`,
        })
      }
    }
  }

  return { valid: errors.length === 0, errors, available }
}

export function lookupPrice(
  priceTables: { property_combination: PropertyValues; price_net: number }[],
  values: PropertyValues,
): number | null {
  for (const entry of priceTables) {
    const combo = entry.property_combination
    const matches = Object.entries(combo).every(
      ([k, v]) => String(values[k]) === String(v),
    )
    if (matches) return entry.price_net
  }
  return null
}
```

---

## 3. Neue Datei: `planner-api/src/routes/articleConfigurator.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { validatePropertyCombination, lookupPrice } from '../services/ofmlEngine.js'

const PropertySchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(['enum', 'dimension', 'boolean']),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  depends_on: z.record(z.array(z.string())).optional(),
  sort_order: z.number().int().min(0).optional(),
})

export async function articleConfiguratorRoutes(app: FastifyInstance) {
  // ─── Properties CRUD ─────────────────────────────────────────────────────

  app.post<{ Params: { articleId: string } }>(
    '/catalog-articles/:articleId/properties',
    async (request, reply) => {
      const parsed = PropertySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

      const article = await prisma.catalogArticle.findUnique({ where: { id: request.params.articleId } })
      if (!article) return sendNotFound(reply, 'Article not found')

      const prop = await prisma.catalogArticleProperty.create({
        data: {
          article_id: request.params.articleId,
          key: parsed.data.key,
          label: parsed.data.label,
          type: parsed.data.type,
          options: parsed.data.options ?? [],
          depends_on: parsed.data.depends_on ?? {},
          sort_order: parsed.data.sort_order ?? 0,
        },
      })
      return reply.status(201).send(prop)
    },
  )

  app.get<{ Params: { articleId: string } }>(
    '/catalog-articles/:articleId/properties',
    async (request, reply) => {
      const article = await prisma.catalogArticle.findUnique({ where: { id: request.params.articleId } })
      if (!article) return sendNotFound(reply, 'Article not found')

      const props = await prisma.catalogArticleProperty.findMany({
        where: { article_id: request.params.articleId },
        orderBy: { sort_order: 'asc' },
      })
      return reply.send(props)
    },
  )

  app.delete<{ Params: { articleId: string; propertyId: string } }>(
    '/catalog-articles/:articleId/properties/:propertyId',
    async (request, reply) => {
      const prop = await prisma.catalogArticleProperty.findUnique({ where: { id: request.params.propertyId } })
      if (!prop || prop.article_id !== request.params.articleId) return sendNotFound(reply, 'Property not found')
      await prisma.catalogArticleProperty.delete({ where: { id: request.params.propertyId } })
      return reply.status(204).send()
    },
  )

  // ─── Validate-Kombination ─────────────────────────────────────────────────

  app.post<{ Params: { articleId: string } }>(
    '/catalog-articles/:articleId/validate-configuration',
    async (request, reply) => {
      const schema = z.object({ values: z.record(z.unknown()) })
      const parsed = schema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, 'values object required')

      const properties = await prisma.catalogArticleProperty.findMany({
        where: { article_id: request.params.articleId },
        orderBy: { sort_order: 'asc' },
      })

      const result = validatePropertyCombination(
        properties as Parameters<typeof validatePropertyCombination>[0],
        parsed.data.values as Record<string, string>,
      )

      // Preis-Lookup
      const priceTables = await prisma.catalogArticlePriceTable.findMany({
        where: { article_id: request.params.articleId },
      })
      const price = lookupPrice(
        priceTables as Parameters<typeof lookupPrice>[0],
        parsed.data.values as Record<string, string>,
      )

      return reply.send({ ...result, price_net: price })
    },
  )

  // ─── Preistabellen ───────────────────────────────────────────────────────

  app.post<{ Params: { articleId: string } }>(
    '/catalog-articles/:articleId/price-table',
    async (request, reply) => {
      const schema = z.object({
        property_combination: z.record(z.unknown()),
        price_net: z.number().min(0),
      })
      const parsed = schema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

      const article = await prisma.catalogArticle.findUnique({ where: { id: request.params.articleId } })
      if (!article) return sendNotFound(reply, 'Article not found')

      const entry = await prisma.catalogArticlePriceTable.create({
        data: {
          article_id: request.params.articleId,
          property_combination: parsed.data.property_combination,
          price_net: parsed.data.price_net,
        },
      })
      return reply.status(201).send(entry)
    },
  )

  app.get<{ Params: { articleId: string } }>(
    '/catalog-articles/:articleId/price-table',
    async (request, reply) => {
      const entries = await prisma.catalogArticlePriceTable.findMany({
        where: { article_id: request.params.articleId },
      })
      return reply.send(entries)
    },
  )

  // ─── User-Profile ────────────────────────────────────────────────────────

  app.post('/article-profiles', async (request, reply) => {
    const schema = z.object({
      article_id: z.string().uuid(),
      name: z.string().min(1).max(100),
      property_values: z.record(z.unknown()),
      user_id: z.string().min(1),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const profile = await prisma.userArticleProfile.create({
      data: {
        user_id: parsed.data.user_id,
        tenant_id: request.tenantId ?? null,
        name: parsed.data.name,
        article_id: parsed.data.article_id,
        property_values: parsed.data.property_values,
      },
    })
    return reply.status(201).send(profile)
  })

  app.get<{ Params: { userId: string } }>('/article-profiles/:userId', async (request, reply) => {
    const profiles = await prisma.userArticleProfile.findMany({
      where: { user_id: request.params.userId },
      orderBy: { name: 'asc' },
    })
    return reply.send(profiles)
  })
}
```

---

## 4. Tests: `planner-api/src/services/ofmlEngine.test.ts` + `planner-api/src/routes/articleConfigurator.test.ts`

### ofmlEngine.test.ts (Unit-Tests, 10 Tests)
- Gültige Kombination ohne Abhängigkeiten → valid=true
- Gültige Kombination mit erfüllter Abhängigkeit → valid=true
- Ungültige Kombination (dep nicht erfüllt) → valid=false, 1 error
- Unbekannter Enum-Wert → valid=false, 1 error
- available gibt richtige Optionen zurück
- lookupPrice findet exakten Treffer → price_net
- lookupPrice findet keinen Treffer → null
- Leere Eigenschaften → valid=true
- Mehrfach-Abhängigkeiten werden korrekt ausgewertet
- Fehlermeldung enthält Property-Key

### articleConfigurator.test.ts (API-Tests, 12 Tests)
- POST properties → 201
- GET properties → 200 array
- DELETE property → 204
- POST validate-configuration gültig → valid=true
- POST validate-configuration ungültig → valid=false
- POST validate-configuration mit Preis-Lookup → price_net returned
- POST price-table → 201
- GET price-table → 200 array
- POST article-profiles → 201
- GET article-profiles/:userId → 200 array
- POST validate-configuration mit unknown article → 404
- POST properties → 400 ungültiger type

---

## 5. `planner-api/src/index.ts` – Route registrieren

```typescript
import { articleConfiguratorRoutes } from './routes/articleConfigurator.js'
await app.register(articleConfiguratorRoutes, { prefix: '/api/v1' })
```

---

## DoD-Checkliste

- [ ] `npx vitest run src/services/ofmlEngine.test.ts` → 10 Tests grün
- [ ] `npx vitest run src/routes/articleConfigurator.test.ts` → 12 Tests grün
- [ ] Abhängigkeitsvalidierung blockiert ungültige Kombination korrekt
- [ ] Preis ändert sich bei anderer Variante
- [ ] ROADMAP.md Sprint 54 Status → `done`
- [ ] Commit + PR `feature/sprint-54-ofml-konfigurator`
