import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const catalog = JSON.parse(readFileSync('assets/template-library/catalog.json', 'utf8')) as {
  templates: Array<{ id: string; title: string }>
}
const templates = catalog.templates.map(({ id, title }) => [id, title] as const)

test('visitor can browse all templates and return to a healthy animated preview', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '选择参数化图形' }).getByRole('button')).toHaveCount(22)
  await expect(page.getByRole('heading', { name: '双曲颈面' }).first()).toBeVisible()

  const canvas = page.locator('canvas[data-animation="catenoid-field"]')
  await expect(canvas).toHaveAttribute('data-animation-ready', 'true')
  await expect.poll(() => canvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))).toMatchObject({ width: expect.any(Number), height: expect.any(Number) })
  const animationContract = await canvas.evaluate((element) => {
    const animation = (element as HTMLCanvasElement & {
      __catenoidFieldAnimation?: {
        colors: { accent: string; background: string; secondary: string }
        dataPulses: Array<{ position: unknown }>
        drawTextTicker: unknown
        hyperText: unknown
        setOptions: (options: Record<string, string | number>) => void
        settings: { cycleSpeed: number; rotationSpeed: number }
      }
    }).__catenoidFieldAnimation
    animation?.setOptions({
      accent: '#ff0066',
      background: '#010203',
      cycleSpeed: 0.75,
      rotationSpeed: 1.25,
      secondary: '#00aaff',
    })
    const options = animation ? { colors: { ...animation.colors }, settings: { ...animation.settings } } : null
    animation?.setOptions({
      accent: '#77e1ca',
      background: '#0f141a',
      cycleSpeed: 1,
      rotationSpeed: 1,
      secondary: '#a98bff',
    })
    return {
      pulseCount: animation?.dataPulses.length,
      hasHyperText: typeof animation?.hyperText === 'function',
      hasTextTicker: typeof animation?.drawTextTicker === 'function',
      options,
    }
  })
  expect(animationContract).toMatchObject({
    pulseCount: 8,
    hasHyperText: true,
    hasTextTicker: true,
    options: {
      colors: { accent: '#ff0066', background: '#010203', secondary: '#00aaff' },
      settings: { cycleSpeed: 0.75, rotationSpeed: 1.25 },
    },
  })
  await expect.poll(() => canvas.evaluate((element) => {
    const animation = (element as HTMLCanvasElement & {
      __catenoidFieldAnimation?: { dataPulses: Array<{ position: unknown }> }
    }).__catenoidFieldAnimation
    return animation?.dataPulses.filter((pulse) => pulse.position).length ?? 0
  }), { timeout: 5_000 }).toBeGreaterThan(0)

  for (const [id, title] of templates.slice(1)) {
    await page.getByRole('button', { name: title }).click()
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible()
    const genericCanvas = page.locator(`canvas[data-animation="${id}"]`)
    await expect(genericCanvas).toBeVisible()
    await expect(genericCanvas).toHaveAttribute('data-animation-ready', 'true')
    const size = await genericCanvas.evaluate((element) => ({
      width: (element as HTMLCanvasElement).width,
      height: (element as HTMLCanvasElement).height,
    }))
    expect(size.width).toBeGreaterThan(2)
    expect(size.height).toBeGreaterThan(2)
  }
  await expect(page.getByText('该动态图形根据自身几何家族使用确定性的运动与文字编排')).toBeVisible()

  await page.getByRole('button', { name: '双曲颈面' }).click()
  const restoredCanvas = page.locator('canvas[data-animation="catenoid-field"]')
  await expect(restoredCanvas).toHaveAttribute('data-animation-ready', 'true')
  const size = await restoredCanvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))
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

