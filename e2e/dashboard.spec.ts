import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00Z'))
  await page.route('**/api/get_log', (route) =>
    route.fulfill({ json: { 'hydra:member': [{ totalHours: 2 }] } }),
  )
})

test('check progress, keep every day visible, and save preferences', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Daily hours' })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'No data loaded',
  )
  await page.getByLabel('Your campus login').fill('test-student')
  await page.getByRole('button', { name: 'Check hours' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '26.0 of 100 hours',
  )
  await expect(page.locator('.remaining')).toContainText('74.0')
  await expect(page.locator('.day-card')).toHaveCount(31)
  await expect(page.locator('.day-card.is-logged')).toHaveCount(13)
  await expect(page.locator('.day-card.is-future')).toHaveCount(18)
  await expect(page.locator('header')).toHaveCount(0)
  await page.getByLabel('Required hours').fill('26')
  await expect(page.getByText('Requirement met', { exact: true })).toBeVisible()
  await expect(page.locator('.remaining')).toContainText('0.0')
  await page.getByLabel('Required hours').fill('150')
  // Include zero, short, and long sessions in visual checks.
  await page.route('**/api/get_log', (route) => {
    const day = new Date(route.request().postDataJSON().startDate).getUTCDate()
    const hours = [0, 3.5, 6.2, 8.4, 10.1, 4.7, 0, 7.3, 5.8, 2.5][day % 10]
    return route.fulfill({ json: { hours } })
  })
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({
    path: 'test-results/dashboard-dark.png',
    fullPage: true,
  })
  await page.reload()
  await expect(page.getByLabel('Required hours')).toHaveValue('150')
  await expect(page.getByLabel('Your campus login')).toHaveValue('test-student')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors).toEqual([])
})

test('mobile cycle navigation and layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByLabel('Your campus login').fill('test-student')
  await page.getByRole('button', { name: 'Check hours' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
  await page.getByRole('button', { name: 'Previous cycle' }).click()
  await expect(page.locator('.cycle-control')).toContainText('Jul 28 — Aug 27')
  await page.getByRole('button', { name: 'Back to current cycle' }).click()
  await expect(page.locator('.cycle-control')).toContainText('Aug 28 — Sep 27')
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
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

test('partial failures and recovery do not invent missing hours', async ({
  page,
}) => {
  let fail = true
  await page.route('**/api/get_log', async (route) => {
    if (
      fail &&
      route.request().postDataJSON().startDate.startsWith('2026-09-01')
    )
      await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.fulfill({ json: { hours: 2 } })
  })
  await page.goto('/')
  await page.getByLabel('Your campus login').fill('test-student')
  await page.getByRole('button', { name: 'Check hours' }).click()
  await expect(page.getByRole('status')).toContainText('1 day unavailable')
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '24.0 of 100 hours, partial data',
  )
  await expect(page.locator('.remaining')).toContainText('—')
  await expect(
    page.locator('.day-status').filter({ hasText: /^Unavailable$/ }),
  ).toHaveCount(1)
  fail = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    '26.0 of 100 hours',
  )
  await page.getByRole('button', { name: 'Next cycle' }).click()
  await expect(page.getByRole('status')).toContainText(
    'This cycle hasn’t started',
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'No data loaded',
  )
})

test('all daily cards fit the viewport and dark background fills the page', async ({
  page,
}) => {
  await page.route('**/api/get_log', (route) =>
    route.fulfill({ json: { hours: 10.5 } }),
  )
  await page.goto('/')
  await page.getByLabel('Required hours').fill('999')
  await page.getByLabel('Your campus login').fill('test-student')
  await page.getByRole('button', { name: 'Check hours' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Loaded for test-student',
  )
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [1024, 600],
    [768, 1024],
    [820, 1180],
    [880, 660],
    [601, 740],
    [375, 812],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height })
    const layout = await page.evaluate(() => ({
      pageFits:
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.documentElement.scrollWidth <= window.innerWidth,
      cardsFit: [
        ...document.querySelectorAll(
          '.day-card, .stat-card, .progress-card, .controls',
        ),
      ].every((card) => {
        const rect = card.getBoundingClientRect()
        return (
          rect.bottom <= window.innerHeight &&
          rect.top >= 0 &&
          card.scrollHeight <= card.clientHeight &&
          card.scrollWidth <= card.clientWidth
        )
      }),
    }))
    expect(layout, width + 'x' + height).toEqual({
      pageFits: true,
      cardsFit: true,
    })
  }
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  const backgrounds = await page.evaluate(() =>
    [
      document.documentElement,
      document.body,
      document.getElementById('root')!,
    ].map((element) => getComputedStyle(element).backgroundColor),
  )
  expect(new Set(backgrounds).size).toBe(1)
  expect(backgrounds[0]).toBe('rgb(19, 23, 32)')
})
