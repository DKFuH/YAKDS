# AGENT_SPRINTS - Sprint Index

Stand: 2026-03-11

---

## Status

- Sprints `S47` bis `S107`: `done`
- Sprint `S108`: `done`
- Zwischensprints `S108a` bis `S108f` (SH3D): `done`
- Sprint `S109`: `done`
- S109 Foundation: `S109-fluent2-ui-foundation.md` `done`
- RC-Tag fuer S109: `rc-s109-ui-shell-hardening`
- Sprint `S110`: `done` (Full Fluent2 Migration + Ribbon-Menueband)
- Sprint `S117`: `done` (CAD-Interop Provider-Schnitt, Phase 1)
- Sprint `S118`: `in_progress` (CAD-Interop Ausbau und Provider-Plugin-System)
- Sprint `S121`: `planned` (Tenant-Scope und Produktkern-Recovery)
- Sprint `S122`: `planned` (Editor-Goldpfade und Room-Bootstrap)
- Sprint `S123`: `planned` (Browser-CI-Gates und Shell-Regressionen)
- Projektname in den Spezifikationen: `OKP`

Review-Hinweis 2026-03-11:

- Die Laufzeitpruefung auf dem lokalen Frontend (`:5173`) und auf einer isolierten Review-Instanz hat Widersprueche zwischen Doku und Realitaet gezeigt.
- `S109` und `S110` bleiben historisch `done`, haben aber aktuelle Runtime-Regressionen in Browser und Playwright.
- `S118` bleibt fachlich sinnvoll, ist aber gegenwaertig von Kernproblemen in Tenant-Scoping, Produktpfad und Browser-Gates blockiert.

---

## Sprint-Dateien

| Sprint | Datei | Status |
|--------|-------|--------|
| 47 | `S47-mobile-aufmass.md` | done |
| 48 | `S48-erp-connector.md` | done |
| 49 | `S49-analytics-reports.md` | done |
| 50 | `S50-compliance-rbac.md` | done |
| 51 | `S51-gltf-export.md` | done |
| 52 | `S52-ifc-import-export.md` | done |
| 53 | `S53-dwg-skp.md` | done |
| 54 | `S54-ofml-konfigurator.md` | done |
| 55 | `S55-raumakustik.md` | done |
| 56 | `S56-canvas-ux.md` | done |
| 57 | `S57-wall-attachments.md` | done |
| 58 | `S58-bild-nachzeichnen.md` | done |
| 59 | `S59-bemassung-frontansicht.md` | done |
| 60 | `S60-katalog-kitchen-assistant.md` | done |
| 61 | `S61-angebots-pdf-firmenprofil.md` | done |
| 62 | `S62-mcp-planungsassistent.md` | done |
| 63 | `S63-smarte-bemassung-centerlines.md` | done |
| 64 | `S64-layout-sheets-detail-views.md` | done |
| 65 | `S65-zuschnittliste-cutlist.md` | done |
| 66 | `S66-cnc-nesting-dxf-export.md` | done |
| 67 | `S67-annotative-layout-styles.md` | done |
| 68 | `S68-constraint-modus-driving-dimensions.md` | done |
| 69 | `S69-panorama-multipoint-client-tour.md` | done |
| 70 | `S70-spezifikationsblaetter-werkstattpaket.md` | done |
| 71 | `S71-gebogene-waende-2d-kern.md` | done |
| 72 | `S72-bogen-bemassung-layout.md` | done |
| 73 | `S73-bogen-3d-interop.md` | done |
| 74 | `S74-split-view-virtual-visitor.md` | done |
| 75 | `S75-modell-import-asset-browser-light.md` | done |
| 76 | `S76-render-ux-praesentationsmodus.md` | done |
| 77 | `S77-nordkompass-sonnenstand-tageslicht.md` | done |
| 78 | `S78-textur-materialbibliothek.md` | done |
| 79 | `S79-offline-pwa-und-aufmass-import.md` | done |
| 80 | `S80-html-viewer-und-vektor-exporte.md` | done |
| 81 | `S81-mehr-ebenen-projektmodell.md` | done |
| 82 | `S82-treppen-und-vertikale-verbindungen.md` | done |
| 83 | `S83-mehr-ebenen-layout-sektionen-interop.md` | done |
| 84 | `S84-i18n-core-und-locale-switcher.md` | done |
| 85 | `S85-language-packs-und-uebersetzungsverwaltung.md` | done |
| 86 | `S86-mehrsprachige-dokumente-und-shares.md` | done |
| 87 | `S87-navigation-ux-und-input-profile.md` | done |
| 88 | `S88-locking-visibility-safe-edit.md` | done |
| 89 | `S89-browser-favoriten-ordner-kollektionen.md` | done |
| 90 | `S90-cad-gruppen-bauteile-auswahlsets.md` | done |
| 91 | `S91-dokumente-pdf-archiv-versionierung.md` | done |
| 92 | `S92-projektarchiv-kontakte-shop-defaults.md` | done |
| 93 | `S93-katalogversionen-index-sharing-aufschlaege.md` | done |
| 94 | `S94-bestellstatus-positionsnummern-sperranzeige.md` | done |
| 95 | `S95-raumaufmass-json-import.md` | done |
| 96 | `S96-mwst-skonto-zusatzartikel-profile.md` | done |
| 97 | `S97-pos-aufmassservice-import-plugin.md` | done |
| 98 | `S98-stabilisierungsphase.md` | done |
| 99 | `S99-workflow-engine-bpmn-light.md` | done |
| 100 | `S100-masterdata-registry-sync.md` | done |
| 101 | `S101-mobile-status-client.md` | done |
| 102 | `S102-process-reporting-dashboards.md` | done |
| 103 | `S103-erp-integration-hooks-datev.md` | done |
| 104 | `S104-interaktive-elevation-section-view.md` | done |
| 105 | `S105-automatische-wandtransparenz-dollhouse.md` | done |
| 106 | `S106-kamera-fov-und-presets.md` | done |
| 107 | `S107-skybox-hdri-renderumgebung.md` | done |
| 108 | `S108-one-click-screenshot-und-360-export.md` | done |
| 108a | `S108a-sh3d-snap-modifier-hardening.md` | done |
| 108b | `S108b-sh3d-mode-action-insert-orchestrierung.md` | done |
| 108c | `S108c-sh3d-preferences-persistenz.md` | done |
| 108d | `S108d-sh3d-wall-topologie-robustheit.md` | done |
| 108e | `S108e-sh3d-room-validation-autofix.md` | done |
| 108f | `S108f-sh3d-dimension-assist-und-multiview.md` | done |
| 109 | `S109-ui-workflow-und-cad-toolbox.md` | done |
| 110 | `S110-post-s109-hardening-und-ci-gates.md` | done |
| 117 | `S117-cad-interop-provider-schnitt.md` | done |
| 118 | `S118-cad-interop-ausbau-und-provider-plugin.md` | in_progress |
| 121 | `S121-tenant-scope-und-produktkern-recovery.md` | planned |
| 122 | `S122-editor-goldene-pfade-und-room-bootstrap.md` | planned |
| 123 | `S123-browser-ci-gates-und-shell-regressionen.md` | planned |
