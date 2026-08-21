# Initial calibration cases

## Surface of revolution

- Asset: `assets/reference-tests/surface-revolution.png`
- Preserve: hourglass topology, mirrored upper/lower flares, ring-and-meridian reading, centered neck.
- May vary: flare width, neck width, ring count, meridian count, vertical compression.
- Do not copy: background noise or exact raster line positions.

## Transform array

- Asset: `assets/reference-tests/transform-array.png`
- Preserve: simple circular/elliptical primitives, incremental transformation, restrained line styling.
- May vary: overlap, rotation step, scale progression, and stroke color.
- Do not copy: words, typography, layout, or institutional identity.

## Deformation grid

- Asset: `assets/reference-tests/deformation-grid.png`
- Preserve: analytic grid continuity, technical projection, regular sampling, coherent deformation.
- May vary: field strength, grid density, crop, orientation, and color.
- Do not copy: interface cards, comments, icons, text, or product-specific composition.

## Orbital rings

- Source evidence: the prior Knowhere circle implementation used unit-circle sampling, per-ring X/Y/Z rotations, and weak perspective `1 + z·0.08` before mapping to a 2D canvas.
- Preserve: complete orbit continuity, distinct ring attitudes, centered overall silhouette.
- May vary: ring count, Euler angles, aspect, projection strength, and sampling density.
- Do not copy: file labels, particles, hover behavior, or animation timing.

## Orbital system diagram

- Asset: `assets/reference-tests/orbital-system.png`
- Preserve: several complete elliptical orbits with clearly different attitudes, mixed solid/dashed hierarchy, a centered geometric hub, sparse outlined nodes, and a restrained reference axis.
- May vary: orbit angles, dashed-ring selection, node phases, hub radii, and axis angle.
- Do not copy: “DAILYMINIMAL”, numbering, series text, or the exact poster composition.

## Projection ray cone

- Asset: `assets/reference-tests/frustum-projection.png`
- Preserve: one shared origin, one terminal aperture, sparse straight rays, no intermediate cross-section rings, and symmetry around the central axis.
- May vary: aperture ratio, length, ray count, aperture aspect, and weak-perspective strength.
- Do not copy: black markers, dotted annotations, paper texture, or diagram-specific symbols.

## Converging braided helix

- Asset: `assets/reference-tests/converging-helix-side-view.png`
- Preserve: several phase-offset dashed curves reading as lateral waves around one X axis, clear crossings, large amplitude at the inlet, monotonic radial and pitch convergence, and a thin horizontal continuation.
- May vary: strand count, turns, phase span, small turn differences, dash pattern, perspective, decay rate, compression, color, and tail length.
- Do not copy: exact dash locations, crop, glow artifacts, or accidental raster noise.
- Failure cue: isolated dots, straight rays, or repeated vertical hoop sections do not preserve the side-view braided topology.

## Web engineering backgrounds

- Asset: `assets/reference-tests/web-engineering-backgrounds.png`
- Preserve: sparse open geometry, obvious axes or focal points, separated perspective layers, restrained line hierarchy, and enough negative space for interface content.
- May vary: grid density, layer count, pole separation, projection, crop, and color.
- Do not copy: interface cards, product text, avatars, icons, brand colors, or the exact page composition.
- Failure cue: dense closed curves that collapse into one ornamental silhouette at card scale do not meet this case.

These cases establish family behavior; they are not a fixed style palette. Add a new case only when a real request exposes a missing classification or rendering rule.
