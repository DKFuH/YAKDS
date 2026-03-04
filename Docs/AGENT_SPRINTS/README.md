# AGENT_SPRINTS - Sprint-Dokumentation

Sprints `S47` bis `S81` sind implementiert und gemergt.

Stand: 2026-03-04

---

## Sprint-Uebersicht

| Sprint | Datei | Status | Commit | Tests |
|--------|-------|--------|--------|-------|
| 47 | `S47-mobile-aufmass.md` | done | `ab83788` | +15 |
| 48 | `S48-erp-connector.md` | done | `ab83788` | +10 |
| 49 | `S49-analytics-reports.md` | done | `ab83788` | +15 |
| 50 | `S50-compliance-rbac.md` | done | `ab83788` | +12 |
| 51 | `S51-gltf-export.md` | done | `ab83788` | +5 |
| 52 | `S52-ifc-import-export.md` | done | `a7f8758` | +10 |
| 53 | `S53-dwg-skp.md` | done | `b4e7db7` | +12 |
| 54 | `S54-ofml-konfigurator.md` | done | `b4e7db7` | +22 |
| 55 | `S55-raumakustik.md` | done | `27f3f69` | +14 |
| 56 | `S56-canvas-ux.md` | done | `ab83788` | Frontend |
| 57 | `S57-wall-attachments.md` | done | `def4c96` | +5 |
| 58 | `S58-bild-nachzeichnen.md` | done | `411028b` | +3 |
| 59 | `S59-bemassung-frontansicht.md` | done | `299276a` | +10 |
| 60 | `S60-katalog-kitchen-assistant.md` | done | `299276a` | +15 |
| 61 | `S61-angebots-pdf-firmenprofil.md` | done | `584ee9b` | +8 |
| 62 | `S62-mcp-planungsassistent.md` | done | `8de198f` | +26 |
| 63 | `S63-smarte-bemassung-centerlines.md` | done | `f396864` | +53 |
| 64 | `S64-layout-sheets-detail-views.md` | done | `4ad81e3` | +10 |
| 65 | `S65-zuschnittliste-cutlist.md` | done | `6b7b81c` | +11 |
| 66 | `S66-cnc-nesting-dxf-export.md` | done | `24f4cbc` | +16 |
| 67 | `S67-annotative-layout-styles.md` | done | `867fff9` | +16 |
| 68 | `S68-constraint-modus-driving-dimensions.md` | done | `b01b007` | +10 |
| 69 | `S69-panorama-multipoint-client-tour.md` | done | `local` | +6 |
| 70 | `S70-spezifikationsblaetter-werkstattpaket.md` | done | `local` | +4 |
| 71 | `S71-gebogene-waende-2d-kern.md` | done | `local` | +9 |
| 72 | `S72-bogen-bemassung-layout.md` | done | `local` | +39 |
| 73 | `S73-bogen-3d-interop.md` | done | `local` | +8 |
| 74 | `S74-split-view-virtual-visitor.md` | done | `local` | +10 |
| 75 | `S75-modell-import-asset-browser-light.md` | done | `local` | +12 |
| 76 | `S76-render-ux-praesentationsmodus.md` | done | `local` | +8 |
| 77 | `S77-nordkompass-sonnenstand-tageslicht.md` | done | - | - |

---

## Technische Rahmenbedingungen

- **Backend:** Fastify v5, Prisma 5, Zod, TypeScript, Vitest
- **Frontend:** React 18, React Router v6, CSS Modules, Konva
- **API-Prefix:** `/api/v1`
- **Error-Helpers:** `sendBadRequest(reply, msg)`, `sendNotFound(reply, msg)` aus `../errors.js`
- **Prisma-Client:** `import { prisma } from '../db.js'`
- **API-Client (Frontend):** `import { api } from './client.js'`

---

## Vorbereiteter Backlog

