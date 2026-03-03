import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cutlistApi } from '../api/projectFeatures.js'
import styles from './CutlistPage.module.css'

type CutlistPart = {
  label: string
  width_mm: number
  height_mm: number
  quantity: number
  material_code: string
  material_label: string
  grain_direction: 'none' | 'length' | 'width'
  article_name: string
  room_name?: string
}

type CutlistSummary = {
  total_parts: number
  by_material: Record<string, { count: number; area_sqm: number; material_label: string }>
}

type CutlistRecord = {
  id: string
  project_id: string
  room_id: string | null
  generated_at: string
  parts: CutlistPart[]
  summary: CutlistSummary
}

function grainLabel(value: CutlistPart['grain_direction']) {
  if (value === 'length') return 'laengs'
  if (value === 'width') return 'quer'
  return 'kein'
}

export function CutlistPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [items, setItems] = useState<CutlistRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomFilter, setRoomFilter] = useState('all')
  const [materialFilter, setMaterialFilter] = useState('all')

  async function load() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await cutlistApi.list(projectId) as CutlistRecord[]
      setItems(rows)
      setActiveId((prev) => prev ?? rows[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [projectId])

  const active = useMemo(() => items.find((entry) => entry.id === activeId) ?? null, [items, activeId])

  const roomOptions = useMemo(() => {
    const set = new Set<string>()
    for (const part of active?.parts ?? []) {
      if (part.room_name) set.add(part.room_name)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [active])

  const materialOptions = useMemo(() => {
    const set = new Set<string>()
    for (const part of active?.parts ?? []) {
      set.add(part.material_code)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [active])

  const filteredParts = useMemo(() => {
    const source = active?.parts ?? []
    return source.filter((part) => {
      const roomOk = roomFilter === 'all' || part.room_name === roomFilter
      const materialOk = materialFilter === 'all' || part.material_code === materialFilter
      return roomOk && materialOk
    })
  }, [active, roomFilter, materialFilter])

  async function onGenerate() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const created = await cutlistApi.generate(projectId) as CutlistRecord
      setItems((prev) => [created, ...prev])
      setActiveId(created.id)
      setRoomFilter('all')
      setMaterialFilter('all')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Generieren')
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Zuschnittliste loeschen?')) return
    setError(null)
    try {
      await cutlistApi.remove(id)
      setItems((prev) => {
        const next = prev.filter((entry) => entry.id !== id)
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null)
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Loeschen')
    }
  }

  if (!projectId) {
    return <div className={styles.page}>Projekt-ID fehlt.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Zuschnittliste</h1>
          <p className={styles.subtitle}>Projekt {projectId.slice(0, 8)}...</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/projects/${projectId}`)}>
            Zurueck
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => void onGenerate()} disabled={loading}>
            Zuschnittliste generieren
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2>Gespeicherte Listen</h2>
        {loading && items.length === 0 ? (
          <p>Lade...</p>
        ) : items.length === 0 ? (
          <p>Noch keine Zuschnittliste vorhanden.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Raum</th>
                <th>Teile</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className={activeId === entry.id ? styles.activeRow : ''}>
                  <td>
                    <button className={styles.linkBtn} onClick={() => setActiveId(entry.id)}>
                      {new Date(entry.generated_at).toLocaleString('de-DE')}
                    </button>
                  </td>
                  <td>{entry.room_id ? 'Raum-Filter' : 'Projektweit'}</td>
                  <td>{entry.summary?.total_parts ?? 0}</td>
                  <td>
                    <button type="button" className={styles.btnDanger} onClick={() => void onDelete(entry.id)}>
                      Loeschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {active && (
        <section className={styles.section}>
          <div className={styles.filters}>
            <label>
              Raum
              <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
                <option value="all">Alle</option>
                {roomOptions.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </label>

            <label>
              Material
              <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
                <option value="all">Alle</option>
                {materialOptions.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </label>

            <div className={styles.actions}>
              <a className={styles.btnSecondary} href={`/api/v1/cutlists/${active.id}/export.csv`} target="_blank" rel="noreferrer">
                CSV Export
              </a>
              <a className={styles.btnSecondary} href={`/api/v1/cutlists/${active.id}/export.pdf`} target="_blank" rel="noreferrer">
                PDF Export
              </a>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Breite</th>
                <th>Hoehe</th>
                <th>Anzahl</th>
                <th>Material</th>
                <th>Korn</th>
                <th>Artikel</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((part, index) => (
                <tr key={`${part.article_name}-${index}`}>
                  <td>{part.label}</td>
                  <td>{part.width_mm}</td>
                  <td>{part.height_mm}</td>
                  <td>{part.quantity}</td>
                  <td>{part.material_code}</td>
                  <td>{grainLabel(part.grain_direction)}</td>
                  <td>{part.article_name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.summary}>
            <strong>Gesamtteile: {active.summary?.total_parts ?? 0}</strong>
            <ul>
              {Object.entries(active.summary?.by_material ?? {}).map(([code, item]) => (
                <li key={code}>{code}: {item.count} Teile · {item.area_sqm.toFixed(3)} m²</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

