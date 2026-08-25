(() => {
  'use strict';

  window.__parametricWireframeDefinitions ||= {};
  const definitions = window.__parametricWireframeDefinitions;
  const TAU = Math.PI * 2;
  const BG = '#0f141a';
  const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const rgba = (hex, opacity) => {
    const c = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${opacity})`;
  };

  function stage(context, width, height, viewRotation = null, background = BG) {
    context.save();
    context.clearRect(0, 0, width, height);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const scale = Math.min(width / 800, height / 600);
    return { x: (width - 800 * scale) / 2, y: (height - 600 * scale) / 2, scale, viewRotation };
  }

  function map(s, point) {
    const projected = s.viewRotation ? project([point[0], point[1], 0], s.viewRotation, 0.12) : point;
    return [s.x + (400 + projected[0] * 220) * s.scale, s.y + (305 + projected[1] * 220) * s.scale];
  }
  function path(context, s, points, color, opacity = 0.7, width = 1, reveal = 1, dash = [], offset = 0) {
    if (points.length < 2 || reveal <= 0) return;
    const last = Math.max(1, Math.ceil((points.length - 1) * clamp(reveal)));
    context.beginPath();
    let p = map(s, points[0]); context.moveTo(p[0], p[1]);
    for (let index = 1; index <= last; index += 1) { p = map(s, points[index]); context.lineTo(p[0], p[1]); }
    context.strokeStyle = rgba(color, opacity);
    context.lineWidth = width * s.scale;
    context.setLineDash(dash.map(value => value * s.scale));
    context.lineDashOffset = offset * s.scale;
    context.stroke();
  }

  function label(context, s, text, x, y, color, align = 'left', opacity = 0.55, vertical = false) {
    context.save();
    context.font = `600 ${Math.max(7, 10 * s.scale)}px ${FONT}`;
    context.textAlign = align; context.textBaseline = 'middle'; context.fillStyle = rgba(color, opacity);
    context.translate(s.x + x * s.scale, s.y + y * s.scale);
    if (vertical) context.rotate(-Math.PI / 2);
    context.fillText(text, 0, 0); context.restore();
  }

  function node(context, s, point, color, size = 11) {
    const p = map(s, point); const pixels = Math.max(7, Math.min(15, size * s.scale));
    context.fillStyle = rgba(color, 0.96); context.fillRect(p[0] - pixels / 2, p[1] - pixels / 2, pixels, pixels);
  }

  function events(context, s, elapsed, reduced, entries, color) {
    if (reduced) return;
    entries.forEach((entry, index) => {
      if ((elapsed + index * 431) % (1730 + index * 97) < 310) node(context, s, entry, color, 9 + index % 3 * 2);
    });
  }

  function rotate(point, rotation) {
    let [x, y, z] = point; let c = Math.cos(rotation[0]); let n = Math.sin(rotation[0]);
    [y, z] = [y * c - z * n, y * n + z * c]; c = Math.cos(rotation[1]); n = Math.sin(rotation[1]);
    [x, z] = [x * c + z * n, -x * n + z * c]; c = Math.cos(rotation[2]); n = Math.sin(rotation[2]);
    return [x * c - y * n, x * n + y * c, z];
  }
  function project(point, rotation, strength) { const p = rotate(point, rotation); const k = 1 + p[2] * strength; return [p[0] * k, p[1] * k, p[2]]; }
  function pointer(frame, axis) { return frame.reducedMotion ? 0 : Math.max(-1, Math.min(1, Number(frame.pointer?.[axis]) || 0)); }
  function finish(context) { context.restore(); }

  const arrays = [
    {
      id: 'nested-lens-tunnel', color: '#e8edf2', count: 18, super: 2, radius: [0.9, 0.86], rotation: -0.26, dr: 0.024,
      translate: [-0.22, 0.08], dt: [0.025, -0.01], scale: [0.28, 1.34], ds: [0.04, -0.052], shear: -0.12, dh: 0.009
    },
    {
      id: 'offset-superellipse-echo', color: '#f6a6d7', count: 16, super: 3.9, radius: [0.58, 0.72], rotation: -0.24, dr: 0.024,
      translate: [-0.38, -0.27], dt: [0.05, 0.036], scale: [0.72, 0.72], ds: [0.018, 0.018], shear: -0.11, dh: 0.012
    }
  ];
  function arrayPoints(g, index, pulse) {
    const points = []; const angle = g.rotation + index * g.dr; const co = Math.cos(angle); const si = Math.sin(angle);
    for (let segment = 0; segment <= 220; segment += 1) {
      const t = segment / 220 * TAU; const power = 2 / g.super;
      const ux = Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), power);
      const uy = Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), power);
      const x = ux * g.radius[0] * (g.scale[0] + index * g.ds[0]) * pulse;
      const y = uy * g.radius[1] * (g.scale[1] + index * g.ds[1]) * pulse;
      const sx = x + (g.shear + index * g.dh) * y;
      points.push([sx * co - y * si + g.translate[0] + index * g.dt[0], sx * si + y * co + g.translate[1] + index * g.dt[1]]);
    }
    return points;
  }
  arrays.forEach(g => definitions[g.id] = { id: g.id, draw(frame) {
    const { context, width, height, elapsed, reducedMotion } = frame; const color = frame.accentColor || g.color; const s = stage(context, width, height, frame.viewRotation, frame.backgroundColor || BG);
    const active = reducedMotion ? -10 : elapsed / (g.id === arrays[0].id ? 410 : 530) % g.count; const nodes = [];
    for (let index = 0; index < g.count; index += 1) {
      const distance = Math.min(Math.abs(index - active), g.count - Math.abs(index - active)); const glow = reducedMotion ? 0 : ease(1 - distance / 2.8);
      const points = arrayPoints(g, index, 1 + glow * (g.id === arrays[0].id ? 0.025 : 0.045));
      path(context, s, points, color, 0.38 + index / g.count * 0.34 + glow * 0.22, 0.95 + glow * 0.65, reducedMotion ? 1 : ease((frame.intro - index / g.count * 0.48) / 0.52));
      if (index % 4 === 1) nodes.push(points[(23 + index * 31) % 220]);
    }
    events(context, s, elapsed, reducedMotion, nodes, color);
    label(context, s, g.id === arrays[0].id ? 'LENS ARRAY / ΔT 0.025,−0.010' : 'ECHO MATRIX / n=3.90', 64, 58, color);
    label(context, s, reducedMotion ? `LAYER / ${g.count}` : `LAYER / ${String(Math.floor(active) + 1).padStart(2, '0')}`, 736, 542, color, 'right', 0.72);
    if (g.id === arrays[1].id) label(context, s, 'ΔH → 0.012', 748, 300, color, 'center', 0.38, true);
    else label(context, s, 'Sᵧ 1.340 → 0.456', 64, 542, color);
    finish(context);
  }});

  const orbitRings = [
    [[0.16, 0.42, 0.06], 1.08, 0.58], [[0.72, -0.18, 0.48], 1.02, 0.82], [[-0.64, 0.5, -0.54], 1.12, 0.7],
    [[1.12, 0.24, 0.98], 0.94, 0.9], [[-1.02, -0.3, 0.74], 1, 0.76], [[0.38, 1.04, -1.08], 0.88, 0.64], [[-0.24, 0.82, 1.3], 1.05, 0.86]
  ];
  definitions['orbital-halo-weave'] = { id: 'orbital-halo-weave', draw(frame) {
    const { context, width, height, elapsed, reducedMotion } = frame; const color = frame.accentColor || '#9fb6ff'; const s = stage(context, width, height, null, frame.backgroundColor || BG);
    const view = frame.viewRotation ?? [0.18 + pointer(frame, 'y') * 0.05, -0.12 + pointer(frame, 'x') * 0.07, 0.08]; const nodes = [];
    orbitRings.forEach((ring, index) => {
      const precession = reducedMotion ? 0 : Math.sin(elapsed / (2600 + index * 190)) * 0.055;
      const r = [ring[0][0] + precession, ring[0][1], ring[0][2] + precession * (index % 2 ? -1 : 1)]; const points = [];
      for (let segment = 0; segment <= 240; segment += 1) { const a = segment / 240 * TAU; points.push(project(rotate([Math.cos(a) * ring[1], Math.sin(a) * ring[1] * ring[2], 0], r), view, 0.11)); }
      path(context, s, points, color, index === 6 ? 0.56 : 0.72, 1.02, reducedMotion ? 1 : ease((frame.intro - index * 0.05) / 0.65), index === 4 ? [5, 9] : []);
      nodes.push(points[(index * 37 + 29) % 240]);
    });
    events(context, s, elapsed, reducedMotion, nodes, color); path(context, s, [[-1.22, 0], [1.22, 0]], color, 0.35, 0.8, 1, [4, 6]);
    label(context, s, 'HALO / 07 ORBITS', 70, 70, color); label(context, s, reducedMotion ? 'PRECESSION / HOLD' : `PRECESSION / ${Math.floor(elapsed / 700) % 7 + 1}`, 730, 82, color, 'right');
    label(context, s, 'DATA TRAVERSE', 400, 548, color, 'center', 0.42); finish(context);
  }};

  function parametric(kind, variant, t) {
    if (kind === 'rose') { const radius = Math.cos(7 * t + variant * 0.13); return [radius * Math.cos(t), radius * Math.sin(t)]; }
    const R = 5, r = 3, d = 0.31 * R; return [((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t)) / 3.6, ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)) / 3.6];
  }
  [
    ['rose-curve-choir', '#ffd27a', 'rose', 11, 2], ['hypotrochoid-knot', '#9f8cff', 'hypo', 1, 3]
  ].forEach(config => definitions[config[0]] = { id: config[0], draw(frame) {
    const [id, defaultColor, kind, count, turns] = config; const { context, width, height, elapsed, reducedMotion } = frame; const color = frame.accentColor || defaultColor; const s = stage(context, width, height, frame.viewRotation, frame.backgroundColor || BG);
    const phase = reducedMotion ? 0 : kind === 'rose' ? elapsed * 0.00018 : elapsed % 6000 / 6000 * TAU; const nodes = [];
    for (let curve = 0; curve < count; curve += 1) { const points = [];
      for (let segment = 0; segment <= 560; segment += 1) { const t = segment / 560 * TAU * turns + (kind === 'rose' ? phase : 0); const p = parametric(kind, curve, t); const spread = (curve - (count - 1) / 2) * (kind === 'rose' ? 0.012 : 0.02); const x = p[0] * (kind === 'rose' ? 0.88 + spread : 1 + spread); const y = p[1] * (kind === 'rose' ? 0.88 - spread : 1 - spread); points.push(kind === 'rose' ? [x, y] : [x * Math.cos(phase) - y * Math.sin(phase), x * Math.sin(phase) + y * Math.cos(phase)]); }
      path(context, s, points, color, kind === 'rose' ? 0.38 + curve / count * 0.3 : 0.92, kind === 'rose' ? 0.96 : 2.1, reducedMotion ? 1 : ease((frame.intro - curve * 0.025) / 0.72));
      if (kind === 'rose') nodes.push(points[(curve * 71 + 43) % 560]);
      else [43, 127, 211, 295, 379, 463].forEach(index => nodes.push(points[index]));
    }
    events(context, s, elapsed, reducedMotion, nodes.slice(0, 6), color);
    if (kind === 'rose') { label(context, s, 'PETAL CHOIR / k=7', 66, 64, color); label(context, s, reducedMotion ? 'φ / COMPLETE' : `φ / ${(phase % TAU).toFixed(2)}`, 734, 64, color, 'right'); label(context, s, '11 COHERENT TRACES', 400, 548, color, 'center'); }
    else { label(context, s, 'R:r / 5:3', 70, 92, color); label(context, s, 'HYPOTROCHOID', 730, 510, color, 'right'); label(context, s, reducedMotion ? 'TRACE / CLOSED' : `TRACE / ${String(Math.floor(elapsed / 500) % 9 + 1).padStart(2, '0')}`, 70, 510, color); }
    finish(context);
  }});

  function gridDefinition(id, color, field, amount, frequency, tilt, depth, rotation, rows, columns) {
    definitions[id] = { id, draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame; const activeColor = frame.accentColor || color; const s = stage(context, width, height, null, frame.backgroundColor || BG);
      const phase = reducedMotion ? 0.65 : elapsed * (field === 'wave' ? 0.00072 : 0.00048); const all = []; const make = (u, v) => {
        let x = u, y = v, z;
        if (field === 'wave') z = amount * 0.27 * Math.sin(Math.PI * frequency * u + phase) * Math.cos(Math.PI * frequency * v - phase * 0.7);
        else { x *= 1 - amount * Math.exp(-frequency * v * v); z = depth * (x * x - v * v) * 0.38 + 0.08 * Math.cos(v * Math.PI); }
        y += tilt * x * 0.16; return project([x, y, z], frame.viewRotation ?? rotation, field === 'wave' ? 0.17 : 0.2);
      };
      for (let row = 0; row < rows; row += 1) { const points = []; const v = -1 + row * 2 / (rows - 1); for (let q = 0; q <= 112; q += 1) points.push(make(-1 + q / 56, v)); all.push(points); }
      for (let column = 0; column < columns; column += 1) { const points = []; const u = -1 + column * 2 / (columns - 1); for (let q = 0; q <= 112; q += 1) points.push(make(u, -1 + q / 56)); all.push(points); }
      const scan = reducedMotion ? -1 : Math.floor(elapsed / 190) % all.length;
      all.forEach((points, index) => path(context, s, points, activeColor, 0.42 + (index === scan ? 0.46 : 0), index === scan ? 2 : 0.92, reducedMotion ? 1 : ease((frame.intro - index / all.length * 0.42) / 0.58)));
      events(context, s, elapsed, reducedMotion, [all[2][31], all[7][78], all[rows + 3][50], all[rows + 10][89]], activeColor);
      if (field === 'wave') { label(context, s, 'BOUNDARY / FOLDED WAVE', 62, 62, activeColor); label(context, s, reducedMotion ? 'PHASE / HOLD' : `PHASE / ${(phase % TAU).toFixed(2)}`, 738, 538, activeColor, 'right'); label(context, s, '11 × 17', 738, 62, activeColor, 'right'); }
      else { label(context, s, 'PINCH / a=0.88', 65, 82, activeColor); label(context, s, 'SADDLE DEPTH / 0.82', 735, 518, activeColor, 'right'); label(context, s, reducedMotion ? 'SCAN / COMPLETE' : `SCAN / ${String(scan + 1).padStart(2, '0')}`, 65, 518, activeColor); }
      finish(context);
    }};
  }
  gridDefinition('folded-wave-membrane', '#74d8ff', 'wave', 0.98, 1.72, 0.32, 0.66, [0.62, -0.2, 0.42], 11, 17);
  gridDefinition('pinched-saddle-grid', '#6ee7b7', 'pinch', 0.88, 2.45, -0.62, 0.82, [-0.38, 0.24, -0.18], 13, 17);

  definitions['skewed-projection-gate'] = { id: 'skewed-projection-gate', draw(frame) {
    const { context, width, height, elapsed, reducedMotion } = frame; const color = frame.accentColor || '#ff9f80'; const s = stage(context, width, height, null, frame.backgroundColor || BG); const rotation = frame.viewRotation ?? [0.29, -0.51, 0.2];
    const origin = project([-1.72, 0, 0], rotation, 0.22); const targets = []; const rim = [];
    for (let q = 0; q <= 220; q += 1) { const a = 0.31 + q / 220 * TAU; rim.push(project([0, 0.82 * Math.cos(a), 0.82 * 0.34 * Math.sin(a)], rotation, 0.22)); }
    path(context, s, rim, color, 0.9, 1.2, reducedMotion ? 1 : ease((frame.intro - 0.2) / 0.7));
    for (let ray = 0; ray < 19; ray += 1) { const target = rim[Math.floor(ray / 19 * 220)]; targets.push(target); path(context, s, [origin, target], color, 0.5 + ray % 3 * 0.08, 1.02, reducedMotion ? 1 : ease((frame.intro - ray * 0.018) / 0.68)); }
    if (!reducedMotion) { const ray = Math.floor(elapsed / 380) % 19; const progress = (elapsed % 2900) / 2900; const end = targets[ray]; const lerp = q => [origin[0] + (end[0] - origin[0]) * q, origin[1] + (end[1] - origin[1]) * q]; path(context, s, [lerp(Math.max(0, progress - 0.13)), lerp(progress)], color, 1, 2.6); node(context, s, lerp(progress), color, 10); events(context, s, elapsed, false, [targets[(ray + 7) % 19]], color); }
    path(context, s, [origin, project([0, 0, 0], rotation, 0.22)], color, 0.38, 0.8, 1, [4, 6]);
    label(context, s, 'ORIGIN / o', 68, 210, color); label(context, s, 'APERTURE / 19 RAYS', 735, 98, color, 'right'); label(context, s, reducedMotion ? 'PROJECT / LOCK' : `PACKET / ${String(Math.floor(elapsed / 380) % 19 + 1).padStart(2, '0')}`, 735, 520, color, 'right'); finish(context);
  }};

  function dipoleLines() { const lines = []; const source = [-0.76, 0], sink = [0.76, 0];
    for (let line = 0; line < 23; line += 1) { const angle = -2.55 + line / 22 * 5.1; let p = [source[0] + Math.cos(angle) * 0.082, Math.sin(angle) * 0.082]; const points = [p];
      for (let step = 0; step < 980; step += 1) { const a = [p[0] - source[0], p[1]], b = [p[0] - sink[0], p[1]]; const ar = Math.max(0.0001, a[0] ** 2 + a[1] ** 2), br = Math.max(0.0001, b[0] ** 2 + b[1] ** 2); let x = a[0] / ar - b[0] / br, y = a[1] / ar - b[1] / br; const length = Math.hypot(x, y); p = [p[0] + x / length * 0.012, p[1] + y / length * 0.012]; points.push(p); if (Math.hypot(p[0] - sink[0], p[1]) < 0.06 || Math.hypot(...p) > 3.6) break; }
      lines.push(points);
    } return lines;
  }
  const magneticLines = dipoleLines();
  definitions['magnetic-eye-field'] = { id: 'magnetic-eye-field', draw(frame) {
    const { context, width, height, elapsed, reducedMotion } = frame; const color = frame.accentColor || '#d9e875'; const s = stage(context, width, height, frame.viewRotation, frame.backgroundColor || BG); const nodes = [];
    magneticLines.forEach((points, index) => { const fitted = points.map(point => [point[0], point[1] * 0.4]); path(context, s, fitted, color, index === 11 ? 0.88 : 0.57, index === 11 ? 1.35 : 0.96, reducedMotion ? 1 : ease((frame.intro - index * 0.014) / 0.7));
      if (!reducedMotion) { const start = Math.floor(((elapsed / 3300 + index / 23) % 1) * Math.max(1, fitted.length - 14)); path(context, s, fitted.slice(start, start + 14), color, 1, 2.4); }
      nodes.push(fitted[Math.floor(fitted.length * (0.25 + index % 4 * 0.12))]);
    }); events(context, s, elapsed, reducedMotion, nodes.slice(0, 7), color);
    label(context, s, 'SOURCE / +q', 64, 70, color); label(context, s, 'SINK / −q', 736, 70, color, 'right'); label(context, s, reducedMotion ? 'FLOW / STABLE' : `FLOW / ${Math.floor(elapsed / 1450) % 2 ? 'CAPTURE' : 'EMIT'}`, 400, 548, color, 'center'); finish(context);
  }};

})();
