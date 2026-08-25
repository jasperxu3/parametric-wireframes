(() => {
  'use strict';

  window.__parametricWireframeDefinitions ||= {};

  const definitions = window.__parametricWireframeDefinitions;
  const TAU = Math.PI * 2;
  const BACKGROUND = '#0f141a';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function rgba(hex, alpha) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  function fitStage(width, height) {
    const stageWidth = Math.min(width, height * 4 / 3);
    const stageHeight = stageWidth * 3 / 4;
    return {
      x: (width - stageWidth) / 2,
      y: (height - stageHeight) / 2,
      width: stageWidth,
      height: stageHeight,
      margin: Math.min(stageWidth, stageHeight) * 0.1
    };
  }

  function beginFrame(context, width, height, background = BACKGROUND) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    return fitStage(width, height);
  }

  function pointerValue(frame, axis) {
    if (frame.reducedMotion) return 0;
    return clamp(Number(frame.pointer?.[axis]) || 0, -1, 1);
  }

  function setLabelStyle(context, stage, color, alpha = 0.5) {
    const size = Math.max(7, Math.min(11, stage.height * 0.018));
    context.font = `600 ${size}px ${MONO}`;
    context.fillStyle = rgba(color, alpha);
    context.textBaseline = 'middle';
    return size;
  }

  function drawDataEvents(context, stage, elapsed, reducedMotion, anchors, color) {
    if (reducedMotion || anchors.length === 0) return;
    const period = anchors.length * 320;
    anchors.forEach((point, index) => {
      const local = ((elapsed - index * 320) % period + period) % period;
      if (local >= 360) return;
      const size = Math.min(14, Math.max(7, stage.height * 0.023));
      context.fillStyle = rgba(color, 0.94);
      context.fillRect(
        Math.round(point[0] - size / 2),
        Math.round(point[1] - size / 2),
        Math.round(size),
        Math.round(size)
      );
    });
  }

  function drawPolyline(context, points, progress = 1) {
    if (points.length < 2 || progress <= 0) return;
    const last = Math.max(1, Math.ceil((points.length - 1) * clamp(progress)));
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index <= last; index += 1) {
      context.lineTo(points[index][0], points[index][1]);
    }
    context.stroke();
  }

  function superellipsePoint(angle, exponent) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const power = 2 / Math.max(0.2, exponent);
    return [
      Math.sign(cosine) * Math.pow(Math.abs(cosine), power),
      Math.sign(sine) * Math.pow(Math.abs(sine), power)
    ];
  }

  function transformPath(geometry, itemIndex, segments, scaleMultiplier = 1) {
    const rotation = geometry.rotation + itemIndex * geometry.rotationStep;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const tx = geometry.translate[0] + itemIndex * geometry.translateStep[0];
    const ty = geometry.translate[1] + itemIndex * geometry.translateStep[1];
    const sx = (geometry.scale[0] + itemIndex * geometry.scaleStep[0]) * scaleMultiplier;
    const sy = (geometry.scale[1] + itemIndex * geometry.scaleStep[1]) * scaleMultiplier;
    const shx = geometry.shear[0] + itemIndex * geometry.shearStep[0];
    const shy = geometry.shear[1] + itemIndex * geometry.shearStep[1];
    const points = [];

    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * TAU;
      const primitive = geometry.primitive === 'superellipse'
        ? superellipsePoint(angle, geometry.exponent)
        : [Math.cos(angle), Math.sin(angle)];
      const x0 = primitive[0] * geometry.radiusX * sx;
      const y0 = primitive[1] * geometry.radiusY * sy;
      const x1 = x0 + shx * y0;
      const y1 = y0 + shy * x0;
      points.push([x1 * cosine - y1 * sine + tx, x1 * sine + y1 * cosine + ty]);
    }
    return points;
  }

  function mapPath(points, centerX, centerY, scale, viewRotation = null) {
    return points.map(point => {
      if (!viewRotation) return [centerX + point[0] * scale, centerY + point[1] * scale];
      const rotated = rotate3D([point[0], point[1], 0], viewRotation);
      const perspective = 1 + rotated[2] * 0.12;
      return [centerX + rotated[0] * perspective * scale, centerY + rotated[1] * perspective * scale];
    });
  }

  function rotate3D(point, rotation) {
    let [x, y, z] = point;
    let cosine = Math.cos(rotation[0]);
    let sine = Math.sin(rotation[0]);
    [y, z] = [y * cosine - z * sine, y * sine + z * cosine];
    cosine = Math.cos(rotation[1]);
    sine = Math.sin(rotation[1]);
    [x, z] = [x * cosine + z * sine, -x * sine + z * cosine];
    cosine = Math.cos(rotation[2]);
    sine = Math.sin(rotation[2]);
    return [x * cosine - y * sine, x * sine + y * cosine, z];
  }

  function projectGridPoint(u, v, geometry, projection, phase = 0) {
    let x = u;
    let y = v;
    let z = geometry.depth * (1 - Math.min(1, u * u + v * v));

    if (geometry.field === 'wave') {
      x += geometry.amount * 0.22 * Math.sin(v * Math.PI * geometry.frequency + phase);
      y += geometry.amount * 0.18 * Math.sin(u * Math.PI * geometry.frequency + phase * 0.82);
      z += geometry.amount * 0.18 * Math.sin((u + v) * Math.PI * geometry.frequency + phase * 1.15);
    } else {
      x *= 1 - geometry.amount * Math.exp(-v * v * geometry.frequency);
      z += geometry.amount * 0.12 * Math.cos(v * Math.PI);
    }
    y += geometry.tilt * x * 0.18;

    const rotated = rotate3D([x, y, z], projection.rotation);
    const perspective = 1 + rotated[2] * projection.strength;
    return [rotated[0] * perspective, rotated[1] * perspective, rotated[2]];
  }

  function sampleGrid(geometry, sampling, projection, phase) {
    const paths = [];
    for (let row = 0; row < sampling.rows; row += 1) {
      const v = -1 + 2 * row / (sampling.rows - 1);
      const points = [];
      for (let sample = 0; sample <= sampling.samples; sample += 1) {
        points.push(projectGridPoint(-1 + 2 * sample / sampling.samples, v, geometry, projection, phase));
      }
      paths.push({ role: 'row', index: row, points });
    }
    for (let column = 0; column < sampling.columns; column += 1) {
      const u = -1 + 2 * column / (sampling.columns - 1);
      const points = [];
      for (let sample = 0; sample <= sampling.samples; sample += 1) {
        points.push(projectGridPoint(u, -1 + 2 * sample / sampling.samples, geometry, projection, phase));
      }
      paths.push({ role: 'column', index: column, points });
    }
    return paths;
  }

  function drawGrid(context, stage, paths, color, intro) {
    const scale = Math.min(stage.width * 0.31, stage.height * 0.34);
    const centerX = stage.x + stage.width * 0.5;
    const centerY = stage.y + stage.height * 0.51;
    const ordered = paths.map((path, pathIndex) => ({
      ...path,
      pathIndex,
      depth: path.points.reduce((sum, point) => sum + point[2], 0) / path.points.length
    })).sort((a, b) => a.depth - b.depth);

    ordered.forEach(path => {
      const reveal = smoothstep((intro - path.pathIndex / paths.length * 0.5) / 0.5);
      const depth = clamp((path.depth + 1) * 0.5);
      context.strokeStyle = rgba(color, (path.role === 'row' ? 0.45 : 0.32) + depth * 0.25);
      context.lineWidth = path.role === 'row' ? 1.05 : 0.85;
      drawPolyline(context, path.points.map(point => [
        centerX + point[0] * scale,
        centerY + point[1] * scale
      ]), reveal);
    });
  }

  const ellipseGeometry = {
    primitive: 'ellipse', count: 13, radiusX: 0.92, radiusY: 0.92,
    rotation: 0, rotationStep: 0, translate: [0, 0], translateStep: [0, 0],
    scale: [0.48, 1.16], scaleStep: [0.065, -0.055],
    shear: [0, 0], shearStep: [0, 0]
  };

  definitions['ellipse-reflection'] = {
    id: 'ellipse-reflection',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const color = frame.accentColor || '#6c9fe8';
      const stage = beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);
      const centerX = stage.x + stage.width * 0.5;
      const centerY = stage.y + stage.height * 0.51;
      const scale = stage.height * 0.3;
      const cyclePosition = reducedMotion ? ellipseGeometry.count - 1 : elapsed / 520 % ellipseGeometry.count;

      for (let index = 0; index < ellipseGeometry.count; index += 1) {
        const reveal = reducedMotion ? 1 : smoothstep((frame.intro - index / ellipseGeometry.count * 0.58) / 0.42);
        const directDistance = Math.abs(index - cyclePosition);
        const cycleDistance = Math.min(directDistance, ellipseGeometry.count - directDistance);
        const activation = reducedMotion ? 0 : smoothstep(1 - cycleDistance / 2.4);
        context.strokeStyle = rgba(color, reducedMotion ? 0.78 : 0.58 + activation * 0.3);
        context.lineWidth = reducedMotion ? 1.15 : 1.05 + activation * 0.5;
        drawPolyline(context, mapPath(transformPath(ellipseGeometry, index, 180), centerX, centerY, scale, frame.viewRotation), reveal);
      }

      const ellipseEvents = [1, 4, 7, 10, 12].map((layer, eventIndex) => {
        const path = mapPath(transformPath(ellipseGeometry, layer, 180), centerX, centerY, scale, frame.viewRotation);
        const point = path[(eventIndex * 37 + 19) % 180];
        return point;
      });
      drawDataEvents(context, stage, elapsed, reducedMotion, ellipseEvents, color);

      const current = Math.floor(cyclePosition);
      setLabelStyle(context, stage, color, 0.56);
      context.textAlign = 'left';
      context.fillText('ROW 00  ·  SCALE MATRIX', stage.x + stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillText('Sᵧ 1.160 → 0.500', stage.x + stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
      context.textAlign = 'right';
      context.fillStyle = rgba(color, 0.82);
      context.fillText(`[${String(current).padStart(2, '0')}]`, stage.x + stage.width - stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillStyle = rgba(color, 0.48);
      context.fillText('Sₓ 0.480 → 1.260', stage.x + stage.width - stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
    }
  };

  const petalGeometry = {
    primitive: 'ellipse', count: 14, radiusX: 0.28, radiusY: 1,
    rotation: 0, rotationStep: 0.2244, translate: [0, 0], translateStep: [0, 0],
    scale: [1, 1], scaleStep: [0, 0], shear: [0, 0], shearStep: [0, 0]
  };

  definitions['radial-petals'] = {
    id: 'radial-petals',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const color = frame.accentColor || '#d76b98';
      const stage = beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);
      const centerX = stage.x + stage.width * 0.5;
      const centerY = stage.y + stage.height * 0.5;
      const phase = reducedMotion ? 0 : elapsed * 0.00022 + pointerValue(frame, 'x') * 0.08;
      const bloom = reducedMotion ? 1 : 0.96 + Math.sin(elapsed * 0.00105) * 0.04;
      const scale = stage.height * 0.31;

      context.strokeStyle = rgba(color, 0.72);
      context.lineWidth = 1.08;
      const petalEvents = [];
      for (let index = 0; index < petalGeometry.count; index += 1) {
        const geometry = { ...petalGeometry, rotation: phase };
        const reveal = reducedMotion ? 1 : smoothstep((frame.intro - index / petalGeometry.count * 0.45) / 0.55);
        const path = mapPath(transformPath(geometry, index, 160, bloom), centerX, centerY, scale, frame.viewRotation);
        drawPolyline(context, path, reveal);
        if (index % 3 === 0 && petalEvents.length < 5) {
          petalEvents.push(path[(index * 23 + 31) % 160]);
        }
      }
      drawDataEvents(context, stage, elapsed, reducedMotion, petalEvents, color);

      setLabelStyle(context, stage, color, 0.5);
      context.textAlign = 'left';
      const phaseTurn = ((phase % TAU) + TAU) % TAU;
      const activeQuadrant = Math.floor(phaseTurn / (Math.PI / 2)) + 1;
      context.fillText(`Q${activeQuadrant} ACTIVE / φ ${phaseTurn.toFixed(2)}`, stage.x + stage.margin * 0.48, centerY);
      context.fillText('QIII / 3π⁄2', stage.x + stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.45);
      context.textAlign = 'right';
      context.fillText('QI / 0', stage.x + stage.width - stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillText('QIV / 2π', stage.x + stage.width - stage.margin * 0.48, centerY);
    }
  };

  const superellipseGeometry = {
    primitive: 'superellipse', exponent: 3.4, count: 12, radiusX: 0.5, radiusY: 0.62,
    rotation: -0.32, rotationStep: 0.058, translate: [-0.34, -0.14], translateStep: [0.063, 0.028],
    scale: [0.72, 0.72], scaleStep: [0.035, 0.035], shear: [0, 0], shearStep: [0.008, 0]
  };

  definitions['superellipse-stack'] = {
    id: 'superellipse-stack',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const color = frame.accentColor || '#65a7ff';
      const stage = beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);
      const centerX = stage.x + stage.width * 0.5;
      const centerY = stage.y + stage.height * 0.5;
      const cyclePosition = reducedMotion
        ? superellipseGeometry.count - 1
        : elapsed / 5400 * superellipseGeometry.count % superellipseGeometry.count;
      const scale = stage.height * 0.39;
      const stackEvents = [];

      for (let index = 0; index < superellipseGeometry.count; index += 1) {
        const directDistance = Math.abs(index - cyclePosition);
        const cycleDistance = Math.min(directDistance, superellipseGeometry.count - directDistance);
        const activation = smoothstep(1 - cycleDistance / 2.6);
        const transformProgress = reducedMotion
          ? 1
          : 0.92 + 0.08 * activation;
        const reveal = reducedMotion ? 1 : smoothstep((frame.intro - index / superellipseGeometry.count * 0.52) / 0.48);
        context.strokeStyle = rgba(color, reducedMotion
          ? 0.42 + index / superellipseGeometry.count * 0.34
          : 0.36 + index / superellipseGeometry.count * 0.28 + activation * 0.28);
        context.lineWidth = reducedMotion ? 1.08 : 1 + activation * 0.55;
        const path = mapPath(
          transformPath(superellipseGeometry, index, 180, transformProgress),
          centerX,
          centerY,
          scale,
          frame.viewRotation
        );
        drawPolyline(context, path, reveal);
        if (index % 3 === 0 && stackEvents.length < 4) {
          stackEvents.push(path[(index * 29 + 17) % 180]);
        }
      }
      drawDataEvents(context, stage, elapsed, reducedMotion, stackEvents, color);

      setLabelStyle(context, stage, color, 0.52);
      context.textAlign = 'left';
      const matrixIndex = Math.floor(cyclePosition);
      const growth = reducedMotion ? 1 : 0.92 + 0.08 * smoothstep(1 - Math.abs(cyclePosition - matrixIndex) / 2.6);
      context.fillText(`M[${String(matrixIndex).padStart(2, '0')}]  n=3.40`, stage.x + stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillText('↳ ΔT [0.063, 0.028]', stage.x + stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
      context.textAlign = 'right';
      context.fillText(`GROW ×${growth.toFixed(3)}`, stage.x + stage.width - stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillText('ΔR 0.058  ·  ΔH 0.008', stage.x + stage.width - stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
    }
  };

  definitions['gravity-well'] = {
    id: 'gravity-well',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const color = frame.accentColor || '#59d9bd';
      const stage = beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);
      const breath = reducedMotion ? 0 : Math.sin(elapsed * 0.00072);
      const geometry = {
        field: 'hourglass',
        amount: 0.72 + breath * 0.045,
        frequency: 1.9,
        tilt: 0.28 + pointerValue(frame, 'x') * 0.035,
        depth: 0.62 + breath * 0.035
      };
      const sampling = { rows: 14, columns: 18, samples: 96 };
      const projection = {
        strength: 0.14,
        rotation: frame.viewRotation ?? [0.42 + pointerValue(frame, 'y') * 0.04, 0, 0]
      };
      const paths = sampleGrid(geometry, sampling, projection, 0);
      drawGrid(context, stage, paths, color, reducedMotion ? 1 : frame.intro);
      const gridScale = Math.min(stage.width * 0.31, stage.height * 0.34);
      const gridCenterX = stage.x + stage.width * 0.5;
      const gridCenterY = stage.y + stage.height * 0.51;
      const gravityEvents = [2, 6, 10, 15, 23].map((pathIndex, eventIndex) => {
        const point = paths[pathIndex].points[(eventIndex * 19 + 13) % 97];
        return [gridCenterX + point[0] * gridScale, gridCenterY + point[1] * gridScale];
      });
      drawDataEvents(context, stage, elapsed, reducedMotion, gravityEvents, color);

      setLabelStyle(context, stage, color, 0.52);
      context.textAlign = 'left';
      context.fillText(`RIM  a=${geometry.amount.toFixed(3)}`, stage.x + stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.fillText('x′=x[1−a·exp(−fv²)]', stage.x + stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
      context.textAlign = 'right';
      context.fillStyle = rgba(color, 0.76);
      context.fillText(`CENTER  x′=${(1 - geometry.amount).toFixed(3)}`, stage.x + stage.width - stage.margin * 0.48, stage.y + stage.height * 0.5);
      context.fillStyle = rgba(color, 0.46);
      context.fillText(`DEPTH ${geometry.depth.toFixed(3)}`, stage.x + stage.width - stage.margin * 0.48, stage.y + stage.margin * 0.55);
    }
  };

  definitions['wave-membrane'] = {
    id: 'wave-membrane',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const color = frame.accentColor || '#b084f5';
      const stage = beginFrame(context, width, height, frame.backgroundColor || BACKGROUND);
      const phase = reducedMotion ? 0.72 : elapsed * 0.00105 + pointerValue(frame, 'x') * 0.24;
      const geometry = { field: 'wave', amount: 0.9, frequency: 1.65, tilt: 0.22, depth: 0.36 };
      const sampling = { rows: 13, columns: 17, samples: 100 };
      const projection = {
        strength: 0.1,
        rotation: frame.viewRotation ?? [0.34 + pointerValue(frame, 'y') * 0.035, 0.08, 0]
      };
      const paths = sampleGrid(geometry, sampling, projection, phase);
      drawGrid(context, stage, paths, color, reducedMotion ? 1 : frame.intro);
      const gridScale = Math.min(stage.width * 0.31, stage.height * 0.34);
      const gridCenterX = stage.x + stage.width * 0.5;
      const gridCenterY = stage.y + stage.height * 0.51;
      const waveEvents = [1, 5, 9, 16, 25].map((pathIndex, eventIndex) => {
        const point = paths[pathIndex].points[(eventIndex * 21 + 11) % 101];
        return [gridCenterX + point[0] * gridScale, gridCenterY + point[1] * gridScale];
      });
      drawDataEvents(context, stage, elapsed, reducedMotion, waveEvents, color);

      const equation = 'Δx, Δy, Δz ∝ sin(πf·x,y + φ)';
      const typedLength = reducedMotion ? equation.length : Math.min(equation.length, Math.floor((elapsed % 5200) / 42));
      setLabelStyle(context, stage, color, 0.82);
      context.textAlign = 'left';
      context.fillText(equation.slice(0, typedLength), stage.x + stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
      context.fillStyle = rgba(color, 0.68);
      context.fillText('BOUNDARY / u=-1', stage.x + stage.margin * 0.48, stage.y + stage.margin * 0.55);
      context.textAlign = 'right';
      context.fillText('VALLEY / φ→', stage.x + stage.width - stage.margin * 0.48, stage.y + stage.height - stage.margin * 0.46);
    }
  };
})();
