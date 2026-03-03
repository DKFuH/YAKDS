# Sprint 61 – Angebots-PDF mit Firmenprofil

**Branch:** `feature/sprint-61-pdf-firmenprofil`
**Gruppe:** A (unabhängig)
**Status:** `done`
**Abhängigkeiten:** S13 (Angebotsmanagement), Phase 9 (TenantSetting)

---

## Ziel

Professionelles Angebots-PDF mit vollständigem Firmenkopf (Logo-Text, Adresse,
Bank, USt-IdNr), Kundenadressblock und sauberem Layout. Tenant-Einstellungen
werden im Frontend pflegbar. Kein externer PDF-Dienst — Generator bleibt
eigenständig.

---

## 1. Schema-Migration

```prisma
// Migration: planner-api/prisma/migrations/YYYYMMDDHHMMSS_tenant_company_details/migration.sql
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_name  VARCHAR(200);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_street VARCHAR(200);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_zip    VARCHAR(20);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_city   VARCHAR(100);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_phone  VARCHAR(50);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_email  VARCHAR(200);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_web    VARCHAR(200);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS iban           VARCHAR(50);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bic            VARCHAR(20);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bank_name      VARCHAR(100);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS vat_id         VARCHAR(30);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS tax_number     VARCHAR(30);
// ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS quote_footer   TEXT;
```

**Prisma-Schema** – Felder in `model TenantSetting` ergänzen:

```prisma
  company_name   String?  @db.VarChar(200)
  company_street String?  @db.VarChar(200)
  company_zip    String?  @db.VarChar(20)
  company_city   String?  @db.VarChar(100)
  company_phone  String?  @db.VarChar(50)
  company_email  String?  @db.VarChar(200)
  company_web    String?  @db.VarChar(200)
  iban           String?  @db.VarChar(50)
  bic            String?  @db.VarChar(20)
  bank_name      String?  @db.VarChar(100)
  vat_id         String?  @db.VarChar(30)   // z. B. DE123456789
  tax_number     String?  @db.VarChar(30)
  quote_footer   String?  // ersetzt bisheriges footer_text, tenant-global
```

---

## 2. Erweiterung `pdfGenerator.ts`

`QuotePdfInput` erhält optionalen `sender`- und `recipient`-Block:

```typescript
export type PdfSender = {
  company_name: string
  street?: string
  zip?: string
  city?: string
  phone?: string
  email?: string
  web?: string
  vat_id?: string
  tax_number?: string
  iban?: string
  bic?: string
  bank_name?: string
}

export type PdfRecipient = {
  name: string          // Kundenname oder Firma
  street?: string
  zip?: string
  city?: string
  email?: string
}

export type QuotePdfInput = {
  quote_number: string
  version: number
  valid_until: string | Date
  free_text: string | null
  footer_text: string | null      // bleibt für Abwärtskompatibilität
  items: QuotePdfItem[]
  price_snapshot?: QuotePdfSnapshot
  sender?: PdfSender              // NEU
  recipient?: PdfRecipient        // NEU
}
```

**Layout-Änderungen in `renderQuoteLines()`:**

1. **Kopfzeile (Seite 1):**
   - Links oben: Firmenname (18pt fett), darunter Straße, PLZ Ort, Tel, Web (9pt)
   - Rechts oben (gleiche Höhe): „ANGEBOT", Angebotsnummer, Datum, Gültig bis (10pt)
   - Trennlinie

2. **Empfängerblock** (unter Kopf, linksbündig):
   - Absenderzeile mini: „{Firmenname} · {Straße} · {PLZ} {Ort}" (7pt, grau simuliert durch abstand)
   - Kundenname, Straße, PLZ Ort (10pt)

3. **Positions-Tabelle** (unverändert, aber Spaltenbreiten anpassen):
   - Pos | Beschreibung | Menge | EP netto | GP netto

4. **Summenblock:**
   - Zwischensumme netto / MwSt 19% / **Gesamtbetrag brutto** (rechtsbündig)

5. **Fußzeile letzte Seite:**
   - Bankverbindung: {bank_name} · IBAN {iban} · BIC {bic}
   - USt-IdNr: {vat_id} | St-Nr: {tax_number}
   - Danach: `quote_footer` aus TenantSetting oder `footer_text` aus Input

---

## 3. Route `POST /quotes/:id/export-pdf` anpassen

