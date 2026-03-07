import { expect, test } from '@playwright/test'

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

test('captures screenshot via dialog flow and shows success message', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { __OKP_E2E_MEDIA_MOCK__?: unknown }).__OKP_E2E_MEDIA_MOCK__ = {
      screenshotResult: { filename: 'harness-screenshot.png' },
    }
  })

  await page.goto('/__e2e/capture-dialog')
  await page.getByTestId('toggle-capture-dialog').click()
  await page.getByTestId('capture-screenshot').click()

  await expect(page.getByTestId('capture-message')).toContainText('Screenshot gespeichert: harness-screenshot.png')
})

test('starts 360 export, polls status, and shows done status', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { __OKP_E2E_MEDIA_MOCK__?: unknown }).__OKP_E2E_MEDIA_MOCK__ = {
      exportCreateResult: { job_id: 'job-1' },
      exportStatusQueue: [
        { status: 'running', error_message: null, download_url: null },
        { status: 'running', error_message: null, download_url: null },
        { status: 'done', error_message: null, download_url: null },
      ],
    }
  })

  await page.goto('/__e2e/capture-dialog')
  await page.getByTestId('toggle-capture-dialog').click()
  await page.getByTestId('capture-export360').click()

  await expect(page.getByTestId('capture-export-status')).toContainText('360-Status: done')
  await expect(page.getByTestId('capture-message')).toContainText('360-Export abgeschlossen (kein Download-Link)')
})

test('shows viewport error when no active preview is available', async ({ page }) => {
  await page.goto('/__e2e/capture-dialog')
  await page.getByTestId('toggle-capture-dialog').click()
  await page.getByTestId('toggle-preview-viewport').click()
  await page.getByTestId('capture-screenshot').click()

  await expect(page.getByTestId('capture-message')).toContainText('Screenshot fehlgeschlagen: kein aktiver Viewport gefunden')
  await expect(page.getByTestId('capture-message')).toHaveAttribute('data-error', 'true')
})

test('shows export failure error message when status endpoint returns failed', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { __OKP_E2E_MEDIA_MOCK__?: unknown }).__OKP_E2E_MEDIA_MOCK__ = {
      exportCreateResult: { job_id: 'job-2' },
      exportStatusQueue: [
        { status: 'failed', error_message: 'Worker queue timeout', download_url: null },
      ],
    }
  })

  await page.goto('/__e2e/capture-dialog')
  await page.getByTestId('toggle-capture-dialog').click()
  await page.getByTestId('capture-export360').click()

  await expect(page.getByTestId('capture-message')).toContainText('360-Export fehlgeschlagen: Error: Worker queue timeout')
  await expect(page.getByTestId('capture-message')).toHaveAttribute('data-error', 'true')
})
