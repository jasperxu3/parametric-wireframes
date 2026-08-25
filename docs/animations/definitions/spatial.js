(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const BACKGROUND = '#0f141a';
  const FUNNEL = '#ffbd70';
  const CONE = '#60a5fa';
  const ORBITS = '#f2f2f2';

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function ease(value) {
    return 0.5 - Math.cos(clamp(value) * Math.PI) * 0.5;
  }

  function rgba(hex, alpha) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  function rotate3D(point, rotation) {
    let [x, y, z] = point;
    const [rx, ry, rz] = rotation;
    let cosine = Math.cos(rx);
    let sine = Math.sin(rx);
    [y, z] = [y * cosine - z * sine, y * sine + z * cosine];
    cosine = Math.cos(ry);
    sine = Math.sin(ry);
    [x, z] = [x * cosine + z * sine, -x * sine + z * cosine];
    cosine = Math.cos(rz);
    sine = Math.sin(rz);
    return [x * cosine - y * sine, x * sine + y * cosine, z];
  }

  function project3D(point, rotation, strength) {
    const rotated = rotate3D(point, rotation);
    const perspective = 1 + rotated[2] * strength;
    return [rotated[0] * perspective, rotated[1] * perspective, rotated[2]];
  }

  function screenPoint(point, layout) {
    return {
      x: layout.cx + point[0] * layout.scale,
      y: layout.cy + point[1] * layout.scale,
      z: point[2] || 0
    };
  }

  function beginFrame(context, width, height, background = BACKGROUND) {
    context.save();
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  function endFrame(context) {
    context.restore();
  }

  function trace(context, points, reveal = 1) {
    if (points.length < 2 || reveal <= 0) return;
    const final = Math.max(1, Math.ceil((points.length - 1) * clamp(reveal)));
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index <= final; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.stroke();
  }

  function labelStyle(context, color, size, alpha = 0.72) {
    context.fillStyle = rgba(color, alpha);
    context.font = `${Math.max(9, size)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textBaseline = 'middle';
    context.letterSpacing = `${Math.max(0.5, size * 0.08)}px`;
  }

  function drawGuide(context, x1, y1, x2, y2, color, alpha = 0.28) {
    context.save();
    context.strokeStyle = rgba(color, alpha);
    context.lineWidth = 1;
    context.setLineDash([3, 5]);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.restore();
  }

  function bellRadius(v) {
    const neck = 0.12;
    const flare = 0.92;
    const bell = Math.exp(-Math.pow(Math.abs(v) * 1.55, 2));
    return flare - (flare - neck) * bell;
  }

  function funnelPoint(u, v, rotation, layout) {
    const radius = bellRadius(v);
    const angle = u + 1.05 * v;
    const point = [1.16 * v, radius * Math.cos(angle), radius * Math.sin(angle)];
    return screenPoint(project3D(point, rotation, 0.12), layout);
  }

  function drawTwistedFunnel(frame) {
    const { context, width, height, elapsed, intro, reducedMotion, pointer } = frame;
    const color = frame.accentColor || FUNNEL;
    beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);

    const view = reducedMotion || frame.viewRotation ? [0, 0] : [pointer.y * 0.055, pointer.x * 0.09];
    const rotation = frame.viewRotation ?? [0.14 + view[0], 0.22 + view[1], 0];
    const layout = {
      cx: width * 0.51,
      cy: height * 0.51,
      scale: Math.min(width * 0.64 / 2.75, height * 0.58 / 2.05)
    };
    const paths = [];

    for (let ringIndex = 0; ringIndex < 11; ringIndex += 1) {
      let v;
      if (reducedMotion || ringIndex === 0 || ringIndex === 10) {
        v = -1 + ringIndex * 0.2;
      } else {
        const phase = (ringIndex / 10 + elapsed / 6200) % 1;
        v = -1 + phase * 2;
      }
      const points = [];
      for (let segment = 0; segment <= 120; segment += 1) {
        points.push(funnelPoint(segment / 120 * TAU, v, rotation, layout));
      }
      paths.push({ points, z: points.reduce((sum, point) => sum + point.z, 0) / points.length, ring: true });
    }

    for (let meridianIndex = 0; meridianIndex < 18; meridianIndex += 1) {
      const points = [];
      const u = meridianIndex / 18 * TAU;
      for (let segment = 0; segment <= 90; segment += 1) {
        points.push(funnelPoint(u, -1 + segment / 90 * 2, rotation, layout));
      }
      paths.push({ points, z: points.reduce((sum, point) => sum + point.z, 0) / points.length, ring: false });
    }

    paths.sort((a, b) => a.z - b.z);
    paths.forEach((path, index) => {
      const reveal = reducedMotion ? 1 : ease(intro * 1.55 - index * 0.018);
      context.strokeStyle = rgba(color, path.ring ? 0.82 : 0.56);
      context.lineWidth = path.ring ? 1.12 : 0.92;
      trace(context, path.points, reveal);
    });

    const flowPhase = reducedMotion ? 0.5 : (elapsed % 6200) / 6200;
    if (!reducedMotion && elapsed % 2400 < 760) {
      const sampleV = -1 + flowPhase * 2;
      const sampleU = Math.floor(flowPhase * 18) / 18 * TAU;
      const sample = funnelPoint(sampleU, sampleV, rotation, layout);
      const squareSize = Math.max(7, Math.min(14, layout.scale * 0.08));
      context.fillStyle = rgba(color, 0.96);
      context.fillRect(sample.x - squareSize / 2, sample.y - squareSize / 2, squareSize, squareSize);
    }

    const fontSize = Math.min(width, height) * 0.022;
    labelStyle(context, color, fontSize);
    context.textAlign = 'left';
    context.fillText('INLET  v = −1', width * 0.085, height * 0.22);
    context.textAlign = 'right';
    context.fillText('OUTLET  v = +1', width * 0.915, height * 0.78);
    context.textAlign = 'center';
    context.fillText('τ = 1.05  /  BELL PROFILE', width * 0.5, height * 0.895);
    const sectionV = -1 + flowPhase * 2;
    const sectionRadius = bellRadius(sectionV);
    context.textAlign = 'left';
    context.fillText(
      reducedMotion ? 'SECTION  v = 0.00  /  r = 0.12' : `SECTION  v = ${sectionV >= 0 ? '+' : '−'}${Math.abs(sectionV).toFixed(2)}  /  r = ${sectionRadius.toFixed(2)}`,
      width * 0.085,
      height * 0.84
    );
    drawGuide(context, width * 0.13, height * 0.25, width * 0.22, height * 0.36, color);
    drawGuide(context, width * 0.87, height * 0.75, width * 0.79, height * 0.64, color);

    endFrame(context);
  }

  function conePoint(point, rotation, layout) {
    return screenPoint(project3D(point, rotation, 0.18), layout);
  }

  function drawProjectionCone(frame) {
    const { context, width, height, elapsed, intro, reducedMotion, pointer } = frame;
    const color = frame.accentColor || CONE;
    beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);

    const view = reducedMotion || frame.viewRotation ? [0, 0] : [pointer.y * 0.035, pointer.x * 0.07];
    const rotation = frame.viewRotation ?? [0.12 + view[0], 0.34 + view[1], 0];
    const layout = {
      cx: width * 0.5,
      cy: height * 0.51,
      scale: Math.min(width * 0.63 / 3.35, height * 0.54 / 1.9)
    };
    const origin = conePoint([-1.55, 0, 0], rotation, layout);
    const target = angle => conePoint([
      1.55,
      0.9 * 0.88 * Math.cos(angle),
      0.9 * Math.sin(angle)
    ], rotation, layout);

    const rim = [];
    for (let segment = 0; segment <= 180; segment += 1) {
      rim.push(target(0.18 + segment / 180 * TAU));
    }
    context.strokeStyle = rgba(color, 0.95);
    context.lineWidth = 1.3;
    trace(context, rim, reducedMotion ? 1 : ease(intro * 1.4 - 0.32));

    for (let rayIndex = 0; rayIndex < 11; rayIndex += 1) {
      const endpoint = target(0.18 + rayIndex / 11 * TAU);
      const reveal = reducedMotion ? 1 : ease(intro * 1.8 - rayIndex * 0.055);
      context.strokeStyle = rgba(color, rayIndex % 2 ? 0.72 : 0.9);
      context.lineWidth = 1.3;
      trace(context, [origin, endpoint], reveal);
    }

    const projectionPhase = reducedMotion ? 1 : (elapsed % 4800) / 4800;
    if (!reducedMotion) {
      const activeRay = Math.floor(elapsed / 4800 * 11) % 11;
      const endpoint = target(0.18 + activeRay / 11 * TAU);
      const head = projectionPhase;
      const tail = Math.max(0, head - 0.16);
      const interpolate = amount => ({
        x: origin.x + (endpoint.x - origin.x) * amount,
        y: origin.y + (endpoint.y - origin.y) * amount
      });
      context.strokeStyle = rgba(color, 1);
      context.lineWidth = 2.6;
      trace(context, [interpolate(tail), interpolate(head)], 1);

      if (elapsed % 2400 < 760) {
        const sample = interpolate(head);
        const squareSize = Math.max(7, Math.min(14, layout.scale * 0.08));
        context.fillStyle = rgba(color, 0.98);
        context.fillRect(sample.x - squareSize / 2, sample.y - squareSize / 2, squareSize, squareSize);
      }
    }

    const axisEnd = conePoint([1.55, 0, 0], rotation, layout);
    context.save();
    context.strokeStyle = rgba(color, 0.58);
    context.lineWidth = 1;
    context.setLineDash([5, 6]);
    trace(context, [origin, axisEnd], reducedMotion ? 1 : ease(intro * 2.5 - 0.08));
    context.restore();

    const marker = [];
    for (let segment = 0; segment <= 36; segment += 1) {
      const angle = segment / 36 * TAU;
      marker.push(conePoint([-1.55, 0.035 * Math.cos(angle), 0.035 * Math.sin(angle)], rotation, layout));
    }
    context.strokeStyle = rgba(color, 1);
    context.lineWidth = 1.8;
    trace(context, marker, reducedMotion ? 1 : ease(intro * 2.2 - 0.2));

    const fontSize = Math.min(width, height) * 0.022;
    labelStyle(context, color, fontSize, 0.95);
    context.textAlign = 'left';
    context.fillText('VANISHING POINT  o', width * 0.085, height * 0.27);
    context.textAlign = 'right';
    context.fillText('APERTURE  r = 0.90', width * 0.915, height * 0.19);
    context.fillText('11 PROJECTED RAYS', width * 0.915, height * 0.83);
    context.textAlign = 'left';
    context.fillText(
      reducedMotion ? 'PROJECT  100%  /  APERTURE LOCK' : `PROJECT  ${String(Math.round(projectionPhase * 100)).padStart(3, '0')}%  /  RAY ${String(Math.floor(elapsed / 4800 * 11) % 11 + 1).padStart(2, '0')}`,
      width * 0.085,
      height * 0.88
    );
    drawGuide(context, width * 0.2, height * 0.3, origin.x - fontSize, origin.y - fontSize, color, 0.48);
    drawGuide(context, width * 0.82, height * 0.22, rim[20].x, rim[20].y, color, 0.48);

    endFrame(context);
  }

  const ORBIT_RINGS = [
    { rotation: [0.12, 0.08, 0.08], radius: 1.08, aspect: 0.68, strokeWidth: 1.55 },
    { rotation: [1.08, 0.18, 0.62], radius: 1.02, aspect: 0.9, strokeWidth: 1.45 },
    { rotation: [-0.86, 0.36, -0.7], radius: 1.04, aspect: 0.92, strokeWidth: 1.35 },
    { rotation: [0.58, 0.88, 1.08], radius: 1.02, aspect: 0.94, dash: [7, 8], strokeWidth: 1.1 }
  ];
  const ORBIT_MARKERS = [
    { ring: 0, phase: 0.08, radius: 0.025 },
    { ring: 1, phase: 0.62, radius: 0.022 }
  ];

  function animatedRing(ring, index, elapsed, reducedMotion) {
    if (reducedMotion) return ring;
    const direction = index % 2 ? -1 : 1;
    const phase = elapsed / (15000 + index * 2300) * TAU * direction;
    return {
      ...ring,
      rotation: [
        ring.rotation[0] + Math.sin(phase) * (0.055 + index * 0.008),
        ring.rotation[1] + (Math.cos(phase * 0.83) - 1) * (0.07 + index * 0.006),
        ring.rotation[2] + phase * 0.12
      ]
    };
  }

  function orbitPoint(ring, phase, viewRotation, layout) {
    const angle = phase * TAU;
    const base = [Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius * ring.aspect, 0];
    const ringPoint = rotate3D(base, ring.rotation);
    return screenPoint(project3D(ringPoint, viewRotation, 0.08), layout);
  }

  function drawScreenCircle(context, center, radius, segments = 32) {
    context.beginPath();
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * TAU;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      if (segment === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  function drawAtomicOrbits(frame) {
    const { context, width, height, elapsed, intro, reducedMotion, pointer } = frame;
    const color = frame.accentColor || ORBITS;
    beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);

    const view = reducedMotion || frame.viewRotation ? [0, 0] : [pointer.y * 0.055, pointer.x * 0.075];
    const viewRotation = frame.viewRotation ?? [view[0], view[1], 0];
    const layout = {
      cx: width * 0.5,
      cy: height * 0.51,
      scale: Math.min(width * 0.61 / 2.9, height * 0.58 / 2.35)
    };
    const rings = ORBIT_RINGS.map((ring, index) => animatedRing(ring, index, elapsed, reducedMotion));
    const revealBase = reducedMotion ? 1 : ease(intro * 1.5);

    const axisStart = screenPoint([-1.45, 0, 0], layout);
    const axisEnd = screenPoint([1.45, 0, 0], layout);
    context.strokeStyle = rgba(color, 0.66);
    context.lineWidth = 1.15;
    trace(context, [axisStart, axisEnd], revealBase);
    const arrowSize = 0.07 * layout.scale;
    trace(context, [
      { x: axisEnd.x - arrowSize, y: axisEnd.y - arrowSize * 0.55 },
      axisEnd,
      { x: axisEnd.x - arrowSize, y: axisEnd.y + arrowSize * 0.55 }
    ], revealBase);

    rings.forEach((ring, ringIndex) => {
      const points = [];
      for (let segment = 0; segment <= 220; segment += 1) {
        points.push(orbitPoint(ring, segment / 220, viewRotation, layout));
      }
      context.save();
      context.strokeStyle = rgba(color, ringIndex === 3 ? 0.68 : 0.9);
      context.lineWidth = ring.strokeWidth;
      context.setLineDash(ring.dash || []);
      trace(context, points, reducedMotion ? 1 : ease(intro * 1.55 - ringIndex * 0.07));
      context.restore();
    });

    ORBIT_MARKERS.forEach((marker, markerIndex) => {
      const markerPhase = reducedMotion
        ? marker.phase
        : (marker.phase + elapsed / (5200 + markerIndex * 1300) * (markerIndex ? -1 : 1)) % 1;
      const center = orbitPoint(rings[marker.ring], markerPhase, viewRotation, layout);
      context.strokeStyle = rgba(color, 0.98);
      context.lineWidth = 1.4;
      drawScreenCircle(context, center, marker.radius * layout.scale, 32);
    });

    if (!reducedMotion && elapsed % 2400 < 760) {
      const eventRingIndex = Math.floor(elapsed / 2400) % rings.length;
      const eventPhase = (0.14 + elapsed / 5600 * (eventRingIndex % 2 ? -1 : 1) + 1) % 1;
      const eventPoint = orbitPoint(rings[eventRingIndex], eventPhase, viewRotation, layout);
      const squareSize = Math.max(7, Math.min(14, layout.scale * 0.08));
      context.fillStyle = rgba(color, 0.96);
      context.fillRect(eventPoint.x - squareSize / 2, eventPoint.y - squareSize / 2, squareSize, squareSize);
    }

    [-0.2, 0.2].forEach(position => {
      context.strokeStyle = rgba(color, 0.95);
      context.lineWidth = 1.8;
      drawScreenCircle(context, {
        x: layout.cx + 1.45 * position * layout.scale,
        y: layout.cy
      }, 0.022 * layout.scale, 32);
    });
    [0.2, 0.11].forEach((radius, index) => {
      context.strokeStyle = rgba(color, 1);
      context.lineWidth = index === 0 ? 3.2 : 1.9;
      drawScreenCircle(context, { x: layout.cx, y: layout.cy }, radius * layout.scale, 96);
    });

    const fontSize = Math.min(width, height) * 0.021;
    labelStyle(context, color, fontSize, 0.7);
    context.textAlign = 'left';
    context.fillText('HUB  r = 0.11 / 0.20', width * 0.085, height * 0.19);
    context.textAlign = 'right';
    context.fillText('AXIS  ℓ = 1.45', width * 0.915, height * 0.81);
    drawGuide(context, width * 0.22, height * 0.21, layout.cx - fontSize, layout.cy - fontSize, color, 0.22);
    drawGuide(context, width * 0.82, height * 0.79, axisEnd.x, axisEnd.y, color, 0.22);

    const textPhase = reducedMotion ? -0.72 : elapsed / 14000 * TAU - 0.72;
    const textRadiusX = Math.min(width * 0.39, layout.scale * 1.48);
    const textRadiusY = Math.min(height * 0.39, layout.scale * 1.13);
    const textX = layout.cx + Math.cos(textPhase) * textRadiusX;
    const textY = layout.cy + Math.sin(textPhase) * textRadiusY;
    context.save();
    context.translate(textX, textY);
    context.rotate(Math.atan2(Math.cos(textPhase) * textRadiusY, -Math.sin(textPhase) * textRadiusX));
    context.textAlign = 'center';
    context.fillStyle = rgba(color, 0.48);
    context.fillText('ORBITAL PRECESSION', 0, 0);
    context.restore();

    endFrame(context);
  }

  window.__parametricWireframeDefinitions ||= {};
  window.__parametricWireframeDefinitions['twisted-funnel'] = {
    id: 'twisted-funnel',
    draw: drawTwistedFunnel
  };
  window.__parametricWireframeDefinitions['projection-cone'] = {
    id: 'projection-cone',
    draw: drawProjectionCone
  };
  window.__parametricWireframeDefinitions['atomic-orbits'] = {
    id: 'atomic-orbits',
    draw: drawAtomicOrbits
  };
})();
