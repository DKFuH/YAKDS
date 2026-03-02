import type { Opening, WallSegment } from '@shared/types'
import type { CatalogItem, CatalogItemType } from './catalog.js'
import type { Placement } from './placements.js'
import type { Project, ProjectDetail } from './projects.js'
import type { RoomBoundaryPayload, RoomPayload } from './rooms.js'
import type { ValidatePayload, ValidateResponse } from './validate.js'

interface DemoStore {
  projects: ProjectDetail[]
  catalog: CatalogItem[]
  dashboard_configs: Array<{
    id: string
    user_id: string
    tenant_id: string
    widgets: Array<{ id: string; title?: string; config?: Record<string, unknown> }>
    layout: { columns: number; items: Array<{ widget_id: string; x: number; y: number; w: number; h: number }> }
    created_at: string
    updated_at: string
  }>
  catalog_indices: Array<{
    id: string
    project_id: string
    catalog_id: string
    purchase_index: number
    sales_index: number
    applied_at: string
    applied_by: string
  }>
  documents: Array<{
    id: string
    project_id: string
    tenant_id: string
    filename: string
    original_filename: string | null
    mime_type: string
    size_bytes: number
    uploaded_by: string
    uploaded_at: string
    type: 'quote_pdf' | 'render_image' | 'cad_import' | 'email' | 'contract' | 'other'
    source_kind: 'manual_upload' | 'quote_export' | 'render_job' | 'import_job'
    source_id: string | null
    storage_provider: 'demo_memory'
    storage_bucket: null
    storage_key: string
    storage_version: number
    external_url: string | null
    tags: string[]
    is_public: boolean
    download_url: string
    preview_url: string
  }>
  contacts: Array<{
    id: string
    tenant_id: string
    type: 'end_customer' | 'architect' | 'contractor'
    company: string | null
    first_name: string | null
    last_name: string
    email: string | null
    phone: string | null
    address_json: Record<string, unknown>
    lead_source: 'web_planner' | 'showroom' | 'referral' | 'other'
    budget_estimate: number | null
    notes: string | null
    created_at: string
    updated_at: string
    project_ids: string[]
  }>
}

const STORAGE_KEY = 'yakds-demo-store-v1'

function now(): string {
  return new Date().toISOString()
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildBoundary(widthMm: number, depthMm: number): RoomBoundaryPayload {
  const vertices = [
    { id: uid('v'), index: 0, x_mm: 0, y_mm: 0 },
    { id: uid('v'), index: 1, x_mm: widthMm, y_mm: 0 },
    { id: uid('v'), index: 2, x_mm: widthMm, y_mm: depthMm },
    { id: uid('v'), index: 3, x_mm: 0, y_mm: depthMm }
  ]

  const wall_segments: WallSegment[] = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]
    const horizontal = vertex.y_mm === next.y_mm
    return {
      id: uid('wall'),
      index,
      start_vertex_id: vertex.id,
      end_vertex_id: next.id,
      length_mm: horizontal ? Math.abs(next.x_mm - vertex.x_mm) : Math.abs(next.y_mm - vertex.y_mm)
    }
  })

  return { vertices, wall_segments }
}

function buildRoom(projectId: string, name = 'Küche'): RoomPayload {
  const timestamp = now()
  return {
    id: uid('room'),
    project_id: projectId,
    name,
    ceiling_height_mm: 2500,
    boundary: buildBoundary(4200, 3200),
    ceiling_constraints: [],
    openings: [],
    placements: [],
    created_at: timestamp,
    updated_at: timestamp
  }
}