```typescript
// In planner-api/src/routes/quotes.ts – export-pdf Handler erweitern

const settings = await prisma.tenantSetting.findUnique({
  where: { tenant_id: project.tenant_id ?? '' },
})

const sender: PdfSender | undefined = settings?.company_name
  ? {
      company_name: settings.company_name,
      street:       settings.company_street ?? undefined,
      zip:          settings.company_zip    ?? undefined,
      city:         settings.company_city   ?? undefined,
      phone:        settings.company_phone  ?? undefined,
      email:        settings.company_email  ?? undefined,
      web:          settings.company_web    ?? undefined,
      vat_id:       settings.vat_id         ?? undefined,
      tax_number:   settings.tax_number     ?? undefined,
      iban:         settings.iban           ?? undefined,
      bic:          settings.bic            ?? undefined,
      bank_name:    settings.bank_name      ?? undefined,
    }
  : undefined

// Kundendaten aus Lead/Contact holen (falls verknüpft)
const lead = project.lead_id
  ? await prisma.lead.findUnique({ where: { id: project.lead_id }, select: { name: true, email: true } })
  : null

const recipient: PdfRecipient | undefined = lead
  ? { name: lead.name, email: lead.email ?? undefined }
  : undefined

const pdf = buildQuotePdf({
  // ... bisherige Felder ...
  footer_text: settings?.quote_footer ?? quote.footer_text ?? null,
  sender,
  recipient,
})
```

---

## 4. Neue Route: `GET/PUT /api/v1/tenant/settings`

Für Frontend-Pflege der Firmendaten:

```typescript
// GET /api/v1/tenant/settings – liefert TenantSetting für aktuellen Tenant
// PUT /api/v1/tenant/settings – aktualisiert TenantSetting (upsert)
```

Body-Schema (Zod):
```typescript
const TenantSettingBodySchema = z.object({
  company_name:   z.string().max(200).optional(),
  company_street: z.string().max(200).optional(),
  company_zip:    z.string().max(20).optional(),
  company_city:   z.string().max(100).optional(),
  company_phone:  z.string().max(50).optional(),
  company_email:  z.string().email().optional(),
  company_web:    z.string().max(200).optional(),
  iban:           z.string().max(50).optional(),
  bic:            z.string().max(20).optional(),
  bank_name:      z.string().max(100).optional(),
  vat_id:         z.string().max(30).optional(),
  tax_number:     z.string().max(30).optional(),
  quote_footer:   z.string().max(2000).optional(),
  logo_url:       z.string().url().optional(),
  currency_code:  z.string().length(3).optional(),
})
```

Route in neuer Datei `planner-api/src/routes/tenantSettings.ts`, registriert in `index.ts`.

---

## 5. Frontend

### 5a. Download-Button in Angebots-UI

In der bestehenden Angebots-Seite/Sidebar:
```tsx
<button onClick={async () => {
  const res = await fetch(`/api/v1/quotes/${quoteId}/export-pdf`, { method: 'POST' })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Angebot-${quoteNumber}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}}>
  PDF herunterladen
</button>
```

### 5b. Firmenprofil-Seite: `planner-frontend/src/pages/TenantSettingsPage.tsx`

Formular mit Feldern für alle TenantSetting-Felder, aufgeteilt in 3 Sektionen:
- **Firmendaten:** Name, Straße, PLZ, Ort, Tel, E-Mail, Web
- **Steuer & Bank:** USt-IdNr, St-Nr, IBAN, BIC, Bank
- **Angebotsvorlage:** Fußtext (Textarea), Währung

Erreichbar über Einstellungen-Icon / Route `/settings/company`.

---

## 6. Tests (`planner-api/src/routes/tenantSettings.test.ts`)

Mindest-Tests (8):
1. `PUT /tenant/settings` – upsert company_name → 200
2. `PUT /tenant/settings` – ungültige E-Mail → 400
3. `GET /tenant/settings` – liefert gespeicherte Daten
4. `POST /quotes/:id/export-pdf` – mit TenantSetting → PDF enthält company_name
5. `POST /quotes/:id/export-pdf` – ohne TenantSetting → PDF ohne Absender (kein Crash)
6. `POST /quotes/:id/export-pdf` – mit Lead → Empfängerblock gesetzt
7. `buildQuotePdf()` Unit – sender gesetzt → company_name in Ausgabe
8. `buildQuotePdf()` Unit – ohne sender → kein crash, valid PDF Buffer

---

## DoD-Checkliste

- [ ] Migration + Prisma-Schema: alle 13 Felder in `TenantSetting`
- [ ] `pdfGenerator.ts`: `PdfSender` + `PdfRecipient` im Input, Kopf/Empfänger/Fuß gerendert
- [ ] `POST /quotes/:id/export-pdf` lädt TenantSetting und übergibt `sender`/`recipient`
- [ ] `GET/PUT /api/v1/tenant/settings` → Firmendaten pflegbar
- [ ] Frontend: PDF-Download-Button funktioniert
- [ ] Frontend: `TenantSettingsPage.tsx` mit allen Feldern
- [ ] 8+ Tests grün
- [ ] ROADMAP Sprint 61 → `done`
