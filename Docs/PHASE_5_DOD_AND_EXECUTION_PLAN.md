# PHASE_5_DOD_AND_EXECUTION_PLAN.md

Stand: 2026-03-02

---

## 1) Executive Summary: Phase-5 Definition of Done (DoD)

- **Auftragsabwicklung als Kernkompetenz:** OKP schließt die Studio-Plattform mit einem vollständigen Bestellwesen ab – von der Angebotsakzeptanz über Herstellerbestellungen und Lieferterminplanung bis zur Abschlussrechnung.
- **Nahtlose Fortsetzung von Phase 4:** Alle Features bauen auf den Bereichen/Alternativen (Sprint 32), dem Workspace-Layout (Sprint 34), dem CRM-Light (Sprint 27) und dem Dokumentenmanagement (Sprint 26) auf.
- **One-Week-Sprints:** Sprints 35–39 werden als 5 aufeinanderfolgende 1-Wochen-Inkremente umgesetzt.
- **Verbindlicher End-to-End-Flow:** Quote akzeptiert → Bestellung erstellt → Liefertermin geplant → Montagetermin koordiniert → Rechnung erstellt → Projekt abgeschlossen.

### Globales DoD für Phase 5

1. **Bestellverwaltung produktiv:** Kaufbestellungen an Lieferanten/Hersteller sind projektgebunden, statusverfolgbar und dokumentierbar.
2. **Lieferterminplanung produktiv:** Lieferdaten, Speditionsinfos und Wareneingang sind erfassbar und im Projektkontext sichtbar.
3. **Kundenkommunikation produktiv:** Freigabe-Workflow und E-Mail-Korrespondenz sind als Aktivitäten am Projekt verfolgbar.
4. **Nachkalkulation produktiv:** Ist-Kosten aus Bestellungen werden gegen Angebotswerte gespiegelt und als Deckungsbeitragsanalyse ausgegeben.
5. **Abschlussrechnung produktiv:** Rechnungen können aus akzeptierten Angeboten erzeugt und als PDF ausgegeben werden.

---

## 2) Ausgangslage und Abhängigkeiten

### Technische Ausgangslage

- `Sprint 13`: Angebotslogik (`quotes`) vorhanden.
- `Sprint 26`: Dokumentenmanagement vorhanden.
- `Sprint 27`: CRM-Light (`contacts`) vorhanden.
- `Sprint 30`: Cloud-Sync und Notifications vorhanden.
- `Sprint 32`: Bereiche/Alternativen vorhanden.
- `Sprint 34`: Workspace-Layout und Advisor-Felder vorhanden.

### Verbindliche Abhängigkeiten für Phase 5

- Tenant-Scoping bleibt in allen neuen Endpunkten verpflichtend (`tenant_id` erzwungen).
- Bestellungen referenzieren bestehende Projekte (kein Parallelmodell).
- Liefertermine nutzen bestehende Notification-Infrastruktur (Sprint 30) für Eskalationen.
- Nachkalkulation operiert auf Quote-Daten (Sprint 13) und Bestellkosten (Sprint 35).

---

## 3) Sprint-Backlog (35–39)

### Sprint 35 – Bestellverwaltung

- **Priorität:** Muss (P1)
- **Ziel:** Kaufbestellungen an Lieferanten/Hersteller projektgebunden erstellen und verfolgen.

**Neue Entity (`PurchaseOrder`)**

```ts
interface PurchaseOrder {
  id: string;
  project_id: string;
  tenant_id: string;
  supplier_name: string;
  supplier_ref: string | null;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_delivered' | 'delivered' | 'cancelled';
  order_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  position: number;
  sku: string | null;
  description: string;
  qty: number;
  unit: string;
  unit_price_net: number;
  line_net: number;
  notes: string | null;
}
```

**API-Contracts**

```http
POST   /projects/:id/purchase-orders
GET    /projects/:id/purchase-orders
GET    /purchase-orders/:id
PATCH  /purchase-orders/:id/status
PUT    /purchase-orders/:id
DELETE /purchase-orders/:id
```

**DoD (Sprint 35)**

- Bestellungen sind projektgebunden und tenant-sicher.
- Statuswechsel (draft → sent → confirmed → delivered) sind persistent und triggern optionale Notifications.
- 5–8 Tests decken CRUD und Statuswechsel-Workflow ab.

---

### Sprint 36 – Lieferterminplanung

- **Priorität:** Muss (P1)
- **Ziel:** Lieferdaten, Speditionsinfos und Wareneingang strukturiert erfassen.

**Neue Entity (`DeliveryAppointment`)**