function seedCatalog(): CatalogItem[] {
  const items: Array<{
    sku: string
    name: string
    type: CatalogItemType
    width_mm: number
    height_mm: number
    depth_mm: number
    list_price_net: number
  }> = [
    { sku: 'US-060', name: 'Unterschrank 60', type: 'base_cabinet', width_mm: 600, height_mm: 720, depth_mm: 560, list_price_net: 249 },
    { sku: 'US-080', name: 'Unterschrank 80', type: 'base_cabinet', width_mm: 800, height_mm: 720, depth_mm: 560, list_price_net: 289 },
    { sku: 'HS-090', name: 'Hängeschrank 90', type: 'wall_cabinet', width_mm: 900, height_mm: 720, depth_mm: 350, list_price_net: 199 },
    { sku: 'TS-060', name: 'Hochschrank 60', type: 'tall_cabinet', width_mm: 600, height_mm: 2100, depth_mm: 600, list_price_net: 599 },
    { sku: 'APL-001', name: 'Arbeitsplatte Eiche 2 m', type: 'worktop', width_mm: 2000, height_mm: 38, depth_mm: 635, list_price_net: 179 },
    { sku: 'GER-001', name: 'Einbauherd', type: 'appliance', width_mm: 600, height_mm: 595, depth_mm: 560, list_price_net: 749 }
  ]

  return items.map((item) => ({
    id: uid('cat'),
    ...item,
    dealer_price_net: Math.round(item.list_price_net * 0.72 * 100) / 100,
    default_markup_pct: 25,
    tax_group_id: 'tax-standard',
    pricing_group_id: 'pricing-standard'
  }))
}

function seedStore(): DemoStore {
  const timestamp = now()
  const projectId = uid('project')
  const room = buildRoom(projectId)
  return {
    projects: [
      {
        id: projectId,
        name: 'Demo Küche',
        description: 'Lokaler Demo-Modus ohne Datenbank',
        status: 'active',
        project_status: 'planning',
        deadline: null,
        priority: 'medium',
        assigned_to: 'Studio Team',
        advisor: null,
        sales_rep: null,
        progress_pct: 35,
        lead_status: 'qualified',
        quote_value: 12990,
        close_probability: 55,
        created_at: timestamp,
        updated_at: timestamp,
        _count: { rooms: 1 },
        rooms: [room],
        quotes: []
      }
    ],
    catalog: seedCatalog(),
    dashboard_configs: [],
    catalog_indices: [],
    documents: [
      {
        id: uid('doc'),
        project_id: projectId,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        filename: 'angebot-demo.pdf',
        original_filename: 'angebot-demo.pdf',
        mime_type: 'application/pdf',
        size_bytes: 24,
        uploaded_by: 'system:quote-export',
        uploaded_at: timestamp,
        type: 'quote_pdf',
        source_kind: 'quote_export',
        source_id: 'quote-demo-1',
        storage_provider: 'demo_memory',
        storage_bucket: null,
        storage_key: uid('storage'),
        storage_version: 1,
        external_url: null,
        tags: ['quote', 'demo'],
        is_public: false,
        download_url: 'data:application/pdf;base64,JVBERi0xLjQKJURlbW8gUERGCg==',
        preview_url: 'data:application/pdf;base64,JVBERi0xLjQKJURlbW8gUERGCg=='
      }
    ],
    contacts: [
      {
        id: uid('contact'),
        tenant_id: '00000000-0000-0000-0000-000000000001',
        type: 'end_customer',
        company: null,
        first_name: 'Max',
        last_name: 'Mustermann',
        email: 'max@example.de',
        phone: '+49 151 000000',
        address_json: { city: 'Hamburg' },
        lead_source: 'web_planner',
        budget_estimate: 15000,
        notes: 'Demo-Kontakt',
        created_at: timestamp,
        updated_at: timestamp,
        project_ids: [projectId]
      }
    ]
  }
}

function loadStore(): DemoStore {
  if (typeof window === 'undefined') {
    return seedStore()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = seedStore()
    saveStore(seeded)
    return seeded
  }

  try {
    return JSON.parse(raw) as DemoStore
  } catch {
    const seeded = seedStore()
    saveStore(seeded)
    return seeded
  }
}

function saveStore(store: DemoStore): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.localStorage.setItem('yakds-demo-mode', 'true')
  }
}

function updateStore(mutator: (store: DemoStore) => DemoStore): DemoStore {
  const next = mutator(loadStore())
  saveStore(next)
  return next
}

export function isDemoModeEnabled(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem('yakds-demo-mode') === 'true'
}

export function listProjects(): Project[] {
  return loadStore().projects.map(({ rooms, quotes, ...project }) => ({
    ...project,
    _count: { rooms: rooms.length }
  }))
}

export function getProject(id: string): ProjectDetail {
  const project = loadStore().projects.find((entry) => entry.id === id)
  if (!project) {
    throw new Error('Projekt nicht gefunden.')
  }
  return project
}

