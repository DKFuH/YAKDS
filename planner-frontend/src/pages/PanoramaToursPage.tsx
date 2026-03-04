import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { panoramaToursApi, type PanoramaPoint, type PanoramaTour } from '../api/panoramaTours.js'
import styles from './TenantSettingsPage.module.css'

const DEFAULT_POINT: PanoramaPoint = {
  id: 'point-1',
  label: 'Eingang',
  camera: { x: 0, y: 1.6, z: 0, yaw: 90, pitch: 0 },
  hotspots: [],
}

export function PanoramaToursPage() {
  const navigate = useNavigate()
  const { id: projectId } = useParams<{ id: string }>()

  const [items, setItems] = useState<PanoramaTour[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('Neue Tour')
  const [pointsJson, setPointsJson] = useState(JSON.stringify([DEFAULT_POINT], null, 2))
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => items.find((entry) => entry.id === activeId) ?? null, [items, activeId])

  useEffect(() => {
    if (!projectId) return
    panoramaToursApi.list(projectId)
      .then((data) => {
        setItems(data)
        setActiveId(data[0]?.id ?? null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!active) {
      setName('Neue Tour')
      setPointsJson(JSON.stringify([DEFAULT_POINT], null, 2))
      setShareLink(null)
      return
    }

    setName(active.name)
    setPointsJson(JSON.stringify(active.points_json, null, 2))
    setShareLink(active.share_token ? `${window.location.origin}/share/panorama/${active.share_token}` : null)
  }, [active])

  async function refreshList(selectId?: string | null) {
    if (!projectId) return
    const data = await panoramaToursApi.list(projectId)
    setItems(data)
    if (selectId) {
      setActiveId(selectId)
      return
    }
    if (!data.some((entry) => entry.id === activeId)) {
      setActiveId(data[0]?.id ?? null)
    }
  }

  function parsePoints(): PanoramaPoint[] {
    const parsed = JSON.parse(pointsJson) as PanoramaPoint[]
    if (!Array.isArray(parsed)) {
      throw new Error('points_json muss ein Array sein')
    }
    return parsed
  }

  async function createTour() {
    if (!projectId) return
    setSaving(true)
    setError(null)
    try {
      const created = await panoramaToursApi.create(projectId, {
        name,
        points_json: parsePoints(),
      })
      await refreshList(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tour konnte nicht erstellt werden')
    } finally {
      setSaving(false)
    }
  }

  async function saveTour() {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      await panoramaToursApi.update(active.id, {
        name,
        points_json: parsePoints(),
      })
      await refreshList(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tour konnte nicht gespeichert werden')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTour() {
    if (!active) return
    if (!confirm('Panorama-Tour wirklich löschen?')) return

    setSaving(true)
    setError(null)
    try {
      await panoramaToursApi.remove(active.id)
      await refreshList(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tour konnte nicht gelöscht werden')
    } finally {
      setSaving(false)
    }
  }

  async function createShareLink() {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      const share = await panoramaToursApi.share(active.id, 30)
      setShareLink(`${window.location.origin}${share.share_url}`)
      await refreshList(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share-Link konnte nicht erstellt werden')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.center}>Lade Panorama-Touren…</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Projekt</p>
          <h1>Panorama-Touren</h1>
          <p className={styles.subtitle}>Multi-Point Touren mit Kamera-Viewpoints und Hotspots.</p>
        </div>
        <div className={styles.headerActions}>
          <button type='button' className={styles.btnSecondary} onClick={() => navigate(`/projects/${projectId}`)}>
            {'← Zurück zum Editor'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Touren</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Tour wählen</span>
            <select value={activeId ?? ''} onChange={(event) => setActiveId(event.target.value || null)}>
              <option value=''>Neu erstellen</option>
              {items.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className={styles.field}>
            <span>points_json</span>
            <textarea value={pointsJson} onChange={(event) => setPointsJson(event.target.value)} rows={14} />
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type='button'
            className={styles.btnPrimary}
            disabled={saving}
            onClick={() => void (active ? saveTour() : createTour())}
          >
            {saving ? 'Speichern…' : active ? 'Tour speichern' : 'Tour erstellen'}
          </button>

          {active && (
            <>
              <button type='button' className={styles.btnSecondary} disabled={saving} onClick={() => void createShareLink()}>
                Share-Link erstellen
              </button>
              <button type='button' className={styles.btnSecondary} disabled={saving} onClick={() => void deleteTour()}>
                Tour löschen
              </button>
            </>
          )}
        </div>

        {shareLink && (
          <div className={styles.success}>
            Share-Link: <a href={shareLink} target='_blank' rel='noreferrer'>{shareLink}</a>
          </div>
        )}
      </section>
    </div>
  )
}
