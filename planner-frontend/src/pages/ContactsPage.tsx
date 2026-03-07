import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  contactsApi,
  type Contact,
  type ContactLeadSource,
  type ContactPartyKind,
  type ContactType,
} from '../api/contacts.js'
import { platformApi } from '../api/platform.js'
import { projectsApi, type Project } from '../api/projects.js'

const LEAD_SOURCE_LABELS: Record<ContactLeadSource, string> = {
  web_planner: 'Webplaner',
  showroom: 'Showroom',
  referral: 'Empfehlung',
  other: 'Sonstiges',
}

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  end_customer: 'Endkunde',
  architect: 'Architekt',
  contractor: 'Ausführender Betrieb',
}

const PARTY_KIND_LABELS: Record<ContactPartyKind, string> = {
  company: 'Unternehmen',
  private_person: 'Privatkontakt',
  contact_person: 'Ansprechpartner',
}

const useStyles = makeStyles({
  page: { display: 'grid', rowGap: tokens.spacingVerticalXL },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  toolbar: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  cardBody: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalS },
  kpisRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalXS,
    borderTop: '1px solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  kpiCell: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' },
  projectChips: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS },
  attachRow: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'flex-end' },
  empty: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingVerticalM,
    '@media (max-width: 600px)': { gridTemplateColumns: '1fr' },
  },
  formFullWidth: { gridColumn: '1 / -1' },
})

