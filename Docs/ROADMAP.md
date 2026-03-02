# ROADMAP.md

Sprint-Planung für MVP (Sprints 0-19), Phase 2 (Sprints 20-24) und Phase 3 (Sprints 25-30) inkl. aktuellem Fortschritt.

---

## MVP - Sprints 0-19

**Zielbild:** Nicht-rechteckige Räume, Dachschrägen, BOM/Preise/Angebote, DXF-Interop, SKP-Referenzimport, externer Render-Worker.

### Sprint-Übersicht

| Sprint | Thema | Deliverables |
|--------|-------|--------------|
| 0 | Architektur & Domänenmodell | ARCHITECTURE.md, Kerndokumente, Monorepo-Struktur |
| 1 | Backend-Grundgerüst | Projekt-CRUD, Postgres-Schema, API-Grundstruktur |
| 2 | Frontend-Grundgerüst | Projektliste, Editor-Layout, Canvas, Sidebars |
| 3 | Polygon-Raumeditor v1 | Punkte setzen, Polygon schließen, Validierung |
| 3.5 | CAD/SKP-Import Grundlagen | Upload-Pipeline, neutrales Austauschformat |
| 4 | Präzisionsbearbeitung | Vertex-Move, numerische Kantenlänge, stabile Wand-IDs |
| 5 | Öffnungen | Türen/Fenster an Wänden, Offset, Brüstungshöhe |
| 6 | Dachschrägen | CeilingConstraints, Höhenberechnung an beliebigem Punkt |
| 7 | Katalog MVP | Schrank-/Gerätetypen, Preisfelder, Warengruppen |
| 7.5 | SKP-Komponenten-Mapping | Referenzmodell, Heuristik, Mapping-Persistenz |
| 8 | Platzierungsengine v1 | wall_id + offset, Innenrichtung, Verschieben |
| 9 | Geometrieprüfung v1 | Kollisionen, Öffnungsblockierung, Mindestabstände |
| 10 | Höhenprüfung | Dachschrägen-Regeln, Preiswirkung (flags) |
| 11 | Stücklisten-Engine v1 | BOM aus Planung, `POST /calculate-bom` |
| 11.5 | DXF-Export v1 | Raumkontur + Möbel als DXF, Layer-Konventionen |
| 12 | Preisengine v1 | 9-stufige Kalkulation, netto/MwSt/brutto/DB |
| 13 | Angebotsmanagement v1 | Angebotsnummer, Versionen, PDF light |
| 14 | Browser-3D-Preview | Three.js, Extrusion, Proxy-Meshes, Orbit |
| 15 | Render-Job-System | Queue, Scene Payload, Worker-Protokoll End-to-End |
| 16 | Business-Sprint | Kundenpreislisten, CRM-Felder light, JSON/CSV-Export |
| 17 | Blockverrechnung | Blockprogramme, automatische Auswahl des besten Blocks |
| 18 | Interop-API | Asynchrone Importjobs, Prüfprotokoll, Mapping-Persistenz |
| 19 | Interop-Härtung | Roundtrip-Tests, Einheitenprüfung, Regressionstests |

### Meilensteine

| Nach Sprint | Ergebnis |
|-------------|----------|
| 6 | Echte Polygonräume mit Öffnungen und Dachschrägen |
| 8 | Erste wandbasierte Küchenplanung |
| 13 | Internes Angebots-MVP |
| 15 | Renderworkflow produktiv nutzbar |
| 19 | Vollständiges MVP: Interop + Business + Planung |

### Nicht im MVP

- Komplexe Eckschrank-Automatik, freie Rundungen
- Vollständige Dachgeometrie als CAD
- Echtzeit-Multiuser, vollwertiges ERP
- Verlustfreier SKP-Roundtrip, nativer DWG-Binary-Parser

---

## Phase 2 - Sprints 20-24

**Ausgangslage (Sprint 19):** MVP vollständig. Polygonräume + Placement + BOM + Preis + Angebote + DXF/SKP + Render-Worker alle produktiv.

**Ziel:** Funktionslücken zu etablierten Studiosystemen schließen (Herstellerkataloge, Automatismen, Prüfmodul, Mehrmandantenfähigkeit, Webplaner), ohne die bestehende Architektur zu brechen.

---

### Sprint 20 - Herstellerkatalog & Schrankkonfigurator (Light)

**Ziel:** 1 Hersteller-Import End-to-End + konfigurierbarer Schrank mit Artikel/Preis/BOM.

**Neues Datenmodell:**
- DB-Tabellen: `manufacturers`, `catalog_articles`, `article_options`, `article_variants`, `article_prices`, `article_rules`
- Domain-Typen: `Manufacturer`, `CatalogArticle`, `ArticleOption`, `ArticleVariant`, `ArticlePrice`, `ArticleRule`

