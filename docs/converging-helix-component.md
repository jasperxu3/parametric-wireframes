# Converging Helix React component

`ConvergingHelixEmbed` is a standalone Canvas component for embedding the converging braided helix without gallery controls or telemetry. Copy these files together:

- `src/components/converging-helix-embed.tsx`
- `src/components/converging-helix-embed.css`
- `assets/animations/converging-helix.js`

```tsx
<ConvergingHelixEmbed
  accentColor="#83c9ff"
  backgroundColor="transparent"
  speed={1}
  lineWidth={1}
  dashLength={5}
  dashGap={8}
  turns={2.25}
  amplitude={0.52}
  decay={1.05}
  compression={1.22}
  rotation={[0, 0.57, 0]}
  mirror={false}
  showDataSquares
/>
```

Render the opposite CTA side with the same options and `mirror`. Both instances remain independently responsive but use the same authored left-to-right convergence. The component pauses offscreen, stops while the document is hidden, caps DPR at 2, and renders a complete static frame under reduced motion.
