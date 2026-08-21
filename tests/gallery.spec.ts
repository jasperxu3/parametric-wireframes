import { expect, test } from '@playwright/test'

test('visitor can browse all templates and return to a healthy animated preview', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '选择参数化图形' }).getByRole('button')).toHaveCount(13)
  await expect(page.getByRole('heading', { name: '双曲颈面' }).first()).toBeVisible()

  const canvas = page.locator('canvas[data-animation="catenoid-field"]')
  await expect(canvas).toHaveAttribute('data-animation-ready', 'true')
  await expect.poll(() => canvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))).toMatchObject({ width: expect.any(Number), height: expect.any(Number) })
  const animationContract = await canvas.evaluate((element) => {
    const animation = (element as HTMLCanvasElement & {
      __catenoidFieldAnimation?: {
        dataPulses: Array<{ position: unknown }>
        drawTextTicker: unknown
        hyperText: unknown
      }
    }).__catenoidFieldAnimation
    return {
      pulseCount: animation?.dataPulses.length,
      hasHyperText: typeof animation?.hyperText === 'function',
      hasTextTicker: typeof animation?.drawTextTicker === 'function',
    }
  })
  expect(animationContract).toEqual({ pulseCount: 8, hasHyperText: true, hasTextTicker: true })
  await expect.poll(() => canvas.evaluate((element) => {
    const animation = (element as HTMLCanvasElement & {
      __catenoidFieldAnimation?: { dataPulses: Array<{ position: unknown }> }
    }).__catenoidFieldAnimation
    return animation?.dataPulses.filter((pulse) => pulse.position).length ?? 0
  }), { timeout: 5_000 }).toBeGreaterThan(0)

  await page.getByRole('button', { name: '波动膜网格' }).click()
  await expect(page.getByRole('heading', { name: '波动膜网格' }).first()).toBeVisible()
  await expect(canvas).toBeHidden()
  await expect(page.getByText('该图形当前使用确定性 SVG 预览。')).toBeVisible()

  await page.getByRole('button', { name: '双曲颈面' }).click()
  await expect(canvas).toBeVisible()
  const size = await canvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))
  expect(size.width).toBeGreaterThan(2)
  expect(size.height).toBeGreaterThan(2)
  expect(errors).toEqual([])
})

test('visitor can collapse panels, restart the preview, and copy both exports', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')

  const libraryToggle = page.getByRole('button', { name: '折叠图形库' })
  const inspectorToggle = page.getByRole('button', { name: '折叠调试面板' })
  await libraryToggle.click()
  await expect(page.getByRole('button', { name: '展开图形库' })).toHaveAttribute('aria-expanded', 'false')
  await inspectorToggle.click()
  await expect(page.getByRole('button', { name: '展开调试面板' })).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: '重新播放入场动画' }).click()
  await page.getByRole('button', { name: '展开调试面板' }).click()
  await page.getByRole('button', { name: '复制 SVG' }).click()
  await expect(page.locator('.toast')).toContainText('SVG 代码已复制')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('<svg')
  await page.getByRole('button', { name: '复制参数' }).click()
  await expect(page.locator('.toast')).toContainText('参数 JSON 已复制')
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).name).toBe('catenoid-field')
})

test('reduced motion keeps the full preview and disables animation controls', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')
  await expect(page.locator('[data-animation-setting]')).toHaveCount(4)
  for (const input of await page.locator('[data-animation-setting]').all()) {
    await expect(input).toBeDisabled()
  }
  await context.close()
})

test('mobile visitors start with both sidebars collapsed', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('button', { name: '展开图形库' })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: '展开调试面板' })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: '展开图形库' }).click()
  await expect(page.getByRole('button', { name: '折叠图形库' })).toHaveAttribute('aria-expanded', 'true')
  await context.close()
})
