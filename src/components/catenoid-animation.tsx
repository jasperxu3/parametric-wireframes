import { useEffect, useRef } from 'react'
import animationUrl from '../../assets/animations/catenoid-field.js?url'

type AnimationInstance = {
  destroy: () => void
  restart: () => void
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

export function CatenoidAnimation({ active }: { active: boolean }) {
  const canvasRef = useRef<AnimationCanvas>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    const initialize = () => {
      if (disposed) return
      window.__parametricWireframesAnimations?.initialize()
      if (active) canvas.__catenoidFieldAnimation?.restart()
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
