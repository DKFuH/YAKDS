import { useState } from 'react'
import styles from './LernreisePanel.module.css'

interface Course {
  id: string
  title: string
  description: string
  icon: string
  steps: string[]
}

const COURSES: Course[] = [
  {
    id: 'erste-schritte',
    title: 'Erste Schritte',
    description: 'Einstieg in OKP: Benutzeroberfläche, Navigation und erste Aktionen.',
    icon: '🚀',
    steps: ['Projektboard aufrufen', 'Erstes Projekt anlegen', 'Katalog importieren'],
  },
  {
    id: 'projekt-vorbereiten',
    title: 'Projekt vorbereiten',
    description: 'Kundendaten pflegen, Bereiche anlegen und Alternativen definieren.',
    icon: '📋',
    steps: ['Kontakt anlegen', 'Bereich + Alternative anlegen', 'Modell-Einstellungen (F7) setzen'],
  },
  {
    id: 'raum-planen',
    title: 'Raum planen',
    description: 'Raum zeichnen, Wände bearbeiten, Öffnungen platzieren.',
    icon: '🏗️',
    steps: ['Neuen Raum anlegen', 'Polygon zeichnen', 'Türen & Fenster einsetzen'],
  },
  {
    id: 'moebel-platzieren',
    title: 'Möbel platzieren',
    description: 'Schränke und Geräte aus dem Katalog in den Raum einfügen.',
    icon: '🪑',
    steps: ['Katalog öffnen', 'Artikel per Drag-and-Drop platzieren', 'Stückliste prüfen'],
  },
]

// Simple inline article suggestions (no API call needed for static help content)
const HELP_ARTICLES: Record<string, string[]> = {
  katalog: ['Herstellerkatalog importieren', 'Artikel konfigurieren', 'Preise aktualisieren'],
  raum: ['Raum zeichnen', 'Dachschrägen einrichten', 'Öffnungen setzen'],
  angebot: ['Angebot erstellen', 'PDF exportieren', 'Angebotsstatus ändern'],
  projekt: ['Projekt anlegen', 'Status ändern', 'Projekt duplizieren'],
}

interface Props {
  onClose: () => void
}

export function LernreisePanel({ onClose }: Props) {
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [supportSearch, setSupportSearch] = useState('')
  const [supportResults, setSupportResults] = useState<string[]>([])

  function handleSupportSearch() {
    const term = supportSearch.trim().toLowerCase()
    if (!term) {
      setSupportResults([])
      return
    }
    const matches: string[] = []
    for (const [key, articles] of Object.entries(HELP_ARTICLES)) {
      if (key.includes(term) || term.includes(key)) {
        matches.push(...articles)
      }
    }
    setSupportResults(matches.length > 0 ? matches : ['Kein Artikel gefunden – Support kontaktieren'])
  }

  function toggleCourse(courseId: string) {
    setExpandedCourseId((prev) => (prev === courseId ? null : courseId))
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lernreise &amp; Hilfe</h2>
        <button className={styles.btnClose} onClick={onClose} aria-label="Panel schließen">✕</button>
      </div>

      <div className={styles.courseList}>
        {COURSES.map((course) => (
          <div
            key={course.id}
            className={styles.courseCard}
            role="button"
            tabIndex={0}
            onClick={() => toggleCourse(course.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCourse(course.id) }}
          >
            <span className={styles.courseIcon}>{course.icon}</span>
            <div className={styles.courseContent}>
              <span className={styles.courseTitle}>{course.title}</span>
              <span className={styles.courseDesc}>{course.description}</span>
              {expandedCourseId === course.id && (
                <ul className={styles.courseSteps}>
                  {course.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.support}>
        <p className={styles.supportTitle}>Support</p>
        <div className={styles.supportRow}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Artikel suchen…"
            value={supportSearch}
            onChange={(e) => setSupportSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSupportSearch() }}
          />
          <button className={styles.btnSupport} onClick={handleSupportSearch}>Suchen</button>
        </div>
        {supportResults.length > 0 && (
          <div className={styles.searchResults}>
            {supportResults.map((result) => (
              <button key={result} className={styles.searchResultItem} type="button">{result}</button>
            ))}
          </div>
        )}
        <a
          href="https://support.okp.local"
          target="_blank"
          rel="noreferrer"
          className={styles.btnSupportPrimary}
        >
          Support kontaktieren
        </a>
      </div>
    </div>
  )
}
