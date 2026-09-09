import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00Z'))
})

test('desktop demo, filtering, target persistence, theme, and CSV export', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Every hour counts.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  await page.getByRole('button', { name: 'Explore a demo' }).click()
  await expect(page.getByRole('status')).toContainText('Demo data')
  await expect(page.locator('.day-card')).toHaveCount(31)
  await page.getByRole('button', { name: 'Logged', exact: true }).click()
  await expect(page.locator('.day-card')).toHaveCount(10)
  await page.getByRole('button', { name: 'All days', exact: true }).click()
  await page
    .getByRole('spinbutton', { name: 'Cycle target', exact: true })
    .fill('150')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('logtime-demo-2026-08-29.csv')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const csv = Buffer.concat(chunks).toString()
  expect(csv).toContain('2026-08-29,5.5,recorded')
  expect(csv).toContain('2026-09-10,,upcoming')
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({
    path: 'test-results/dashboard-dark.png',
    fullPage: true,
  })
  await page.reload()
  await expect(
    page.getByRole('spinbutton', { name: 'Cycle target', exact: true }),
  ).toHaveValue('150')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors).toEqual([])
})

test('mobile stays within the viewport and cycle navigation works', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore a demo' }).click()
  await page.getByRole('button', { name: 'Previous cycle' }).click()
  await expect(page.locator('.cycle-control')).toContainText('Jul 29 — Aug 28')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.locator('.cycle-control')).toContainText('Aug 29 — Sep 28')
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/dashboard-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('live responses, partial failures, and recovery', async ({ page }) => {
  let fail = true
  await page.route('**/api/get_log', async (route) => {
    const request = route.request().postDataJSON()
    if (fail && request.startDate.startsWith('2026-09-01'))
      await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.fulfill({ json: { 'hydra:member': [{ totalHours: 2 }] } })
  })
  await page.goto('/')
  await page.getByLabel('Your campus login').fill('test-student')
  await page.getByRole('button', { name: 'Load hours' }).click()
  await expect(page.getByRole('status')).toContainText('1 day unavailable')
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '22.0 of 100 hours, partial data',
  )
  await expect(
    page.locator('.day-card').filter({ hasText: 'Unavailable' }),
  ).toHaveCount(1)
  fail = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '24.0 of 100 hours',
  )
  await page.getByRole('button', { name: 'Next cycle' }).click()
  await expect(page.getByRole('status')).toContainText(
    'This cycle hasn’t started',
  )
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
})