export function createProject(data: { name: string; description?: string }): Project {
  const timestamp = now()
  const projectId = uid('project')
  const room = buildRoom(projectId)

  const store = updateStore((current) => ({
    ...current,
    projects: [
      {
        id: projectId,
        name: data.name,
        description: data.description ?? null,
        status: 'active',
        project_status: 'lead',
        deadline: null,
        priority: 'medium',
        assigned_to: null,
        advisor: null,
        sales_rep: null,
        progress_pct: 0,
        lead_status: 'new',
        quote_value: null,
        close_probability: null,
        created_at: timestamp,
        updated_at: timestamp,
        _count: { rooms: 1 },
        rooms: [room],
        quotes: []
      },
      ...current.projects
    ]
  }))

  const project = store.projects.find((entry) => entry.id === projectId)
  if (!project) {
    throw new Error('Projekt konnte nicht erstellt werden.')
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    project_status: project.project_status,
    deadline: project.deadline,
    priority: project.priority,
    assigned_to: project.assigned_to,
    advisor: project.advisor,
    sales_rep: project.sales_rep,
    progress_pct: project.progress_pct,
    lead_status: project.lead_status,
    quote_value: project.quote_value,
    close_probability: project.close_probability,
    created_at: project.created_at,
    updated_at: project.updated_at,
    _count: { rooms: project.rooms.length }
  }
}

export function updateProject(
  id: string,
  data: {
    name?: string
    description?: string | null
    status?: string
    project_status?: Project['project_status']
    deadline?: string | null
    priority?: Project['priority']
    assigned_to?: string | null
    advisor?: string | null
    sales_rep?: string | null
    progress_pct?: number
  }
): Project {
  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) =>
      project.id === id
        ? {
            ...project,
            name: data.name ?? project.name,
            description: data.description ?? project.description,
            status: (data.status as Project['status'] | undefined) ?? project.status,
            project_status: data.project_status ?? project.project_status,
            deadline: data.deadline !== undefined ? data.deadline : project.deadline,
            priority: data.priority ?? project.priority,
            assigned_to: data.assigned_to !== undefined ? data.assigned_to : project.assigned_to,
            advisor: data.advisor !== undefined ? data.advisor : project.advisor,
            sales_rep: data.sales_rep !== undefined ? data.sales_rep : project.sales_rep,
            progress_pct: data.progress_pct ?? project.progress_pct,
            updated_at: now()
          }
        : project
    )
  }))

  const project = store.projects.find((entry) => entry.id === id)
  if (!project) {
    throw new Error('Projekt nicht gefunden.')
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    project_status: project.project_status,
    deadline: project.deadline,
    priority: project.priority,
    assigned_to: project.assigned_to,
    advisor: project.advisor,
    sales_rep: project.sales_rep,
    progress_pct: project.progress_pct,
    lead_status: project.lead_status,
    quote_value: project.quote_value,
    close_probability: project.close_probability,
    created_at: project.created_at,
    updated_at: project.updated_at,
    _count: { rooms: project.rooms.length }
  }
}

export function deleteProject(id: string): void {
  updateStore((current) => ({
    ...current,
    projects: current.projects.filter((project) => project.id !== id),
    documents: current.documents.filter((document) => document.project_id !== id),
    contacts: current.contacts.map((contact) => ({
      ...contact,
      project_ids: contact.project_ids.filter((projectId) => projectId !== id)
    }))
  }))
}

export function listContacts(search?: string) {
  const store = loadStore()
  let contacts = [...store.contacts]
  if (search?.trim()) {
    const query = search.trim().toLowerCase()
    contacts = contacts.filter((contact) =>
      [contact.first_name, contact.last_name, contact.company, contact.email, contact.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }

  return contacts.map((contact) => {
    const projects = store.projects.filter((project) => contact.project_ids.includes(project.id))
    const revenueTotal = projects.reduce((sum, project) => sum + (project.quote_value ?? 0), 0)
    const conversionPct = projects.length > 0
      ? Math.round((projects.filter((project) => project.lead_status === 'won').length / projects.length) * 100)
      : 0

    return {
      ...contact,
      project_count: projects.length,
      revenue_total: revenueTotal,
      conversion_pct: conversionPct,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        quote_value: project.quote_value ?? null,
        lead_status: project.lead_status ?? null,
        project_status: project.project_status,
        is_primary: true
      }))
    }
  })
}

