# TASKS_CODEX.md

## Aufgaben für Codex

**Zuständigkeit:** Polygonalgorithmen, Kollisionserkennung, Validatoren, Preisregeln, BOM-Berechnung, Import-/Export-Mapping, Tests, kleine isolierte Module

> **Hinweis zu Prompts:** Jeden Prompt als erstes in Codex eingeben. Danach relevante Dateien aus `shared-schemas/src/` und `Docs/ROOM_MODEL.md` als Kontext anhängen.

---

## TASK-3-C01 – Polygon-Validierung

**Sprint:** 3 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] Selbstüberschneidungs-Check (Segment-Segment-Intersection)
- [ ] Mindestkantenlänge prüfen (konfigurierbar, z. B. 100 mm)
- [ ] Geschlossener Ring validieren (erster = letzter Punkt)
- [ ] Funktion: `validatePolygon(vertices: Vertex[]): ValidationResult`
- [ ] Unit-Tests für alle Fehlerfälle

### Codex-Prompt
```
Du implementierst ein isoliertes TypeScript-Modul für einen webbasierten Küchenplaner.

Aufgabe: Polygon-Validierung in `shared-schemas/src/geometry/validatePolygon.ts`

Typen (bereits vorhanden in shared-schemas/src/types.ts):
  interface Vertex { id: string; x_mm: number; y_mm: number; index: number }
  interface ValidationResult { valid: boolean; errors: string[] }

Implementiere:
1. validatePolygon(vertices: Vertex[], minEdgeLengthMm = 100): ValidationResult
   - Prüfe: mind. 3 Punkte
   - Prüfe: kein Segment schneidet ein anderes (Segment-Intersection-Algorithmus)
   - Prüfe: alle Kantenlängen >= minEdgeLengthMm
   - Prüfe: Polygon ist geschlossen (letzter Punkt = erster Punkt ODER wird automatisch geschlossen)

2. Unit-Tests in validatePolygon.test.ts (vitest):
   - Valides Rechteck
   - Valides L-förmiges Polygon (6 Ecken)
   - Selbstüberschneidendes Polygon → Fehler
   - Zu kurze Kante → Fehler
   - Nur 2 Punkte → Fehler

Keine Abhängigkeiten außer Vanilla TypeScript. Keine Klassen, nur pure Funktionen.
```

---

## TASK-3-C02 – Polygon-Rendering auf Canvas

**Sprint:** 3 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] Polygon aus `Vertex[]` rendern (Konva.js oder reines Canvas)
- [ ] Snap auf 0°/45°/90° beim Punkte setzen
- [ ] Raster-Snap (konfigurierbarer Abstand)
- [ ] Unit-Tests für Snap-Funktionen

### Codex-Prompt
```
Du implementierst Hilfsmodule für den 2D-Canvas-Editor eines Küchenplaners (React + Konva.js).

Aufgabe: Snap-Logik in `planner-frontend/src/editor/snapUtils.ts`

Implementiere (pure Funktionen, kein React/Konva-Import):
1. snapToAngle(point: Point2D, origin: Point2D, allowedAngles: number[]): Point2D
   - Projiziert `point` auf den nächstgelegenen erlaubten Winkel (0, 45, 90, 135, 180, 225, 270, 315°)
   - Gibt den projizierten Punkt zurück

2. snapToGrid(point: Point2D, gridSizeMm: number): Point2D
   - Rundet x_mm und y_mm auf nächsten Gitterpunkt

3. snapPoint(point: Point2D, origin: Point2D | null, gridSizeMm: number, angleSnap: boolean): Point2D
   - Kombiniert snapToGrid und snapToAngle (angleSnap nur wenn origin vorhanden)

Typen:
  interface Point2D { x_mm: number; y_mm: number }

Unit-Tests in snapUtils.test.ts (vitest):
- snapToAngle: Punkt bei 47° → snapped auf 45°
- snapToGrid: 1234 mm → 1200 mm bei 100mm Raster
- Kombination beider Snaps
```

