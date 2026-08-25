import { useEffect, useRef } from 'react'
import animationUrl from '../../assets/animations/catenoid-field.js?url'

type AnimationInstance = {
  destroy: () => void
  restart: () => void
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

export function CatenoidAnimation({ active, viewRotation }: { active: boolean; viewRotation: readonly number[] | null }) {
  const canvasRef = useRef<AnimationCanvas>(null)
  const viewRotationRef = useRef(viewRotation)
  viewRotationRef.current = viewRotation

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