export function createContact(
  tenantId: string,
  data: {
    type?: 'end_customer' | 'architect' | 'contractor'
    company?: string | null
    first_name?: string | null
    last_name: string
    email?: string | null
    phone?: string | null
    address?: Record<string, unknown>
    lead_source?: 'web_planner' | 'showroom' | 'referral' | 'other'
    budget_estimate?: number | null
    notes?: string | null
  },
) {
  const timestamp = now()
  const contactId = uid('contact')

  const store = updateStore((current) => ({
    ...current,
    contacts: [
      {
        id: contactId,
        tenant_id: tenantId,
        type: data.type ?? 'end_customer',
        company: data.company ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name,
        email: data.email?.toLowerCase() ?? null,
        phone: data.phone ?? null,
        address_json: data.address ?? {},
        lead_source: data.lead_source ?? 'other',
        budget_estimate: data.budget_estimate ?? null,
        notes: data.notes ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        project_ids: []
      },
      ...current.contacts
    ]
  }))

  const created = store.contacts.find((contact) => contact.id === contactId)
  if (!created) {
    throw new Error('Kontakt konnte nicht erstellt werden.')
  }

  return listContacts().find((contact) => contact.id === created.id)!
}

export function attachContactToProject(projectId: string, contactId: string) {
  updateStore((current) => ({
    ...current,
    contacts: current.contacts.map((contact) => (
      contact.id === contactId && !contact.project_ids.includes(projectId)
        ? { ...contact, project_ids: [...contact.project_ids, projectId], updated_at: now() }
        : contact
    ))
  }))

  return { project_id: projectId, contact_id: contactId }
}

export function listDocuments(projectId: string, params?: {
  type?: 'quote_pdf' | 'render_image' | 'cad_import' | 'email' | 'contract' | 'other'
  tag?: string
}) {
  let documents = loadStore().documents.filter((document) => document.project_id === projectId)

  if (params?.type) {
    documents = documents.filter((document) => document.type === params.type)
  }

  if (params?.tag?.trim()) {
    const tag = params.tag.trim().toLowerCase()
    documents = documents.filter((document) => document.tags.some((entry) => entry.toLowerCase() === tag))
  }

  return documents.sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))
}

export function createDocument(
  projectId: string,
  tenantId: string,
  data: {
    filename: string
    mime_type: string
    file_base64: string
    uploaded_by: string
    type: 'quote_pdf' | 'render_image' | 'cad_import' | 'email' | 'contract' | 'other'
    tags?: string[]
    is_public?: boolean
  },
) {
  const timestamp = now()
  const documentId = uid('doc')
  const previewUrl = `data:${data.mime_type};base64,${data.file_base64}`

  const store = updateStore((current) => ({
    ...current,
    documents: [
      {
        id: documentId,
        project_id: projectId,
        tenant_id: tenantId,
        filename: data.filename,
        original_filename: data.filename,
        mime_type: data.mime_type,
        size_bytes: Math.round((data.file_base64.length * 3) / 4),
        uploaded_by: data.uploaded_by,
        uploaded_at: timestamp,
        type: data.type,
        source_kind: 'manual_upload',
        source_id: null,
        storage_provider: 'demo_memory',
        storage_bucket: null,
        storage_key: uid('storage'),
        storage_version: 1,
        external_url: null,
        tags: data.tags ?? [],
        is_public: data.is_public ?? false,
        download_url: previewUrl,
        preview_url: previewUrl
      },
      ...current.documents
    ]
  }))

  return store.documents.find((document) => document.id === documentId)!
}

export function deleteDocument(projectId: string, documentId: string): void {
  updateStore((current) => ({
    ...current,
    documents: current.documents.filter((document) => !(document.project_id === projectId && document.id === documentId))
  }))
}