test('front view resets camera rotation and persists between templates', async ({ page }) => {
  await page.goto('/')
  const catenoid = page.locator('canvas[data-animation="catenoid-field"]')
  await expect(catenoid).toHaveAttribute('data-animation-ready', 'true')

  const frontView = page.getByRole('button', { name: '正视图' })
  await expect(frontView).toHaveAttribute('aria-pressed', 'false')
  await frontView.click()
  await expect(frontView).toHaveAttribute('aria-pressed', 'true')
  expect(await catenoid.evaluate((element) => (
    element as HTMLCanvasElement & { __catenoidFieldAnimation?: { viewRotation: number[] | null } }
  ).__catenoidFieldAnimation?.viewRotation)).toEqual([0, 0, 0])

  await page.getByRole('button', { name: '扭转漏斗' }).click()
  const funnel = page.locator('canvas[data-animation="twisted-funnel"]')
  await expect(funnel).toHaveAttribute('data-animation-ready', 'true')
  expect(await funnel.evaluate((element) => (
    element as HTMLCanvasElement & { __wireframeAnimation?: { viewRotation: number[] | null } }
  ).__wireframeAnimation?.viewRotation)).toEqual([0, 0, 0])

  await frontView.click()
  await expect(frontView).toHaveAttribute('aria-pressed', 'false')
  expect(await funnel.evaluate((element) => (
    element as HTMLCanvasElement & { __wireframeAnimation?: { viewRotation: number[] | null } }
  ).__wireframeAnimation?.viewRotation)).toBeNull()
})

test('view parameters rotate former 2D geometry without rotating its labels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')
  await page.getByRole('button', { name: '椭圆反射场' }).click()
  await expect(page.locator('canvas[data-animation="ellipse-reflection"]')).toHaveAttribute('data-animation-ready', 'true')

  const audit = await page.evaluate(() => {
    const definitions = window.__parametricWireframeDefinitions!
    const ids = [
      'ellipse-reflection', 'radial-petals', 'superellipse-stack',
      'layered-perspective-grid', 'sparse-dipole-field', 'interference-waves',
      'nested-lens-tunnel', 'offset-superellipse-echo', 'rose-curve-choir',
      'hypotrochoid-knot', 'magnetic-eye-field',
    ]
    const render = (id: string, viewRotation: number[] | null) => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const context = canvas.getContext('2d')!
      let geometry = 2_166_136_261
      const labels: string[] = []
      const record = (x: number, y: number) => {
        geometry = Math.imul(geometry ^ Math.round(x * 100), 16_777_619)
        geometry = Math.imul(geometry ^ Math.round(y * 100), 16_777_619)
      }
      context.moveTo = record
      context.lineTo = record
      context.stroke = () => undefined
      context.fillRect = () => undefined
      context.fillText = (text, x, y) => {
        const transform = context.getTransform()
        labels.push(`${text}:${x}:${y}:${transform.a}:${transform.b}:${transform.c}:${transform.d}:${transform.e}:${transform.f}`)
      }
      definitions[id].draw({
        context,
        width: 800,
        height: 600,
        elapsed: 4_200,
        intro: 1,
        reducedMotion: true,
        pointer: { x: 0, y: 0 },
        frontView: false,
        viewRotation,
      })
      return { geometry, labels }
    }
    return ids.flatMap((id) => {
      const original = render(id, null)
      const rotated = render(id, [0.38, -0.46, 0.22])
      const failures: string[] = []
      if (original.geometry === rotated.geometry) failures.push(`${id}:geometry`)
      if (JSON.stringify(original.labels) !== JSON.stringify(rotated.labels)) failures.push(`${id}:labels`)
      return failures
    })
  })

  expect(audit).toEqual([])

  const xAxis = page.locator('[data-view-axis="X"]')
  await xAxis.fill('45')
  await expect(page.locator('.view-settings output').first()).toHaveText('45°')
  const rotation = await page.locator('canvas[data-animation="ellipse-reflection"]').evaluate((element) => (
    element as HTMLCanvasElement & { __wireframeAnimation?: { viewRotation: number[] | null } }
  ).__wireframeAnimation?.viewRotation)
  expect(rotation?.[0]).toBeCloseTo(Math.PI / 4)
})

test('ellipse reflection keeps animating its geometry after the intro', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')
  await page.getByRole('button', { name: '椭圆反射场' }).click()
  const canvas = page.locator('canvas[data-animation="ellipse-reflection"]')
  await expect(canvas).toHaveAttribute('data-animation-ready', 'true')

  const geometryFrame = () => canvas.evaluate((element) => {
    const source = element as HTMLCanvasElement
    const target = document.createElement('canvas')
    target.width = Math.round(source.width * 0.72)
    target.height = Math.round(source.height * 0.68)
    const context = target.getContext('2d')
    context?.drawImage(
      source,
      source.width * 0.14,
      source.height * 0.16,
      target.width,
      target.height,
      0,
      0,
      target.width,
      target.height,
    )
    return target.toDataURL()
  })

  await page.waitForTimeout(2_200)
  const before = await geometryFrame()
  await page.waitForTimeout(800)
  expect(await geometryFrame()).not.toBe(before)
})

