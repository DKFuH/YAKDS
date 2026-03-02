# Styling Guide — OKP UI System

**Version**: 1.0  
**Letzte Aktualisierung**: 01. März 2026  
**Gültig für**: `planner-frontend` (React + CSS Modules)

---

## Ziel

Dieser Guide adaptiert den LeadKüche-Pro-Stil auf OKP, ohne Framework-Wechsel.

Wichtig:
- **Kein Bootstrap-Zwang**: OKP nutzt CSS Modules, kein Utility-Framework.
- **Token-first**: Farben, Radius, Shadows und Typografie laufen über zentrale CSS-Variablen in `src/global.css`.
- **Komponentenorientiert**: Seitenmodule verwenden Tokens (`var(--...)`) statt Hex-Werte.

---

## Design-Prinzipien für OKP

1. **Klarer Workflow statt Scroll-Flut**
   - Projektliste → Editor → BI/Catalog mit klaren Primäraktionen.
2. **Glas + neutrale Flächen, aber funktional**
   - Glassmorphism als Akzent für wichtige Panels/KPIs, nicht als Dauer-Effekt überall.
3. **Mobile-first, editor-safe**
   - Responsive Form-/List-Seiten; Editor-Bereich bleibt performance- und kontraststabil.

---

## Design Tokens (Source of Truth)

### Brand & UI

```css
--primary-color: #218d8d;
--primary-hover: #1d7480;
--primary-light: rgba(33, 141, 141, 0.1);

--bg-light: #f4f7f6;
--surface-default: #ffffff;
--surface-muted: #f8faf9;
--glass-bg: rgba(255, 255, 255, 0.8);
--glass-border: rgba(255, 255, 255, 0.45);

--text-primary: #2c3e50;
--text-muted: #64748b;
--text-inverse: #ffffff;
--border-subtle: #d7e0e5;
```

### Status

```css
--status-danger: #dc3545;
--status-warning: #ffc107;
--status-success: #10b981;
--status-info: #0dcaf0;
```

### Radius, Shadows, Motion

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-pill: 999px;

--shadow-card: 0 10px 30px rgba(0, 0, 0, 0.04);
--shadow-card-hover: 0 15px 35px rgba(0, 0, 0, 0.06);
--shadow-sm: 0 .125rem .25rem rgba(0, 0, 0, .075);

--transition-fast: 180ms ease;
```

### Typography

```css
--font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--tracking-tight: -0.01em;
```

---

## Komponentenmuster (OKP)

### 1) Surface/Card

- Standardflächen: Border + Radius + `--shadow-card`
- Hover (interaktiv): leichtes Lift + `--shadow-card-hover`

Empfehlung:
- `panel` (Basis)
- `panelGlass` (KPI/Highlight)
- `panelVibrant` (CTA/Key KPI)

### 2) Buttons

- Primäraktionen: `--primary-color`
- Sekundäraktionen: Outline/Subtle Surface
- Destruktiv: `--status-danger`
- Radius standardmäßig `--radius-pill` auf CTA-Buttons

### 3) Inputs/Select

- Ruhige neutrale Hintergründe (`--surface-default`/`--surface-muted`)
- Fokus: Border + ring in `--primary-color`

### 4) Navigation/Tabs

- Active-State: `--primary-light` + `--primary-color`
- Hover-Transition maximal 200ms

### 5) Badges/Status

- Erfolg/Fehler/Warnung nur über Status-Tokens
- Keine frei erfundenen Sonderfarben in Seitenmodulen

---

## OKP-spezifische Regeln

1. **Keine neuen Hex-Werte in Modulen** (`*.module.css`) außer im begründeten Sonderfall.
2. **Neue UI zuerst in Tokens denken** (Global), dann in Komponenten anwenden.
3. **Canvas-Farben zentralisieren** (Editor-Konstanten auf Token-nahe Mapping-Werte).
4. **Kontrast priorisieren** in produktiven Arbeitsbereichen (Editor, Formulare, Tabellen).

---

## Mapping zum ursprünglichen Bootstrap-orientierten Guide

| Ursprungs-Guide | OKP Umsetzung |
|---|---|
| `btn btn-primary rounded-pill` | `.btnPrimary` + Token (`--primary-color`, `--radius-pill`) |
| `card rounded-4 shadow-sm` | `.card`/`.panel` mit `--radius-lg`, `--shadow-card` |
| `text-muted` | `color: var(--text-muted)` |
| `bg-light` | `background: var(--surface-muted)` |
| `nav-link active` | Modulklasse mit `--primary-light` + `--primary-color` |

---

## Rollout-Plan

1. **Phase A (Basis)**
   - Tokens + Base-Utilities in `src/global.css`
2. **Phase B (Hauptseiten)**
   - `ProjectList`, `BIDashboard`, `WebplannerPage`, `CatalogPage` auf Tokens
3. **Phase C (Editor + Panels)**
   - Sidebars, Statusbar, Validation/Import Panels
4. **Phase D (Feinschliff)**
   - Inkonsistenzen entfernen, visuelle QA auf Mobile/Desktop

---

## Definition of Done (Styling)

- [x] Keine neuen Hardcoded-Brand-Farben in Seitenmodulen
- [x] Primäraktionen verwenden überall `--primary-color`
- [x] Karten/Container nutzen konsistente Radius-/Shadow-Tokens
- [x] Fokuszustände sind sichtbar und konsistent
- [x] Mobile-Ansichten bleiben ohne Layout-Brüche nutzbar