---

## TASK-4-C01 – Vertex-Verschiebung und Kantenlängenberechnung

**Sprint:** 4 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `moveVertex(polygon, index, newPos): Polygon`
- [ ] `setEdgeLength(polygon, edgeIndex, lengthMm): Polygon`
- [ ] `polylineToRoomBoundary(polyline): RoomBoundary`
- [ ] Unit-Tests

### Codex-Prompt
```
Du implementierst Geometrie-Editierfunktionen für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/polygonEditor.ts`

Kontext: Raummodell siehe Docs/ROOM_MODEL.md (Vertices sind mm-Koordinaten, wall_id ist stabil).

Implementiere:
1. moveVertex(vertices: Vertex[], index: number, newPos: Point2D): Vertex[]
   - Verschiebt Vertex an Position index
   - Alle anderen Vertices bleiben unverändert
   - Gibt neues Array zurück (immutabel)

2. setEdgeLength(vertices: Vertex[], edgeIndex: number, newLengthMm: number): Vertex[]
   - Ändert Länge der Kante zwischen vertices[edgeIndex] und vertices[edgeIndex+1]
   - Verschiebt den END-Vertex entlang der Kantenrichtung
   - Alle anderen Vertices bleiben unverändert

3. polylineToRoomBoundary(points: Point2D[]): { vertices: Vertex[]; }
   - Konvertiert eine CAD-Polylinie in Vertex-Array
   - Generiert stabile UUIDs (crypto.randomUUID())
   - Schließt den Ring wenn nötig (letzter Punkt ≠ erster Punkt → Punkt hinzufügen)

Unit-Tests (vitest) für alle 3 Funktionen inklusive Edge Cases.
Pure Funktionen, kein Framework.
```

---

## TASK-5-C01 – Öffnungs-Validierung

**Sprint:** 5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `validateOpening(wall, opening): ValidationResult`
- [ ] `detectOpeningsFromCad(cadLayer): OpeningCandidate[]`
- [ ] Unit-Tests

### Codex-Prompt
```
Du implementierst Öffnungsvalidierung für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/openingValidator.ts`

Typen (aus Docs/ROOM_MODEL.md):
  interface WallSegment { id: string; length_mm: number; ... }
  interface Opening { id: string; wall_id: string; offset_mm: number; width_mm: number; ... }
  interface ValidationResult { valid: boolean; errors: string[] }
  interface CadEntity { type: string; geometry: any; }
  interface OpeningCandidate { offset_mm: number; width_mm: number; confidence: 'high'|'low'; }

Implementiere:
1. validateOpening(wall: WallSegment, opening: Opening, existingOpenings: Opening[]): ValidationResult
   - Regel: offset_mm >= 0
   - Regel: offset_mm + width_mm <= wall.length_mm
   - Regel: Öffnung überschneidet keine existierende Öffnung (1D-Intervall-Check)

2. detectOpeningsFromCad(entities: CadEntity[], wallLength_mm: number): OpeningCandidate[]
   - Sucht Lücken zwischen Liniensegmenten auf einer Wand
   - Lücken zwischen Linien-Endpoints gelten als Öffnungskandidaten
   - Mindestbreite 500 mm, Maximalbreite 3000 mm

Unit-Tests (vitest) für beide Funktionen.
```

---

## TASK-6-C01 – Höhenberechnung (Dachschrägen)

**Sprint:** 6 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `getAvailableHeight(constraints, point): number`
- [ ] Mehrere Constraints → Minimum
- [ ] Unit-Tests mit verschiedenen Dachgeometrien

### Codex-Prompt
```
Du implementierst Dachschrägen-Höhenberechnung für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/ceilingHeight.ts`

