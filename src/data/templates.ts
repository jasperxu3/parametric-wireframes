import catalog from '../../assets/template-library/catalog.json'
import atomicOrbitsSvg from '../../docs/templates/atomic-orbits/atomic-orbits-01.svg?raw'
import catenoidFieldSvg from '../../docs/templates/catenoid-field/catenoid-field-01.svg?raw'
import convergingHelixSvg from '../../docs/templates/converging-dashed-helix/converging-dashed-helix-01.svg?raw'
import ellipseReflectionSvg from '../../docs/templates/ellipse-reflection/ellipse-reflection-01.svg?raw'
import gravityWellSvg from '../../docs/templates/gravity-well/gravity-well-01.svg?raw'
import interferenceWavesSvg from '../../docs/templates/interference-waves/interference-waves-01.svg?raw'
import layeredGridSvg from '../../docs/templates/layered-perspective-grid/layered-perspective-grid-01.svg?raw'
import projectionConeSvg from '../../docs/templates/projection-cone/projection-cone-01.svg?raw'
import radialPetalsSvg from '../../docs/templates/radial-petals/radial-petals-01.svg?raw'
import sparseDipoleSvg from '../../docs/templates/sparse-dipole-field/sparse-dipole-field-01.svg?raw'
import superellipseStackSvg from '../../docs/templates/superellipse-stack/superellipse-stack-01.svg?raw'
import twistedFunnelSvg from '../../docs/templates/twisted-funnel/twisted-funnel-01.svg?raw'
import waveMembraneSvg from '../../docs/templates/wave-membrane/wave-membrane-01.svg?raw'

const svgById: Record<string, string> = {
  'atomic-orbits': atomicOrbitsSvg,
  'catenoid-field': catenoidFieldSvg,
  'converging-dashed-helix': convergingHelixSvg,
  'ellipse-reflection': ellipseReflectionSvg,
  'gravity-well': gravityWellSvg,
  'interference-waves': interferenceWavesSvg,
  'layered-perspective-grid': layeredGridSvg,
  'projection-cone': projectionConeSvg,
  'radial-petals': radialPetalsSvg,
  'sparse-dipole-field': sparseDipoleSvg,
  'superellipse-stack': superellipseStackSvg,
  'twisted-funnel': twistedFunnelSvg,
  'wave-membrane': waveMembraneSvg,
}

export type WireframeTemplate = (typeof catalog.templates)[number] & {
  svg: string
}

export const templates: WireframeTemplate[] = catalog.templates.map((template) => {
  const svg = svgById[template.id]
  if (!svg) throw new Error(`Missing generated SVG for ${template.id}`)
  return { ...template, svg }
})