**Deliverables:** Import-Pipeline (CSV/JSON), Konfigurator-UI (Breite/Höhe/Front/Griff), 30 Tests.

**DoD:** 1 Herstellerkatalog importiert, 1 konfigurierbarer Schrank platzierbar, BOM/Pricing aus `CatalogArticle` und `ArticleVariant`.

---

### Sprint 21 - Automatismen (Langteile, Zubehör, Auto-Vervollständigung)

**Ziel:** Automatische BOM-Generierung für Arbeitsplatte, Sockel, Wange, Standardzubehör.

**Scope:**
- `AutoCompletionService`: Worktop- und Sockel-Segmente entlang Cabinet-Cluster
- Autogen-Objekte als `generated` markiert, Rebuild bei Änderungen
- UI: Button "Auto vervollständigen" + Diff-View

**DoD:** Standardzeile erzeugt automatisch Worktop + Sockel in BOM; Änderungen konsistent.

---

### Sprint 22 - Prüf-Engine v2 ("Protect"-Niveau)

**Ziel:** Konfigurierbares Prüfmodul mit Kategorien, Bericht und Finalprüfung.

**Neues Datenmodell:**
- DB-Tabellen: `rule_definitions`, `rule_runs`, `rule_violations`
- Domain-Typen: `RuleDefinition`, `RuleRun`, `RuleViolationRecord`

**Mindestens 15 Regeln:** Kollision (Tür/Auszug), Abstände, Ergonomie, Vollständigkeit (Arbeitsplatte/Sockel/Blenden), Zubehör.

**DoD:** Konfigurierbarer Prüfbericht mit Filter + Jump-to-Problem + Finalprüfung.

---

### Sprint 23 - Multi-Tenant / BI-Light

**Ziel:** Vom Single-Studio zu Multi-Tenant mit KPI-Endpunkten.

**Scope:**
- `tenants`, `branches`; `tenant_id` in allen relevanten Tabellen
- API-Middleware: tenant-scope enforced
- KPI-Endpunkte: Angebote/Zeitraum, Conversion, Top-Warengruppen
- Minimal-Dashboard: KPI Cards + Zeitraumfilter

**Domain-Typen:** `Tenant`, `Branch`, `ProjectKpiSnapshot`, `KpiQuery`

**DoD:** 2 Tenants sauber getrennt, KPI-Endpunkte plausibel, Basis-Dashboard.

---

### Sprint 24 - Online-Webplaner MVP + Handover

**Ziel:** Abgespeckter Endkunden-Webplaner (Lead Gen) mit Übergabe ins Profi-Tool.

**Scope:**
- Vereinfachter Grundriss (rechteckig + Aussparungen), reduzierter Katalog, guided Wizard
- `LeadProject` wird zu `Project` im Profi-Editor promoted
- Consent + Retention Policy

**Domain-Typen:** `LeadProject`, `LeadPlanningPayload`, `LeadPromotionResult`

**DoD:** Endkunde konfiguriert Küche, Lead geht ans Studio, Studio öffnet Projekt im Profi-Editor.

---

## Risiken Phase 2

1. Herstellerkatalogtiefe professioneller Systeme ist ohne langfristige Datenpflege nicht erreichbar.
2. Automatismen müssen deterministisch und testbar sein, sonst zerlegt es Pricing/BOM.
3. Prüf-Engine braucht klare DoD, sonst entsteht Rule-Spaghetti.
4. Multi-Tenant muss früh mit Migrations- und Index-Disziplin kommen.
5. Webplaner ist ein anderes Produkt: guided UX, kein Profi-Editor.

---

## Phase 3 - Sprints 25-30

**Ausgangslage (nach Sprint 24):** Kern-Planung, Preis/BOM, Angebote, Multi-Tenant, BI-Light und Lead-Handover sind vorhanden.

**Ziel:** Entwicklung zur vollwertigen Studio-Plattform mit Projektsteuerung, Dokumentenmanagement, CRM-Light, personalisierten Dashboards, Katalogindexierung und Cloud-Workflow.

### Fortschrittssnapshot (Stand 2026-03-01)

| Sprint | Status | Hinweis |
|--------|--------|---------|
| 25 | In Arbeit | Projektboard/Gantt und Status-/Assign-Pfade bereits vorhanden, weitere Härtung offen |
| 26 | Weit umgesetzt | Dokumentrouten und Kern-Integration inkl. Auto-Attach/Download aktiv |
| 27 | Weit umgesetzt | Kontakt-API + Projektverknüpfung + CRM-Ansicht mit KPIs aktiv |
| 28 | Weit umgesetzt | DashboardConfig + KPI-Endpunkte + Dashboard-UI integriert |
| 29 | Weit umgesetzt | CatalogIndex-API + Pricing-Einfluss + Batch-UI integriert |
| 30 | In Umsetzung | Suche/Export/Notifications/Backup-Endpunkte und Frontend-Anbindung vorhanden |