Typen:
  interface CeilingConstraint {
    wall_id: string;
    wall_start: Point2D;   // Weltkoordinate des Wandanfangs
    wall_end: Point2D;     // Weltkoordinate des Wandendes
    kniestock_height_mm: number;
    slope_angle_deg: number;
    depth_into_room_mm: number;
  }
  interface Point2D { x_mm: number; y_mm: number }

Formel (aus Docs/ROOM_MODEL.md):
  d = senkrechter Abstand von point zur Wand
  if d >= depth_into_room_mm: available = nominal_ceiling_height
  else: available = kniestock_height_mm + tan(slope_angle_deg_in_rad) * d

Implementiere:
1. getHeightAtPoint(constraint: CeilingConstraint, point: Point2D, nominalCeilingMm: number): number
   - Berechnet verfügbare Höhe für eine einzelne Schräge

2. getAvailableHeight(constraints: CeilingConstraint[], point: Point2D, nominalCeilingMm: number): number
   - Gibt Minimum über alle Constraints zurück
   - Wenn keine Constraints: gibt nominalCeilingMm zurück

Unit-Tests (vitest):
- Punkt direkt an Wand (Kniestock)
- Punkt jenseits der Tiefe (volle Höhe)
- Punkt in der Mitte (interpoliert)
- Mehrere Schrägen: Minimum korrekt
```

---

## TASK-8-C01 – Wandbasierte Platzierungsalgorithmen

**Sprint:** 8 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `getWallInnerDirection(wall, polygon): Vector2D`
- [ ] `snapToWall(dragPos, wall): number`
- [ ] `getPlacementPosition(wall, offsetMm): Point2D`
- [ ] `canPlaceOnWall(wall, offset, width, existingPlacements): boolean`
- [ ] Unit-Tests für gerade und schräge Wände

### Codex-Prompt
```
Du implementierst die Platzierungs-Mathematik für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/wallPlacement.ts`

Kontext: Objekte werden an Wänden platziert via wall_id + offset_mm.
Die Wand hat einen Anfang (start) und ein Ende (end) als 2D-Weltkoordinaten.
Das Polygon ist CCW orientiert, daher zeigt die Innenrichtung nach rechts von start→end.

Implementiere:
1. getWallDirection(wall: WallSegment2D): Vector2D
   - Normalisierter Richtungsvektor start → end

2. getWallInnerNormal(wall: WallSegment2D, polygon: Point2D[]): Vector2D
   - Berechnet Innenrichtung (Normale, die ins Polygon zeigt)
   - Test: Mittelpunkt + Normal * 10mm muss innerhalb des Polygons liegen (Point-in-Polygon)

3. getPlacementWorldPos(wall: WallSegment2D, offsetMm: number): Point2D
   - Weltkoordinate des Objektmittelpunkts an offset auf der Wand

4. snapToWall(dragWorldPos: Point2D, wall: WallSegment2D): number
   - Projiziert dragWorldPos auf die Wand → gibt Offset in mm zurück
   - Geclampt auf [0, wall.length_mm]

5. canPlaceOnWall(wall: WallSegment2D, offsetMm: number, widthMm: number, existing: PlacedItem[]): boolean
   - Prüft ob [offset, offset+width] frei ist (keine Überlappung mit existing)

Typen selbst minimal definieren.
Unit-Tests (vitest) für alle 5 Funktionen.
```

---

## TASK-9-C01 – Kollisionsdetektions-Algorithmen

**Sprint:** 9 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] Object-vs-Object, Object-außerhalb-Raum, Object-vs-Opening
- [ ] Mindestabstände, ungültiger Wandbereich
- [ ] Hinweise: Sonderblende, Sonderzuschnitt, Montageaufwand
- [ ] Unit-Tests für alle Kollisionstypen

