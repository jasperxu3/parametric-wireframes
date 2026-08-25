(() => {
  'use strict';

  const BACKGROUND = '#0f141a';
  const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const TAU = Math.PI * 2;

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const alpha = (hex, opacity) => {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity})`;
  };

  function stageFor(width, height) {
    const scale = Math.min(width / 800, height / 600);
    return {
      x: (width - 800 * scale) / 2,
      y: (height - 600 * scale) / 2,
      width: 800 * scale,
      height: 600 * scale,
      scale
    };
  }

  function mapper(stage, bounds, insetX = 80, insetY = 78, viewRotation = null) {
    const usableWidth = stage.width - insetX * 2 * stage.scale;
    const usableHeight = stage.height - insetY * 2 * stage.scale;
    const scale = Math.min(
      usableWidth / (bounds.maxX - bounds.minX),
      usableHeight / (bounds.maxY - bounds.minY)
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return point => {
      if (!viewRotation) return {
        x: stage.x + stage.width / 2 + (point[0] - centerX) * scale,
        y: stage.y + stage.height / 2 + (point[1] - centerY) * scale
      };
      const rotated = rotate3D([point[0] - centerX, point[1] - centerY, 0], viewRotation);
      const perspective = 1 + rotated[2] * 0.12;
      return {
        x: stage.x + stage.width / 2 + rotated[0] * perspective * scale,
        y: stage.y + stage.height / 2 + rotated[1] * perspective * scale
      };
    };
  }

  function paintBackground(context, width, height, background = BACKGROUND) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  function drawPath(context, points, map, options = {}) {
    const reveal = options.reveal === undefined ? 1 : clamp(options.reveal);
    if (reveal <= 0 || points.length < 2) return;
    const last = Math.max(1, Math.min(points.length - 1, Math.ceil((points.length - 1) * reveal)));
    const firstPoint = map(points[0]);
    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);
    for (let index = 1; index <= last; index += 1) {
      const point = map(points[index]);
      context.lineTo(point.x, point.y);
    }
    context.strokeStyle = options.stroke;
    context.lineWidth = options.width;
    context.setLineDash(options.dash || []);
    context.lineDashOffset = options.dashOffset || 0;
    context.lineCap = options.lineCap || 'butt';
    context.lineJoin = 'round';
    context.stroke();
  }

  function drawLabel(context, stage, text, x, y, color, align = 'left', size = 9) {
    context.font = `600 ${Math.max(7, size * stage.scale)}px ${FONT}`;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, stage.x + x * stage.scale, stage.y + y * stage.scale);
  }

  function drawDataSquare(context, stage, location, color, size = 14) {
    const pixels = Math.min(20, Math.max(7, size * stage.scale));
    context.fillStyle = color;
    context.fillRect(location.x - pixels / 2, location.y - pixels / 2, pixels, pixels);
  }

  function eventVisible(elapsed, period, offset, window) {
    return ((elapsed + offset) % period) < window;
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
    [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
    return [x, y, z];
  }

  function project3D(point, rotation, strength) {
    const rotated = rotate3D(point, rotation);
    const perspective = 1 + rotated[2] * strength;
    return [rotated[0] * perspective, rotated[1] * perspective];
  }

  const layeredGrid = {
    id: 'layered-perspective-grid',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const accent = frame.accentColor || '#4addad';
      const stage = stageFor(width, height);
      const map = mapper(stage, { minX: -1.18, maxX: 1.18, minY: -0.99, maxY: 0.99 }, 88, 80, frame.viewRotation);
      const layers = 3;
      const rows = 5;
      const columns = 11;
      const layerCenter = (layers - 1) / 2;
      const scan = reducedMotion ? 0.5 : (elapsed % 3600) / 3600;

      context.save();
      paintBackground(context, width, height, frame.backgroundColor || BACKGROUND);
      const depthStep = reducedMotion ? 3 : 1 + Math.floor((elapsed % 5100) / 1700);
      drawLabel(context, stage, reducedMotion ? 'FAR / L03' : `FAR / L0${depthStep}`, 80, 58, alpha(accent, 0.48));
      drawLabel(context, stage, 'DEPTH STACK', 720, 58, alpha(accent, 0.32), 'right');

      for (let layer = 0; layer < layers; layer += 1) {
        const centerY = (layer - layerCenter) * 0.76;
        const flipped = layer % 2 === 1;
        const topScale = flipped ? 1 : 0.56;
        const bottomScale = flipped ? 0.56 : 1;
        const point = (u, v) => {
          const halfWidth = 1.18 * (topScale + (bottomScale - topScale) * v);
          return [u * halfWidth, centerY + (v - 0.5) * 0.46];
        };
        const reveal = reducedMotion ? 1 : smooth((frame.intro - layer * 0.16) / 0.56);
        const opacity = (0.42 + layer * 0.15) * reveal;

        for (let row = 0; row < rows; row += 1) {
          const v = row / (rows - 1);
          drawPath(context, [point(-1, v), point(1, v)], map, {
            stroke: alpha(accent, opacity), width: 1.28 * stage.scale, reveal
          });
        }
        for (let column = 0; column < columns; column += 1) {
          const u = -1 + (2 * column) / (columns - 1);
          drawPath(context, [point(u, 0), point(u, 1)], map, {
            stroke: alpha(accent, opacity), width: 1.28 * stage.scale, reveal
          });
        }
        if (!reducedMotion && reveal === 1) {
          const layerScan = (scan + layer * 0.23) % 1;
          drawPath(context, [point(-1, layerScan), point(1, layerScan)], map, {
            stroke: alpha(accent, 0.94), width: 2.4 * stage.scale
          });
          drawPath(context, [point(-1, Math.max(0, layerScan - 0.035)), point(1, Math.max(0, layerScan - 0.035))], map, {
            stroke: alpha(accent, 0.25), width: 3.8 * stage.scale
          });

          for (let event = 0; event < 3; event += 1) {
            if (!eventVisible(elapsed, 1900 + event * 170, layer * 370 + event * 610, 340)) continue;
            const row = (layer * 2 + event * 3 + 1) % rows;
            const column = (layer * 4 + event * 5 + 2) % columns;
            drawDataSquare(context, stage, map(point(-1 + (2 * column) / (columns - 1), row / (rows - 1))), accent, 12 + event * 2);
          }
        }
      }

      drawLabel(context, stage, 'NEAR / L01', 80, 542, alpha(accent, 0.48));
      drawLabel(context, stage, '03 PLANES · 05 × 11', 720, 542, alpha(accent, 0.34), 'right');
      context.restore();
    }
  };

  function createDipoleLines() {
    const separation = 1.05;
    const source = [-separation / 2, 0];
    const sink = [separation / 2, 0];
    const vectorAt = point => {
      const sx = point[0] - source[0];
      const sy = point[1];
      const tx = point[0] - sink[0];
      const ty = point[1];
      const sourceRadius2 = Math.max(1e-8, sx * sx + sy * sy);
      const sinkRadius2 = Math.max(1e-8, tx * tx + ty * ty);
      const vx = sx / sourceRadius2 - tx / sinkRadius2;
      const vy = sy / sourceRadius2 - ty / sinkRadius2;
      const length = Math.hypot(vx, vy) || 1;
      return [vx / length, vy / length];
    };
    const lines = [];
    for (let line = 0; line < 11; line += 1) {
      const angle = -2.42 + (4.84 * line) / 10;
      let point = [source[0] + Math.cos(angle) * 0.055, Math.sin(angle) * 0.055];
      const points = [point];
      for (let step = 0; step < 760; step += 1) {
        const direction = vectorAt(point);
        point = [point[0] + direction[0] * 0.016, point[1] + direction[1] * 0.016];
        points.push(point);
        if (Math.hypot(point[0] - sink[0], point[1]) <= 0.055 * 1.15) break;
        if (Math.hypot(point[0], point[1]) > 3) break;
      }
      lines.push(points);
    }
    return { source, sink, lines };
  }

  const dipoleGeometry = createDipoleLines();
  const dipoleField = {
    id: 'sparse-dipole-field',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const accent = frame.accentColor || '#d5dc78';
      const stage = stageFor(width, height);
      const all = dipoleGeometry.lines.flat();
      const maxX = Math.max(0.92, ...all.map(point => Math.abs(point[0])));
      const maxY = Math.max(...all.map(point => Math.abs(point[1])));
      const map = mapper(stage, { minX: -maxX, maxX, minY: -maxY, maxY }, 92, 82, frame.viewRotation);

      context.save();
      paintBackground(context, width, height, frame.backgroundColor || BACKGROUND);
      const polarityForward = reducedMotion || Math.floor(elapsed / 1450) % 2 === 0;
      drawLabel(context, stage, reducedMotion ? 'SOURCE / +q' : `SOURCE / ${polarityForward ? '+q' : 'EMIT'}`, 80, 64, alpha(accent, 0.52));
      drawLabel(context, stage, reducedMotion ? 'SINK / −q' : `SINK / ${polarityForward ? '−q' : 'CAPTURE'}`, 720, 64, alpha(accent, 0.52), 'right');
      drawPath(context, [[-0.92, 0], [0.92, 0]], map, {
        stroke: alpha(accent, 0.38), width: stage.scale, dash: [5 * stage.scale, 7 * stage.scale]
      });

      dipoleGeometry.lines.forEach((points, line) => {
        const reveal = reducedMotion ? 1 : smooth((frame.intro - line * 0.025) / 0.72);
        drawPath(context, points, map, {
          stroke: alpha(accent, line === 5 ? 0.92 : 0.72),
          width: 1.25 * stage.scale,
          reveal
        });
        if (!reducedMotion && reveal === 1) {
          const phase = (elapsed / 3100 + line / 11) % 1;
          const start = Math.floor(phase * Math.max(1, points.length - 18));
          drawPath(context, points.slice(start, start + 18), map, {
            stroke: accent, width: 2.6 * stage.scale, lineCap: 'round'
          });
          if (eventVisible(elapsed, 1780 + (line % 3) * 130, line * 211, 270)) {
            const sample = Math.min(points.length - 1, Math.floor((0.2 + ((line * 0.173) % 0.62)) * points.length));
            drawDataSquare(context, stage, map(points[sample]), accent, 11 + (line % 3) * 2);
          }
        }
      });

      [dipoleGeometry.source, dipoleGeometry.sink].forEach((center, pole) => {
        const points = [];
        for (let segment = 0; segment <= 48; segment += 1) {
          const angle = segment / 48 * TAU;
          points.push([center[0] + Math.cos(angle) * 0.07, center[1] + Math.sin(angle) * 0.07]);
        }
        drawPath(context, points, map, { stroke: accent, width: 1.8 * stage.scale });
        const location = map(center);
        context.fillStyle = alpha(accent, pole === 0 ? 0.8 : 0.25);
        context.beginPath();
        context.arc(location.x, location.y, 2.5 * stage.scale, 0, TAU);
        context.fill();
      });
      drawLabel(context, stage, 'FIELD FLOW  +q → −q', 400, 544, alpha(accent, 0.36), 'center');
      context.restore();
    }
  };

  const interferenceWaves = {
    id: 'interference-waves',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const accent = frame.accentColor || '#60a5fa';
      const stage = stageFor(width, height);
      const map = mapper(stage, { minX: -1, maxX: 1, minY: -1.02, maxY: 1.02 }, 88, 92, frame.viewRotation);
      const curves = 9;
      const center = (curves - 1) / 2;
      const propagation = reducedMotion ? 0 : elapsed * 0.00022;

      context.save();
      paintBackground(context, width, height, frame.backgroundColor || BACKGROUND);
      const phaseIndex = reducedMotion ? 0 : Math.floor((elapsed % 4800) / 600);
      drawLabel(context, stage, reducedMotion ? 'PHASE / φ₀' : `PHASE / φ${phaseIndex} · ${(phaseIndex * 45).toString().padStart(3, '0')}°`, 80, 58, alpha(accent, 0.7));
      drawLabel(context, stage, 'ENDPOINT / x=+1', 720, 58, alpha(accent, 0.55), 'right');
      for (let curve = 0; curve < curves; curve += 1) {
        const offset = (curve - center) * 0.18;
        const points = [];
        for (let segment = 0; segment <= 420; segment += 1) {
          const progress = segment / 420;
          const x = -1 + progress * 2;
          const envelope = 0.38 + 0.62 * Math.pow(Math.sin(progress * Math.PI), 0.7);
          const y = 0.58 * envelope * Math.sin((x * 2.25 + 0.16 + offset - propagation) * Math.PI) + offset * 0.34;
          points.push([x, y]);
        }
        const reveal = reducedMotion ? 1 : smooth((frame.intro - curve * 0.025) / 0.78);
        drawPath(context, points, map, {
          stroke: alpha(accent, 0.74), width: 1.2 * stage.scale, reveal
        });
        if (!reducedMotion && reveal === 1 && eventVisible(elapsed, 1650 + (curve % 2) * 190, curve * 257, 300)) {
          const sample = 54 + ((curve * 47 + 31) % 310);
          drawDataSquare(context, stage, map(points[sample]), accent, 10 + (curve % 4) * 2);
        }
      }

      const formula = 'yᵢ(x)=A·e(x)·sin[π(fx+φᵢ)]';
      const telemetryReveal = reducedMotion ? 1 : 0.58 + 0.42 * smooth((elapsed % 3300) / 900);
      const characters = reducedMotion ? formula.length : Math.max(12, Math.floor(telemetryReveal * formula.length));
      drawLabel(context, stage, formula.slice(0, characters), 720, 544, alpha(accent, 0.68), 'right', 10);
      drawLabel(context, stage, '09 COHERENT CURVES', 80, 544, alpha(accent, 0.4));
      context.restore();
    }
  };

  function helixPoint(strand, progress, viewRotation, rotationPhase = 0) {
    const normalized = strand / 6 * 2 - 1;
    const phase = normalized * 4.8 * 0.5;
    const turns = 2.25 + normalized * 0.42;
    const amplitude = 0.52 * (1 + Math.abs(normalized) * 0.15);
    const compressed = 1 - Math.pow(1 - progress, 1.22);
    const x = -1 + (0.2 - -1) * compressed;
    const radius = amplitude * Math.pow(1 - progress, 1.05);
    const angle = TAU * turns * progress + phase - rotationPhase;
    return project3D([x, radius * Math.cos(angle), radius * Math.sin(angle)], viewRotation ?? [0, 0.01, 0], 0.03);
  }

  const convergingHelix = {
    id: 'converging-dashed-helix',
    draw(frame) {
      const { context, width, height, elapsed, reducedMotion } = frame;
      const accent = frame.accentColor || '#83c9ff';
      const stage = stageFor(width, height);
      const map = mapper(stage, { minX: -1.02, maxX: 0.45, minY: -0.62, maxY: 0.62 }, 86, 90);

      context.save();
      paintBackground(context, width, height, frame.backgroundColor || BACKGROUND);
      drawLabel(context, stage, '01 / ENTRANCE', 80, 58, alpha(accent, 0.58));
      const transportStage = reducedMotion ? 3 : 1 + Math.floor((elapsed % 4200) / 1400);
      drawLabel(context, stage, reducedMotion ? '03 / CONVERGENCE' : `0${transportStage} / ${['INTAKE', 'TRANSPORT', 'CONVERGE'][transportStage - 1]}`, 720, 58, alpha(accent, 0.58), 'right');
      const viewRotation = frame.viewRotation ?? [0, 0.01, 0];
      const rotationPhase = reducedMotion ? 0 : (elapsed % 8400) / 8400 * TAU;
      drawPath(context, [project3D([-1, 0, 0], viewRotation, 0.03), project3D([0.45, 0, 0], viewRotation, 0.03)], map, {
        stroke: alpha(accent, 0.42), width: stage.scale
      });

      for (let strand = 0; strand < 7; strand += 1) {
        const points = [];
        for (let segment = 0; segment <= 380; segment += 1) points.push(helixPoint(strand, segment / 380, frame.viewRotation, rotationPhase));
        const reveal = reducedMotion ? 1 : smooth((frame.intro - strand * 0.035) / 0.74);
        drawPath(context, points, map, {
          stroke: alpha(accent, 0.86),
          width: stage.scale,
          dash: [5 * stage.scale, 8 * stage.scale],
          lineCap: 'round',
          reveal
        });
        if (!reducedMotion && reveal === 1 && eventVisible(elapsed, 1840 + (strand % 3) * 120, strand * 293, 320)) {
          const progress = 0.14 + ((strand * 0.137 + 0.09) % 0.72);
          drawDataSquare(context, stage, map(helixPoint(strand, progress, frame.viewRotation, rotationPhase)), accent, 11 + (strand % 3) * 2);
        }
      }
      drawPath(context, [project3D([0.2, 0, 0], viewRotation, 0.03), project3D([0.45, 0, 0], viewRotation, 0.03)], map, {
        stroke: accent, width: 1.5 * stage.scale
      });

      drawLabel(context, stage, '02 / TRANSPORT', 80, 542, alpha(accent, 0.38));
      drawLabel(context, stage, 'r(s) → 0', 720, 542, alpha(accent, 0.5), 'right');
      context.restore();
    }
  };

  const definitions = window.__parametricWireframeDefinitions || (window.__parametricWireframeDefinitions = {});
  [layeredGrid, dipoleField, interferenceWaves, convergingHelix].forEach(definition => {
    definitions[definition.id] = definition;
  });
})();