### Sprint-Übersicht

| Sprint | Thema | Deliverables |
|--------|-------|--------------|
| 25 | Projekt-/Aufgabenmanagement | `project_status`, Kanban-Board, Gantt-Basis, Status-/Assign-APIs |
| 26 | Dokumentenmanagement | `Document`-Entity, Upload/Preview/Filter, S3-kompatibles Storage |
| 27 | Kontakte / CRM-Light | `Contact`-Entity, Projektverknüpfung, Webplaner-Lead-Automation |
| 28 | Personalisierte Dashboards / KPIs | `DashboardConfig`, Widget-Layout, KPI-Endpunkte |
| 29 | Katalogindexierung & Preisanpassung | `CatalogIndex`, EK/VK-Indizes, Pricing-Integration |
| 30 | Cloud-Sync & Plattform-Features | Global Search, Export, Notification-Webhooks, Auto-Backup |

### Meilenstein

| Nach Sprint | Ergebnis |
|-------------|----------|
| 30 | End-to-End-Plattform: Lead -> Planung -> Quote -> Projektmanagement -> Abschluss |

### Referenz

- Detailplanung und DoD: `Docs/PHASE_3_DOD_AND_EXECUTION_PLAN.md`

### Risiken Phase 3

1. Dokumenten-Storage und Zugriffskontrolle müssen tenant-sicher und revisionsfähig sein.
2. KPI-/Dashboard-Updates brauchen klare Latenz- und Konsistenzstrategie.
3. Preisindexierung darf die bestehende 9-stufige Kalkulation nicht regressiv beeinflussen.
4. Globale Suche benötigt robuste, domänenübergreifende Indexpflege.
5. E-Mail-/Webhook-Zustellung braucht Retry- und Fehlertoleranzkonzept.

---

## Phase 4 – Sprints 31–34: Absolute Basics & Onboarding

**Ausgangslage (nach Sprint 30):** End-to-End-Plattform vorhanden. Jetzt fehlende Grundfunktionen für den täglichen Studio-Einsatz nachrüsten.

**Ziel:** Projektsteuerung auf Dashboard-Niveau, Bereiche/Alternativen-Baumstruktur, Onboarding-Assistent und anpassbares Workspace-Layout.

---

### Sprint 31 – Projektliste & 3-Punkte-Menü

**Ziel:** Dashboard-ähnliche Projektliste mit Filtern, Suche, 3-Punkte-Menü.

**Features:**

- Projektliste-View: Filter (Status/Branch/Verkäufer), Suche.
- „Neues Projekt"-Button → Dialog: Kundenname, Adresse, Kontaktperson, Lead-Quelle.
- 3-Punkte-Menü pro Projekt (Edit, Duplicate, Delete, Archive).
- `PATCH /projects/:id/3dots?action=duplicate|archive|unarchive`.
- `GET /projects?search=…&status_filter=…&sales_rep=…`.

**DoD:** 10 Projekte anlegen, filtern/suchen, Status ändern, 3-Punkte-Menü öffnet Optionen.

---

### Sprint 32 – Bereiche / Alternativen & Modellauswahl

**Ziel:** Baumstruktur + globale Kopfdaten pro Alternative – F7 öffnet überall.

**Features:**

- Projekt-View: Baum „Bereiche > Alternativen" (Rechtsklick: Neu/Duplicate/Delete, Doppelklick öffnen).
- Modell-/Indexeinstellungen-Dialog (F7): Küchenmodell, Arbeitsplatte, Sockel/Abdeckboden, Raum.
- `POST /projects/:id/areas`, `POST /projects/:id/areas/:areaId/alternatives`.
- `GET|PUT /alternatives/:id/model-settings`.

**DoD:** Bereich/Alternative anlegen, Modell ändern → Einstellungen persistiert.

---

### Sprint 33 – Onboarding & Lernreise

**Ziel:** Neuer User kann sich selbstständig einrichten – mit Tutorials und Helpdesk-Links.

**Features:**

- Onboarding-Wizard: Nach erstem Login → „Erste Schritte": Shop-Setup, erster Katalog, Testprojekt.
- Lernreise-UI: Step-by-Step mit Icons und CTA-Buttons.
- Benachrichtigungen: „Speichern nicht automatisch – jetzt speichern?".

**DoD:** Neuer User durchläuft Wizard, findet Tutorials, öffnet Support-Centre.