### Codex-Prompt
```
Du implementierst Kollisionserkennung für einen Küchenplaner.
Datei: `shared-schemas/src/validation/collisionDetector.ts`

Typen (vereinfacht):
  interface PlacedObject { id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm: number; height_mm: number; }
  interface Opening { wall_id: string; offset_mm: number; width_mm: number; }
  interface RuleViolation { severity: 'error'|'warning'|'hint'; code: string; message: string; affected_ids: string[]; }

Implementiere als pure Funktionen:
1. checkObjectOverlap(a: PlacedObject, b: PlacedObject): RuleViolation | null
   - Nur für Objekte an derselben Wand: 1D-Intervall-Overlap
   - code: 'OBJECT_OVERLAP'

2. checkObjectInRoom(obj: PlacedObject, roomPolygon: Point2D[]): RuleViolation | null
   - Prüft ob Objektfußpunkt im Polygon liegt (Point-in-Polygon)
   - code: 'OBJECT_OUTSIDE_ROOM'

3. checkObjectVsOpening(obj: PlacedObject, openings: Opening[]): RuleViolation | null
   - Prüft ob Objekt eine Öffnung blockiert (gleiche Wand, Intervall-Overlap)
   - code: 'OBJECT_BLOCKS_OPENING'

4. checkMinClearance(obj: PlacedObject, others: PlacedObject[], minMm: number): RuleViolation | null
   - Mindestabstand zwischen Objektenden
   - code: 'MIN_CLEARANCE_VIOLATED'

5. detectCostHints(obj: PlacedObject, wall: WallSegment2D, openings: Opening[]): RuleViolation[]
   - Hint: Sonderblende nötig (Objekt endet nicht bündig mit Wand/Nachbarobjekt)
   - Hint: erhöhter Montageaufwand (schräge Wand, Winkel > 10° von 90°)
   - severity: 'hint'

Unit-Tests (vitest) für alle 5 Funktionen inkl. Grenzfälle.
```

---

## TASK-10-C01 – Höhenprüfung gegen Dachschrägen

**Sprint:** 10 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `checkHeightVsConstraints(obj, constraints): HeightViolation[]`
- [ ] Flags: `requires_customization`, `height_variant`, `labor_surcharge`
- [ ] Unit-Tests

### Codex-Prompt
```
Du implementierst Höhenprüfung gegen Dachschrägen für einen Küchenplaner.
Datei: `shared-schemas/src/validation/heightChecker.ts`

Nutze die Funktion getAvailableHeight aus TASK-6-C01 (shared-schemas/src/geometry/ceilingHeight.ts).

Typen:
  interface PlacedObject { id: string; type: 'base'|'wall'|'tall'|'appliance'; height_mm: number; worldPos: Point2D; }
  interface HeightViolation extends RuleViolation {
    available_mm: number;
    required_mm: number;
    flags: { requires_customization: boolean; height_variant: string|null; labor_surcharge: boolean; }
  }

Implementiere:
1. checkObjectHeight(obj: PlacedObject, constraints: CeilingConstraint[], nominalCeilingMm: number): HeightViolation | null
   - Berechnet verfügbare Höhe am Objektstandort (getAvailableHeight)
   - Wenn obj.height_mm > available: Violation erzeugen
   - code: 'HEIGHT_EXCEEDED' für Hochschränke
   - code: 'HANGING_CABINET_SLOPE_COLLISION' für Hängeschränke
   - Flags setzen:
     * requires_customization: true wenn Höhe > 50mm überschritten
     * height_variant: 'low_version' wenn Alternative sinnvoll (< 200mm Überschreitung)
     * labor_surcharge: true wenn Anpassung vor Ort nötig

2. checkAllObjects(objects: PlacedObject[], constraints: CeilingConstraint[], nominalCeilingMm: number): HeightViolation[]

Unit-Tests (vitest) mit verschiedenen Szenarien.
```

---

## TASK-11-C01 – BOM-Berechnungslogik

**Sprint:** 11 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `calculateBOM(project): BOMLine[]`
- [ ] Alle Positionstypen: Möbel, Geräte, Zubehör, Zuschläge, Montage, Fracht
- [ ] Unit-Tests mit Beispielprojekt

