# 01 / Catenoid Field React component

[`CatenoidFieldEmbed`](../src/components/catenoid-field-embed.tsx) is the integration component for placing template 01 in another Vite + React page. It renders only the 4:3 animated preview: no library, inspector, sliders, buttons, or export controls.

The component uses the source animation at [`assets/animations/catenoid-field.js`](../assets/animations/catenoid-field.js). When copying it to another repository, keep these three files together and update the `animationUrl` import if their relative paths change:

- `src/components/catenoid-field-embed.tsx`
- `src/components/catenoid-field-embed.css`
- `assets/animations/catenoid-field.js`

## Usage

```tsx
import { CatenoidFieldEmbed } from './components/catenoid-field-embed'

export function IntegrationArtwork() {
  return (
    <div style={{ width: 'min(100%, 720px)' }}>
      <CatenoidFieldEmbed
        viewRotation={[20, -24, 0]}
        accentColor="#77e1ca"
        secondaryColor="#a98bff"
        backgroundColor="#0f141a"
        cycleSpeed={0.85}
        rotationSpeed={1}
      />
    </div>
  )
}
```

`viewRotation` is `[pitch, yaw, roll]` in degrees. It is a code-level configuration, not a visible control. Tune the values in the destination page and leave them fixed when the composition is approved. Pass `[0, 0, 0]` for a front view or `null` to restore the original automatic camera rotation.

`accentColor` changes the main wireframe, telemetry, and flashing data blocks. `secondaryColor` changes the secondary coordinate labels, while `backgroundColor` changes the canvas background. `cycleSpeed` controls the moving rings, data blocks, and text loops. `rotationSpeed` only controls automatic camera rotation and therefore only has an effect when `viewRotation={null}`. Speed values are multipliers from `0` to `4`; `1` is the authored default.

The animation remains responsive, pauses outside the viewport, cleans itself up on unmount, caps high-density displays at 2× DPR, and presents a complete static frame when the visitor requests reduced motion.