---

### Sprint 34 – Workspace-Layout & Projekt-Details

**Ziel:** Layout anpassbar + Projekt-Details erweitern.

**Features:**

- Workspace-Layout: Speichern/Laden pro User.
- Projekt-Details: Fachberater/Sachbearbeiter zuweisen, Verkäufer (sales_rep) pflegen.
- `PUT /user/workspace-layout`, `PATCH /projects/:id/advisor`.

**DoD:** Berater zuweisen, Workspace-Layout speichern.

---

### Meilenstein Phase 4

| Nach Sprint | Ergebnis |
|-------------|----------|
| 34 | Volle Studio-Praxis: Onboarding, Bereiche, Modellauswahl, Workspace-Layout |

### Risiken Phase 4

1. Bereiche/Alternativen müssen konsistent mit bestehender Raum-/Placement-Logik sein.
2. Onboarding darf bestehende Auth-/User-Flows nicht brechen.
3. Workspace-Layout-Persistenz muss per User/Tenant isoliert bleiben.

---

## Phase 5 – Sprints 41–45: Profi-Parität (Profi-Workflow)

**Ausgangslage (nach Sprint 40):** Vollständige Studio-Plattform inkl. Makros, Arbeitsplattenschemas, Annotationen, Raumdekoration, Lichtprofile und manuelle Angebotszeilen.

**Ziel:** Funktionslücken zu professionellen Küchenstudio-Systemen () schließen. Quelle: Schulungsunterlagen  Teil 1 & 2 (analysiert 2026-03-02).

---

### Sprint 41 – Planungseffizienz: Passstücke, Höhentypen & Sockeloptionen

**Ziel:** Automatisierte Füllstück-Generierung + farbcodierte Höhenzonierung + flexible Sockeloptionen.

**Features:**

- **Passstücke (Filler pieces):** Verbleibende Wandfläche zwischen Schrankreihe und Wand automatisch mit Passst­ück füllen; Fangpunkt-Korrektur wenn Wandabstand aktiv ist; Passstück-Größe folgt verfügbarer Fläche.
- **Höhentypen (farbcodiert):** Unterscheidung von Unterschrank / Oberschrank / Hochschrank per farblicher Markierung in Grundriss und Seitenansicht; Sonderhöhe frei definierbar.
- **Sockeloptionen:** Konfigurierbare Einrückung des Sockels (z. B. 0 mm = bündig zur Korpusvorderkante); gilt gleichzeitig für alle markierten Schränke; Sockeloption pro Alternative persistiert.

**Neues Datenmodell:**
- `filler_pieces` – generierte Passstücke (wall_id, position, width_mm, height_mm, `generated: true`)
- `height_zones` – Zonendefinition (label, color, height_range_mm) pro Planung
- `plinth_options` – Einrückung pro Alternative/Schrank-Gruppe

**Deliverables:** `FillerService`, Höhentypen-Palette in UI, Sockeloption-Dialog, 20 Tests.

**DoD:** Passstück wird bei freier Wandfläche automatisch vorgeschlagen und platziert; Höhentypen sichtbar; Sockel-Einrückung ändert sich sofort in Ansicht.

---

### Sprint 42 – Angebotsworkflow: Schreibschutz, Aufschläge & EK-Nachtrag

**Ziel:** Angebotsversand sperrt Alternative; Negativ-Rabatt-Konvention korrekt implementiert; EK nach Auftragsbestätigung nachtragbar.

**Features:**

- **Schreibschutz nach Angebotsversand:** Erster Ausdruck / erster PDF-Export setzt Alternative auf Status `angebot_gesendet` → schreibgeschützt; nachträgliche Änderungen erzwingen neues Alternativ-Objekt (Branch from locked). UI-Hinweis bei Bearbeitungsversuch.
- **Negativ-Rabatt = Aufschlag:** Im Rabattfeld gilt: positiver Wert = prozentualer Abzug, negativer Wert = prozentualer Aufschlag. Reihenfolge bleibt: Artikel → Warengruppe → Gesamtsumme. UI-Label und Tooltip explizit dokumentieren.
- **EK-Preis nach Auftragsbestätigung:** Workflow: Bestellung drucken → AB vom Hersteller abwarten → EK-Preise pro Position nachtragen. Felder initial leer/gesperrt; entsperrbar nach Statuswechsel `bestellt`. Zeigt realen Bruttogewinn und DB nach EK-Eintrag.
- **Preisberechnung-Anzeige:** Einblendbar: EK, Bruttogewinn (€ + %), Deckungsbeitrag. Toggle pro Angebotsansicht.

