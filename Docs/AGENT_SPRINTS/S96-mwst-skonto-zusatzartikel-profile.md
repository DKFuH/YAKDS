# Sprint 96 - MwSt-, Skonto- & Zusatzartikel-Profile

**Branch:** `feature/sprint-96-mwst-skonto-zusatzartikel-profile`
**Gruppe:** B (startbar nach S13, S49 und S54)
**Status:** `done`
**Abhaengigkeiten:** S13, S49, S54

---

## Ziel

Kaufmaennische Regeln explizit konfigurierbar machen:
MwSt-Profile, Skonto-Regeln und Zusatzartikelgruppen mit abweichender Steuer-
oder Rabattlogik sollen systematisch gepflegt werden koennen.

---

## 1. Backend

Einzufuehren:

- `TaxProfile` und `DiscountProfile`
- Zuordnung zu Quotes, Quote-Lines und Zusatzartikelgruppen
- saubere Berechnungsreihenfolge fuer Rabatt, Skonto und Steuer

Neue Endpunkte:

- `GET /pricing/tax-profiles`
- `PUT /pricing/tax-profiles/:id`
- `GET /pricing/discount-profiles`
- `POST /quotes/:id/recalculate-financials`

---

## 2. Frontend

- Settings fuer Steuer- und Skontoprofile
- Zuordnung im Angebots- oder Quote-Workflow
- transparente Aufschluesselung in Quote, PDF und Reporting

---

## 3. DoD

- Mehrwertsteuerprofile wirken sauber pro Zeile oder Zusatzartikelgruppe
- Skontologik ist nachvollziehbar und reproduzierbar
- Reporting sieht Brutto/Netto/Skonto konsistent
- mindestens 12 Tests fuer Steuer-, Rabatt- und Rechenlogik