test('superellipse growth loops without a visible seam', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')
  await page.getByRole('button', { name: '超椭圆生长阵列' }).click()
  await expect(page.locator('canvas[data-animation="superellipse-stack"]')).toHaveAttribute('data-animation-ready', 'true')

  const differences = await page.evaluate(() => {
    const definition = (window as typeof window & {
      __parametricWireframeDefinitions: Record<string, { draw: (frame: Record<string, unknown>) => void }>
    }).__parametricWireframeDefinitions['superellipse-stack']
    const render = (elapsed: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const context = canvas.getContext('2d')!
      definition.draw({
        context,
        width: canvas.width,
        height: canvas.height,
        elapsed,
        intro: 1,
        reducedMotion: false,
        pointer: { x: 0, y: 0 },
      })
      return context.getImageData(112, 96, 576, 408).data
    }
    const difference = (first: Uint8ClampedArray, second: Uint8ClampedArray) => {
      let total = 0
      for (let index = 0; index < first.length; index += 4) {
        total += Math.abs(first[index] - second[index])
        total += Math.abs(first[index + 1] - second[index + 1])
        total += Math.abs(first[index + 2] - second[index + 2])
      }
      return total
    }
    return {
      seam: difference(render(5_390), render(5_410)),
      regularMotion: difference(render(4_000), render(4_600)),
    }
  })

  expect(differences.regularMotion).toBeGreaterThan(0)
  expect(differences.seam).toBeLessThan(differences.regularMotion * 0.2)
})