**Neues Datenmodell:**
- `alternatives.status` erweitern: `draft | angebot_gesendet | bestellt | abgeschlossen`
- `quote_positions.purchase_price` – nullable, befüllbar nach `bestellt`
- Bestehende Rabattlogik: `discount_value` mit Vorzeichen (negativ = Aufschlag)

**Deliverables:** Status-Machine für Alternative, Lock-Guard in API, EK-Eingabe-UI, 25 Tests.

**DoD:** Alternative nach Versand nicht mehr editierbar ohne Branch; negativer Rabatt addiert Aufschlag korrekt; EK-Felder nach `bestellt` befüllbar; DB wird korrekt angezeigt.

---

### Sprint 43 – UX & Eingabe: Taschenrechner, Favoriten & Vorlagen

**Ziel:** Alltagskomfort im Planer: Rechenketten in Maßfeldern, Favoriten-Filter, Modellvorlagen.

**Features:**

- **Taschenrechnerfunktion in Maßfeldern:** Überall wo Zahlen frei eingegeben werden (Breite, Höhe, Offset, Abstand) können Rechenketten eingegeben werden (z. B. `2500-1632`, `600+150`). Auswertung on-Blur, Fehlerstate bei ungültigem Ausdruck.
- **Favoriten (Artikel & Modelle):** Artikel und Modelle im Katalog als Favorit markierbar (Stern-Icon). Filter „Nur Favoriten" in Katalog-Sidebar. Favoriten per User persistiert.
- **Vorlagen (Modell-Schnellzugriff):** Häufig genutzte Modell-/Indexkonfigurationen als Vorlage speichern und benennen. Vorlagen-Dropdown im Modell-/Indexeinstellungs-Dialog (F7). Makros passen sich automatisch an Modelleinstellungen an, wenn Hersteller identisch; individuelle Änderungen via „Modell wechseln" bleiben erhalten.
- **Planungspfeil-Steuerung:** Planungspfeil rotierbar in 45°-Schritten via Pfeiltasten; Objekte verschieben entlang Blickrichtung des Planungspfeils (wie Achsenbindung).

**Neues Datenmodell:**
- `user_favorites` – (user_id, entity_type, entity_id)
- `model_templates` – (user_id, name, model_settings JSON)

**Deliverables:** `ExpressionInputField`-Komponente, Favoriten-API + UI, Vorlagen-CRUD, Planungspfeil-Tastatursteuerung, 20 Tests.

**DoD:** `2500-1632` in Maßfeld ergibt 868; Favorit gespeichert; Vorlage laden befüllt F7-Dialog; Planungspfeil dreht per Pfeiltaste.

---

### Sprint 44 – Druck & Export: Batchdruck, S/W-Modus & befristeter Link

**Ziel:** Druckworkflow professionalisieren: mehrere Formulare auf einmal, Schwarz/Weiß, zeitbegrenzte Freigabelinks.

**Features:**

