import { useEffect, useRef } from 'react'
import arraysGridsUrl from '../../assets/animations/definitions/arrays-grids.js?url'
import fieldsCurvesUrl from '../../assets/animations/definitions/fields-curves.js?url'
import generatedShapesUrl from '../../assets/animations/definitions/generated-shapes.js?url'
import spatialUrl from '../../assets/animations/definitions/spatial.js?url'
import runtimeUrl from '../../assets/animations/wireframe-runtime.js?url'

type AnimationInstance = {
  destroy: () => void
  frame: number
  restart: () => void
  setColors: (accentColor: string, backgroundColor: string) => void
  setFrontView: (enabled: boolean) => void
  setViewRotation: (rotation: readonly number[] | null) => void
}

type AnimationCanvas = HTMLCanvasElement & {
  __wireframeAnimation?: AnimationInstance
}

type AnimationRuntime = {
  destroy: (canvas: AnimationCanvas) => void
  initialize: (canvas?: AnimationCanvas) => void
}

const definitionScripts = [spatialUrl, arraysGridsUrl, fieldsCurvesUrl, generatedShapesUrl]

function loadScript(url: string) {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`)
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script')
    const onLoad = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', () => reject(new Error(`Unable to load animation script: ${url}`)), { once: true })
    if (!existing) {
      script.src = url
      script.async = true
      document.head.appendChild(script)
    }
  })
}

export function loadWireframeDefinitions() {
  return Promise.all(definitionScripts.map(loadScript))
}

export function WireframeAnimation({ templateId, viewRotation, accentColor, backgroundColor }: {
  templateId: string
  viewRotation: readonly number[] | null
  accentColor: string
  backgroundColor: string
}) {
  const canvasRef = useRef<AnimationCanvas>(null)
  const viewRotationRef = useRef(viewRotation)
  viewRotationRef.current = viewRotation
  const colorsRef = useRef({ accentColor, backgroundColor })
  colorsRef.current = { accentColor, backgroundColor }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    const initialize = async () => {
      await loadWireframeDefinitions()
      await loadScript(runtimeUrl)
      if (disposed) return
      window.__parametricWireframeRuntime?.initialize(canvas)
      canvas.__wireframeAnimation?.restart()
      canvas.__wireframeAnimation?.setViewRotation(viewRotationRef.current)
      canvas.__wireframeAnimation?.setColors(colorsRef.current.accentColor, colorsRef.current.backgroundColor)
    }

    void initialize()
    return () => {
      disposed = true
      window.__parametricWireframeRuntime?.destroy(canvas)
    }
  }, [templateId])

  useEffect(() => {
    canvasRef.current?.__wireframeAnimation?.setViewRotation(viewRotation)
  }, [viewRotation])

  useEffect(() => {
    canvasRef.current?.__wireframeAnimation?.setColors(accentColor, backgroundColor)
  }, [accentColor, backgroundColor])

  return (
    <canvas
      ref={canvasRef}
      className="parametric-animation"
      data-animation={templateId}
      aria-hidden="true"
    />
  )
}

declare global {
  interface Window {
    __parametricWireframeDefinitions?: Record<string, {
      draw: (frame: {
        context: CanvasRenderingContext2D
        width: number
        height: number
        elapsed: number
        intro: number
        reducedMotion: boolean
        pointer: { x: number; y: number }
        frontView: boolean
        viewRotation: readonly number[] | null
        accentColor?: string | null
        backgroundColor?: string | null
      }) => void
    }>
    __parametricWireframeRuntime?: AnimationRuntime
  }
}
