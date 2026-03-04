# Sprint 84 - i18n-Core & Locale Switcher

**Branch:** `feature/sprint-84-i18n-core`
**Gruppe:** A (startbar jederzeit)
**Status:** `done`
**Abhaengigkeiten:** keine harten, sinnvoll nach S74

---

## Ziel

YAKDS bekommt eine echte Mehrsprachenbasis: zentrale Message-Kataloge,
Sprachumschaltung im Frontend, locale-aware Formatierung fuer Datum/Zahl/Waehrung
und eine definierte Fallback-Strategie.

Leitidee: eingebaute UI-Translations und locale-aware Umschaltung.

---

## 1. Architektur

Core-Thema, kein Plugin.

Einzufuehren:

- i18n-Provider im Frontend
- zentrale Sprachdateien pro Locale
- Message-Keys statt harter UI-Strings in neuen/angepassten Bereichen
- Locale-Resolver fuer Benutzer-, Tenant- und Browser-Praeferenz

V1-Sprachen:

- `de`
- `en`

Optional vorbereitet:

- `fr`
- `nl`

---

## 2. Datenmodell / Persistenz

Bestehende Tenant-/User-Settings erweitern:

- `preferred_locale`
- `fallback_locale`

Falls kein passendes Modell vorhanden ist:

```prisma
preferred_locale String? @db.VarChar(10)
```

Zusaetzlich im Frontend lokal speicherbar:

- letzte ausgewaehlte UI-Sprache

---

## 3. Backend

Neue oder angepasste Dateien:

- `planner-api/src/routes/locales.ts`
- optionale Erweiterungen in `tenantSettings.ts`

Endpoints:

- `GET /locales`
- `GET /tenant/locale-settings`
- `PUT /tenant/locale-settings`

Backend-Aufgaben:

- verfuegbare Locales melden
- tenantweite Standardsprache speichern
- spaeter fuer Dokumente und Shares nutzbar machen

---

## 4. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/i18n/*`
- `planner-frontend/src/components/LanguageSwitcher.tsx`
- Anpassungen in `main.tsx`, `SettingsPage.tsx`, Kernseiten

Funktionen:

- Sprache im UI wechseln
- Nachrichten ueber Key-Lookup statt Inline-Strings
- Datums-/Waehrungsformatierung nach Locale
- Fallback auf Deutsch oder Englisch, wenn Keys fehlen

---

## 5. Deliverables

- i18n-Core im Frontend
- Language Switcher
- Tenant-Locale-Settings
- Startabdeckung fuer zentrale Navigations- und Settingsseiten
- 10-14 Tests

---

## 6. DoD

- Nutzer kann zwischen mindestens Deutsch und Englisch umschalten
- zentrale UI-Bereiche reagieren sofort auf Sprachwechsel
- Datum, Zahl und Waehrung werden locale-aware formatiert
- fehlende Uebersetzungen brechen die UI nicht

---

## 7. Abschluss

**Implementiert:**

- `i18next` + `react-i18next` in `planner-frontend` installiert
- Kataloge `de.ts` / `en.ts` mit Namespaces `common`, `nav`, `settings`, `projects`
- `resolveLocale()` als einzige Prioritaetsquelle: `okp_locale` → Tenant → Browser → `de`
- Pure Formatter in `i18n/formatters.ts` (formatDate, formatNumber, formatCurrency)
- React-Hook `useLocale()` wickelt Formatter und `useTranslation`
- `LanguageSwitcher` Komponente: nur `de`/`en` aktiv, `fr`/`nl` disabled
- i18n initialisiert via `i18next.use(initReactI18next).init(...)`, kein `I18nextProvider`
- `preferred_locale` + `fallback_locale` auf `TenantSetting` (Prisma + Migration)
- Backend-Route `GET /locales`, `GET/PUT /tenant/locale-settings` (tenant-scoped, 400 bei planned-Locales)
- SettingsPage, TenantSettingsPage, ProjectList auf `t()`-Keys umgestellt
- Hardcoded `'de-DE'`-Aufrufe in BIDashboard, CatalogBrowser, QuoteExportPanel, CatalogPage entfernt
- 20 Tests (6 backend locales, 14 logic: resolveLocale + formatters), build gruen (751 backend, 412 frontend modules)
