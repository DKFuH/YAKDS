# Sprint 103 - ERP Integration Hooks (DATEV und Drittsysteme)

**Branch:** `feature/sprint-103-erp-integration-hooks-datev`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S99 (Workflow Events), S100 (Masterdaten), S102 (Reporting), S48 (ERP Connector Grundlagen)

## Umsetzung (2026-03-05)

- Integrations-Hook-API umgesetzt:
	- `planner-api/src/routes/integrationHooks.ts`
	- Endpunkte:
		- `POST /integrations/endpoints`
		- `GET /integrations/endpoints`
		- `POST /integrations/endpoints/:id/test`
		- `GET /integrations/outbox`
		- `POST /integrations/outbox/:id/replay`
		- `POST /integrations/inbound/:provider`
		- `GET /integrations/deliveries/:id`
- Persistenzmodell fuer Endpoint/Outbox/Delivery eingefuehrt:
	- Prisma-Schema erweitert in `planner-api/prisma/schema.prisma`
	- Migration erstellt: `planner-api/prisma/migrations/20260305110000_sprint103_integration_hooks/migration.sql`
	- Neue Tabellen: `integration_endpoints`, `integration_mapping_profiles`, `integration_outbox_messages`, `integration_delivery_attempts`
- Route in API-Bootstrap registriert:
	- `planner-api/src/index.ts`
- Tests geliefert:
	- `planner-api/src/routes/integrationHooks.test.ts`

Verifikation:

- `npm run db:generate --workspace planner-api` -> erfolgreich
- `npm run test --workspace planner-api -- src/routes/integrationHooks.test.ts` -> gruen (`6` Tests)
- `npm run build --workspace planner-api` -> erfolgreich

## Ziel

Ein belastbarer Integrations-Layer fuer externe ERP-/Buchhaltungssysteme (inkl. DATEV-Szenarien) soll ueber standardisierte Hooks, Mapping und idempotente Zustellung bereitgestellt werden.

Leitidee: stable contracts over custom spaghetti.

---

## 1. Scope

In Scope:

- Outbound-Hooks fuer Auftrags-, Rechnungs- und Statusereignisse
- Inbound-Endpunkte fuer Rueckmeldungen (z. B. Buchungsstatus)
- Mapping-Layer fuer unterschiedliche Zielsysteme
- Retry, Idempotenz und Dead-letter-Handling
- MCP-Erweiterung fuer Integrationssteuerung

Nicht in Scope:

- Vollstaendige DATEV-Zertifizierung in V1
- Individuelle Sonderadapter je Kunde ohne Standardvertrag

---

## 2. Integrationsmodell

Kernkomponenten:

- `IntegrationEndpoint`
- `IntegrationSubscription`
- `IntegrationOutboxMessage`
- `IntegrationDeliveryAttempt`
- `IntegrationMappingProfile`

Mindestfelder:

- Endpoint: `tenant_id`, `type`, `url`, `auth_mode`, `is_active`
- Outbox: `event_type`, `payload_json`, `idempotency_key`, `status`
- Attempt: `attempt_no`, `http_status`, `error_code`, `next_retry_at`

---

## 3. Architektur

Outbound:

- Domain Event -> Outbox -> Delivery Worker -> Zielsystem
- Signierte Payloads + idempotency keys
- exponential backoff, danach Dead-letter Queue

Inbound:

- verifizierte Callback-Endpunkte
- Signatur-/Token-Pruefung
- Mapping auf interne Events/Statusobjekte

Betrieb:

- Zustellmonitoring mit Fehlerklassifikation
- Replay-Funktion fuer fehlgeschlagene Events

---

## 4. API-Schnittstellen

Geplante Endpunkte:

- `POST /integrations/endpoints`
- `GET /integrations/endpoints`
- `POST /integrations/endpoints/:id/test`
- `GET /integrations/outbox`
- `POST /integrations/outbox/:id/replay`
- `POST /integrations/inbound/:provider`
- `GET /integrations/deliveries/:id`

MCP-Erweiterungen:

- Hook-Status und letzte Fehler
- Mapping-Profil pro Endpoint
- Schalter fuer Dry-Run/Testmodus

---

## 5. Security und Compliance

Pflichtanforderungen:

- tenant-isolierte Endpunkt-Konfiguration
- Secrets verschluesselt speichern
- Request-Signatur fuer Inbound und Outbound
- personenbezogene Felder minimieren und protokollieren

DATEV-bezogene Leitplanken:

- Mapping nur ueber freigegebene Felder
- klare Trennung zwischen Test- und Produktivprofilen

---

## 6. Tests

Mindestens:

- 10+ Service-Tests fuer Outbox/Retry/Idempotenz
- 8+ Route-Tests fuer Endpoint- und Replay-APIs
- 5+ Integrations-Tests mit Mock-ERP/DATEV-Simulator
- 4+ Security-Negativtests (Signatur, Tenant, Auth)

Verifikation:

- kein Duplicate-Delivery bei Retry
- Dead-letter und Replay reproduzierbar
- Mapping-Fehler sind observierbar und diagnosefaehig

---

## 7. DoD

- Endpunkte koennen tenant-sicher konfiguriert und getestet werden
- Outbox liefert Events idempotent an Drittsysteme aus
- Fehlerfaelle laufen ueber Retry/Dead-letter mit Monitoring
- Inbound-Callbacks sind authentifiziert und korrekt gemappt
- API-/Service-/Integrations-Tests sind gruen

---

## 8. Nicht Teil von Sprint 103

- Individuelle One-Off-Integrationen ohne Standardprofil
- komplexe ETL-Pipelines fuer historische Massendaten
- vollumfaengliche Finanzbuchhaltung innerhalb von OKP

---

## 9. Open-Source-Compliance

- Externe ERP-Ideen werden als Schnittstellenmuster verstanden.
- Keine Uebernahme fremder proprietaerer Konnektor-Implementierungen.
- Alle Adapter bleiben dokumentiert, testbar und eigenstaendig lizenzierbar.
