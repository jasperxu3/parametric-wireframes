import { useEffect, useMemo, useRef } from 'react'
import animationUrl from '../../assets/animations/converging-helix.js?url'
import './converging-helix-embed.css'

export type HelixRotation = readonly [pitch: number, yaw: number, roll: number]

export type ConvergingHelixEmbedProps = {
  accentColor?: string
  amplitude?: number
  backgroundColor?: string
  className?: string
  compression?: number
  dashGap?: number
  dashLength?: number
  decay?: number
  lineWidth?: number
  mirror?: boolean
  opacity?: number
  rotation?: HelixRotation
  showDataSquares?: boolean
  speed?: number
  strands?: number
  turns?: number
}

type Options = {
  accent: string
  amplitude: number
  background: string
  compression: number
  dashGap: number
  dashLength: number
  decay: number
  lineWidth: number
  mirror: boolean
  opacity: number
  rotation: number[]
  showDataSquares: boolean
  speed: number
  strands: number
  turns: number
}

type AnimationInstance = {
  destroy: () => void
  restart: () => void
  setOptions: (options: Options) => void
}

type AnimationCanvas = HTMLCanvasElement & {
  __convergingHelixAnimation?: AnimationInstance
}

type AnimationApi = {
  destroy: (canvas: AnimationCanvas) => void
  initialize: (canvas?: AnimationCanvas) => void
}

let animationLoad: Promise<void> | null = null

function getApi() {
  return (window as Window & { __convergingHelixEmbed?: AnimationApi }).__convergingHelixEmbed
}

function loadAnimation() {
  if (getApi()) return Promise.resolve()
  if (animationLoad) return animationLoad
  animationLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = animationUrl
    script.async = true
    script.dataset.convergingHelixEmbed = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => {
      animationLoad = null
      reject(new Error('Unable to load the converging helix animation.'))
    }, { once: true })
    document.head.appendChild(script)
  })
  return animationLoad
}

export function ConvergingHelixEmbed({
  accentColor = '#83c9ff',
  amplitude = 0.52,
  backgroundColor = 'transparent',
  className,
  compression = 1.22,
  dashGap = 8,
  dashLength = 5,
  decay = 1.05,
  lineWidth = 1,
  mirror = false,
  opacity = 0.86,
  rotation = [0, 0.57, 0],
  showDataSquares = true,
  speed = 1,
  strands = 7,
  turns = 2.25,
}: ConvergingHelixEmbedProps) {
  const canvasRef = useRef<AnimationCanvas>(null)
  const options = useMemo<Options>(() => ({
    accent: accentColor,
    amplitude,
    background: backgroundColor,
    compression,
    dashGap,
    dashLength,
    decay,
    lineWidth,
    mirror,
    opacity,
    rotation: rotation.map(value => value * Math.PI / 180),
    showDataSquares,
    speed,
    strands,
    turns,
  }), [accentColor, amplitude, backgroundColor, compression, dashGap, dashLength, decay, lineWidth, mirror, opacity, rotation, showDataSquares, speed, strands, turns])
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    void loadAnimation().then(() => {
      if (disposed) return
      getApi()?.initialize(canvas)
      canvas.__convergingHelixAnimation?.setOptions(optionsRef.current)
      canvas.__convergingHelixAnimation?.restart()
    }).catch(() => {
      canvas.dataset.animationError = 'true'
    })
    return () => {
      disposed = true
      getApi()?.destroy(canvas)
    }
  }, [])

  useEffect(() => {
    canvasRef.current?.__convergingHelixAnimation?.setOptions(options)
  }, [options])

  return (
    <div className={['converging-helix-embed', className].filter(Boolean).join(' ')}>
      <canvas
        ref={canvasRef}
        className="converging-helix-embed__canvas"
        data-animation="converging-helix-embed"
        aria-hidden="true"
      />
    </div>
  )
}