export function ContactsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | ContactType>('all')
  const [partyKindFilter, setPartyKindFilter] = useState<'all' | ContactPartyKind>('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'end_customer' as ContactType,
    party_kind: 'private_person' as ContactPartyKind,
    contact_role: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    lead_source: 'other' as ContactLeadSource,
    budget_estimate: '',
  })
  const [attachSelection, setAttachSelection] = useState<Record<string, string>>({})

  async function load(searchTerm?: string) {
    setLoading(true)
    setError(null)
    try {
      const [contactList, projectList] = await Promise.all([
        contactsApi.list({
          search: searchTerm,
          type: typeFilter === 'all' ? undefined : typeFilter,
          party_kind: partyKindFilter === 'all' ? undefined : partyKindFilter,
          contact_role: roleFilter.trim() || undefined,
        }),
        projectsApi.list(),
      ])
      setContacts(contactList)
      setProjects(projectList.filter((p) => p.status === 'active'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakte konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate() {
    try {
      await contactsApi.create({
        type: form.type,
        party_kind: form.party_kind,
        contact_role: form.contact_role || null,
        first_name: form.first_name || null,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        lead_source: form.lead_source,
        budget_estimate: form.budget_estimate ? Number(form.budget_estimate) : null,
      })
      setCreateOpen(false)
      setForm({ type: 'end_customer', party_kind: 'private_person', contact_role: '', first_name: '', last_name: '', email: '', phone: '', company: '', lead_source: 'other', budget_estimate: '' })
      await load(search)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakt konnte nicht erstellt werden')
    }
  }

  async function handleAttach(contactId: string) {
    const projectId = attachSelection[contactId]
    if (!projectId) return
    try {
      await contactsApi.attachToProject(projectId, contactId)
      await load(search)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakt konnte nicht verknüpft werden')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <Spinner label="Lade Kontakte…" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Title2>Kontakte</Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            Kontakte, Lead-Herkunft, Projektanzahl und Umsatz in einer Übersicht.
          </Body1>
        </div>
        <div className={styles.headerActions}>
          <Button appearance="secondary" onClick={() => void platformApi.exportContactsCsv()}>
            CSV Export
          </Button>
          <Dialog open={createOpen} onOpenChange={(_e, data) => { setCreateOpen(data.open) }}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary">+ Kontakt</Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Neuer Kontakt</DialogTitle>
                <DialogContent>
                  <div className={styles.formGrid}>
                    <div>
                      <Caption1>Typ</Caption1>
                      <Select value={form.type} onChange={(_e, d) => setForm((prev) => ({ ...prev, type: d.value as ContactType }))}>
                        {Object.entries(CONTACT_TYPE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
                      </Select>
                    </div>
                    <div>
                      <Caption1>Kontaktart</Caption1>
                      <Select value={form.party_kind} onChange={(_e, d) => setForm((prev) => ({ ...prev, party_kind: d.value as ContactPartyKind }))}>
                        {Object.entries(PARTY_KIND_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
                      </Select>
                    </div>
                    <Field label="Vorname"><Input value={form.first_name} onChange={(_e, d) => setForm((prev) => ({ ...prev, first_name: d.value }))} /></Field>
                    <Field label="Nachname" required><Input value={form.last_name} onChange={(_e, d) => setForm((prev) => ({ ...prev, last_name: d.value }))} /></Field>
                    <Field label="Firma"><Input value={form.company} onChange={(_e, d) => setForm((prev) => ({ ...prev, company: d.value }))} /></Field>
                    <Field label="Rolle"><Input value={form.contact_role} onChange={(_e, d) => setForm((prev) => ({ ...prev, contact_role: d.value }))} /></Field>
                    <Field label="E-Mail"><Input type="email" value={form.email} onChange={(_e, d) => setForm((prev) => ({ ...prev, email: d.value }))} /></Field>
                    <Field label="Telefon"><Input type="tel" value={form.phone} onChange={(_e, d) => setForm((prev) => ({ ...prev, phone: d.value }))} /></Field>
                    <div>
                      <Caption1>Lead-Quelle</Caption1>
                      <Select value={form.lead_source} onChange={(_e, d) => setForm((prev) => ({ ...prev, lead_source: d.value as ContactLeadSource }))}>
                        {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
                      </Select>
                    </div>
                    <Field label="Budget (€)"><Input type="number" min="0" value={form.budget_estimate} onChange={(_e, d) => setForm((prev) => ({ ...prev, budget_estimate: d.value }))} /></Field>
                  </div>
                </DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Abbrechen</Button>
                  </DialogTrigger>
                  <Button appearance="primary" disabled={!form.last_name.trim()} onClick={() => void handleCreate()}>
                    Anlegen
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      </div>

      {error && (
        <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filterField} style={{ flex: 1, minWidth: '200px' }}>
          <Caption1>Suche</Caption1>
          <Input
            type="search"
            placeholder="Name, Firma, E-Mail oder Telefon"
            value={search}
            onChange={(_e, d) => setSearch(d.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void load(search) }}
          />
        </div>
        <div className={styles.filterField}>
          <Caption1>Typ</Caption1>
          <Select value={typeFilter} onChange={(_e, d) => setTypeFilter(d.value as 'all' | ContactType)}>
            <Option value="all">Alle Typen</Option>
            {Object.entries(CONTACT_TYPE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Caption1>Kontaktart</Caption1>
          <Select value={partyKindFilter} onChange={(_e, d) => setPartyKindFilter(d.value as 'all' | ContactPartyKind)}>
            <Option value="all">Alle Arten</Option>
            {Object.entries(PARTY_KIND_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Caption1>Rolle</Caption1>
          <Input
            placeholder="z. B. Einkauf"
            value={roleFilter}
            onChange={(_e, d) => setRoleFilter(d.value)}
          />
        </div>
        <Button appearance="secondary" onClick={() => void load(search)}>Suchen</Button>
      </div>

      <div className={styles.grid}>
        {contacts.map((contact) => (
          <Card key={contact.id} appearance="filled">
            <CardHeader
              header={
                <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>
                  {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.last_name}
                </Body1>
              }
              description={
                <Caption1>{contact.company ?? 'Privatkontakt'}</Caption1>
              }
              action={
                <Badge appearance="tint" size="small">{LEAD_SOURCE_LABELS[contact.lead_source]}</Badge>
              }
            />

            <div className={styles.cardBody}>
              <div className={styles.metaRow}>
                <Caption1>{CONTACT_TYPE_LABELS[contact.type]}</Caption1>
                <Caption1>·</Caption1>
                <Caption1>{PARTY_KIND_LABELS[contact.party_kind]}</Caption1>
                {contact.contact_role && <><Caption1>·</Caption1><Caption1>{contact.contact_role}</Caption1></>}
              </div>
              <div className={styles.metaRow}>
                <Caption1>{contact.email ?? 'Keine E-Mail'}</Caption1>
                <Caption1>·</Caption1>
                <Caption1>{contact.phone ?? 'Kein Telefon'}</Caption1>
              </div>

              <div className={styles.kpisRow}>
                <div className={styles.kpiCell}>
                  <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>{contact.project_count}</Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Projekte</Caption1>
                </div>
                <div className={styles.kpiCell}>
                  <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>
                    {contact.revenue_total.toLocaleString('de-DE')} €
                  </Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Umsatz</Caption1>
                </div>
                <div className={styles.kpiCell}>
                  <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>{contact.conversion_pct}%</Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Conversion</Caption1>
                </div>
              </div>

              <div className={styles.projectChips}>
                {contact.projects.length === 0 ? (
                  <Caption1 className={styles.empty}>Noch keine Projektverknüpfung</Caption1>
                ) : (
                  contact.projects.map((project) => (
                    <Button
                      key={project.id}
                      appearance="outline"
                      size="small"
                      onClick={() => navigate('/projects/' + project.id)}
                    >
                      {project.name}
                    </Button>
                  ))
                )}
              </div>

              <div className={styles.attachRow}>
                <div style={{ flex: 1 }}>
                  <Select
                    value={attachSelection[contact.id] ?? ''}
                    onChange={(_e, d) => setAttachSelection((prev) => ({ ...prev, [contact.id]: d.value }))}
                  >
                    <Option value="">Projekt auswählen…</Option>
                    {projects.map((project) => (
                      <Option key={project.id} value={project.id}>{project.name}</Option>
                    ))}
                  </Select>
                </div>
                <Button appearance="secondary" onClick={() => void handleAttach(contact.id)}>
                  Verknüpfen
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