test('generic animations stay alive on desktop and mobile', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.locator('canvas[data-animation="catenoid-field"]')).toHaveAttribute('data-animation-ready', 'true')
  await page.getByRole('button', { name: '椭圆反射场' }).click()
  await expect(page.locator('canvas[data-animation="ellipse-reflection"]')).toHaveAttribute('data-animation-ready', 'true')

  const audit = await page.evaluate((auditedIdsList) => {
    const definitions = (window as typeof window & {
      __parametricWireframeDefinitions: Record<string, { draw: (frame: Record<string, unknown>) => void }>
    }).__parametricWireframeDefinitions
    const auditedIds = new Set(auditedIdsList)
    const sizes = [
      { name: 'desktop', width: 800, height: 600 },
      { name: 'mobile', width: 330, height: 247 },
    ]
    const elapsedSamples = [2_600, 3_200, 3_800, 4_400, 5_000, 5_600, 6_200]
    const failures = {
      staticGeometry: [] as string[],
      missingDataAccents: [] as string[],
      staticText: [] as string[],
      illegibleMobileText: [] as string[],
      unstableReducedMotion: [] as string[],
    }

    for (const size of sizes) {
      for (const [id, definition] of Object.entries(definitions)) {
        if (!auditedIds.has(id)) continue
        const frames: string[] = []
        const textFrames: string[] = []
        let hasDataAccent = false
        let minimumFontSize = Number.POSITIVE_INFINITY

        for (const elapsed of elapsedSamples) {
          const canvas = document.createElement('canvas')
          canvas.width = size.width
          canvas.height = size.height
          const context = canvas.getContext('2d')!
          const textCalls: Array<Record<string, unknown>> = []
          let geometryCallCount = 0
          let geometryHash = 2_166_136_261
          const recordGeometry = (x: number, y: number) => {
            geometryCallCount += 1
            geometryHash = Math.imul(geometryHash ^ Math.round(x * 100), 16_777_619)
            geometryHash = Math.imul(geometryHash ^ Math.round(y * 100), 16_777_619)
          }
          const recordStroke = () => {
            const style = `${context.strokeStyle}:${context.lineWidth}:${context.lineDashOffset}:${context.getLineDash().join(',')}`
            for (const character of style) geometryHash = Math.imul(geometryHash ^ character.charCodeAt(0), 16_777_619)
          }
          context.fillRect = (_x, _y, width, height) => {
            if (width <= 24 && height <= 24) hasDataAccent = true
          }
          context.lineTo = (x, y) => {
            recordGeometry(x, y)
          }
          context.moveTo = (x, y) => {
            recordGeometry(x, y)
          }
          context.stroke = recordStroke
          context.fillText = (text, x, y, _maxWidth) => {
            const fontSize = Number.parseFloat(context.font.match(/([\d.]+)px/)?.[1] ?? '0')
            minimumFontSize = Math.min(minimumFontSize, fontSize)
            const transform = context.getTransform()
            textCalls.push({
              text,
              x: Math.round(x * 100) / 100,
              y: Math.round(y * 100) / 100,
              a: Math.round(transform.a * 1_000) / 1_000,
              b: Math.round(transform.b * 1_000) / 1_000,
              c: Math.round(transform.c * 1_000) / 1_000,
              d: Math.round(transform.d * 1_000) / 1_000,
              e: Math.round(transform.e * 100) / 100,
              f: Math.round(transform.f * 100) / 100,
              fill: context.fillStyle,
            })
          }
          definition.draw({
            context,
            width: size.width,
            height: size.height,
            elapsed,
            intro: 1,
            reducedMotion: false,
            pointer: { x: 0, y: 0 },
          })
          frames.push(`${geometryCallCount}:${geometryHash}`)
          textFrames.push(JSON.stringify(textCalls))
        }

        const key = `${size.name}:${id}`
        if (new Set(frames).size < 2) failures.staticGeometry.push(key)
        if (!hasDataAccent) failures.missingDataAccents.push(key)
        if (new Set(textFrames).size < 2) failures.staticText.push(key)
        if (size.name === 'mobile' && minimumFontSize < 7) failures.illegibleMobileText.push(key)

        let reducedMotionHasDataAccent = false
        const reducedMotionFrames = [2_600, 6_200].map((elapsed) => {
          const canvas = document.createElement('canvas')
          canvas.width = size.width
          canvas.height = size.height
          const context = canvas.getContext('2d')!
          let geometryCallCount = 0
          let geometryHash = 2_166_136_261
          const textCalls: string[] = []
          const recordGeometry = (x: number, y: number) => {
            geometryCallCount += 1
            geometryHash = Math.imul(geometryHash ^ Math.round(x * 100), 16_777_619)
            geometryHash = Math.imul(geometryHash ^ Math.round(y * 100), 16_777_619)
          }
          const recordStroke = () => {
            const style = `${context.strokeStyle}:${context.lineWidth}:${context.lineDashOffset}:${context.getLineDash().join(',')}`
            for (const character of style) geometryHash = Math.imul(geometryHash ^ character.charCodeAt(0), 16_777_619)
          }
          context.fillRect = (_x, _y, width, height) => {
            if (width <= 24 && height <= 24) reducedMotionHasDataAccent = true
          }
          context.fillText = (text, x, y, _maxWidth) => {
            textCalls.push(`${text}:${x}:${y}:${context.fillStyle}`)
          }
          context.lineTo = (x, y) => {
            recordGeometry(x, y)
          }
          context.moveTo = (x, y) => {
            recordGeometry(x, y)
          }
          context.stroke = recordStroke
          definition.draw({
            context,
            width: size.width,
            height: size.height,
            elapsed,
            intro: 1,
            reducedMotion: true,
            pointer: { x: 0, y: 0 },
          })
          return `${geometryCallCount}:${geometryHash}:${textCalls.join('|')}`
        })
        if (reducedMotionHasDataAccent || new Set(reducedMotionFrames).size > 1) {
          failures.unstableReducedMotion.push(key)
        }
      }
    }
    return failures
  }, [
    'ellipse-reflection', 'projection-cone', 'atomic-orbits', 'superellipse-stack',
    'wave-membrane', 'layered-perspective-grid', 'sparse-dipole-field',
    'interference-waves', 'converging-dashed-helix', 'hypotrochoid-knot',
  ])

  expect(audit).toEqual({
    staticGeometry: [],
    missingDataAccents: [],
    staticText: [],
    illegibleMobileText: [],
    unstableReducedMotion: [],
  })
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
  await page.getByRole('button', { name: '波动膜网格' }).click()
  const genericCanvas = page.locator('canvas[data-animation="wave-membrane"]')
  await expect(genericCanvas).toHaveAttribute('data-animation-ready', 'true')
  const before = await genericCanvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  await page.waitForTimeout(200)
  const reducedState = await genericCanvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    return {
      frame: canvas.__wireframeAnimation?.frame,
      image: canvas.toDataURL(),
    }
  })
  expect(reducedState.frame).toBe(0)
  expect(reducedState.image).toBe(before)
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