| Sprint | Datei | Status | Thema |
|--------|-------|--------|-------|
| 67 | `S67-annotative-layout-styles.md` | done | Annotative Layout-Stile, massstabsstabile Masse und Symbole |
| 68 | `S68-constraint-modus-driving-dimensions.md` | done | Constraint-Modus und Driving Dimensions fuer Waende und Placements |
| 69 | `S69-panorama-multipoint-client-tour.md` | done | Multi-Point-Panorama und oeffentliche Client-Touren |
| 70 | `S70-spezifikationsblaetter-werkstattpaket.md` | done | Spezifikationsblaetter und Werkstattpakete aus Quote, BOM, Cutlist und Nesting |
| 71 | `S71-gebogene-waende-2d-kern.md` | done | Gebogene Waende als eigener 2D-Geometrietyp mit Oeffnungen und Snap-Logik |
| 72 | `S72-bogen-bemassung-layout.md` | done | Radius-, Bogenlaengen- und Sehnenmasse in Sheets und Detailansichten |
| 73 | `S73-bogen-3d-interop.md` | done | Gebogene Waende in 3D, GLTF, IFC und DXF/DWG-Interop |
| 74 | `S74-split-view-virtual-visitor.md` | done | Split-View im Editor und synchroner Virtual Visitor zwischen 2D und 3D |
| 75 | `S75-modell-import-asset-browser-light.md` | done | Plugin `asset-library`: OBJ/DAE-Import, Bounding-Box/Auto-Scale und Asset-Browser |
| 76 | `S76-render-ux-praesentationsmodus.md` | done | Plugin `presentation`: Render-Presets und Praesentationsmodus |
| 77 | `S77-nordkompass-sonnenstand-tageslicht.md` | done | Plugin `daylight`: Nordkompass, Sonnenstand und Tageslichtsteuerung |
| 78 | `S78-textur-materialbibliothek.md` | done | Plugin `materials`: Textur- und Materialbibliothek fuer Flaechen und Assets |
| 79 | `S79-offline-pwa-und-aufmass-import.md` | done | Core-PWA plus Plugin `survey-import` fuer mobilen Aufmass-/Blueprint-Import |
| 80 | `S80-html-viewer-und-vektor-exporte.md` | done | Plugin `viewer-export`: HTML-Webviewer und SVG-/Vektor-Exporte |
| 81 | `S81-mehr-ebenen-projektmodell.md` | done | Mehr-Ebenen-Projekte mit Levels, Sichtbarkeit und level-spezifischen Raeumen |
| 82 | `S82-treppen-und-vertikale-verbindungen.md` | planned | Plugin `stairs`: Treppen, Treppenaugen und vertikale Verbindungen |
| 83 | `S83-mehr-ebenen-layout-sektionen-interop.md` | planned | Plugin `multilevel-docs`: Mehr-Ebenen-Sheets, Vertikalschnitte und Export-Metadaten |
| 84 | `S84-i18n-core-und-locale-switcher.md` | planned | Core-i18n, Language Switcher und locale-aware Formatierung |
| 85 | `S85-language-packs-und-uebersetzungsverwaltung.md` | planned | Sprachpakete und tenant-spezifische Uebersetzungsverwaltung |
| 86 | `S86-mehrsprachige-dokumente-und-shares.md` | planned | Mehrsprachige PDFs, Exporte, Viewer und Shares |
| 87 | `S87-navigation-ux-und-input-profile.md` | planned | Navigation-UX, CAD-Profil, Touchpad- und MMB-Steuerung |
| 88 | `S88-locking-visibility-safe-edit.md` | planned | Locking, Visibility und Safe-Edit fuer Level, Maße und Objekte |
| 89 | `S89-browser-favoriten-ordner-kollektionen.md` | planned | Favoriten, Ordner und Kollektionen fuer Asset- und Materialbrowser |
| 90 | `S90-cad-gruppen-bauteile-auswahlsets.md` | planned | CAD-Gruppen, Bauteile und Auswahlsets fuer Zeichnungselemente |
| 91 | `S91-dokumente-pdf-archiv-versionierung.md` | planned | Dokumente, PDF-Archiv und Versionssicherung |
| 92 | `S92-projektarchiv-kontakte-shop-defaults.md` | planned | Projektarchiv, Kontakte und tenantweite Standardwerte |
| 93 | `S93-katalogversionen-index-sharing-aufschlaege.md` | planned | Katalogversionen, Index-Sharing und Lieferantenaufschlaege |
| 94 | `S94-bestellstatus-positionsnummern-sperranzeige.md` | planned | Bestellstatus, Positionsnummern und Sperranzeige |
| 95 | `S95-room-survey-json-import.md` | planned | Room-Survey-Import und robuste JSON-Interop |
| 96 | `S96-mwst-skonto-zusatzartikel-profile.md` | planned | MwSt-, Skonto- und Zusatzartikel-Profile |
| 97 | `S97-egi-aufmassservice-import-plugin.md` | planned | Plugin `survey-import`: EGI-Aufmassservice-Import fuer Waende, Oeffnungen und Installationen |
