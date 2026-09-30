import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('main lobby renders in english with ltr direction', async ({ page }) => {
  await page.goto('/?locale=en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('main lobby renders in hebrew with rtl direction', async ({ page }) => {
  await page.goto('/?locale=he')

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('featured game navigation opens a lobby and returns to catalog', async ({ page }) => {
  await page.goto('/?locale=en')
  await expect(page.getByTestId('featured-game-signal-grid')).toBeVisible()
  await page.getByTestId('featured-game-signal-grid').click()

  await expect(page).toHaveURL(/\/game\/signal-grid$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByTestId('lobby-back-to-catalog').click()
  await expect(page).toHaveURL(/\/$/)
})

test('direct detail navigation fetches the slug endpoint without depending on the catalog list endpoint', async ({ page }) => {
  const catalogRequests: string[] = []

  page.on('request', (request) => {
    const url = request.url()

    if (url.includes('/api/games')) {
      catalogRequests.push(url)
    }
  })

  await page.goto('/game/rush-lane?locale=en')

  await expect(page.getByTestId('game-detail-ready')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rush Lane')

  expect(catalogRequests.some((url) => url.endsWith('/api/games/rush-lane'))).toBe(true)
  expect(catalogRequests.some((url) => /\/api\/games(?:\?.*)?$/.test(url))).toBe(false)
})

test('missing game detail shows localized not-found UI', async ({ page }) => {
  await page.goto('/game/not-a-real-game?locale=en')

  await expect(page.getByTestId('game-detail-not-found')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('This game is not in the active catalog.')
})

test('detail route renders localized rtl content for hebrew', async ({ page }) => {
  await page.goto('/game/rush-lane?locale=he')

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('game-detail-ready')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rush Lane')
})

test('detail route shows an error state instead of fallback data when the catalog api is unavailable', async ({ page }) => {
  await page.route('**/api/games/signal-grid', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'CATALOG_UNAVAILABLE' }),
    })
  })

  await page.goto('/game/signal-grid?locale=en')

  await expect(page.getByTestId('game-detail-error')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Something went wrong.')
})

test('platform health endpoints respond successfully', async ({ request }) => {
  const liveResponse = await request.get('http://127.0.0.1:3200/health/live')
  const readyResponse = await request.get('http://127.0.0.1:3200/health/ready')

  expect(liveResponse.ok()).toBe(true)
  expect(readyResponse.ok()).toBe(true)
})

test('main lobby passes the accessibility smoke audit', async ({ page }) => {
  await page.goto('/?locale=en')

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})

test('catalog is served from the persisted live service', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3200/api/games')
  const detailResponse = await request.get('http://127.0.0.1:3200/api/games/signal-grid')

  expect(response.ok()).toBe(true)
  expect(detailResponse.ok()).toBe(true)

  const payload = (await response.json()) as { games: Array<{ slug: string }> }
  const detailPayload = (await detailResponse.json()) as { slug: string }

  expect(payload.games.map((game) => game.slug)).toEqual(['aether-flight', 'rush-lane', 'signal-grid'])
  expect(detailPayload.slug).toBe('signal-grid')
})