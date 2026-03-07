import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROJECT_ID = 'cross-page-project'
const NOW = '2026-03-06T10:00:00.000Z'

async function installCrossPageMocks(page: Page) {
  const context = page.context()

  await context.route('**/api/v1/language-packs**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await context.route('**/api/v1/tenant/settings**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await context.route('**/api/v1/tenant/plugins**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: [
          { id: 'presentation', name: 'Praesentation' },
          { id: 'viewer-export', name: 'Viewer-Export' },
        ],
        enabled: ['presentation', 'viewer-export'],
      }),
    })
  })

  await context.route('**/api/v1/projects/board**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: PROJECT_ID,
          name: 'Cross Page Projekt',
          description: null,
          status: 'active',
          project_status: 'planning',
          deadline: null,
          priority: 'medium',
          assigned_to: null,
          advisor: null,
          sales_rep: null,
          progress_pct: 25,
          lead_status: 'qualified',
          quote_value: null,
          close_probability: null,
          created_at: NOW,
          updated_at: NOW,
          _count: { rooms: 0 },
        },
      ]),
    })
  })

  await context.route('**/api/v1/projects/gantt**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: PROJECT_ID,
          name: 'Cross Page Projekt',
          description: null,
          status: 'active',
          project_status: 'planning',
          deadline: null,
          priority: 'medium',
          assigned_to: null,
          advisor: null,
          sales_rep: null,
          progress_pct: 25,
          lead_status: 'qualified',
          quote_value: null,
          close_probability: null,
          created_at: NOW,
          updated_at: NOW,
          start_at: NOW,
          end_at: null,
          _count: { rooms: 0 },
        },
      ]),
    })
  })

  await context.route(`**/api/v1/projects/${PROJECT_ID}/lock-state**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project_id: PROJECT_ID,
        locked: false,
        alternative_id: null,
        locked_by_user: null,
        locked_by_host: null,
        locked_at: null,
      }),
    })
  })

  await context.route(`**/api/v1/projects/${PROJECT_ID}/presentation-sessions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project_id: PROJECT_ID,
        project_name: 'Cross Page Projekt',
        branding: {
          company_name: null,
          company_city: null,
          company_web: null,
          logo_url: null,
        },
        presentation_mode: {
          hide_editor_panels: false,
          show_branding: true,
          loop_tour: false,
        },
        preferred_entry: { kind: 'split-view' },
        panorama_tours: [],
      }),
    })
  })

  await context.route(`**/api/v1/projects/${PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: PROJECT_ID,
        name: 'Cross Page Projekt',
        description: null,
        status: 'active',
        project_status: 'planning',
        deadline: null,
        priority: 'medium',
        assigned_to: null,
        advisor: null,
        sales_rep: null,
        progress_pct: 25,
        lead_status: 'qualified',
        quote_value: null,
        close_probability: null,
        created_at: NOW,
        updated_at: NOW,
        rooms: [],
        quotes: [],
      }),
    })
  })
}

test('cross-page shell smoke: start -> projects -> editor -> presentation keeps project scoped header state', async ({ page }) => {
  await page.addInitScript((tenantId: string) => {
    ;(window as Window & { __OKP_RUNTIME_CONTEXT__?: { tenantId?: string } }).__OKP_RUNTIME_CONTEXT__ = { tenantId }
  }, TENANT_ID)

  await installCrossPageMocks(page)

  await page.goto('/')
  await expect(page.getByTestId('shell-project-scope-badge')).toContainText(/Global/i)

  const dismissOnboarding = page.getByRole('button', { name: /Ueberspringen|Überspringen|Skip/i })
  if (await dismissOnboarding.count()) {
    await dismissOnboarding.first().click()
  }

  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`))
  await expect(page.getByTestId('shell-project-scope-badge')).toContainText(/Projektgebunden|Project scoped/i)

  const modeBadgeBefore = await page.getByTestId('shell-mode-badge').innerText()
  await expect(page.getByTestId('shell-workflow-badge')).toBeVisible()

  await page.getByRole('tab', { name: /Praesentation|Presentation/i }).click()
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/presentation$`))
  await expect(page.getByTestId('shell-project-scope-badge')).toContainText(/Projektgebunden|Project scoped/i)
  await expect(page.getByTestId('shell-mode-badge')).toContainText(modeBadgeBefore.split(':')[0])
})
