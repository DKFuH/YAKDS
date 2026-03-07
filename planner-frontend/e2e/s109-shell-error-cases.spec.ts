import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((tenantId: string) => {
    ;(window as Window & { __OKP_RUNTIME_CONTEXT__?: { tenantId?: string } }).__OKP_RUNTIME_CONTEXT__ = { tenantId }
  }, TENANT_ID)

  await page.route('**/api/v1/language-packs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
})

function fulfillError(route: Route, status: number, message: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ error: `HTTP_${status}`, message }),
  })
}

test('shows tenant missing backend error on projects start page', async ({ page }) => {
  await page.route('**/api/v1/projects/board**', async (route) => fulfillError(route, 400, 'Tenant context missing'))
  await page.route('**/api/v1/projects/gantt**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }))

  await page.goto('/')

  await expect(page.getByText('Tenant context missing')).toBeVisible()
})

test('shows user missing / unauthorized backend error on projects start page', async ({ page }) => {
  await page.route('**/api/v1/projects/board**', async (route) => fulfillError(route, 401, 'User context missing'))
  await page.route('**/api/v1/projects/gantt**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }))

  await page.goto('/')

  await expect(page.getByText('User context missing')).toBeVisible()
})

test('shows project missing error in editor route', async ({ page }) => {
  await page.route('**/api/v1/projects/missing-project', async (route) => fulfillError(route, 404, 'Project not found'))
  await page.route('**/api/v1/projects/missing-project/lock-state', async (route) => fulfillError(route, 404, 'Project not found'))

  await page.goto('/projects/missing-project')

  await expect(page.getByText('Project not found')).toBeVisible()
})

test('shows 401 unauthorized on editor route', async ({ page }) => {
  await page.route('**/api/v1/projects/secure-project', async (route) => fulfillError(route, 401, 'Unauthorized'))
  await page.route('**/api/v1/projects/secure-project/lock-state', async (route) => fulfillError(route, 401, 'Unauthorized'))

  await page.goto('/projects/secure-project')

  await expect(page.getByText('Unauthorized')).toBeVisible()
})

test('shows 403 forbidden on presentation route', async ({ page }) => {
  await page.route('**/api/v1/tenant/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: [{ id: 'presentation', name: 'Praesentation' }],
        enabled: ['presentation'],
      }),
    })
  })

  await page.route('**/api/v1/tenant/settings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('**/api/v1/projects/secure-project/presentation-sessions', async (route) => fulfillError(route, 403, 'Forbidden'))
  await page.route('**/api/v1/projects/secure-project', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'secure-project',
        name: 'Secure Project',
        description: null,
        status: 'active',
        project_status: 'planning',
        deadline: null,
        priority: 'medium',
        assigned_to: null,
        advisor: null,
        sales_rep: null,
        progress_pct: 25,
        created_at: '2026-03-06T08:00:00.000Z',
        updated_at: '2026-03-06T08:00:00.000Z',
        rooms: [],
        quotes: [],
      }),
    })
  })

  await page.goto('/projects/secure-project/presentation')

  await expect(page.getByText('Forbidden')).toBeVisible()
})
