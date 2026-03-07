import { useEffect, useState } from 'react'
import {
  Body1Strong,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Tab,
  TabList,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  complianceApi,
  type GdprDeletionRequest,
  type GdprScope,
  type RoleAction,
  type RoleName,
  type RolePermission,
  type SlaSnapshot,
} from '../api/compliance.js'

type TabId = 'gdpr' | 'rbac' | 'sla'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const GDPR_SCOPES: GdprScope[] = ['contacts', 'projects', 'leads', 'documents']
const ROLES: RoleName[] = ['admin', 'sales', 'planner', 'viewer']
const ACTIONS: RoleAction[] = ['read', 'write', 'delete', 'export']

function formatDateTime(value: string | null): string {
  if (!value) return '–'
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  formRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: tokens.spacingVerticalS,
  },
  scopeRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalS,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase300 },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
})

export function CompliancePage() {
  const styles = useStyles()
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
    setGdprLoading(true); setGdprError(null)
    try { setGdprRequests(await complianceApi.listDeletionRequests(TENANT_ID)) }
    catch (e) { setGdprError(e instanceof Error ? e.message : 'Fehler') }
    finally { setGdprLoading(false) }
  }

  async function loadRolePermissions() {
    setRbacLoading(true); setRbacError(null)
    try { setPermissions(await complianceApi.listRolePermissions(TENANT_ID)) }
    catch (e) { setRbacError(e instanceof Error ? e.message : 'Fehler') }
    finally { setRbacLoading(false) }
  }

  async function loadSlaSnapshots() {
    setSlaLoading(true); setSlaError(null)
    try { setSnapshots(await complianceApi.listSlaSnapshots(TENANT_ID, 20)) }
    catch (e) { setSlaError(e instanceof Error ? e.message : 'Fehler') }
    finally { setSlaLoading(false) }
  }

  useEffect(() => {
    void loadGdprRequests()
    void loadRolePermissions()
    void loadSlaSnapshots()
  }, [])

  function toggleScope(scope: GdprScope) {
    setScopeSelection((cur) => cur.includes(scope) ? cur.filter((s) => s !== scope) : [...cur, scope])
  }

  async function submitDeletionRequest() {
    if (!contactId.trim()) { setGdprError('Contact-ID ist erforderlich.'); return }
    if (scopeSelection.length === 0) { setGdprError('Mindestens ein Scope muss ausgewaehlt sein.'); return }
    setGdprSubmitting(true); setGdprError(null)
    try {
      await complianceApi.createDeletionRequest(TENANT_ID, {
        contact_id: contactId.trim(), performed_by: 'compliance-ui', scope: scopeSelection,
      })
      setContactId('')
      await loadGdprRequests()
    } catch (e) { setGdprError(e instanceof Error ? e.message : 'Fehler') }
    finally { setGdprSubmitting(false) }
  }

  async function createPermission() {
    if (!newResource.trim()) { setRbacError('Ressource ist erforderlich.'); return }
    setRbacSubmitting(true); setRbacError(null)
    try {
      await complianceApi.createRolePermission(TENANT_ID, { role: newRole, resource: newResource.trim(), action: newAction })
      await loadRolePermissions()
    } catch (e) { setRbacError(e instanceof Error ? e.message : 'Fehler') }
    finally { setRbacSubmitting(false) }
  }

  async function deletePermission(id: string) {
    try { await complianceApi.deleteRolePermission(TENANT_ID, id); await loadRolePermissions() }
    catch (e) { setRbacError(e instanceof Error ? e.message : 'Fehler') }
  }

  return (
    <div className={styles.page}>
      <Title2>Compliance</Title2>

      <TabList selectedValue={activeTab} onTabSelect={(_e, d) => setActiveTab(d.value as TabId)}>
        <Tab value='gdpr'>DSGVO</Tab>
        <Tab value='rbac'>RBAC</Tab>
        <Tab value='sla'>SLA</Tab>
      </TabList>

      {activeTab === 'gdpr' && (
        <Card>
          <CardHeader header={<Body1Strong>DSGVO-Loeschanfrage</Body1Strong>} />
          <div className={styles.formRow}>
            <Field label='Contact-ID'>
              <Input value={contactId} onChange={(_e, d) => setContactId(d.value)} placeholder='UUID' />
            </Field>
          </div>
          <div className={styles.scopeRow}>
            {GDPR_SCOPES.map((scope) => (
              <Checkbox
                key={scope}
                checked={scopeSelection.includes(scope)}
                onChange={() => toggleScope(scope)}
                label={scope}
              />
            ))}
          </div>
          <div style={{ marginBottom: tokens.spacingVerticalS }}>
            <Button
              appearance='primary'
              onClick={() => void submitDeletionRequest()}
              disabled={gdprSubmitting}
              icon={gdprSubmitting ? <Spinner size='tiny' /> : undefined}
            >
              {gdprSubmitting ? 'Ausfuehren...' : 'Ausfuehren'}
            </Button>
          </div>
          {gdprError && <MessageBar intent='error'><MessageBarBody>{gdprError}</MessageBarBody></MessageBar>}
          {gdprLoading ? <Spinner label='Laden...' /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>
                  <th className={styles.th}>Contact-ID</th>
                  <th className={styles.th}>Scope</th>
                  <th className={styles.th}>Angefordert</th>
                  <th className={styles.th}>Abgeschlossen</th>
                </tr></thead>
                <tbody>
                  {gdprRequests.length === 0 && (
                    <tr><td colSpan={4} className={styles.td}><Caption1>Keine Loeschanfragen vorhanden.</Caption1></td></tr>
                  )}
                  {gdprRequests.map((req) => (
                    <tr key={req.id}>
                      <td className={styles.td}>{req.contact_id ?? '–'}</td>
                      <td className={styles.td}>{req.scope_json.join(', ')}</td>
                      <td className={styles.td}>{formatDateTime(req.requested_at)}</td>
                      <td className={styles.td}>{formatDateTime(req.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'rbac' && (
        <Card>
          <CardHeader header={<Body1Strong>Rollen-Berechtigungen</Body1Strong>} />
          <div className={styles.formRow}>
            <Field label='Rolle'>
              <Select value={newRole} onChange={(_e, d) => setNewRole(d.value as RoleName)}>
                {ROLES.map((role) => <Option key={role} value={role}>{role}</Option>)}
              </Select>
            </Field>
            <Field label='Ressource'>
              <Input value={newResource} onChange={(_e, d) => setNewResource(d.value)} placeholder='resource' />
            </Field>
            <Field label='Aktion'>
              <Select value={newAction} onChange={(_e, d) => setNewAction(d.value as RoleAction)}>
                {ACTIONS.map((action) => <Option key={action} value={action}>{action}</Option>)}
              </Select>
            </Field>
            <Button
              appearance='primary'
              onClick={() => void createPermission()}
              disabled={rbacSubmitting}
              icon={rbacSubmitting ? <Spinner size='tiny' /> : undefined}
              style={{ alignSelf: 'flex-end' }}
            >
              Hinzufuegen
            </Button>
          </div>
          {rbacError && <MessageBar intent='error'><MessageBarBody>{rbacError}</MessageBarBody></MessageBar>}
          {rbacLoading ? <Spinner label='Laden...' /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>
                  <th className={styles.th}>Rolle</th>
                  <th className={styles.th}>Ressource</th>
                  <th className={styles.th}>Aktion</th>
                  <th className={styles.th}>Filiale</th>
                  <th className={styles.th}></th>
                </tr></thead>
                <tbody>
                  {permissions.length === 0 && (
                    <tr><td colSpan={5} className={styles.td}><Caption1>Keine Berechtigungen vorhanden.</Caption1></td></tr>
                  )}
                  {permissions.map((perm) => (
                    <tr key={perm.id}>
                      <td className={styles.td}>{perm.role}</td>
                      <td className={styles.td}>{perm.resource}</td>
                      <td className={styles.td}>{perm.action}</td>
                      <td className={styles.td}>{perm.branch_id ?? 'alle'}</td>
                      <td className={styles.td}>
                        <Button appearance='subtle' size='small' onClick={() => void deletePermission(perm.id)}>Loeschen</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'sla' && (
        <Card>
          <CardHeader header={<Body1Strong>SLA-Snapshots (letzte 20)</Body1Strong>} />
          {slaError && <MessageBar intent='error'><MessageBarBody>{slaError}</MessageBarBody></MessageBar>}
          {slaLoading ? <Spinner label='Laden...' /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>
                  <th className={styles.th}>Endpoint</th>
                  <th className={styles.th}>P50 (ms)</th>
                  <th className={styles.th}>P95 (ms)</th>
                  <th className={styles.th}>Uptime (%)</th>
                </tr></thead>
                <tbody>
                  {snapshots.length === 0 && (
                    <tr><td colSpan={4} className={styles.td}><Caption1>Keine SLA-Snapshots vorhanden.</Caption1></td></tr>
                  )}
                  {snapshots.map((snap) => (
                    <tr key={snap.id}>
                      <td className={styles.td}>{snap.endpoint}</td>
                      <td className={styles.td}>{snap.p50_ms.toFixed(1)}</td>
                      <td className={styles.td}>{snap.p95_ms.toFixed(1)}</td>
                      <td className={styles.td}>{snap.uptime_pct.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
