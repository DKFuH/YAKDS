import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { projectsApi, type Project } from '../api/projects.js'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('de-DE')
}

const useStyles = makeStyles({
  page: { display: 'grid', rowGap: tokens.spacingVerticalXL },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: '160px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  cardBody: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  meta: { display: 'flex', flexDirection: 'column', gap: '2px' },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalXS },
  empty: { textAlign: 'center', color: tokens.colorNeutralForeground3, padding: tokens.spacingVerticalXXL },
})

export function ProjectArchivePage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const list = await projectsApi.archiveList({
        search: search.trim() || undefined,
        archive_reason: reasonFilter.trim() || undefined,
      })
      setProjects(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projektarchiv konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleRestore(projectId: string) {
    setRestoringProjectId(projectId); setError(null)
    try {
      await projectsApi.restore(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projekt konnte nicht wiederhergestellt werden')
    } finally {
      setRestoringProjectId(null)
    }
  }

  return (
    <div className={styles.page}>
      <div>
        <Title2>Projektarchiv</Title2>
        <Body1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          Archivierte Projekte suchen, filtern und wiederherstellen.
        </Body1>
      </div>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <Caption1>Suche</Caption1>
          <Input type="search" placeholder="Projektname" value={search} onChange={(_e, d) => setSearch(d.value)} />
        </div>
        <div className={styles.filterField}>
          <Caption1>Archivgrund</Caption1>
          <Input placeholder="z. B. abgeschlossen" value={reasonFilter} onChange={(_e, d) => setReasonFilter(d.value)} />
        </div>
        <Button appearance="primary" onClick={() => void load()}>Filter anwenden</Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Spinner label="Lade Archiv…" />
        </div>
      ) : projects.length === 0 ? (
        <div className={styles.empty}>
          <Body1>Keine archivierten Projekte gefunden.</Body1>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <Card key={project.id} appearance="filled">
              <CardHeader
                header={<Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>{project.name}</Body1>}
                description={<Caption1>{project.archive_reason ?? 'Kein Archivgrund hinterlegt'}</Caption1>}
                action={<Badge appearance="tint" size="small">{project.priority}</Badge>}
              />
              <div className={styles.cardBody}>
                <div className={styles.meta}>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Archiviert: {formatDate(project.archived_at)}</Caption1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Aufbewahrung bis: {formatDate(project.retention_until)}</Caption1>
                  {project.advisor && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Berater: {project.advisor}</Caption1>}
                  {project.assigned_to && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Bearbeitung: {project.assigned_to}</Caption1>}
                </div>
                <div className={styles.actions}>
                  <Button appearance="secondary" size="small" onClick={() => navigate('/projects/' + project.id)}>
                    Öffnen
                  </Button>
                  <Button
                    appearance="primary"
                    size="small"
                    disabled={restoringProjectId === project.id}
                    onClick={() => void handleRestore(project.id)}
                  >
                    {restoringProjectId === project.id ? <Spinner size="tiny" /> : 'Restore'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
