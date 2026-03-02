import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { platformApi, type GlobalSearchResult } from '../api/platform.js'
import { projectsApi, type Project } from '../api/projects.js'
import { OnboardingWizard, shouldShowOnboarding } from '../components/OnboardingWizard.js'
import styles from './ProjectList.module.css'

const BOARD_COLUMNS: Array<{ id: Project['project_status']; label: string }> = [
  { id: 'lead', label: 'Lead' },
  { id: 'planning', label: 'Planung' },
  { id: 'quoted', label: 'Angebot' },
  { id: 'contract', label: 'Auftrag' },
  { id: 'production', label: 'Produktion' },
  { id: 'installed', label: 'Montage' },
]

const PRIORITY_LABELS: Record<Project['priority'], string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
}

type GanttProject = Project & { start_at: string; end_at: string | null }

function formatDate(value: string | null): string {
  if (!value) {
    return 'Kein Termin'
  }
  return new Date(value).toLocaleDateString('de-DE')
}

function getTimelineRange(projects: GanttProject[]) {
  const timestamps = projects.flatMap((project) => {
    const values = [new Date(project.start_at).getTime()]
    if (project.end_at) {
      values.push(new Date(project.end_at).getTime())
    }
    return values
  })

  if (timestamps.length === 0) {
    const today = Date.now()
    return { min: today, max: today + 86400000 }
  }

  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  return { min, max: max === min ? min + 86400000 : max }
}

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [ganttProjects, setGanttProjects] = useState<GanttProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Project['project_status']>('all')
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)

  // Close dropdown menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenuId])

  async function loadProjects(filter: 'all' | Project['project_status']) {
    setLoading(true)
    setError(null)
    try {
      const [board, gantt] = await Promise.all([
        projectsApi.board(filter === 'all' ? {} : { status_filter: filter }),
        projectsApi.gantt(),
      ])
      setProjects(board)
      setGanttProjects(gantt)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden der Projekte')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects(statusFilter)
  }, [statusFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const project = await projectsApi.create({ name: newName.trim() })
      navigate(`/projects/${project.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Projekt wirklich löschen?')) return
    await projectsApi.delete(id)
    setProjects((prev) => prev.filter((project) => project.id !== id))
    setGanttProjects((prev) => prev.filter((project) => project.id !== id))
  }

  async function handleDuplicate(id: string) {
    try {
      const copy = await projectsApi.threeDots(id, 'duplicate')
      navigate(`/projects/${copy.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Duplizieren fehlgeschlagen')
    }
  }

  async function handleArchive(id: string) {
    try {
      const updated = await projectsApi.threeDots(id, 'archive')
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setGanttProjects((prev) => prev.filter((p) => p.id !== id))
      if (updated) {
        // no-op; project removed from active board
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Archivieren fehlgeschlagen')
    }
  }

  async function patchProject(projectId: string, action: () => Promise<Project>) {
    setSavingProjectId(projectId)
    setError(null)
    try {
      const updated = await action()
      setProjects((prev) => prev.map((project) => (project.id === projectId ? updated : project)))
      setGanttProjects((prev) => prev.map((project) => (
        project.id === projectId
          ? { ...project, ...updated, start_at: project.start_at, end_at: updated.deadline }
          : project
      )))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projekt konnte nicht aktualisiert werden')
    } finally {
      setSavingProjectId(null)
    }
  }

  async function handleStatusDrop(projectId: string, nextStatus: Project['project_status']) {
    const project = projects.find((entry) => entry.id === projectId)
    if (!project || project.project_status === nextStatus) {
      return
    }

    const progressByStatus: Partial<Record<Project['project_status'], number>> = {
      lead: 10,
      planning: 30,
      quoted: 55,
      contract: 70,
      production: 85,
      installed: 100,
      archived: 100,
    }

    await patchProject(projectId, () => projectsApi.updateStatus(projectId, {
      project_status: nextStatus,
      progress_pct: Math.max(project.progress_pct, progressByStatus[nextStatus] ?? project.progress_pct),
    }))
  }

  async function handleGlobalSearch() {
    if (searchTerm.trim().length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    setError(null)
    try {
      const response = await platformApi.search(searchTerm.trim())
      setSearchResults(response.results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suche fehlgeschlagen')
    } finally {
      setSearching(false)
    }
  }

  const groupedProjects = useMemo(() => {
    const groups = Object.fromEntries(BOARD_COLUMNS.map((column) => [column.id, [] as Project[]])) as Record<Project['project_status'], Project[]>
    for (const project of projects) {
      if (project.project_status === 'archived') {
        continue
      }
      groups[project.project_status].push(project)
    }
    return groups
  }, [projects])

  const { min: timelineMin, max: timelineMax } = useMemo(() => getTimelineRange(ganttProjects), [ganttProjects])

  if (loading) return <div className={styles.center}>Lade Projekte…</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 4 · Sprint 31</p>
          <h1>Projektboard</h1>
          <p className={styles.subtitle}>Kanban, Fristen, Prioritäten und einfache Timeline in einer Ansicht.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/webplanner')}>
            Webplaner
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/bi')}>
            BI Dashboard
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/contacts')}>
            Kontakte
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/documents')}>
            Dokumente
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/catalog')}>
            Katalog
          </button>
          <button className={styles.btnSecondary} onClick={() => void platformApi.exportProjectsCsv()}>
            CSV Export
          </button>
          <button className={styles.btnPrimary} onClick={() => setCreating(true)}>
            + Neues Projekt
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {creating && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            autoFocus
            type="text"
            placeholder="Projektname"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className={styles.btnPrimary}>Anlegen</button>
          <button type="button" className={styles.btnSecondary} onClick={() => setCreating(false)}>Abbrechen</button>
        </form>
      )}

      <section className={styles.filters}>
        <label className={styles.filterField}>
          <span>Statusfilter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Project['project_status'])}>
            <option value="all">Alle aktiven Phasen</option>
            {BOARD_COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>{column.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.filterFieldSearch}>
          <span>Globale Suche</span>
          <div className={styles.searchRow}>
            <input
              type="search"
              value={searchTerm}
              placeholder="Projekt, Kontakt oder Dokument"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button type="button" className={styles.btnSecondary} onClick={() => void handleGlobalSearch()}>
              {searching ? 'Suche…' : 'Suchen'}
            </button>
          </div>
        </label>
      </section>

      {searchResults.length > 0 && (
        <section className={styles.searchResults}>
          {searchResults.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              className={styles.searchResultCard}
              onClick={() => navigate(result.href)}
            >
              <strong>{result.title}</strong>
              <span>{result.type}</span>
              <span>{result.subtitle ?? result.meta ?? 'Ohne Zusatzinfo'}</span>
            </button>
          ))}
        </section>
      )}

      {projects.length === 0 ? (
        <p className={styles.empty}>Noch keine Projekte. Lege dein erstes Projekt an.</p>
      ) : (
        <>
          <section className={styles.board}>
            {BOARD_COLUMNS.map((column) => (
              <article
                key={column.id}
                className={styles.column}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const projectId = event.dataTransfer.getData('text/project-id')
                  if (projectId) {
                    void handleStatusDrop(projectId, column.id)
                  }
                }}
              >
                <header className={styles.columnHeader}>
                  <strong>{column.label}</strong>
                  <span>{groupedProjects[column.id].length}</span>
                </header>

                <div className={styles.columnBody}>
                  {groupedProjects[column.id].map((project) => (
                    <div
                      key={project.id}
                      className={styles.card}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/project-id', project.id)
                      }}
                    >
                      <div className={styles.cardTop}>
                        <button className={styles.cardTitle} onClick={() => navigate(`/projects/${project.id}`)}>
                          {project.name}
                        </button>
                        <div className={styles.menuWrapper} ref={openMenuId === project.id ? menuRef : undefined}>
                          <button
                            className={styles.btnMenuTrigger}
                            aria-label="Projektmenü öffnen"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId((prev) => (prev === project.id ? null : project.id))
                            }}
                          >
                            ⋯
                          </button>
                          {openMenuId === project.id && (
                            <div className={styles.dropdownMenu} role="menu">
                              <button role="menuitem" className={styles.menuItem} onClick={() => { setOpenMenuId(null); navigate(`/projects/${project.id}`) }}>
                                Bearbeiten
                              </button>
                              <button role="menuitem" className={styles.menuItem} onClick={() => { setOpenMenuId(null); void handleDuplicate(project.id) }}>
                                Duplizieren
                              </button>
                              <button role="menuitem" className={styles.menuItem} onClick={() => { setOpenMenuId(null); void handleArchive(project.id) }}>
                                Archivieren
                              </button>
                              <button role="menuitem" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { setOpenMenuId(null); void handleDelete(project.id) }}>
                                Löschen
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className={styles.cardDescription}>{project.description ?? 'Kein Beschreibungstext'}</p>

                      <div className={styles.progressRow}>
                        <span>{project.progress_pct}% Fortschritt</span>
                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${project.progress_pct}%` }} />
                        </div>
                      </div>

                      <div className={styles.metaGrid}>
                        <span>Priorität: {PRIORITY_LABELS[project.priority]}</span>
                        <span>Fällig: {formatDate(project.deadline)}</span>
                        <span>Verantwortlich: {project.assigned_to ?? 'Nicht gesetzt'}</span>
                        <span>{project._count?.rooms ?? 0} Räume · {project._count?.quotes ?? 0} Angebote</span>
                      </div>

                      <div className={styles.cardQuickActions}>
                        <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/documents?project=${project.id}`)}>
                          Dokumente
                        </button>
                      </div>

                      <div className={styles.cardControls}>
                        <label>
                          <span>Prio</span>
                          <select
                            value={project.priority}
                            disabled={savingProjectId === project.id}
                            onChange={(event) => {
                              void patchProject(project.id, () => projectsApi.assign(project.id, { priority: event.target.value as Project['priority'] }))
                            }}
                          >
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Frist</span>
                          <input
                            type="date"
                            value={project.deadline ? project.deadline.slice(0, 10) : ''}
                            disabled={savingProjectId === project.id}
                            onChange={(event) => {
                              const nextDeadline = event.target.value ? new Date(`${event.target.value}T00:00:00.000Z`).toISOString() : null
                              void patchProject(project.id, () => projectsApi.assign(project.id, { deadline: nextDeadline }))
                            }}
                          />
                        </label>

                        <label>
                          <span>Verantwortlich</span>
                          <input
                            type="text"
                            value={project.assigned_to ?? ''}
                            placeholder="Name oder Rolle"
                            disabled={savingProjectId === project.id}
                            onBlur={(event) => {
                              const value = event.target.value.trim()
                              void patchProject(project.id, () => projectsApi.assign(project.id, { assigned_to: value === '' ? null : value }))
                            }}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              setProjects((prev) => prev.map((entry) => (
                                entry.id === project.id ? { ...entry, assigned_to: nextValue } : entry
                              )))
                            }}
                          />
                        </label>

                        <label>
                          <span>Fortschritt</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={project.progress_pct}
                            disabled={savingProjectId === project.id}
                            onChange={(event) => {
                              const nextProgress = Number(event.target.value)
                              setProjects((prev) => prev.map((entry) => (
                                entry.id === project.id ? { ...entry, progress_pct: nextProgress } : entry
                              )))
                            }}
                            onMouseUp={(event) => {
                              const nextProgress = Number((event.target as HTMLInputElement).value)
                              void patchProject(project.id, () => projectsApi.assign(project.id, { progress_pct: nextProgress }))
                            }}
                            onTouchEnd={(event) => {
                              const nextProgress = Number((event.target as HTMLInputElement).value)
                              void patchProject(project.id, () => projectsApi.assign(project.id, { progress_pct: nextProgress }))
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className={styles.timelineSection}>
            <div className={styles.timelineHeader}>
              <h2>Timeline / Gantt-Basis</h2>
              <span>{ganttProjects.length} Projekte</span>
            </div>

            <div className={styles.timelineList}>
              {ganttProjects.map((project) => {
                const start = new Date(project.start_at).getTime()
                const end = new Date(project.end_at ?? project.start_at).getTime()
                const total = Math.max(1, timelineMax - timelineMin)
                const left = ((start - timelineMin) / total) * 100
                const width = (Math.max(end, start + 86400000) - start) / total * 100

                return (
                  <div key={project.id} className={styles.timelineRow}>
                    <div className={styles.timelineMeta}>
                      <strong>{project.name}</strong>
                      <span>{BOARD_COLUMNS.find((column) => column.id === project.project_status)?.label ?? project.project_status}</span>
                    </div>
                    <div className={styles.timelineTrack}>
                      <div className={styles.timelineBar} style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}>
                        <span>{formatDate(project.deadline)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {showOnboarding && <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />}
    </div>
  )
}