### Codex-Prompt
```
Du implementierst die Stücklistenberechnung (BOM) für einen Küchenplaner.
Datei: `planner-api/src/services/bomCalculator.ts`

Typen aus Docs/PRICING_MODEL.md:
  BOMLine, BOMLineType — genau wie dort definiert implementieren.

Input-Typen (vereinfacht):
  interface ProjectSnapshot {
    cabinets: PlacedCabinet[];    // mit catalog_item, flags
    appliances: PlacedAppliance[]; // mit catalog_item, flags
    priceListItems: PriceListItem[]; // list_price_net, dealer_price_net je catalog_item_id
    taxGroups: TaxGroup[];
    quoteSettings: { freight_flat_rate: number; assembly_rate_per_item: number; }
  }

Implementiere:
1. calculateBOM(project: ProjectSnapshot): BOMLine[]
   - Je PlacedCabinet → BOMLine type:'cabinet'
   - Je PlacedAppliance → BOMLine type:'appliance'
   - Je flags.special_trim_needed → BOMLine type:'surcharge' (Sonderblende)
   - Je flags.labor_surcharge → BOMLine type:'assembly' (Montagezuschlag)
   - Fracht pauschal → BOMLine type:'freight' (1x)
   - variant_surcharge und object_surcharges aus flags befüllen

2. sumBOMLines(lines: BOMLine[]): { total_list_net: number; total_net_after_discounts: number }

Unit-Tests (vitest):
- Leeres Projekt → nur Fracht
- 3 Unterschränke + 1 Herd → korrekte Zeilen
- Sonderzuschlag-Flag → zusätzliche BOMLine
```

---

## TASK-11-C02 – DXF-Schreib-Logik (Export)

**Sprint:** 11.5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] `exportToDxf(project): string`
- [ ] Layer-Struktur gemäß CAD_INTEROP.md
- [ ] Integrations-Test mit Referenz-DXF

### Codex-Prompt
```
Du implementierst DXF-Export für einen Küchenplaner.
Datei: `interop-cad/dxf-export/src/dxfExporter.ts`
Bibliothek: `dxf-writer` (npm)

Layer-Konventionen aus Docs/CAD_INTEROP.md:
  YAKDS_ROOM, YAKDS_WALLS, YAKDS_OPENINGS, YAKDS_FURNITURE

Input:
  interface ExportPayload {
    room: { boundary: Vertex[]; }
    wallSegments: WallSegment2D[];
    openings: Opening[];
    furniture: PlacedObjectBounds[]; // { id, footprintRect: Rect2D }
    includeFurniture: boolean;
  }

Implementiere:
1. exportToDxf(payload: ExportPayload): string
   - DXF-String mit korrekten Layern
   - Raumkontur als geschlossene Polylinie auf YAKDS_ROOM
   - Wandlinien auf YAKDS_WALLS
   - Öffnungen als Linien auf YAKDS_OPENINGS
   - Möbelkonturen als Rechtecke auf YAKDS_FURNITURE (wenn includeFurniture)
   - Einheit: mm ($INSUNITS = 4)

2. Integrationstest: exportToDxf → output enthält alle Layer-Namen als Strings

Keine anderen Deps außer dxf-writer.
```

---

## TASK-12-C01 – Preisregel-Berechnungen

**Sprint:** 12 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] Alle 9 Preisstufen als pure Funktionen
- [ ] `calculatePriceSummary(bomLines, settings): PriceSummary`
- [ ] Unit-Tests inkl. Grenzfälle (0-Rabatt, 100%-Rabatt)