export function getDashboardConfig(userId: string, tenantId: string) {
  const store = loadStore()
  const existing = store.dashboard_configs.find((entry) => entry.user_id === userId && entry.tenant_id === tenantId)
  if (existing) {
    return existing
  }

  return {
    id: null,
    user_id: userId,
    tenant_id: tenantId,
    widgets: [
      { id: 'sales_chart' },
      { id: 'kpi_cards' },
      { id: 'current_projects' },
      { id: 'current_contacts' },
      { id: 'project_pipeline' },
    ],
    layout: {
      columns: 12,
      items: [
        { widget_id: 'sales_chart', x: 0, y: 0, w: 8, h: 4 },
        { widget_id: 'kpi_cards', x: 8, y: 0, w: 4, h: 4 },
        { widget_id: 'current_projects', x: 0, y: 4, w: 6, h: 4 },
        { widget_id: 'current_contacts', x: 6, y: 4, w: 6, h: 4 },
        { widget_id: 'project_pipeline', x: 0, y: 8, w: 12, h: 4 },
      ],
    },
  }
}

export function saveDashboardConfig(
  userId: string,
  tenantId: string,
  payload: {
    widgets: Array<{ id: string; title?: string; config?: Record<string, unknown> }>
    layout: { columns: number; items: Array<{ widget_id: string; x: number; y: number; w: number; h: number }> }
  },
) {
  const timestamp = now()
  const existing = loadStore().dashboard_configs.find((entry) => entry.user_id === userId && entry.tenant_id === tenantId)

  const next = updateStore((current) => ({
    ...current,
    dashboard_configs: existing
      ? current.dashboard_configs.map((entry) => (
          entry.user_id === userId && entry.tenant_id === tenantId
            ? { ...entry, widgets: payload.widgets, layout: payload.layout, updated_at: timestamp }
            : entry
        ))
      : [
          ...current.dashboard_configs,
          {
            id: uid('dashboard'),
            user_id: userId,
            tenant_id: tenantId,
            widgets: payload.widgets,
            layout: payload.layout,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
  }))

  return next.dashboard_configs.find((entry) => entry.user_id === userId && entry.tenant_id === tenantId)!
}

export function getDemoSalesChart(period: 'month' | 'last_month' | 'year' = 'month') {
  const projects = loadStore().projects
  const points = new Map<string, { value_net: number; quotes: number }>()

  for (const project of projects) {
    const date = new Date(project.created_at)
    const key = period === 'year'
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

    const current = points.get(key) ?? { value_net: 0, quotes: 0 }
    current.value_net += project.quote_value ?? 0
    current.quotes += project.quote_value ? 1 : 0
    points.set(key, current)
  }

  const normalizedPoints = [...points.entries()].map(([date, value]) => ({
    date,
    value_net: value.value_net,
    quotes: value.quotes,
  }))

  return {
    tenant_id: '00000000-0000-0000-0000-000000000001',
    period,
    from: projects[0]?.created_at ?? now(),
    to: now(),
    points: normalizedPoints,
    total_net: normalizedPoints.reduce((sum, point) => sum + point.value_net, 0),
  }
}

export function listCatalogIndices(projectId: string) {
  return loadStore().catalog_indices
    .filter((entry) => entry.project_id === projectId)
    .sort((left, right) => right.applied_at.localeCompare(left.applied_at))
}

export function createCatalogIndex(
  projectId: string,
  payload: {
    catalog_id: string
    purchase_index: number
    sales_index: number
    applied_by: string
  },
) {
  const record = {
    id: uid('catalog-index'),
    project_id: projectId,
    catalog_id: payload.catalog_id,
    purchase_index: payload.purchase_index,
    sales_index: payload.sales_index,
    applied_at: now(),
    applied_by: payload.applied_by,
  }

  updateStore((current) => ({
    ...current,
    catalog_indices: [record, ...current.catalog_indices],
  }))

  return record
}

export function searchGlobal(query: string, type?: 'project' | 'contact' | 'document') {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return { query, results: [] }
  }

  const store = loadStore()
  const results: Array<{
    type: 'project' | 'contact' | 'document'
    id: string
    title: string
    subtitle: string | null
    meta: string | null
    href: string
    updated_at: string
  }> = []

  if (!type || type === 'project') {
    for (const project of store.projects) {
      const haystack = `${project.name} ${project.description ?? ''}`.toLowerCase()
      if (haystack.includes(normalized)) {
        results.push({
          type: 'project',
          id: project.id,
          title: project.name,
          subtitle: project.description ?? null,
          meta: project.project_status,
          href: `/projects/${project.id}`,
          updated_at: project.updated_at,
        })
      }
    }
  }

  if (!type || type === 'contact') {
    for (const contact of store.contacts) {
      const haystack = [contact.first_name, contact.last_name, contact.company, contact.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(normalized)) {
        results.push({
          type: 'contact',
          id: contact.id,
          title: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.last_name,
          subtitle: contact.company ?? contact.email,
          meta: contact.email,
          href: '/contacts',
          updated_at: contact.updated_at,
        })
      }
    }
  }

  if (!type || type === 'document') {
    for (const document of store.documents) {
      const haystack = [document.filename, document.original_filename, ...document.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(normalized)) {
        results.push({
          type: 'document',
          id: document.id,
          title: document.filename,
          subtitle: document.tags.join(', ') || null,
          meta: document.type,
          href: `/documents?project=${document.project_id}`,
          updated_at: document.uploaded_at,
        })
      }
    }
  }

  return {
    query,
    results: results
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, 20),
  }
}

