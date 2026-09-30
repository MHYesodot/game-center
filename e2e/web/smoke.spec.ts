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