- **Batchdrucke:** Mehrere Ausdrucksformulare (Grundriss, Ansichten, Angebot, Installationsplan, …) in einem einzigen PDF-Job zusammenführen und drucken/exportieren. Konfigurierbare Batch-Profile (welche Formulare, welche Reihenfolge).
- **Schwarz/Weiß Druckmodus:** Pro Ansichtsfenster umschaltbar (Rechtsklick → „Schwarz/Weiß anzeigen"). Exportiert Strichzeichnung statt Farbausdruck – ideal für Montageunterlagen.
- **Zeitlich befristeter Share-Link:** Beim Erstellen eines Freigabe-Links Ablaufdatum in Tagen konfigurierbar. Link nach Ablauf ungültig (HTTP 410); kann verlängert werden.
- **Ausdrucksformulare anpassen:** UI zum Erstellen, Bearbeiten, Löschen von Formulartemplates (welche Fenster, Maße, Positionsnummern, Installationsplan ein/aus). Einstellung in Allgemeine Einstellungen → Ausdrucke.

**Neues Datenmodell:**
- `print_batch_profiles` – (name, form_ids[], user_id)
- `share_links.expires_at` – nullable, timestamp

**Deliverables:** Batch-PDF-Service, S/W-Toggle in Ansicht, Link-Ablauf-Logik, Formular-Template-CRUD, 20 Tests.

**DoD:** Batchdruck erzeugt zusammengeführtes PDF; S/W-Export liefert Strichzeichnung; Share-Link nach Ablauf nicht mehr abrufbar; eigenes Formular-Template anwendbar.

---

### Sprint 45 – Erweiterte Planung: Nischenverkleidung, Abdeckboden & Tiefenkürzung

**Ziel:** Spezielle Schranktypen und Maßanpassungen mit korrekter BOM- und Preiswirkung.

**Features:**

- **Nischenverkleidungen:** Eigener Schranktyp „Nischenverkleidung". Prüfregel: seitlicher Überstand der Arbeitsplatte berücksichtigen (bündig planen). Wenn Nischenverkleidung ein Installationsobjekt überdeckt, wird Wandabstand des Installationsobjekts automatisch so weit erhöht, dass es auf der Verkleidungsfläche sitzt.
- **Abdeckboden:** Automatisch auf Highboard-Schränken gesetzt (konfigurierbar). Bei Eigenschaften-Änderung (z. B. Regal verhindert automatischen Abdeckboden) wird nach Korrektur der korrekte (ggf. größere) Abdeckboden neu generiert und entsprechend bestellt.
- **Tiefenkürzung:** Tiefe einzelner Schränke in den Eigenschaften abweichend einstellbar. Löst Mehrpreis-Flag in BOM aus (Kennzeichnung `custom_depth: true`). Unterscheidung: bauseits (Montagekosten) vs. nicht-bauseits (Herstellerkosten bei Arbeitsplatten/Abdeckboden).
- **Ansichtenschnitt Richtungswechsel:** Rechtsklick auf Ansichtenschnitt-Pfeil → „Richtung wechseln" kehrt Blickrichtung auf andere Seite um.

**Neues Datenmodell:**
- `cabinet_properties.custom_depth_mm` – nullable, löst `surcharge_flag: true` in BOM
- `cabinet_properties.cost_type` – enum `bauseits | nicht_bauseits`
- `cover_panels` – generierte Abdeckböden (auto-rebuild-fähig)

**Deliverables:** Nischenverkleidungs-Typ, Abdeckboden-Service mit Rebuild, Tiefenkürzungs-Eigenschaft + BOM-Flag, Richtungswechsel-Kontextmenü, 25 Tests.

**DoD:** Nischenverkleidung verschiebt Installationsobjekt korrekt; Abdeckboden wird nach Eigenschaftskorrektur neu generiert; Tiefenkürzung erzeugt Mehrpreis-Zeile in BOM; Ansichtenschnitt dreht Richtung.

---

### Meilenstein Phase 5

| Nach Sprint | Ergebnis |
|-------------|----------|
| 45 | Profi-Parität: Passstücke, Angebotsworkflow, Taschenrechner, Favoriten, Batchdruck, Nischenverkleidung |

### Risiken Phase 5

1. Schreibschutz-Status-Machine muss atomar sein – kein Race Condition beim gleichzeitigen Drucken.
2. Taschenrechner-Parser darf keine Sicherheitslücken (eval) einführen – eigene Miniparser-Implementierung.
3. Batchdruck-PDFs können bei großen Planungen sehr groß werden – Streaming/Pagination nötig.
4. Nischenverkleidungs-Automatik hängt von stabiler Wandabstand-API ab (Sprint 8 / Sprint 33).
5. Negativ-Rabatt-Konvention muss in UI klar kommuniziert werden – keine stille Fehlbedienung.

---

## Phase 6 – Sprints 46–50: Vernetzte Branchenlösung (Auftragssteuerung, Mobile, ERP, Compliance)

**Ausgangslage (nach Sprint 45):** Profi-Parität hergestellt. Studio-Tool deckt den vollständigen Planungs- und Angebotsworkflow ab.

**Ziel:** OKP zur vernetzten Branchenlösung ausbauen: Produktionssteuerung, mobiler Außendienst, ERP-Anbindung, erweitertes Reporting, DSGVO/SSO/RBAC. Quelle: Copilot-Planungsdokument (PR #9, 2026-03-02).

---

### Sprint 46 – Auftragssteuerung & Produktionsübergabe

**Ziel:** Bestätigtes Angebot erzeugt zwei verknüpfte Entitäten: interne `ProductionOrder` (Produktionsauftrag im Studio) und externe `PurchaseOrder` (Bestellung an den Küchenhersteller).

> **Stand:** `PurchaseOrder` + `PurchaseOrderItem` + 6 API-Routen bereits implementiert (PR #10, gemergt 2026-03-02, +12 Tests). `ProductionOrder` + Freeze-Guard noch ausstehend.

**Features:**

- **PurchaseOrder (Herstellerbestellung) ✅ PR #10:**
  Bestellschein an den Küchenhersteller mit Positionen (SKU, Menge, Preis).
  Status-Lifecycle: `draft → sent → confirmed → partially_delivered → delivered → cancelled`.
  6 CRUD-Endpunkte inkl. Status-Workflow-Übergänge + Notification-Trigger.

- **ProductionOrder (interner Produktionsauftrag):**
  Konvertierung des bestätigten Angebots in einen internen Produktionsauftrag; BOM wird eingefroren (Snapshot).
  Status-Lifecycle: `draft → confirmed → in_production → ready → delivered → installed`.
  Statusübergänge mit Zeitstempel und User-Referenz geloggt.

- **Produktionsübersicht:** Listenansicht aller Aufträge mit Filter nach Status, Fälligkeit, Sachbearbeiter; Drill-down auf Positionen.

- **Freeze-Guard:** Änderungen an Planung/BOM nach Konvertierung blockiert; UI-Hinweis mit Option auf neue Alternative.

- **Verknüpfung:** `PurchaseOrder` referenziert `ProductionOrder`; Status-Updates der Herstellerbestellung aktualisieren den Produktionsauftrag.

**Datenmodell:**
- `purchase_orders` ✅ – (id, status, items[], created_at) – PR #10
- `purchase_order_items` ✅ – (order_id, position, sku, quantity, unit_price) – PR #10
- `production_orders` – (quote_id, bom_snapshot JSON, status, created_at) – ausstehend
- `production_order_events` – Audit-Log (order_id, from_status, to_status, user_id, timestamp) – ausstehend

**Deliverables (ausstehend):** `ProductionOrderService`, Freeze-Guard in API, Produktionsübersicht-UI, Verknüpfung PO↔PurchaseOrder, 15 weitere Tests.

**DoD:** Angebot → Produktionsauftrag konvertiert; BOM-Snapshot unveränderlich; Planungsänderung nach Freeze blockiert; PurchaseOrder mit ProductionOrder verknüpft; Statuswechsel beider Entitäten geloggt.

---

### Sprint 47 – Mobile Aufmaß & Baustellenprotokoll

**Ziel:** Progressive Web App für Außendienst: Aufmaß, Fotos, Installationscheckliste, automatisches Protokoll.

**Features:**

- **Offline-fähige PWA:** Raummaße und Notizen auch ohne Internetverbindung erfassen; Sync beim nächsten Verbindungsaufbau.
- **Foto-Dokumentation:** Kameraintegration im Browser; Fotos werden Projekt/Raum zugeordnet und in S3-kompatiblem Storage abgelegt.
- **Installationscheckliste:** Pro Auftrag konfigurierbare Checkliste (Mängel, Abnahmen); Häkchen + Freitext + Foto je Position.
- **PDF-Protokoll-Generierung:** Abnahmeprotokoll automatisch aus Checkliste + Fotos generieren und als Dokument am Projekt ablegen.

**Neues Datenmodell:**
- `site_surveys` – (project_id, measurements JSON, photos[], notes, synced_at)
- `installation_checklists` – (order_id, items[], completed_at)
- `checklist_items` – (checklist_id, label, checked, photo_url, note)

**Deliverables:** PWA-Manifest + Service Worker, Foto-Upload-Pipeline, Checklisten-CRUD, Protokoll-PDF-Generator, 20 Tests.

**DoD:** Aufmaß offline erfasst und nach Sync am Projekt sichtbar; Protokoll-PDF aus Checkliste generierbar; Fotos abrufbar.

---

### Sprint 48 – ERP-Anbindung & Lieferantenportal

**Ziel:** Bestehende `PurchaseOrder` (Sprint 46) um ERP-Konnektoren erweitern: automatische Übertragung an externe Systeme, Webhook-Rückmeldung, Lieferantenportal.

**Features:**

- **ERP-Konnektor-Framework:** Konfigurierbare Konnektoren (Endpunkt, Auth, Feldmapping); unterstützt REST + Webhook-Push. Überträgt `PurchaseOrder`-Daten automatisch ins ERP des Herstellers.
- **Artikel-Mapping:** Katalog-Artikelnummer ↔ ERP-Artikelnummer pro Konnektor konfigurierbar.
- **Lieferantenportal (Light):** Eigene Ansicht für Lieferanten: offene `PurchaseOrders` einsehen, Lieferdatum bestätigen, AB hochladen.
- **Status-Rückübermittlung:** ERP liefert AB und Lieferstatus als Webhook zurück → aktualisiert `purchase_order.status` und triggert Notification an Studio.

**Neues Datenmodell:**
- `erp_connectors` – (tenant_id, name, endpoint, auth_config JSON, field_mapping JSON)
- `purchase_orders.erp_order_ref` – nullable, befüllt nach ERP-Übertragung

**Deliverables:** Konnektor-CRUD, ERP-Push-Service, Lieferantenportal-View, Webhook-Empfänger, 25 Tests.

**DoD:** PurchaseOrder wird via Konnektor ins ERP übertragen; AB-Webhook aktualisiert Status; Lieferant sieht offene Bestellungen im Portal.

---

### Sprint 49 – Erweiterte Analytics & individuelle Reports

**Ziel:** Report-Builder mit Drill-down, Trichteranalyse und geplanter E-Mail-Verteilung.

**Features:**

- **Report-Builder:** Konfigurierbare Dimensionen (Zeitraum, Branch, Verkäufer, Warengruppe) und Metriken (Umsatz, DB, Conversion); Ergebnis als Tabelle oder Chart.
- **5 Standard-Reports:** Umsatz/Zeitraum, Trichter Lead→Angebot→Auftrag, Durchlaufzeiten, Top-Warengruppen, Verkäufer-Ranking.
- **Drill-down:** Klick auf Aggregat öffnet Detailliste der zugehörigen Datensätze.
- **Geplante Verteilung:** Reports per Cron (täglich/wöchentlich/monatlich) als PDF oder Excel per E-Mail versenden.

**Neues Datenmodell:**
- `report_definitions` – (tenant_id, name, dimensions[], metrics[], filters JSON)
- `report_schedules` – (report_id, cron_expression, recipients[], format)
- `report_runs` – (schedule_id, generated_at, file_url)

**Deliverables:** Report-Builder-UI, 5 vordefinierte Report-Templates, Drill-down-Navigation, Schedule-CRUD + Cron-Job, PDF/Excel-Export, 20 Tests.

**DoD:** Custom-Report konfiguriert und gespeichert; Standard-Reports aufrufbar; Drill-down zeigt Einzeldatensätze; Versand per Schedule funktioniert.

---

### Sprint 50 – Compliance, Plattformhärtung & SLA-Management

**Ziel:** DSGVO-Tooling, SSO/SAML 2.0, granulares RBAC, SLA-Monitoring.

**Features:**

- **DSGVO-Workflow:** Datenlöschung auf Anfrage (Right to be forgotten): alle personenbezogenen Daten eines Kontakts/Projekts identifizieren, anonymisieren oder löschen; Nachweis-Log.
- **Datenexport (Art. 20 DSGVO):** Alle Daten eines Nutzers/Kontakts als strukturiertes JSON exportierbar.
- **SSO / SAML 2.0:** Konfigurierbare Identity-Provider-Anbindung; Fallback auf lokale Auth falls IdP nicht erreichbar.
- **Granulares RBAC:** Rollen und Berechtigungen auf Branch-Ebene definierbar (z. B. Verkäufer darf nur eigene Projekte sehen).
- **SLA-Monitoring:** Uptime-Indikatoren, Antwortzeit-Tracking pro API-Endpunkt, Alert bei SLA-Verletzung; Dashboard-Widget.

**Neues Datenmodell:**
- `gdpr_deletion_requests` – (contact_id, requested_at, completed_at, performed_by)
- `sso_providers` – (tenant_id, entity_id, sso_url, certificate)
- `role_permissions` – (role, resource, action, branch_id nullable)
- `sla_snapshots` – (endpoint, p50_ms, p95_ms, uptime_pct, recorded_at)

**Deliverables:** DSGVO-Lösch-/Export-Flow, SSO-Konfiguration + Fallback, RBAC-Admin-UI, SLA-Dashboard-Widget, Vollständiges Audit-Log, 30 Tests.

**DoD:** Löschanfrage vollständig anonymisiert Datensätze + Nachweis; SSO-Login mit externem IdP funktioniert; Branch-RBAC greift; SLA-Widget zeigt aktuelle Werte.

---

### Meilenstein Phase 6

| Nach Sprint | Ergebnis |
|-------------|----------|
| 50 | Vernetzte Branchenlösung: Auftragssteuerung, Mobile Feldarbeit, ERP-Anbindung, erweitertes Reporting, DSGVO/SSO/RBAC |

### Risiken Phase 6

1. ERP-Heterogenität: Jedes ERP hat andere Datenmodelle – Konnektor-Framework muss flexibel genug sein ohne unkontrollierbare Komplexität.
2. Offline-Sync-Konflikte in der PWA: Gleichzeitige Bearbeitung am Tablet und im Browser muss deterministisch aufgelöst werden.
3. PDF-Generierung bei großen Reports kann Laufzeit-Probleme erzeugen – asynchrone Job-Queue nötig.
4. Kaskadierende DSGVO-Löschungen können referenzielle Integrität brechen – Anonymisierungs-Strategie statt Hard-Delete bevorzugen.
5. SSO-Fallback-Sicherheit: Lokale Auth darf nicht als Backdoor fungieren – MFA-Pflicht für Fallback.
6. SLA-Snapshot-Datenmenge: Langfristige Retention-Strategie (Aggregation, TTL) für Monitoring-Daten definieren.