```ts
interface DeliveryAppointment {
  id: string;
  project_id: string;
  tenant_id: string;
  purchase_order_id: string | null;
  type: 'delivery' | 'installation' | 'service';
  scheduled_date: string;
  time_from: string | null;
  time_to: string | null;
  location_notes: string | null;
  assigned_team: string | null;
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**API-Contracts**

```http
POST  /projects/:id/delivery-appointments
GET   /projects/:id/delivery-appointments
PATCH /delivery-appointments/:id/status
PUT   /delivery-appointments/:id
DELETE /delivery-appointments/:id
GET   /delivery-appointments/calendar?tenant_id=?&from=?&to=?
```

**DoD (Sprint 36)**

- Liefertermine und Montagetermine sind erfassbar und im Projektstatus sichtbar.
- Kalenderansicht zeigt Termine mandantenübergreifend gefiltert.
- Termin-Benachrichtigungen nutzen bestehenden Notification-Service.

---

### Sprint 37 – Kundenkommunikation & Freigabe-Workflow

- **Priorität:** Muss (P1)
- **Ziel:** Freigabe-E-Mails und Kundenkorrespondenz als Aktivitäten am Projekt verfolgen.

**Neue Entity (`ProjectActivity`)**

```ts
interface ProjectActivity {
  id: string;
  project_id: string;
  tenant_id: string;
  type: 'email_sent' | 'email_received' | 'call' | 'meeting' | 'note' | 'approval_requested' | 'approval_received';
  subject: string;
  body: string | null;
  contact_id: string | null;
  created_by: string;
  activity_date: string;
  created_at: string;
}
```

**API-Contracts**

```http
POST /projects/:id/activities
GET  /projects/:id/activities?type=?
POST /projects/:id/activities/:activityId/approval-request
```

**DoD (Sprint 37)**

- Aktivitäten (E-Mail/Anruf/Meeting/Freigabe) sind am Projekt dokumentierbar.
- Freigabe-Anfragen erzeugen Notifications und protokollieren Antworten.
- Kontakt-Verknüpfung (Sprint 27) zeigt Aktivitätshistorie pro Kontakt.

---

### Sprint 38 – Nachkalkulation & Abschlussrechnung

- **Priorität:** Muss (P1)
- **Ziel:** Ist-Kosten aus Bestellungen gegen Angebotswerte spiegeln; Rechnung erzeugen.

**Neue Entity (`ProjectInvoice`)**

```ts
interface ProjectInvoice {
  id: string;
  project_id: string;
  quote_id: string | null;
  tenant_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  total_net: number;
  total_gross: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**API-Contracts**

```http
POST /projects/:id/invoices
GET  /projects/:id/invoices
PATCH /invoices/:id/status
GET  /projects/:id/cost-analysis
```

**DoD (Sprint 38)**

- Rechnung kann aus akzeptiertem Angebot erzeugt werden (Übernahme der Quote-Items).
- Kostenanalyse (`/cost-analysis`) spiegelt Bestellkosten gegen Angebotswerte.
- Rechnungsstatus (draft → sent → paid) ist persistent.

---

### Sprint 39 – Erweiterte Plattformauswertungen

- **Priorität:** Soll (P2)
- **Ziel:** Unternehmensweite KPIs um Bestell-, Liefer- und Rechnungsmetriken erweitern.

**Erweiterte KPI-Endpunkte**

```http
GET /kpis/order-volume?period=month&tenant_id=?
GET /kpis/delivery-performance?period=month&tenant_id=?
GET /kpis/invoice-aging?tenant_id=?
GET /kpis/margin-analysis?period=month&tenant_id=?
```

**DoD (Sprint 39)**

- Bestell- und Liefermetriken sind im Dashboard als Widgets verfügbar.
- Margenanalyse (Angebot vs. Ist-Kosten) ist pro Tenant und Zeitraum abrufbar.
- Rechnungsalterung zeigt offene, fällige und überfällige Beträge.

---

## 4) Übersichtstabelle Phase 5

| Sprint | Thema | Schlüsselobjekte | API-Highlights |
|---|---|---|---|
| 35 | Bestellverwaltung | `PurchaseOrder`, `PurchaseOrderItem` | `/projects/:id/purchase-orders`, `/purchase-orders/:id/status` |
| 36 | Lieferterminplanung | `DeliveryAppointment` | `/projects/:id/delivery-appointments`, `/delivery-appointments/calendar` |
| 37 | Kundenkommunikation | `ProjectActivity` | `/projects/:id/activities`, `approval-request` |
| 38 | Nachkalkulation & Rechnung | `ProjectInvoice` | `/projects/:id/invoices`, `/projects/:id/cost-analysis` |
| 39 | Erweiterte Auswertungen | KPI-Metriken | `/kpis/order-volume`, `/kpis/margin-analysis` |

---

## 5) Reihenfolgeplan (5 Wochen)

### Woche 1 (Sprint 35)

- PurchaseOrder-/PurchaseOrderItem-Schema, API-Routen, Statuswechsel-Workflow.

### Woche 2 (Sprint 36)

- DeliveryAppointment-Schema, Kalender-API, Notification-Integration.

### Woche 3 (Sprint 37)

- ProjectActivity-Schema, Aktivitäts-API, Freigabe-Workflow.

### Woche 4 (Sprint 38)

- ProjectInvoice-Schema, Rechnungsrouten, Kostenanalyse-Endpunkt.

### Woche 5 (Sprint 39)

- Erweiterte KPI-Endpunkte, Dashboard-Widget-Anbindung, Abnahme.

---

## 6) Risiken und offene Architekturfragen

1. **Bestellkomplexität:** Bestellungen an mehrere Lieferanten pro Projekt erfordern klares 1:n-Modell.
2. **Terminplanung:** Kalender-Synchronisation mit externen Systemen (Google/Outlook) ist bewusst aus Phase 5 ausgeschlossen.
3. **Rechnungslegung:** Steuerrechtliche Anforderungen (z. B. GoBD) erfordern Audit-Log für Rechnungsänderungen.
4. **Margenanalyse:** Korrekte Kostenzuordnung erfordert konsistente SKU-Verknüpfung zwischen Bestellung und BOM.
5. **Notification-Last:** Bestell- und Liefertermin-Events erhöhen das Notification-Volumen; Retry/Dead-Letter-Strategie (Sprint 30) muss ausreichen.

---

## 7) Meilenstein nach Phase 5

Nach Sprint 39 ist OKP eine vollständige Studio-Plattform mit geschlossenem Auftragskreislauf: Lead-Erfassung → Planung → Angebot → Bestellung → Lieferung → Montage → Rechnung → Abschluss – mit mandantengetrennter Cloud-Auswertung auf allen Stufen.
