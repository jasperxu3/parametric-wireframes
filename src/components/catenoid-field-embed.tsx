import { useEffect, useMemo, useRef } from 'react'
import animationUrl from '../../assets/animations/catenoid-field.js?url'
import './catenoid-field-embed.css'

type AnimationInstance = {
  destroy: () => void
  restart: () => void
  setOptions: (options: CatenoidFieldOptions) => void
  setViewRotation: (rotation: readonly number[] | null) => void
}

type AnimationCanvas = HTMLCanvasElement & {
  __catenoidFieldAnimation?: AnimationInstance
}

type AnimationApi = {
  destroy: (canvas: AnimationCanvas) => void
  initialize: () => void
}

export type CatenoidViewRotation = readonly [pitch: number, yaw: number, roll: number]

type CatenoidFieldOptions = {
  accent: string
  background: string
  cycleSpeed: number
  rotationSpeed: number
  secondary: string
}

export type CatenoidFieldEmbedProps = {
  /** Main geometry, data block, and telemetry color. */
  accentColor?: string
  /** Canvas background color. */
  backgroundColor?: string
  /** CSS class applied to the 4:3 preview container. */
  className?: string
  /** Ring, data pulse, and text-loop speed multiplier. */
  cycleSpeed?: number
  /** Automatic camera speed multiplier. Only applies when viewRotation is null. */
  rotationSpeed?: number
  /** Secondary coordinate-label color. */
  secondaryColor?: string
  /**
   * Camera rotation in degrees: [pitch, yaw, roll]. Pass null to restore the
   * animation's original automatic camera movement.
   */
  viewRotation?: CatenoidViewRotation | null
}

const DEFAULT_VIEW_ROTATION: CatenoidViewRotation = [20, -24, 0]
let animationLoad: Promise<void> | null = null

function getAnimationApi() {
  return (window as Window & { __parametricWireframesAnimations?: AnimationApi }).__parametricWireframesAnimations
}

function loadAnimation() {
  if (getAnimationApi()) return Promise.resolve()
  if (animationLoad) return animationLoad

  animationLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-catenoid-field-embed]')
    const script = existing ?? document.createElement('script')
    const onLoad = () => resolve()
    const onError = () => {
      animationLoad = null
      reject(new Error('Unable to load the catenoid field animation.'))
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) {
      script.src = animationUrl
      script.async = true
      script.dataset.catenoidFieldEmbed = 'true'
      document.head.appendChild(script)
    }
  })

  return animationLoad
}

/**
 * Standalone 01 / Catenoid Field artwork with no workbench controls or
 * surrounding application chrome.
 */
export function CatenoidFieldEmbed({
  accentColor = '#77e1ca',
  backgroundColor = '#0f141a',
  className,
  cycleSpeed = 1,
  rotationSpeed = 1,
  secondaryColor = '#a98bff',
  viewRotation = DEFAULT_VIEW_ROTATION,
}: CatenoidFieldEmbedProps) {
  const canvasRef = useRef<AnimationCanvas>(null)
  const rotationRadians = useMemo(
    () => viewRotation?.map(value => value * Math.PI / 180) ?? null,
    [viewRotation],
  )
  const rotationRef = useRef<readonly number[] | null>(rotationRadians)
  rotationRef.current = rotationRadians
  const options = useMemo<CatenoidFieldOptions>(() => ({
    accent: accentColor,
    background: backgroundColor,
    cycleSpeed,
    rotationSpeed,
    secondary: secondaryColor,
  }), [accentColor, backgroundColor, cycleSpeed, rotationSpeed, secondaryColor])
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    void loadAnimation()
      .then(() => {
        if (disposed) return
        getAnimationApi()?.initialize()
        canvas.__catenoidFieldAnimation?.restart()
        canvas.__catenoidFieldAnimation?.setOptions(optionsRef.current)
        canvas.__catenoidFieldAnimation?.setViewRotation(rotationRef.current)
      })
      .catch(() => {
        canvas.dataset.animationError = 'true'
      })

    return () => {
      disposed = true
      getAnimationApi()?.destroy(canvas)
    }
  }, [])

  useEffect(() => {
    canvasRef.current?.__catenoidFieldAnimation?.setViewRotation(rotationRadians)
  }, [rotationRadians])

  useEffect(() => {
    canvasRef.current?.__catenoidFieldAnimation?.setOptions(options)
  }, [options])

  return (
    <div className={['catenoid-field-embed', className].filter(Boolean).join(' ')}>
      <canvas
        ref={canvasRef}
        className="catenoid-field-embed__canvas"
        data-animation="catenoid-field"
        aria-hidden="true"
      />
    </div>
  )
}
