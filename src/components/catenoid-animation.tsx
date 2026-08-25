import { useEffect, useRef } from 'react'
import animationUrl from '../../assets/animations/catenoid-field.js?url'

type AnimationInstance = {
  destroy: () => void
  restart: () => void
  setOptions: (options: { accent: string; background: string; secondary: string }) => void
  setFrontView: (enabled: boolean) => void
  setViewRotation: (rotation: readonly number[] | null) => void
}

type AnimationCanvas = HTMLCanvasElement & {
  __catenoidFieldAnimation?: AnimationInstance
}

type AnimationApi = {
  destroy: (canvas: AnimationCanvas) => void
  initialize: () => void
}

declare global {
  interface Window {
    __parametricWireframesAnimations?: AnimationApi
  }
}

export function CatenoidAnimation({ active, viewRotation, accentColor, backgroundColor }: {
  active: boolean
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

    const initialize = () => {
      if (disposed) return
      window.__parametricWireframesAnimations?.initialize()
      if (active) {
        canvas.__catenoidFieldAnimation?.restart()
        canvas.__catenoidFieldAnimation?.setViewRotation(viewRotationRef.current)
        canvas.__catenoidFieldAnimation?.setOptions({
          accent: colorsRef.current.accentColor,
          background: colorsRef.current.backgroundColor,
          secondary: colorsRef.current.accentColor,
        })
      }
    }

    if (window.__parametricWireframesAnimations) {
      initialize()
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-catenoid-animation]')
      if (existing) {
        existing.addEventListener('load', initialize, { once: true })
      } else {
        const script = document.createElement('script')
        script.src = animationUrl
        script.async = true
        script.dataset.catenoidAnimation = 'true'
        script.addEventListener('load', initialize, { once: true })
        document.head.appendChild(script)
      }
    }

    return () => {
      disposed = true
      window.__parametricWireframesAnimations?.destroy(canvas)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const api = window.__parametricWireframesAnimations
    if (!canvas || !api) return
    if (active) {
      api.initialize()
      canvas.__catenoidFieldAnimation?.restart()
    } else {
      api.destroy(canvas)
    }
  }, [active])

  useEffect(() => {
    canvasRef.current?.__catenoidFieldAnimation?.setViewRotation(viewRotation)
  }, [viewRotation])

  useEffect(() => {
    canvasRef.current?.__catenoidFieldAnimation?.setOptions({ accent: accentColor, background: backgroundColor, secondary: accentColor })
  }, [accentColor, backgroundColor])

  return (
    <canvas
      ref={canvasRef}
      className="parametric-animation"
      data-animation="catenoid-field"
      aria-hidden="true"
      hidden={!active}
    />
  )
}
