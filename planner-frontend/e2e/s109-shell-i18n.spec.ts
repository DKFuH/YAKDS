import { expect, test } from '@playwright/test'

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((tenantId: string) => {
    ;(window as Window & { __OKP_RUNTIME_CONTEXT__?: { tenantId?: string } }).__OKP_RUNTIME_CONTEXT__ = { tenantId }
    window.localStorage.setItem('okp_locale', 'de')
  }, TENANT_ID)

  await page.route('**/api/v1/language-packs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/api/v1/tenant/locale-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferred_locale: 'en' }),
    })
  })
})

test('i18n switch updates shell menu labels and disabled reasons (DE/EN)', async ({ page }) => {
  await page.goto('/__e2e/s109-shell')

  await expect(page.getByTestId('header-backend-menu-trigger')).toHaveText('Backend-Features')
  await page.getByTestId('header-backend-menu-trigger').click()
  await expect(page.getByTestId('header-backend-feature-panel-camera')).toHaveAttribute('title', 'Projektkontext fehlt')
  await page.keyboard.press('Escape')

  await page.getByTestId('language-switch-en').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByTestId('header-backend-menu-trigger')).toHaveText('Backend features')

  await page.getByTestId('header-backend-menu-trigger').click()
  await expect(page.getByTestId('header-backend-feature-panel-camera')).toHaveAttribute('title', 'Project context missing')
  await page.keyboard.press('Escape')

  await expect(page.getByTestId('sidebar-plugin-slot-presentation')).toHaveAttribute('title', 'Project context missing')

  await page.getByTestId('language-switch-de').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByTestId('header-backend-menu-trigger')).toHaveText('Backend-Features')
})