### Codex-Prompt
```
Du implementierst die 9-stufige Preisberechnung für einen Küchenplaner.
Datei: `planner-api/src/services/priceCalculator.ts`

Exakte Typen aus Docs/PRICING_MODEL.md übernehmen: BOMLine, PriceSummary, PriceComponent, GlobalDiscountSettings.

Implementiere als pure Funktionen (KEIN Rounding zwischen Schritten — nur Endrundung):

1. applyDiscount(value: number, pct: number): number
   - value * (1 - pct/100)

2. calcLineNet(line: BOMLine): number
   - Stufen 1–5 auf Zeilenebene:
     (list_price_net + variant_surcharge + object_surcharges)
     × qty
     nach position_discount_pct
     nach pricing_group_discount_pct

3. calculatePriceSummary(lines: BOMLine[], settings: GlobalDiscountSettings): PriceSummary
   - Stufe 6: Global-Rabatt auf Summe aller calcLineNet
   - Stufe 7: Extra-Kosten addieren
   - Stufe 8: MwSt (gruppiert nach tax_group_id)
   - Stufe 9: kaufmännische Rundung auf 2 Dezimalen
   - PriceComponent[] für jeden Schritt befüllen
   - contribution_margin_net und markup_pct berechnen

Unit-Tests (vitest):
- Kein Rabatt → Brutto = Netto * 1.19
- 100% Rabatt → Netto 0, trotzdem Fracht und MwSt
- Mehrere Steuergruppen
- Rundung korrekt
```

---

## TASK-3-C03 – DXF-Import-Parser

**Sprint:** 3.5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Offen

### Akzeptanzkriterien
- [ ] DXF lesen: Linien, Polylinien, Layer
- [ ] Output: `ImportAsset`-Format gemäß CAD_INTEROP.md
- [ ] Unit-Tests mit Beispiel-DXF

### Codex-Prompt
```
Du implementierst den DXF-Import-Parser für einen Küchenplaner.
Datei: `interop-cad/dxf-import/src/dxfParser.ts`
Bibliothek: `dxf-parser` (npm)

Output-Format: ImportAsset aus Docs/CAD_INTEROP.md (genau implementieren).

Implementiere:
1. parseDxf(dxfString: string, sourceFilename: string): ImportAsset
   - Liest Layer (Name, Farbe, Sichtbarkeit)
   - Liest Entities: LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, TEXT, INSERT
   - Normalisiert Koordinaten auf mm (aus $INSUNITS Header)
   - Ignoriert 3D-Objekte (z-Koordinate > 0), protokolliert als 'ignored'
   - Gibt BoundingBox2D aller Entities zurück

2. ImportProtocolEntry für jede Entität: 'imported' | 'ignored' | 'needs_review'
   - needs_review: Entity-Typ unbekannt oder Geometrie unvollständig

Unit-Tests (vitest):
- Minimales DXF-String mit einer LINE → korrekte CadEntity
- Unbekannte Entity → 'ignored' in Protocol
- INSUNITS=1 (Inch) → Koordinaten in mm konvertiert
```

---

## TASK-7-C01 – SKP-Import-Parser

**Sprint:** 7.5 | **Zuständig:** Codex | **Priorität:** Kann | **Status:** Offen

### Akzeptanzkriterien
- [ ] SKP Komponenten + Metadaten extrahieren
- [ ] Output: `SkpReferenceModel`
- [ ] Unit-Tests mit Beispiel-SKP

### Codex-Prompt
```
Du implementierst den SketchUp-Import-Parser für einen Küchenplaner.
Datei: `interop-sketchup/skp-import/src/skpParser.ts`

Hinweis: SKP ist ein binäres Format. Nutze die Bibliothek `sketchup-file-reader` (npm)
oder alternativ: Konvertierung via `open3d` / externe CLI nach GLTF als Fallback dokumentieren.

Output-Format: SkpReferenceModel aus Docs/SKP_INTEROP.md (genau implementieren).

Implementiere:
1. parseSkp(fileBuffer: Buffer, sourceFilename: string): SkpReferenceModel
   - Extrahiert Komponenten-Definitionen (Name, GUID)
   - Extrahiert Instanzen (Position, Rotation als 3D-Transformation)
   - Liest AttributeDictionary-Werte als metadata
   - Schätzt Bounding Box je Komponente (aus Vertices)
   - Konvertiert Geometrie → GLTF-kompatibles Format (raw_geometry als Base64 oder URL-Platzhalter)

2. autoMapComponent(component: SkpComponent): SkpComponentMapping
   - Heuristik-Mapping via Name-Keywords (aus Docs/SKP_INTEROP.md)
   - Unbekannte Komponenten → target_type: 'reference_object'

Unit-Tests (vitest) mit Mock-Daten (kein echtes SKP nötig für Tests).
```

