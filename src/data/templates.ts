import catalog from '../../assets/template-library/catalog.json'

const svgModules = import.meta.glob('../../docs/templates/*/*-01.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const svgById = Object.fromEntries(
  Object.entries(svgModules).map(([file, svg]) => [file.match(/\/templates\/([^/]+)\//)?.[1], svg]),
)

export type WireframeTemplate = (typeof catalog.templates)[number] & {
  svg: string
}

export const templates: WireframeTemplate[] = catalog.templates.map((template) => {
  const svg = svgById[template.id]
  if (!svg) throw new Error(`Missing generated SVG for ${template.id}`)
  return { ...template, svg }
})
