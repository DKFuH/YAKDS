# Sprint 93 - Katalogversionen, Index-Sharing & Lieferantenaufschlaege

**Branch:** `feature/sprint-93-katalogversionen-index-sharing-aufschlaege`
**Gruppe:** B (startbar nach S20 und S29)
**Status:** `done`
**Abhaengigkeiten:** S20, S29, S54

---

## Ziel

Katalogpflege fuer groessere Datenstaende beherrschbar machen:
mehrere Katalogversionen parallel sichtbar, freigegebene Indexregeln tenantweit
teilbar und Lieferantenaufschlaege pro Version steuerbar.

---

## 1. Backend

Einzufuehren:

- Katalogversion mit `valid_from`, `valid_to`, `is_active`
- freigebbare Indexprofile
- Aufschlagsregeln pro Lieferant oder Hersteller

Neue Endpunkte:

- `GET /catalog/versions`
- `POST /catalog/versions/:id/activate`
- `GET /catalog/index-profiles`
- `PUT /catalog/index-profiles/:id/share`

---

## 2. Frontend

- Vergleichsansicht fuer zwei aktive Katalogversionen
- Sichtbare Gueltigkeit von Versionen
- UI fuer prozentuale Aufschlaege je Lieferant
- Freigabe-/Uebernahme-Workflow fuer Indexprofile

---

## 3. DoD

- zwei Katalogversionen koennen parallel eingesehen werden
- Indexprofile lassen sich tenantweit freigeben
- Preisaufschlaege wirken sauber auf Vorschau und Kalkulation
- mindestens 10 Tests fuer Versionierung und Aufschlagslogik