---

## TASK-17-C01 – Block-Bewertungsalgorithmus

**Sprint:** 17 | **Zuständig:** Codex | **Priorität:** Soll | **Status:** Offen

### Akzeptanzkriterien
- [ ] `evaluateBlock(project, block): BlockEvaluation`
- [ ] `findBestBlock(project, blocks): BlockEvaluation`
- [ ] Unit-Tests mit mehreren Blockmodellen

### Codex-Prompt
```
Du implementierst die Blockverrechnung für einen Küchenplaner.
Datei: `planner-api/src/services/blockEvaluator.ts`

Kontext: Hersteller bieten "Blockprogramme" an — Staffelrabatte basierend auf Umsatz/Punkten.
Mehrere Blöcke werden verglichen, der vorteilhafteste wird übernommen.

Typen:
  interface BlockDefinition {
    id: string;
    name: string;
    basis: 'purchase_price' | 'sell_price' | 'points';
    tiers: BlockTier[];  // { min_value: number; discount_pct: number }[]
  }
  interface BlockEvaluation {
    block_id: string;
    block_name: string;
    basis_value: number;       // berechneter Gesamtwert (EK-Summe, VK-Summe oder Punkte)
    applied_discount_pct: number;
    price_advantage_net: number;  // Vorteil gegenüber Standardkalkulation
    recommended: boolean;
  }

Implementiere:
1. evaluateBlock(priceSummary: PriceSummary, block: BlockDefinition): BlockEvaluation
   - Berechnet basis_value je nach block.basis
   - Findet passende Tier (höchste min_value <= basis_value)
   - Berechnet price_advantage_net = standard_net - net_with_block_discount

2. findBestBlock(priceSummary: PriceSummary, blocks: BlockDefinition[]): BlockEvaluation
   - Evaluiert alle Blocks
   - Gibt denjenigen mit höchstem price_advantage_net zurück
   - Setzt recommended: true nur beim Besten

Unit-Tests (vitest):
- 3 Blockprogramme, unterschiedliche Tiers
- Kein passender Tier → discount_pct: 0
- Bester Block korrekt identifiziert
```

---

## TASK-19-C01 – Import-/Export-Regressionstests

**Sprint:** 19 | **Zuständig:** Codex | **Priorität:** Kann | **Status:** Offen

### Codex-Prompt
```
Du erstellst Regressionstests für den DXF-Import/Export-Roundtrip eines Küchenplaners.
Datei: `tests/integration/cadRoundtrip.test.ts`

Nutze: vitest + die Module aus TASK-3-C03 (dxfParser) und TASK-11-C02 (dxfExporter).

Testfälle:
1. Roundtrip-Basis:
   - Erstelle ExportPayload mit bekannten Koordinaten
   - exportToDxf → DXF-String
   - parseDxf → ImportAsset
   - Vergleiche: alle Raum-Vertices im ImportAsset vorhanden (Toleranz: ±1mm)

2. Einheiten-Check:
   - DXF mit INSUNITS=1 (Inch) importieren → Koordinaten in mm korrekt

3. Layer-Check:
   - Exportiertes DXF enthält alle 4 YAKDS-Layer

4. Robustheit:
   - Leeres DXF → kein Crash, leeres ImportAsset
   - DXF mit unbekannten Entities → nur bekannte werden importiert
```
