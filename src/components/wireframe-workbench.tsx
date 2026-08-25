import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { templates } from '../data/templates'
import { CatenoidAnimation } from './catenoid-animation'
import { WireframeAnimation } from './wireframe-animation'

type ViewRotation = [number, number, number]

const VIEW_AXES = [
  { key: 'X', label: '俯仰 X', min: -90, max: 90 },
  { key: 'Y', label: '水平 Y', min: -180, max: 180 },
  { key: 'Z', label: '滚转 Z', min: -180, max: 180 },
] as const

function SvgMarkup({ markup, className }: { markup: string; className: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: markup }} />
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const area = document.createElement('textarea')
  area.value = text
  area.readOnly = true
  area.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('Copy failed')
}

export function WireframeWorkbench() {
  const [activeId, setActiveId] = useState(templates[0].id)
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [restartKey, setRestartKey] = useState(0)
  const [viewRotation, setViewRotation] = useState<ViewRotation | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const activeTemplate = templates.find((template) => template.id === activeId) ?? templates[0]
  const catenoid = activeTemplate.id === 'catenoid-field'
  const frontView = viewRotation?.every((value) => value === 0) ?? false
  const viewRotationRadians = useMemo(
    () => viewRotation?.map((value) => value * Math.PI / 180) ?? null,
    [viewRotation],
  )

  const setViewAxis = (axis: number, value: number) => {
    setViewRotation((current) => {
      const next: ViewRotation = current ? [...current] : [0, 0, 0]
      next[axis] = value
      return next
    })
  }

  useEffect(() => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setLibraryCollapsed(true)
      setInspectorCollapsed(true)
    }
    return () => clearTimeout(toastTimer.current)
  }, [])

  const announce = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  const copyExport = async (kind: 'scene' | 'svg') => {
    try {
      await copyText(kind === 'svg' ? activeTemplate.svg : JSON.stringify(activeTemplate.scene, null, 2))
      announce(kind === 'svg' ? 'SVG 代码已复制' : '参数 JSON 已复制')
    } catch {
      announce('复制失败，请在安全的浏览器页面中重试')
    }
  }

  const selectTemplate = (id: string) => {
    setActiveId(id)
    if (window.matchMedia('(max-width: 760px)').matches) setLibraryCollapsed(true)
  }

  const togglePanel = (panel: 'library' | 'inspector') => {
    const opening = panel === 'library' ? libraryCollapsed : inspectorCollapsed
    if (panel === 'library') setLibraryCollapsed(!libraryCollapsed)
    else setInspectorCollapsed(!inspectorCollapsed)
    if (opening && window.matchMedia('(max-width: 760px)').matches) {
      if (panel === 'library') setInspectorCollapsed(true)
      else setLibraryCollapsed(true)
    }
  }

  const workbenchClass = [
    'workbench',
    libraryCollapsed && 'left-collapsed',
    inspectorCollapsed && 'right-collapsed',
  ].filter(Boolean).join(' ')
  const accentStyle = { '--active-accent': activeTemplate.accent } as CSSProperties

  return (
    <div className={workbenchClass} style={accentStyle}>
      <aside className={`sidebar library-panel${libraryCollapsed ? ' is-collapsed' : ''}`} aria-label="图形库">
        <div className="panel-header">
          <button
            className="icon-button"
            type="button"
            onClick={() => togglePanel('library')}
            aria-label={libraryCollapsed ? '展开图形库' : '折叠图形库'}
            title={libraryCollapsed ? '展开图形库' : '折叠图形库'}
            aria-expanded={!libraryCollapsed}
          >
            {libraryCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>
        <nav className="template-list" aria-label="选择参数化图形">
          {templates.map((template) => (
            <button
              className={`template-option${template.id === activeId ? ' is-active' : ''}`}
              style={{ '--template-accent': template.accent } as CSSProperties}
              type="button"
              key={template.id}
              onClick={() => selectTemplate(template.id)}
              aria-label={template.title}
              title={template.title}
              aria-pressed={template.id === activeId}
            >
              <SvgMarkup markup={template.svg} className="template-thumbnail" />
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="stage-header">
          <div className="stage-heading">
            <p>{activeTemplate.familyLabel}</p>
            <h1>{activeTemplate.title}</h1>
          </div>
          <span className="stage-status">LIVE CANVAS</span>
        </header>
        <section className="stage-shell" aria-label="参数化图形调试区域">
          <div className={`stage-render preview show-animation is-animated${restartKey ? ' is-restarting' : ''}`}>
            <SvgMarkup key={`${activeId}-${restartKey}`} markup={activeTemplate.svg} className="stage-svg" />
            {catenoid
              ? <CatenoidAnimation key="catenoid-field" active viewRotation={viewRotationRadians} />
              : <WireframeAnimation key={activeId} templateId={activeId} viewRotation={viewRotationRadians} />}
            <div className="stage-controls">
              <button
                className={`stage-view-button${frontView ? ' is-active' : ''}`}
                type="button"
                onClick={() => setViewRotation(frontView ? null : [0, 0, 0])}
                aria-pressed={frontView}
              >
                正视图
              </button>
              <button
                className="icon-button stage-refresh"
                type="button"
                onClick={() => {
                  setRestartKey((value) => value + 1)
                  const canvas = document.querySelector<HTMLCanvasElement>('.parametric-animation')
                  if (catenoid) canvas?.__catenoidFieldAnimation?.restart()
                  else canvas?.__wireframeAnimation?.restart()
                }}
                aria-label="重新播放入场动画"
                title="重新播放入场动画"
              >
                <IconRefresh />
              </button>
            </div>
          </div>
        </section>
        <footer className="stage-footer">
          <code>{activeTemplate.formula}</code>
          <span className="stage-zoom">FIT · 100%</span>
        </footer>
      </main>

      <aside className={`sidebar inspector-panel${inspectorCollapsed ? ' is-collapsed' : ''}`} aria-label="图形调试面板">
        <div className="panel-header">
          <div className="panel-title"><p>Inspector</p><h2>预览与参数</h2></div>
          <button
            className="icon-button"
            type="button"
            onClick={() => togglePanel('inspector')}
            aria-label={inspectorCollapsed ? '展开调试面板' : '折叠调试面板'}
            title={inspectorCollapsed ? '展开调试面板' : '折叠调试面板'}
            aria-expanded={!inspectorCollapsed}
          >
            {inspectorCollapsed ? <IconChevronLeft /> : <IconChevronRight />}
          </button>
        </div>
        <div className="inspector-scroll">
          <p className="section-label">当前图形</p>
          <SvgMarkup markup={activeTemplate.svg} className="mini-preview" />
          <div className="inspector-block">
            <div className="meta-row"><span>名称</span><strong>{activeTemplate.title}</strong></div>
            <div className="meta-row"><span>家族</span><strong>{activeTemplate.familyLabel}</strong></div>
            <div className="meta-row"><span>公式</span><code>{activeTemplate.formula}</code></div>
          </div>
          <div className="inspector-block">
            <fieldset className="animation-settings view-settings">
              <legend>视角参数</legend>
              {VIEW_AXES.map((axis, index) => (
                <label className="animation-setting" key={axis.key}>
                  <span>{axis.label} <output>{viewRotation ? `${viewRotation[index]}°` : '默认'}</output></span>
                  <input
                    type="range"
                    data-view-axis={axis.key}
                    aria-label={axis.label}
                    min={axis.min}
                    max={axis.max}
                    step="1"
                    value={viewRotation?.[index] ?? 0}
                    onChange={(event) => setViewAxis(index, Number(event.currentTarget.value))}
                  />
                </label>
              ))}
              <button className="view-reset-button" type="button" onClick={() => setViewRotation(null)} disabled={!viewRotation}>恢复默认视角</button>
            </fieldset>
          </div>
          <div className="inspector-block" hidden={!catenoid}>
            <fieldset className="animation-settings">
              <legend>动画调试</legend>
              <label className="toggle-setting"><span>自动旋转</span><input type="checkbox" data-animation-setting="autoRotate" defaultChecked disabled={Boolean(viewRotation)} /><span className="switch" aria-hidden="true" /></label>
              <label className="toggle-setting"><span>鼠标跟随</span><input type="checkbox" data-animation-setting="pointerFollow" defaultChecked disabled={Boolean(viewRotation)} /><span className="switch" aria-hidden="true" /></label>
              <label className="animation-setting"><span>旋转速度 <output>1.0×</output></span><input type="range" data-animation-setting="rotationSpeed" min="0" max="200" step="10" defaultValue="100" disabled={Boolean(viewRotation)} /></label>
              <label className="animation-setting"><span>圆环速度 <output>1.0×</output></span><input type="range" data-animation-setting="cycleSpeed" min="0" max="200" step="10" defaultValue="100" /></label>
            </fieldset>
          </div>
          <div className="inspector-block" hidden={catenoid}>
            <p className="static-notice">该动态图形根据自身几何家族使用确定性的运动与文字编排；刷新按钮可重新播放入场。</p>
          </div>
        </div>
        <footer className="inspector-footer">
          <button className="action-button secondary" type="button" onClick={() => void copyExport('scene')}>复制参数</button>
          <button className="action-button" type="button" onClick={() => void copyExport('svg')}>复制 SVG</button>
        </footer>
      </aside>
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}

declare global {
  interface HTMLCanvasElement {
    __catenoidFieldAnimation?: { restart: () => void; setFrontView: (enabled: boolean) => void; setViewRotation: (rotation: readonly number[] | null) => void }
    __wireframeAnimation?: { frame: number; restart: () => void; setFrontView: (enabled: boolean) => void; setViewRotation: (rotation: readonly number[] | null) => void }
  }
}