export function createRoom(data: {
  project_id: string
  name: string
  ceiling_height_mm?: number
  boundary: RoomBoundaryPayload
}): RoomPayload {
  const roomId = uid('room')
  const timestamp = now()

  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) =>
      project.id === data.project_id
        ? {
            ...project,
            updated_at: timestamp,
            rooms: [
              ...project.rooms,
              {
                id: roomId,
                project_id: data.project_id,
                name: data.name,
                ceiling_height_mm: data.ceiling_height_mm ?? 2500,
                boundary: data.boundary,
                ceiling_constraints: [],
                openings: [],
                placements: [],
                created_at: timestamp,
                updated_at: timestamp
              }
            ]
          }
        : project
    )
  }))

  const project = store.projects.find((entry) => entry.id === data.project_id)
  const room = project?.rooms.find((entry) => entry.id === roomId)
  if (!room) {
    throw new Error('Raum konnte nicht erstellt werden.')
  }
  return room as RoomPayload
}

export function updateRoom(
  id: string,
  data: Partial<{
    name: string
    ceiling_height_mm: number
    boundary: RoomBoundaryPayload
    ceiling_constraints: unknown[]
    openings: unknown[]
    placements: unknown[]
  }>
): RoomPayload {
  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) => ({
      ...project,
      rooms: project.rooms.map((room) =>
        room.id === id
          ? {
              ...room,
              ...data,
              updated_at: now()
            }
          : room
      )
    }))
  }))

  for (const project of store.projects) {
    const room = project.rooms.find((entry) => entry.id === id)
    if (room) {
      return room as RoomPayload
    }
  }

  throw new Error('Raum nicht gefunden.')
}

export function savePlacements(roomId: string, placements: Placement[]): Placement[] {
  updateRoom(roomId, { placements })
  return placements
}

export function saveOpenings(roomId: string, openings: Opening[]): Opening[] {
  updateRoom(roomId, { openings })
  return openings
}

export function listCatalog(params?: {
  type?: CatalogItemType
  q?: string
  limit?: number
  offset?: number
}): CatalogItem[] {
  let items = [...loadStore().catalog]

  if (params?.type) {
    items = items.filter((item) => item.type === params.type)
  }

  if (params?.q) {
    const query = params.q.toLowerCase()
    items = items.filter((item) => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
  }

  const offset = params?.offset ?? 0
  const limit = params?.limit ?? items.length
  return items.slice(offset, offset + limit)
}

export function getCatalogItem(id: string): CatalogItem {
  const item = loadStore().catalog.find((entry) => entry.id === id)
  if (!item) {
    throw new Error('Katalogartikel nicht gefunden.')
  }
  return item
}

export function validateProject(payload: ValidatePayload): ValidateResponse {
  const violations = payload.objects.flatMap((object, index) => {
    return payload.objects.slice(index + 1).flatMap((other) => {
      if (object.wall_id !== other.wall_id) {
        return []
      }

      const overlaps =
        object.offset_mm < other.offset_mm + other.width_mm &&
        other.offset_mm < object.offset_mm + object.width_mm

      if (!overlaps) {
        return []
      }

      return [
        {
          severity: 'error' as const,
          code: 'DEMO-COLLISION',
          message: `Platzierungen ${object.id} und ${other.id} überlappen.`,
          affected_ids: [object.id, other.id]
        }
      ]
    })
  })

  return {
    valid: violations.length === 0,
    violations,
    errors: violations.filter((entry) => entry.severity === 'error'),
    warnings: [],
    hints: []
  }
}
