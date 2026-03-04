import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { panoramaToursApi, type PanoramaPoint } from '../api/panoramaTours.js'
import styles from './TenantSettingsPage.module.css'

export function PublicPanoramaTourPage() {
  const { token } = useParams<{ token: string }>()
  const [tourName, setTourName] = useState<string>('')
  const [points, setPoints] = useState<PanoramaPoint[]>([])
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('Ungültiger Share-Token')
      setLoading(false)
      return
    }

    panoramaToursApi.getShared(token)
      .then((tour) => {
        setTourName(tour.name)
        setPoints(tour.points_json)
        setActivePointId(tour.points_json[0]?.id ?? null)
      })
      .catch((err: Error) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [token])

  const active = useMemo(() => points.find((point) => point.id === activePointId) ?? null, [points, activePointId])

  if (loading) return <div className={styles.center}>Lade Panorama-Tour…</div>
  if (error) return <div className={styles.center}>{error}</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Öffentliche Tour</p>
          <h1>{tourName}</h1>
          <p className={styles.subtitle}>Kamerapunkte und Hotspot-Navigation.</p>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Viewpoints</h2>
        {points.length === 0 ? (
          <p>Diese Tour enthält keine Punkte.</p>
        ) : (
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Punkt</span>
              <select value={activePointId ?? ''} onChange={(event) => setActivePointId(event.target.value)}>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>{point.label}</option>
                ))}
              </select>
            </label>

            {active && (
              <div className={styles.field}>
                <span>Kamera</span>
                <pre>
{JSON.stringify(active.camera, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {active && active.hotspots.length > 0 && (
          <div className={styles.actions}>
            {active.hotspots.map((hotspot) => (
              <button
                key={`${active.id}-${hotspot.target_point_id}`}
                type='button'
                className={styles.btnSecondary}
                onClick={() => setActivePointId(hotspot.target_point_id)}
              >
                {hotspot.label ?? `Zu ${hotspot.target_point_id}`}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
