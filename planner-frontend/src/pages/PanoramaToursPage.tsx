import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Textarea,
  Title2,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { panoramaToursApi, type PanoramaPoint, type PanoramaTour } from '../api/panoramaTours.js'
import { getTenantPlugins } from '../api/tenantSettings.js'
import { useLocale } from '../hooks/useLocale.js'

const DEFAULT_POINT: PanoramaPoint = {
  id: 'point-1',
  label: 'Eingang',
  camera: { x: 0, y: 1.6, z: 0, yaw: 90, pitch: 0 },
  hotspots: [],
}

const useStyles = makeStyles({
  page: { maxWidth: '800px', margin: '0 auto', display: 'grid', rowGap: tokens.spacingVerticalXXL },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacingHorizontalM, flexWrap: 'wrap' },
  headerText: { display: 'grid', rowGap: tokens.spacingVerticalXS },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: tokens.spacingVerticalM },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', marginTop: tokens.spacingVerticalM },
  shareLink: { fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all' },
})

export function PanoramaToursPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { id: projectId } = useParams<{ id: string }>()
  const { locale } = useLocale()

  const [items, setItems] = useState<PanoramaTour[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('Neue Tour')
  const [shareLocale, setShareLocale] = useState<'de' | 'en'>(locale.startsWith('en') ? 'en' : 'de')
  const [pointsJson, setPointsJson] = useState(JSON.stringify([DEFAULT_POINT], null, 2))
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presentationEnabled, setPresentationEnabled] = useState(false)

  const active = useMemo(() => items.find((e) => e.id === activeId) ?? null, [items, activeId])

  useEffect(() => {
    let alive = true
    getTenantPlugins()
      .then((r) => { if (alive) setPresentationEnabled(r.enabled.includes('presentation')) })
      .catch(() => { if (alive) setPresentationEnabled(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!projectId) return
    panoramaToursApi.list(projectId)
      .then((data) => { setItems(data); setActiveId(data[0]?.id ?? null) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!active) {
      setName('Neue Tour'); setShareLocale(locale.startsWith('en') ? 'en' : 'de')
      setPointsJson(JSON.stringify([DEFAULT_POINT], null, 2)); setShareLink(null); return
    }
    setName(active.name)
    setShareLocale(active.locale_code?.startsWith('en') ? 'en' : 'de')
    setPointsJson(JSON.stringify(active.points_json, null, 2))
    setShareLink(active.share_token ? `${window.location.origin}/share/panorama/${active.share_token}` : null)
  }, [active, locale])

  async function refreshList(selectId?: string | null) {
    if (!projectId) return
    const data = await panoramaToursApi.list(projectId)
    setItems(data)
    if (selectId) { setActiveId(selectId); return }
    if (!data.some((e) => e.id === activeId)) setActiveId(data[0]?.id ?? null)
  }

  function parsePoints(): PanoramaPoint[] {
    const parsed = JSON.parse(pointsJson) as PanoramaPoint[]
    if (!Array.isArray(parsed)) throw new Error('points_json muss ein Array sein')
    return parsed
  }

  async function createTour() {
    if (!projectId) return
    setSaving(true); setError(null)
    try {
      const created = await panoramaToursApi.create(projectId, { name, locale_code: shareLocale, points_json: parsePoints() })
      await refreshList(created.id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Fehler') } finally { setSaving(false) }
  }

  async function saveTour() {
    if (!active) return
    setSaving(true); setError(null)
    try {
      await panoramaToursApi.update(active.id, { name, locale_code: shareLocale, points_json: parsePoints() })
      await refreshList(active.id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Fehler') } finally { setSaving(false) }
  }

  async function deleteTour() {
    if (!active || !confirm('Panorama-Tour wirklich l\u00f6schen?')) return
    setSaving(true); setError(null)
    try { await panoramaToursApi.remove(active.id); await refreshList(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler') } finally { setSaving(false) }
  }

  async function createShareLink() {
    if (!active) return
    setSaving(true); setError(null)
    try {
      const share = await panoramaToursApi.share(active.id, 30, shareLocale)
      setShareLink(`${window.location.origin}${share.share_url}`)
      setShareLocale(share.locale_code.startsWith('en') ? 'en' : 'de')
      await refreshList(active.id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Fehler') } finally { setSaving(false) }
  }

  if (loading) return <Spinner label='Lade Panorama-Touren\u2026' style={{ marginTop: 64 }} />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <Title2>Panorama-Touren</Title2>
          <Subtitle2>Multi-Point Touren mit Kamera-Viewpoints und Hotspots.</Subtitle2>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
          {presentationEnabled && (
            <Button appearance='subtle' onClick={() => navigate(`/projects/${projectId}/presentation${activeId ? `?source=panorama-tour&tourId=${activeId}` : ''}`)}>
              Pr\u00e4sentationsmodus
            </Button>
          )}
          <Button appearance='subtle' onClick={() => navigate(`/projects/${projectId}`)}>
            \u2190 Zur\u00fcck
          </Button>
        </div>
      </div>

      {error && <MessageBar intent='error'><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <Card>
        <CardHeader header={<Body1Strong>Touren</Body1Strong>} />
        <div className={styles.formGrid}>
          <Field label='Tour w\u00e4hlen'>
            <Select value={activeId ?? ''} onChange={(_e, d) => setActiveId(d.value || null)}>
              <Option value=''>Neu erstellen</Option>
              {items.map((entry) => <Option key={entry.id} value={entry.id}>{entry.name}</Option>)}
            </Select>
          </Field>
          <Field label='Name'>
            <Input value={name} onChange={(_e, d) => setName(d.value)} />
          </Field>
          <Field label='Sprache'>
            <Select value={shareLocale} onChange={(_e, d) => setShareLocale(d.value === 'en' ? 'en' : 'de')}>
              <Option value='de'>Deutsch</Option>
              <Option value='en'>English</Option>
            </Select>
          </Field>
        </div>
        <Field label='points_json' style={{ marginTop: tokens.spacingVerticalM }}>
          <Textarea rows={12} value={pointsJson} onChange={(_e, d) => setPointsJson(d.value)} style={{ fontFamily: 'monospace', fontSize: '13px' }} />
        </Field>

        <div className={styles.actions}>
          <Button appearance='primary' disabled={saving} onClick={() => void (active ? saveTour() : createTour())}>
            {saving ? <Spinner size='tiny' /> : active ? 'Tour speichern' : 'Tour erstellen'}
          </Button>
          {active && (
            <>
              <Button appearance='secondary' disabled={saving} onClick={() => void createShareLink()}>Share-Link erstellen</Button>
              <Button appearance='secondary' disabled={saving} onClick={() => void deleteTour()}>Tour l\u00f6schen</Button>
            </>
          )}
        </div>

        {shareLink && (
          <MessageBar intent='success' style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>
              Share-Link: <a href={shareLink} target='_blank' rel='noreferrer' className={styles.shareLink}>{shareLink}</a>
            </MessageBarBody>
          </MessageBar>
        )}
      </Card>
    </div>
  )
}
