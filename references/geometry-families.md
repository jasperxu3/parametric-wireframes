# Geometry families and scene schema

## Shared scene schema

```json
{
  "version": 1,
  "seed": 42,
  "name": "descriptive-slug",
  "viewport": { "width": 1200, "height": 1200, "padding": 72, "background": "#07051b" },
  "family": "surface-revolution",
  "geometry": {},
  "projection": { "type": "weak-perspective", "strength": 0.08, "rotation": [0, 0, 0] },
  "sampling": {},
  "style": { "stroke": "#f4f1ff", "strokeWidth": 1.2, "opacity": 0.9, "fill": "none" },
  "constraints": { "mirrorX": true },
  "variants": { "count": 6, "includeBase": true, "parameters": {} }
}
```

`variants.parameters` maps dotted numeric paths to either an absolute range, such as `{"geometry.neck":{"min":0.12,"max":0.22}}`, or a relative range, such as `{"projection.strength":{"relative":[-0.15,0.15]}}`. Array indices are valid dotted segments. Variant zero stays unchanged when `includeBase` is true.

For deliberately distinct variants, use `variants.presets`: an array of dotted-path override objects, one per variant. Presets are preferable when differences must remain visible in a reduced contact sheet, or when integer topology parameters such as ray count need to change.

## `projection-rays`

Model one source point and a terminal circular or elliptical aperture. For terminal angle `u`:

`origin = [-length, 0, 0]`

`target(u) = [length, apertureRadius · apertureAspect · cos(u), apertureRadius · sin(u)]`

Draw one terminal rim and `sampling.rays` straight paths from the same origin to evenly spaced target points. An optional small origin marker is a single outline, not an intermediate surface ring. Use this family for perspective projection diagrams and sparse ray cones. Do not use `surface-revolution` when the reference has no intermediate cross-section rings.

## `surface-revolution`

Sample a profile radius `r(v)` and rotate it around the vertical axis:

`p(u,v) = [r(v) cos(u + twist·v), height·v, r(v) sin(u + twist·v)]`

Use constant-`v` paths as rings and constant-`u` paths as meridians. Supported profiles are `hourglass`, `catenoid`, `sinusoidal`, `bell`, and `frustum`. `axis` can be `vertical` or `horizontal`.

For a one-way cone or frustum, use:

`r(v) = radiusStart + (radiusEnd - radiusStart) · ((v + 1) / 2)^exponent`

Useful parameters: `neck`, `flare`, `radiusStart`, `radiusEnd`, `exponent`, `growth`, `height`, and `twist`. Use this family when rings and meridians describe one coherent surface.

## `orbital-rings`

Start each orbit in the XY plane:

`p(t) = [rx cos(t), ry sin(t), 0]`

Rotate it in X, Y, then Z using the orbit's Euler angles. Apply the shared camera rotation and weak projection `s = 1 + strength·z`, then map to 2D. This is the static form of the prior Canvas method; elapsed time, pointer tilt, particles, and animation state are intentionally excluded.

Useful parameters: `rings[].rotation`, `rings[].radius`, `rings[].aspect`, and `sampling.segments`. A ring may also define `dash`, `strokeWidth`, and `opacity`. Optional `hubRadii`, `markers`, `axisLength`, `axisAngle`, `axisArrowSize`, and `axisMarkers` add a front-facing center hub, outlined orbital nodes, and a technical reference axis without changing the underlying orbit equations.

## `transform-array`

Sample a primitive ellipse or superellipse, then apply an indexed 2D affine transform:

`q_i(t) = T(i) · R(i) · H(i) · S(i) · p(t)`

Use `count`, `primitive`, `radiusX`, `radiusY`, `rotation`, `rotationStep`, `translate`, `translateStep`, `scale`, `scaleStep`, `shear`, and `shearStep`. This family fits identity graphics made from repeated circles or ellipses.

## `deformation-grid`

Start from a normalized grid `(u,v) ∈ [-1,1]²` and apply a continuous analytic field. Supported fields:

- `barrel`: expands or contracts coordinates radially.
- `pinch`: narrows the grid near one axis.
- `wave`: applies sinusoidal displacement.
- `hourglass`: scales horizontal position by a vertical profile.

Then optionally apply weak 3D projection. Use `rows`, `columns`, `samples`, `field`, `amount`, `frequency`, `perspective`, and `tilt`.

## `parametric-curves`

Sample analytic 2D paths directly. Supported curves are:

- `lissajous`: `x = sin(at + δ)`, `y = sin(bt)`.
- `rose`: `r = cos(kt + φ)`, then convert polar coordinates to Cartesian coordinates.
- `hypotrochoid`: a point attached to a circle rolling inside a fixed unit circle.
- `interference`: a phase-offset bundle `yᵢ(x) = A·e(x)·sin(π(fx + φᵢ))` with a smooth envelope.

Use `sampling.curves` for the number of phase layers and `sampling.segments` for path resolution. `geometry.spread` controls phase separation. This family is appropriate for mathematical curve plots and wave-interference graphics that are not surfaces or repeated closed primitives.

## `converging-helix`

Build several phase-offset 3D helices around the X axis whose radius decays toward a shared convergence point:

`pᵢ(s) = [x(s), r(s)cos θᵢ(s), r(s)sin θᵢ(s)]`

Use `rᵢ(s)=Aᵢ(1-s)^p`, `θᵢ(s)=2π(T+ΔTᵢ)s+φᵢ`, and compressed pitch `x(s)=x₀+(xc-x₀)[1-(1-s)^c]`. Project the 3D curves almost side-on so they read as horizontal, interlacing waves around the X axis. Keep phases within a limited `phaseSpan`; distributing them uniformly through a full circle creates repeated vertical coil sections and is the wrong model for a lateral braid. Small `turnSpread` and `amplitudeSpread` values make strands cross without losing the shared topology. Render each strand with a short dash pattern, keep a faint solid X axis, and append a thin tail after convergence. Use `turns`, `amplitude`, `decay`, `compression`, `phaseSpan`, `turnSpread`, `amplitudeSpread`, `dashLength`, `dashGap`, `strandWidth`, and `sampling.segments`. This family fits dashed helical streams, not point clouds, straight projection rays, or visible stacks of circular hoops.

## `layered-grid`

Construct separated trapezoidal grid planes from bilinear coordinates:

`qₗ(u,v) = [u·w(v) + κ(v-1/2), yₗ + d(v-1/2)]`

Interpolate `w(v)` between `farScale` and `nearScale`; optionally reverse that direction on alternating layers. Use this family for sparse Web backgrounds that communicate parallel planes, processing layers, or perspective stages without forming one dense surface.

## `dipole-field`

Trace normalized streamlines through a two-pole inverse-square vector field:

`F(p) = (p-p₊)/‖p-p₊‖² - (p-p₋)/‖p-p₋‖²`

Integrate from evenly spaced directions around the positive pole until each path reaches the negative pole or exits the field boundary. Add two pole markers and a restrained dashed axis. Use this family for sparse scientific field diagrams whose source, sink, direction, and hierarchy must remain legible at Web-card scale.

## Projection and fitting

The renderer uses X/Y/Z Euler rotations followed by weak perspective. It then fits all projected paths into the viewport padding without changing their relative geometry. `projection.strength` should remain small enough that `1 + strength·z` stays positive.

The renderer rejects non-finite coordinates, unsupported families, invalid colors, impossible sampling counts, negative line widths, and scenes whose geometry collapses to zero area.
