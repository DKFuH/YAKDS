import { useEffect, useState } from 'react'
import {
  complianceApi,
  type GdprDeletionRequest,
  type GdprScope,
  type RoleAction,
  type RoleName,
  type RolePermission,
  type SlaSnapshot,
} from '../api/compliance.js'
import styles from './CompliancePage.module.css'

type TabId = 'gdpr' | 'rbac' | 'sla'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const GDPR_SCOPES: GdprScope[] = ['contacts', 'projects', 'leads', 'documents']
const ROLES: RoleName[] = ['admin', 'sales', 'planner', 'viewer']
const ACTIONS: RoleAction[] = ['read', 'write', 'delete', 'export']

function formatDateTime(value: string | null): string {
  if (!value) {
    return '–'
  }

  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CompliancePage() {
  const [activeTab, setActiveTab] = useState<TabId>('gdpr')

  const [gdprRequests, setGdprRequests] = useState<GdprDeletionRequest[]>([])
  const [gdprLoading, setGdprLoading] = useState(false)
  const [gdprError, setGdprError] = useState<string | null>(null)
  const [contactId, setContactId] = useState('')
  const [scopeSelection, setScopeSelection] = useState<GdprScope[]>(['contacts'])
  const [gdprSubmitting, setGdprSubmitting] = useState(false)

  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [rbacLoading, setRbacLoading] = useState(false)
  const [rbacError, setRbacError] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<RoleName>('admin')
  const [newResource, setNewResource] = useState('projects')
  const [newAction, setNewAction] = useState<RoleAction>('read')
  const [rbacSubmitting, setRbacSubmitting] = useState(false)

  const [snapshots, setSnapshots] = useState<SlaSnapshot[]>([])
  const [slaLoading, setSlaLoading] = useState(false)
  const [slaError, setSlaError] = useState<string | null>(null)

  async function loadGdprRequests() {
    setGdprLoading(true)
    setGdprError(null)
    try {
      const data = await complianceApi.listDeletionRequests(TENANT_ID)
      setGdprRequests(data)
    } catch (error) {
      setGdprError(error instanceof Error ? error.message : 'DSGVO-Anfragen konnten nicht geladen werden')
    } finally {
      setGdprLoading(false)
    }
  }

  async function loadRolePermissions() {
    setRbacLoading(true)
    setRbacError(null)
    try {
      const data = await complianceApi.listRolePermissions(TENANT_ID)
      setPermissions(data)
    } catch (error) {
      setRbacError(error instanceof Error ? error.message : 'RBAC-Berechtigungen konnten nicht geladen werden')
    } finally {
      setRbacLoading(false)
    }
  }

  async function loadSlaSnapshots() {
    setSlaLoading(true)
    setSlaError(null)
    try {
      const data = await complianceApi.listSlaSnapshots(TENANT_ID, 20)
      setSnapshots(data)
    } catch (error) {
      setSlaError(error instanceof Error ? error.message : 'SLA-Snapshots konnten nicht geladen werden')
    } finally {
      setSlaLoading(false)
    }
  }

  useEffect(() => {
    void loadGdprRequests()
    void loadRolePermissions()
    void loadSlaSnapshots()
  }, [])

  function toggleScope(scope: GdprScope) {
    setScopeSelection((current) =>
      current.includes(scope)
        ? current.filter((entry) => entry !== scope)
        : [...current, scope],
    )
  }

  async function submitDeletionRequest() {
    if (!contactId.trim()) {
      setGdprError('Contact-ID ist erforderlich.')
      return
    }

    if (scopeSelection.length === 0) {
      setGdprError('Mindestens ein Scope muss ausgewählt sein.')
      return
    }

    setGdprSubmitting(true)
    setGdprError(null)
    try {
      await complianceApi.createDeletionRequest(TENANT_ID, {
        contact_id: contactId.trim(),
        performed_by: 'compliance-ui',
        scope: scopeSelection,
      })
      setContactId('')
      await loadGdprRequests()
    } catch (error) {
      setGdprError(error instanceof Error ? error.message : 'DSGVO-Anfrage konnte nicht erstellt werden')
    } finally {
      setGdprSubmitting(false)
    }
  }

  async function createPermission() {
    if (!newResource.trim()) {
      setRbacError('Ressource ist erforderlich.')
      return
    }

    setRbacSubmitting(true)
    setRbacError(null)
    try {
      await complianceApi.createRolePermission(TENANT_ID, {
        role: newRole,
        resource: newResource.trim(),
        action: newAction,
      })
      await loadRolePermissions()
    } catch (error) {
      setRbacError(error instanceof Error ? error.message : 'Berechtigung konnte nicht erstellt werden')
    } finally {
      setRbacSubmitting(false)
    }
  }

  async function deletePermission(id: string) {
    try {
      await complianceApi.deleteRolePermission(TENANT_ID, id)
      await loadRolePermissions()
    } catch (error) {
      setRbacError(error instanceof Error ? error.message : 'Berechtigung konnte nicht gelöscht werden')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Compliance</h1>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={activeTab === 'gdpr' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('gdpr')}>
          DSGVO
        </button>
        <button type="button" className={activeTab === 'rbac' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('rbac')}>
          RBAC
        </button>
        <button type="button" className={activeTab === 'sla' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('sla')}>
          SLA
        </button>
      </div>

      {activeTab === 'gdpr' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DSGVO-Löschanfrage</h2>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Contact-ID
              <input
                className={styles.input}
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                placeholder="UUID"
              />
            </label>
          </div>
          <div className={styles.formRow}>
            {GDPR_SCOPES.map((scope) => (
              <label key={scope} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={scopeSelection.includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                {scope}
              </label>
            ))}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.primaryBtn} onClick={() => void submitDeletionRequest()} disabled={gdprSubmitting}>
              {gdprSubmitting ? 'Ausführen …' : 'Ausführen'}
            </button>
          </div>

          {gdprError && <p className={styles.error}>{gdprError}</p>}
          {gdprLoading ? (
            <p className={styles.hint}>Laden …</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Contact-ID</th>
                  <th>Scope</th>
                  <th>Angefordert</th>
                  <th>Abgeschlossen</th>
                </tr>
              </thead>
              <tbody>
                {gdprRequests.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.hint}>Keine Löschanfragen vorhanden.</td>
                  </tr>
                )}
                {gdprRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.contact_id ?? '–'}</td>
                    <td>{request.scope_json.join(', ')}</td>
                    <td>{formatDateTime(request.requested_at)}</td>
                    <td>{formatDateTime(request.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {activeTab === 'rbac' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Rollen-Berechtigungen</h2>

          <div className={styles.formInline}>
            <select
              className={styles.select}
              aria-label="Rolle"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as RoleName)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <input
              className={styles.input}
              value={newResource}
              onChange={(event) => setNewResource(event.target.value)}
              placeholder="resource"
            />

            <select
              className={styles.select}
              aria-label="Aktion"
              value={newAction}
              onChange={(event) => setNewAction(event.target.value as RoleAction)}
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <button type="button" className={styles.primaryBtn} onClick={() => void createPermission()} disabled={rbacSubmitting}>
              {rbacSubmitting ? 'Speichern …' : 'Hinzufügen'}
            </button>
          </div>

          {rbacError && <p className={styles.error}>{rbacError}</p>}
          {rbacLoading ? (
            <p className={styles.hint}>Laden …</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rolle</th>
                  <th>Ressource</th>
                  <th>Aktion</th>
                  <th>Filiale</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {permissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.hint}>Keine Berechtigungen vorhanden.</td>
                  </tr>
                )}
                {permissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>{permission.role}</td>
                    <td>{permission.resource}</td>
                    <td>{permission.action}</td>
                    <td>{permission.branch_id ?? 'alle'}</td>
                    <td>
                      <button type="button" className={styles.secondaryBtn} onClick={() => void deletePermission(permission.id)}>
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {activeTab === 'sla' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SLA-Snapshots (letzte 20)</h2>
          {slaError && <p className={styles.error}>{slaError}</p>}
          {slaLoading ? (
            <p className={styles.hint}>Laden …</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>P50 (ms)</th>
                  <th>P95 (ms)</th>
                  <th>Uptime (%)</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.hint}>Keine SLA-Snapshots vorhanden.</td>
                  </tr>
                )}
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{snapshot.endpoint}</td>
                    <td>{snapshot.p50_ms.toFixed(1)}</td>
                    <td>{snapshot.p95_ms.toFixed(1)}</td>
                    <td>{snapshot.uptime_pct.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
