#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FAMILY_IDS = new Set(['surface-revolution', 'projection-rays', 'orbital-rings', 'transform-array', 'deformation-grid', 'parametric-curves', 'converging-helix', 'layered-grid', 'dipole-field']);

const DEFAULTS = {
  version: 1,
  seed: 1,
  name: 'parametric-wireframe',
  viewport: { width: 1200, height: 1200, padding: 72, background: '#07051b' },
  projection: { type: 'weak-perspective', strength: 0.08, rotation: [0, 0, 0] },
  sampling: {},
  style: { stroke: '#f4f1ff', strokeWidth: 1.2, opacity: 0.9, fill: 'none' },
  constraints: { mirrorX: false },
  variants: { count: 6, includeBase: true, parameters: {}, presets: [] }
};

const FAMILY_DEFAULTS = {
  'surface-revolution': {
    geometry: { profile: 'hourglass', axis: 'vertical', neck: 0.13, flare: 0.92, radiusStart: 0.12, radiusEnd: 0.95, exponent: 1.7, growth: 1.6, height: 1.15, twist: 0 },
    projection: { type: 'weak-perspective', strength: 0.08, rotation: [0.36, 0, 0] },
    sampling: { rings: 10, meridians: 13, uSegments: 96, vSegments: 72 },
    constraints: { mirrorX: true },
    variants: { parameters: {
      'geometry.neck': { relative: [-0.18, 0.18] },
      'geometry.flare': { relative: [-0.08, 0.08] },
      'geometry.exponent': { relative: [-0.12, 0.12] },
      'projection.rotation.0': { relative: [-0.12, 0.12] }
    } }
  },
  'projection-rays': {
    geometry: {
      length: 1.45,
      apertureRadius: 0.9,
      apertureAspect: 1,
      phase: 0,
      originMarkerRadius: 0.025,
      showOriginMarker: true,
      showAxis: true
    },
    projection: { type: 'weak-perspective', strength: 0.14, rotation: [0, 0.3, 0] },
    sampling: { rays: 8, apertureSegments: 160, markerSegments: 36 },
    constraints: { mirrorX: false, mirrorY: true },
    variants: { parameters: {} }
  },
  'orbital-rings': {
    geometry: { rings: [
      { rotation: [0, 0, 0], radius: 1, aspect: 1 },
      { rotation: [0.92, 0.1, 0.56], radius: 1.04, aspect: 1 },
      { rotation: [-0.78, 0.38, -0.68], radius: 1.04, aspect: 1 },
      { rotation: [0.22, 1.05, 1.16], radius: 1.04, aspect: 1 }
    ], hubRadii: [], markers: [], axisLength: 0, axisAngle: 0, axisArrowSize: 0.06, axisMarkers: [], axisMarkerRadius: 0.025 },
    sampling: { segments: 180, hubSegments: 96, markerSegments: 32 },
    variants: { parameters: {
      'projection.strength': { relative: [-0.2, 0.2] },
      'geometry.rings.1.rotation.2': { relative: [-0.14, 0.14] },
      'geometry.rings.2.rotation.2': { relative: [-0.14, 0.14] },
      'geometry.rings.3.rotation.1': { relative: [-0.12, 0.12] }
    } }
  },
  'transform-array': {
    geometry: {
      primitive: 'ellipse', count: 9, radiusX: 0.62, radiusY: 0.78,
      rotation: -0.28, rotationStep: 0.07,
      translate: [-0.24, 0], translateStep: [0.06, 0],
      scale: [0.9, 0.9], scaleStep: [0.025, 0.025],
      shear: [0, 0], shearStep: [0, 0]
    },
    projection: { type: 'none', strength: 0, rotation: [0, 0, 0] },
    sampling: { segments: 144 },
    variants: { parameters: {
      'geometry.rotationStep': { relative: [-0.24, 0.24] },
      'geometry.translateStep.0': { relative: [-0.18, 0.18] },
      'geometry.scaleStep.0': { relative: [-0.2, 0.2] },
      'geometry.radiusY': { relative: [-0.1, 0.1] }
    } }
  },
  'deformation-grid': {
    geometry: { field: 'hourglass', amount: 0.62, frequency: 1.5, tilt: 0.42, depth: 0.36 },
    projection: { type: 'weak-perspective', strength: 0.08, rotation: [0.22, 0, 0] },
    sampling: { rows: 11, columns: 15, samples: 72 },
    variants: { parameters: {
      'geometry.amount': { relative: [-0.16, 0.16] },
      'geometry.tilt': { relative: [-0.15, 0.15] },
      'geometry.depth': { relative: [-0.18, 0.18] },
      'projection.strength': { relative: [-0.2, 0.2] }
    } }
  },
  'parametric-curves': {
    geometry: {
      curve: 'lissajous', a: 3, b: 2, k: 5, delta: 0.5,
      turns: 6, innerRadius: 0.34, penOffset: 0.72,
      spread: 0.12, amplitude: 0.62, frequency: 2.5
    },
    projection: { type: 'none', strength: 0, rotation: [0, 0, 0] },
    sampling: { curves: 7, segments: 480 },
    variants: { parameters: {
      'geometry.delta': { relative: [-0.3, 0.3] },
      'geometry.spread': { relative: [-0.2, 0.2] }
    } }
  },
  'converging-helix': {
    geometry: {
      turns: 2.25, amplitude: 0.52, decay: 1.05, compression: 1.22,
      convergeX: 0.22, tailLength: 0.25, phaseSpan: 4.8,
      turnSpread: 0.42, amplitudeSpread: 0.15,
      dashLength: 5, dashGap: 8, strandWidth: 3.1,
      tailWidth: 1.5, axisWidth: 1, axisOpacity: 0.42
    },
    projection: { type: 'weak-perspective', strength: 0.03, rotation: [0, 0.01, 0] },
    sampling: { strands: 7, segments: 360 },
    variants: { parameters: {
      'geometry.turns': { relative: [-0.14, 0.14] },
      'geometry.decay': { relative: [-0.12, 0.12] },
      'geometry.compression': { relative: [-0.1, 0.1] }
    } }
  },
  'layered-grid': {
    geometry: {
      layers: 3, width: 1.2, depth: 0.52, spacing: 0.72,
      nearScale: 1, farScale: 0.62, skew: 0, alternate: true
    },
    projection: { type: 'none', strength: 0, rotation: [0, 0, 0] },
    sampling: { rows: 5, columns: 11 },
    variants: { parameters: {
      'geometry.spacing': { relative: [-0.12, 0.12] },
      'geometry.farScale': { relative: [-0.14, 0.14] },
      'geometry.skew': { min: -0.12, max: 0.12 }
    } }
  },
  'dipole-field': {
    geometry: {
      separation: 1.05, startRadius: 0.055, stepSize: 0.016,
      poleRadius: 0.07, axisLength: 0.92, maxRadius: 3
    },
    projection: { type: 'none', strength: 0, rotation: [0, 0, 0] },
    sampling: { lines: 11, steps: 760, markerSegments: 48 },
    variants: { parameters: {
      'geometry.separation': { relative: [-0.14, 0.14] },
      'geometry.stepSize': { relative: [-0.1, 0.1] }
    } }
  }
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(...objects) {
  const result = {};
  for (const object of objects) {
    if (!isObject(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (isObject(value)) result[key] = mergeDeep(result[key], value);
      else if (Array.isArray(value)) result[key] = value.map(item => isObject(item) ? mergeDeep(item) : item);
      else result[key] = value;
    }
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hashSeed(value) {
  const input = String(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function assertFiniteNumber(value, label, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a finite number between ${min} and ${max}`);
}

function assertInteger(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}`);
}

function validateColor(value, label) {
  if (value === 'none') return;
  if (typeof value !== 'string' || !/^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|[a-z]+)$/i.test(value)) throw new Error(`${label} must be a CSS color or none`);
}

function normalizeScene(input) {
  if (!isObject(input)) throw new Error('Scene must be a JSON object');
  if (input.version !== undefined && input.version !== 1) throw new Error('Only scene version 1 is supported');
  if (!FAMILY_IDS.has(input.family)) throw new Error(`Unsupported family: ${input.family}`);
  const scene = mergeDeep(DEFAULTS, FAMILY_DEFAULTS[input.family], input);
  scene.version = 1;
  scene.name = String(scene.name || scene.family).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || scene.family;
  assertInteger(scene.viewport.width, 'viewport.width', 64, 8192);
  assertInteger(scene.viewport.height, 'viewport.height', 64, 8192);
  assertFiniteNumber(scene.viewport.padding, 'viewport.padding', 0, Math.min(scene.viewport.width, scene.viewport.height) / 2 - 1);
  validateColor(scene.viewport.background, 'viewport.background');
  validateColor(scene.style.stroke, 'style.stroke');
  if (scene.style.fill !== 'none') throw new Error('style.fill must be none in the static wireframe skill');
  assertFiniteNumber(scene.style.strokeWidth, 'style.strokeWidth', 0.05, 100);
  assertFiniteNumber(scene.style.opacity, 'style.opacity', 0, 1);
  assertFiniteNumber(scene.projection.strength, 'projection.strength', -0.45, 0.45);
  if (!Array.isArray(scene.projection.rotation) || scene.projection.rotation.length !== 3) throw new Error('projection.rotation must be a three-number array');
  scene.projection.rotation.forEach((value, index) => assertFiniteNumber(value, `projection.rotation.${index}`, -Math.PI * 4, Math.PI * 4));
  assertInteger(scene.variants.count, 'variants.count', 1, 64);
  if (!Array.isArray(scene.variants.presets)) throw new Error('variants.presets must be an array');
  if (scene.variants.presets.length && scene.variants.presets.length !== scene.variants.count) {
    throw new Error('variants.presets must contain exactly variants.count entries');
  }
  if (scene.constraints.mirrorX && (Math.abs(scene.projection.rotation[1]) > 1e-9 || Math.abs(scene.projection.rotation[2]) > 1e-9)) {
    throw new Error('constraints.mirrorX requires zero Y and Z camera rotation');
  }
  validateFamily(scene);
  return scene;
}

function validateFamily(scene) {
  const { family, geometry, sampling } = scene;
  if (family === 'surface-revolution') {
    if (!['hourglass', 'catenoid', 'sinusoidal', 'bell', 'frustum'].includes(geometry.profile)) throw new Error('Unsupported surface profile');
    if (!['vertical', 'horizontal'].includes(geometry.axis)) throw new Error('geometry.axis must be vertical or horizontal');
    ['neck', 'flare', 'height'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 5));
    ['radiusStart', 'radiusEnd'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 5));
    assertFiniteNumber(geometry.exponent, 'geometry.exponent', 0.1, 8);
    assertFiniteNumber(geometry.growth, 'geometry.growth', 0.1, 8);
    assertFiniteNumber(geometry.twist, 'geometry.twist', -Math.PI * 4, Math.PI * 4);
    assertInteger(sampling.rings, 'sampling.rings', 2, 128);
    assertInteger(sampling.meridians, 'sampling.meridians', 2, 128);
    assertInteger(sampling.uSegments, 'sampling.uSegments', 12, 1024);
    assertInteger(sampling.vSegments, 'sampling.vSegments', 8, 1024);
  } else if (family === 'projection-rays') {
    ['length', 'apertureRadius', 'apertureAspect'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 8));
    assertFiniteNumber(geometry.phase, 'geometry.phase', -Math.PI * 4, Math.PI * 4);
    assertFiniteNumber(geometry.originMarkerRadius, 'geometry.originMarkerRadius', 0.001, 1);
    if (typeof geometry.showOriginMarker !== 'boolean' || typeof geometry.showAxis !== 'boolean') throw new Error('projection-rays visibility flags must be boolean');
    assertInteger(sampling.rays, 'sampling.rays', 3, 64);
    assertInteger(sampling.apertureSegments, 'sampling.apertureSegments', 24, 2048);
    assertInteger(sampling.markerSegments, 'sampling.markerSegments', 12, 256);
  } else if (family === 'orbital-rings') {
    if (!Array.isArray(geometry.rings) || geometry.rings.length < 1 || geometry.rings.length > 64) throw new Error('geometry.rings must contain 1 to 64 rings');
    geometry.rings.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring.rotation) || ring.rotation.length !== 3) throw new Error(`geometry.rings.${ringIndex}.rotation must contain three numbers`);
      ring.rotation.forEach((value, index) => assertFiniteNumber(value, `geometry.rings.${ringIndex}.rotation.${index}`, -Math.PI * 4, Math.PI * 4));
      assertFiniteNumber(ring.radius, `geometry.rings.${ringIndex}.radius`, 0.01, 8);
      assertFiniteNumber(ring.aspect, `geometry.rings.${ringIndex}.aspect`, 0.05, 8);
      if (ring.dash !== undefined) {
        if (!Array.isArray(ring.dash) || ring.dash.length !== 2) throw new Error(`geometry.rings.${ringIndex}.dash must contain two numbers`);
        ring.dash.forEach((value, index) => assertFiniteNumber(value, `geometry.rings.${ringIndex}.dash.${index}`, 0.001, 100));
      }
      if (ring.strokeWidth !== undefined) assertFiniteNumber(ring.strokeWidth, `geometry.rings.${ringIndex}.strokeWidth`, 0.05, 20);
      if (ring.opacity !== undefined) assertFiniteNumber(ring.opacity, `geometry.rings.${ringIndex}.opacity`, 0, 1);
    });
    assertInteger(sampling.segments, 'sampling.segments', 12, 2048);
    assertInteger(sampling.hubSegments, 'sampling.hubSegments', 24, 1024);
    assertInteger(sampling.markerSegments, 'sampling.markerSegments', 12, 256);
    if (!Array.isArray(geometry.hubRadii)) throw new Error('geometry.hubRadii must be an array');
    geometry.hubRadii.forEach((value, index) => assertFiniteNumber(value, `geometry.hubRadii.${index}`, 0.005, 4));
    assertFiniteNumber(geometry.axisLength, 'geometry.axisLength', 0, 8);
    assertFiniteNumber(geometry.axisAngle, 'geometry.axisAngle', -Math.PI * 4, Math.PI * 4);
    assertFiniteNumber(geometry.axisArrowSize, 'geometry.axisArrowSize', 0.005, 1);
    assertFiniteNumber(geometry.axisMarkerRadius, 'geometry.axisMarkerRadius', 0.001, 1);
    if (!Array.isArray(geometry.axisMarkers)) throw new Error('geometry.axisMarkers must be an array');
    geometry.axisMarkers.forEach((value, index) => assertFiniteNumber(value, `geometry.axisMarkers.${index}`, -1, 1));
    if (!Array.isArray(geometry.markers)) throw new Error('geometry.markers must be an array');
    geometry.markers.forEach((marker, markerIndex) => {
      assertInteger(marker.ring, `geometry.markers.${markerIndex}.ring`, 0, geometry.rings.length - 1);
      assertFiniteNumber(marker.phase, `geometry.markers.${markerIndex}.phase`, -8, 8);
      assertFiniteNumber(marker.radius, `geometry.markers.${markerIndex}.radius`, 0.002, 1);
    });
  } else if (family === 'transform-array') {
    if (!['ellipse', 'superellipse'].includes(geometry.primitive)) throw new Error('Unsupported transform primitive');
    assertInteger(geometry.count, 'geometry.count', 1, 256);
    ['radiusX', 'radiusY'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 20));
    ['rotation', 'rotationStep'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, -20, 20));
    ['translate', 'translateStep', 'scale', 'scaleStep', 'shear', 'shearStep'].forEach(key => {
      if (!Array.isArray(geometry[key]) || geometry[key].length !== 2) throw new Error(`geometry.${key} must contain two numbers`);
      geometry[key].forEach((value, index) => assertFiniteNumber(value, `geometry.${key}.${index}`, -20, 20));
    });
    assertInteger(sampling.segments, 'sampling.segments', 12, 2048);
  } else if (family === 'deformation-grid') {
    if (!['barrel', 'pinch', 'wave', 'hourglass'].includes(geometry.field)) throw new Error('Unsupported deformation field');
    ['amount', 'frequency', 'tilt', 'depth'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, -20, 20));
    assertInteger(sampling.rows, 'sampling.rows', 2, 128);
    assertInteger(sampling.columns, 'sampling.columns', 2, 128);
    assertInteger(sampling.samples, 'sampling.samples', 8, 1024);
  } else if (family === 'parametric-curves') {
    if (!['lissajous', 'rose', 'hypotrochoid', 'interference'].includes(geometry.curve)) throw new Error('Unsupported parametric curve');
    ['a', 'b', 'k', 'delta', 'turns', 'innerRadius', 'penOffset', 'spread', 'amplitude', 'frequency'].forEach(key => {
      assertFiniteNumber(geometry[key], `geometry.${key}`, -20, 20);
    });
    assertInteger(sampling.curves, 'sampling.curves', 1, 128);
    assertInteger(sampling.segments, 'sampling.segments', 24, 4096);
    if (geometry.curve === 'hypotrochoid') assertFiniteNumber(geometry.innerRadius, 'geometry.innerRadius', 0.05, 0.95);
  } else if (family === 'converging-helix') {
    ['turns', 'amplitude', 'decay', 'compression', 'tailLength', 'phaseSpan', 'turnSpread', 'amplitudeSpread', 'dashLength', 'dashGap', 'strandWidth', 'tailWidth', 'axisWidth'].forEach(key => {
      assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 20);
    });
    assertFiniteNumber(geometry.convergeX, 'geometry.convergeX', -2, 2);
    assertFiniteNumber(geometry.axisOpacity, 'geometry.axisOpacity', 0, 1);
    assertInteger(sampling.strands, 'sampling.strands', 1, 32);
    assertInteger(sampling.segments, 'sampling.segments', 24, 4096);
  } else if (family === 'layered-grid') {
    assertInteger(geometry.layers, 'geometry.layers', 1, 16);
    ['width', 'depth', 'spacing', 'nearScale', 'farScale'].forEach(key => assertFiniteNumber(geometry[key], `geometry.${key}`, 0.01, 10));
    assertFiniteNumber(geometry.skew, 'geometry.skew', -4, 4);
    if (typeof geometry.alternate !== 'boolean') throw new Error('geometry.alternate must be boolean');
    assertInteger(sampling.rows, 'sampling.rows', 2, 64);
    assertInteger(sampling.columns, 'sampling.columns', 2, 64);
  } else if (family === 'dipole-field') {
    ['separation', 'startRadius', 'stepSize', 'poleRadius', 'axisLength', 'maxRadius'].forEach(key => {
      assertFiniteNumber(geometry[key], `geometry.${key}`, 0.001, 20);
    });
    assertInteger(sampling.lines, 'sampling.lines', 3, 63);
    assertInteger(sampling.steps, 'sampling.steps', 40, 4096);
    assertInteger(sampling.markerSegments, 'sampling.markerSegments', 12, 256);
  }
}

function getAtPath(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], object);
}

function setAtPath(object, dottedPath, value) {
  const keys = dottedPath.split('.');
  const finalKey = keys.pop();
  let cursor = object;
  for (const key of keys) {
    if (cursor[key] === undefined) throw new Error(`Unknown variant parameter path: ${dottedPath}`);
    cursor = cursor[key];
  }
  if (cursor[finalKey] === undefined) throw new Error(`Unknown variant parameter path: ${dottedPath}`);
  cursor[finalKey] = value;
}

function resolveVariant(baseScene, index) {
  const scene = clone(baseScene);
  scene.variant = { index, seed: hashSeed(`${baseScene.seed}:${index}`) };
  const preset = baseScene.variants.presets?.[index];
  if (preset) {
    for (const dottedPath of Object.keys(preset).sort()) setAtPath(scene, dottedPath, preset[dottedPath]);
    validateFamily(scene);
    return scene;
  }
  if (index === 0 && baseScene.variants.includeBase) return scene;
  const random = mulberry32(scene.variant.seed);
  for (const dottedPath of Object.keys(baseScene.variants.parameters || {}).sort()) {
    const rule = baseScene.variants.parameters[dottedPath];
    const current = getAtPath(scene, dottedPath);
    if (!Number.isFinite(current)) throw new Error(`Variant parameter must target a number: ${dottedPath}`);
    let next;
    if (isObject(rule) && Array.isArray(rule.relative) && rule.relative.length === 2) {
      next = current * (1 + rule.relative[0] + random() * (rule.relative[1] - rule.relative[0]));
    } else if (isObject(rule) && Number.isFinite(rule.min) && Number.isFinite(rule.max)) {
      next = rule.min + random() * (rule.max - rule.min);
    } else {
      throw new Error(`Invalid variant range for ${dottedPath}`);
    }
    setAtPath(scene, dottedPath, next);
  }
  validateFamily(scene);
  return scene;
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
  [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
  return [x, y, z];
}

function project3D(point, projection) {
  const rotated = rotate3D(point, projection.rotation || [0, 0, 0]);
  const scale = projection.type === 'none' ? 1 : 1 + rotated[2] * projection.strength;
  if (!Number.isFinite(scale) || scale <= 0.02) throw new Error('Projection collapsed behind the camera');
  return [rotated[0] * scale, rotated[1] * scale];
}

function profileRadius(v, geometry) {
  const magnitude = Math.abs(v);
  if (geometry.profile === 'frustum') {
    const progress = (v + 1) / 2;
    return geometry.radiusStart + (geometry.radiusEnd - geometry.radiusStart) * Math.pow(progress, geometry.exponent);
  }
  if (geometry.profile === 'hourglass') return geometry.neck + (geometry.flare - geometry.neck) * Math.pow(magnitude, geometry.exponent);
  if (geometry.profile === 'catenoid') {
    const normalized = (Math.cosh(geometry.growth * magnitude) - 1) / (Math.cosh(geometry.growth) - 1);
    return geometry.neck + (geometry.flare - geometry.neck) * normalized;
  }
  if (geometry.profile === 'sinusoidal') {
    const wave = 0.5 - 0.5 * Math.cos(Math.PI * magnitude);
    return geometry.neck + (geometry.flare - geometry.neck) * wave;
  }
  const bell = Math.exp(-Math.pow(magnitude * geometry.growth, 2));
  return geometry.flare - (geometry.flare - geometry.neck) * bell;
}

function renderSurface(scene) {
  const paths = [];
  const { geometry, sampling, projection } = scene;
  const point = (u, v) => {
    const radius = profileRadius(v, geometry);
    const angle = u + geometry.twist * v;
    const point3D = geometry.axis === 'horizontal'
      ? [geometry.height * v, radius * Math.cos(angle), radius * Math.sin(angle)]
      : [radius * Math.cos(angle), geometry.height * v, radius * Math.sin(angle)];
    return project3D(point3D, projection);
  };
  for (let ringIndex = 0; ringIndex < sampling.rings; ringIndex += 1) {
    const v = -1 + (2 * ringIndex) / (sampling.rings - 1);
    const points = [];
    for (let segment = 0; segment <= sampling.uSegments; segment += 1) points.push(point((segment / sampling.uSegments) * Math.PI * 2, v));
    paths.push({ role: 'ring', points });
  }
  for (let meridianIndex = 0; meridianIndex < sampling.meridians; meridianIndex += 1) {
    const u = (meridianIndex / sampling.meridians) * Math.PI * 2;
    const points = [];
    for (let segment = 0; segment <= sampling.vSegments; segment += 1) points.push(point(u, -1 + (2 * segment) / sampling.vSegments));
    paths.push({ role: 'meridian', points });
  }
  return paths;
}

function renderOrbits(scene) {
  const { geometry, sampling, projection } = scene;
  const orbitPoint = (ring, phase) => {
    const angle = phase * Math.PI * 2;
    const base = [Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius * ring.aspect, 0];
    return project3D(rotate3D(base, ring.rotation), projection);
  };
  const circleAt = (center, radius, segments, role, extra = {}) => {
    const points = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
    }
    return { role, points, ...extra };
  };
  const paths = [];
  if (geometry.axisLength > 0) {
    const direction = [Math.cos(geometry.axisAngle), Math.sin(geometry.axisAngle)];
    const normal = [-direction[1], direction[0]];
    const start = [-direction[0] * geometry.axisLength, -direction[1] * geometry.axisLength];
    const end = [direction[0] * geometry.axisLength, direction[1] * geometry.axisLength];
    paths.push({ role: 'axis', points: [start, end], opacity: 0.72, strokeWidth: 1.15 });
    const arrowBase = [end[0] - direction[0] * geometry.axisArrowSize, end[1] - direction[1] * geometry.axisArrowSize];
    const wing = geometry.axisArrowSize * 0.55;
    paths.push({ role: 'axis-arrow', points: [
      [arrowBase[0] + normal[0] * wing, arrowBase[1] + normal[1] * wing],
      end,
      [arrowBase[0] - normal[0] * wing, arrowBase[1] - normal[1] * wing]
    ], opacity: 0.9, strokeWidth: 1.45 });
  }
  geometry.rings.forEach((ring, ringIndex) => {
    const points = [];
    for (let segment = 0; segment <= sampling.segments; segment += 1) points.push(orbitPoint(ring, segment / sampling.segments));
    paths.push({ role: 'orbit', index: ringIndex, points, dash: ring.dash, opacity: ring.opacity, strokeWidth: ring.strokeWidth });
  });
  geometry.markers.forEach((marker, markerIndex) => {
    const center = orbitPoint(geometry.rings[marker.ring], marker.phase);
    paths.push(circleAt(center, marker.radius, sampling.markerSegments, 'marker', { index: markerIndex, strokeWidth: marker.strokeWidth || 1.4, opacity: marker.opacity || 0.95 }));
  });
  if (geometry.axisLength > 0) {
    const direction = [Math.cos(geometry.axisAngle), Math.sin(geometry.axisAngle)];
    geometry.axisMarkers.forEach((position, markerIndex) => {
      const center = [direction[0] * geometry.axisLength * position, direction[1] * geometry.axisLength * position];
      paths.push(circleAt(center, geometry.axisMarkerRadius, sampling.markerSegments, 'axis-marker', { index: markerIndex, strokeWidth: 1.8, opacity: 0.95 }));
    });
  }
  geometry.hubRadii.forEach((radius, hubIndex) => {
    paths.push(circleAt([0, 0], radius, sampling.hubSegments, 'hub', { index: hubIndex, strokeWidth: hubIndex === geometry.hubRadii.length - 1 ? 3.2 : 1.9, opacity: 1 }));
  });
  return paths;
}

function renderProjectionRays(scene) {
  const { geometry, sampling, projection } = scene;
  const origin3D = [-geometry.length, 0, 0];
  const origin = project3D(origin3D, projection);
  const target3D = angle => [
    geometry.length,
    geometry.apertureRadius * geometry.apertureAspect * Math.cos(angle),
    geometry.apertureRadius * Math.sin(angle)
  ];
  const paths = [];
  const rim = [];
  for (let segment = 0; segment <= sampling.apertureSegments; segment += 1) {
    const angle = geometry.phase + (segment / sampling.apertureSegments) * Math.PI * 2;
    rim.push(project3D(target3D(angle), projection));
  }
  paths.push({ role: 'aperture', points: rim });
  for (let rayIndex = 0; rayIndex < sampling.rays; rayIndex += 1) {
    const angle = geometry.phase + (rayIndex / sampling.rays) * Math.PI * 2;
    paths.push({ role: 'ray', index: rayIndex, points: [origin, project3D(target3D(angle), projection)] });
  }
  if (geometry.showAxis) paths.push({ role: 'axis', points: [origin, project3D([geometry.length, 0, 0], projection)] });
  if (geometry.showOriginMarker) {
    const marker = [];
    for (let segment = 0; segment <= sampling.markerSegments; segment += 1) {
      const angle = (segment / sampling.markerSegments) * Math.PI * 2;
      marker.push(project3D([
        -geometry.length,
        geometry.originMarkerRadius * Math.cos(angle),
        geometry.originMarkerRadius * Math.sin(angle)
      ], projection));
    }
    paths.push({ role: 'origin-marker', points: marker });
  }
  return paths;
}

function superellipsePoint(angle, exponent = 2) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const power = 2 / Math.max(0.2, exponent);
  return [Math.sign(cosine) * Math.pow(Math.abs(cosine), power), Math.sign(sine) * Math.pow(Math.abs(sine), power)];
}

function renderTransformArray(scene) {
  const { geometry, sampling } = scene;
  const paths = [];
  for (let itemIndex = 0; itemIndex < geometry.count; itemIndex += 1) {
    const rotation = geometry.rotation + itemIndex * geometry.rotationStep;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const tx = geometry.translate[0] + itemIndex * geometry.translateStep[0];
    const ty = geometry.translate[1] + itemIndex * geometry.translateStep[1];
    const sx = geometry.scale[0] + itemIndex * geometry.scaleStep[0];
    const sy = geometry.scale[1] + itemIndex * geometry.scaleStep[1];
    const shx = geometry.shear[0] + itemIndex * geometry.shearStep[0];
    const shy = geometry.shear[1] + itemIndex * geometry.shearStep[1];
    const points = [];
    for (let segment = 0; segment <= sampling.segments; segment += 1) {
      const angle = (segment / sampling.segments) * Math.PI * 2;
      const primitive = geometry.primitive === 'superellipse' ? superellipsePoint(angle, geometry.exponent || 2.8) : [Math.cos(angle), Math.sin(angle)];
      const x0 = primitive[0] * geometry.radiusX * sx;
      const y0 = primitive[1] * geometry.radiusY * sy;
      const x1 = x0 + shx * y0;
      const y1 = y0 + shy * x0;
      points.push([x1 * cosine - y1 * sine + tx, x1 * sine + y1 * cosine + ty]);
    }
    paths.push({ role: 'transform', index: itemIndex, points });
  }
  return paths;
}

function deformPoint(u, v, geometry, projection) {
  let x = u;
  let y = v;
  let z = geometry.depth * (1 - Math.min(1, u * u + v * v));
  if (geometry.field === 'barrel') {
    const factor = 1 + geometry.amount * (u * u + v * v);
    x *= factor;
    y *= factor;
  } else if (geometry.field === 'pinch') {
    x *= 1 - geometry.amount * Math.exp(-v * v * geometry.frequency);
  } else if (geometry.field === 'wave') {
    x += geometry.amount * 0.22 * Math.sin(v * Math.PI * geometry.frequency);
    y += geometry.amount * 0.18 * Math.sin(u * Math.PI * geometry.frequency);
    z += geometry.amount * 0.18 * Math.sin((u + v) * Math.PI * geometry.frequency);
  } else if (geometry.field === 'hourglass') {
    x *= 1 - geometry.amount * Math.exp(-v * v * geometry.frequency);
    z += geometry.amount * 0.12 * Math.cos(v * Math.PI);
  }
  y += geometry.tilt * x * 0.18;
  return project3D([x, y, z], projection);
}

function renderGrid(scene) {
  const paths = [];
  const { geometry, sampling, projection } = scene;
  for (let row = 0; row < sampling.rows; row += 1) {
    const v = -1 + (2 * row) / (sampling.rows - 1);
    const points = [];
    for (let sample = 0; sample <= sampling.samples; sample += 1) points.push(deformPoint(-1 + (2 * sample) / sampling.samples, v, geometry, projection));
    paths.push({ role: 'row', points });
  }
  for (let column = 0; column < sampling.columns; column += 1) {
    const u = -1 + (2 * column) / (sampling.columns - 1);
    const points = [];
    for (let sample = 0; sample <= sampling.samples; sample += 1) points.push(deformPoint(u, -1 + (2 * sample) / sampling.samples, geometry, projection));
    paths.push({ role: 'column', points });
  }
  return paths;
}

function renderParametricCurves(scene) {
  const { geometry, sampling } = scene;
  const paths = [];
  const center = (sampling.curves - 1) / 2;
  for (let curveIndex = 0; curveIndex < sampling.curves; curveIndex += 1) {
    const offset = (curveIndex - center) * geometry.spread;
    const points = [];
    for (let segment = 0; segment <= sampling.segments; segment += 1) {
      const progress = segment / sampling.segments;
      let x;
      let y;
      if (geometry.curve === 'lissajous') {
        const t = progress * Math.PI * 2 * geometry.turns;
        x = Math.sin(geometry.a * t + geometry.delta + offset);
        y = Math.sin(geometry.b * t + offset * 0.45);
      } else if (geometry.curve === 'rose') {
        const t = progress * Math.PI * 2;
        const radius = Math.cos(geometry.k * t + offset);
        const scale = 1 + offset * 0.16;
        x = radius * Math.cos(t) * scale;
        y = radius * Math.sin(t) * scale;
      } else if (geometry.curve === 'hypotrochoid') {
        const t = progress * Math.PI * 2 * geometry.turns + offset;
        const inner = geometry.innerRadius;
        const difference = 1 - inner;
        const pen = geometry.penOffset + offset * 0.12;
        x = difference * Math.cos(t) + pen * Math.cos((difference / inner) * t);
        y = difference * Math.sin(t) - pen * Math.sin((difference / inner) * t);
      } else {
        x = -1 + progress * 2;
        const envelope = 0.38 + 0.62 * Math.pow(Math.sin(progress * Math.PI), 0.7);
        y = geometry.amplitude * envelope * Math.sin((x * geometry.frequency + geometry.delta + offset) * Math.PI) + offset * 0.34;
      }
      points.push([x, y]);
    }
    paths.push({ role: 'parametric-curve', index: curveIndex, points });
  }
  return paths;
}

function renderConvergingHelix(scene) {
  const { geometry, sampling } = scene;
  const paths = [];
  const startX = -1;
  const tailEnd = geometry.convergeX + geometry.tailLength;
  paths.push({
    role: 'helix-axis',
    points: [project3D([startX, 0, 0], scene.projection), project3D([tailEnd, 0, 0], scene.projection)],
    strokeWidth: geometry.axisWidth,
    opacity: geometry.axisOpacity
  });
  for (let strand = 0; strand < sampling.strands; strand += 1) {
    const normalizedStrand = sampling.strands === 1 ? 0 : strand / (sampling.strands - 1) * 2 - 1;
    const phase = normalizedStrand * geometry.phaseSpan * 0.5;
    const strandTurns = geometry.turns + normalizedStrand * geometry.turnSpread;
    const strandAmplitude = geometry.amplitude * (1 + Math.abs(normalizedStrand) * geometry.amplitudeSpread);
    const points = [];
    for (let segment = 0; segment <= sampling.segments; segment += 1) {
      const progress = segment / sampling.segments;
      const compressed = 1 - Math.pow(1 - progress, geometry.compression);
      const x = startX + (geometry.convergeX - startX) * compressed;
      const radius = strandAmplitude * Math.pow(1 - progress, geometry.decay);
      const angle = Math.PI * 2 * strandTurns * progress + phase;
      points.push(project3D([x, radius * Math.cos(angle), radius * Math.sin(angle)], scene.projection));
    }
    paths.push({ role: 'helix-strand', index: strand, points, dash: [geometry.dashLength, geometry.dashGap], strokeWidth: geometry.strandWidth, opacity: 0.86 });
  }
  paths.push({
    role: 'tail',
    points: [project3D([geometry.convergeX, 0, 0], scene.projection), project3D([tailEnd, 0, 0], scene.projection)],
    strokeWidth: geometry.tailWidth,
    opacity: 1
  });
  return paths;
}

function renderLayeredGrid(scene) {
  const { geometry, sampling } = scene;
  const paths = [];
  const layerCenter = (geometry.layers - 1) / 2;
  for (let layer = 0; layer < geometry.layers; layer += 1) {
    const centerY = (layer - layerCenter) * geometry.spacing;
    const flipped = geometry.alternate && layer % 2 === 1;
    const topScale = flipped ? geometry.nearScale : geometry.farScale;
    const bottomScale = flipped ? geometry.farScale : geometry.nearScale;
    const gridPoint = (u, v) => {
      const halfWidth = geometry.width * (topScale + (bottomScale - topScale) * v);
      const shift = geometry.skew * (v - 0.5);
      return [u * halfWidth + shift, centerY + (v - 0.5) * geometry.depth];
    };
    for (let row = 0; row < sampling.rows; row += 1) {
      const v = row / (sampling.rows - 1);
      paths.push({ role: 'layer-row', index: layer * sampling.rows + row, points: [gridPoint(-1, v), gridPoint(1, v)] });
    }
    for (let column = 0; column < sampling.columns; column += 1) {
      const u = -1 + (2 * column) / (sampling.columns - 1);
      paths.push({ role: 'layer-column', index: layer * sampling.columns + column, points: [gridPoint(u, 0), gridPoint(u, 1)] });
    }
  }
  return paths;
}

function renderDipoleField(scene) {
  const { geometry, sampling } = scene;
  const source = [-geometry.separation / 2, 0];
  const sink = [geometry.separation / 2, 0];
  const vectorAt = ([x, y]) => {
    const sx = x - source[0];
    const sy = y;
    const tx = x - sink[0];
    const ty = y;
    const sourceRadius2 = Math.max(1e-8, sx * sx + sy * sy);
    const sinkRadius2 = Math.max(1e-8, tx * tx + ty * ty);
    const vx = sx / sourceRadius2 - tx / sinkRadius2;
    const vy = sy / sourceRadius2 - ty / sinkRadius2;
    const length = Math.hypot(vx, vy) || 1;
    return [vx / length, vy / length];
  };
  const circle = (center, radius, role) => {
    const points = [];
    for (let segment = 0; segment <= sampling.markerSegments; segment += 1) {
      const angle = (segment / sampling.markerSegments) * Math.PI * 2;
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
    }
    return { role, points, strokeWidth: 1.8, opacity: 1 };
  };
  const paths = [{ role: 'field-axis', points: [[-geometry.axisLength, 0], [geometry.axisLength, 0]], dash: [5, 7], opacity: 0.48 }];
  for (let line = 0; line < sampling.lines; line += 1) {
    const angle = -2.42 + (4.84 * line) / (sampling.lines - 1);
    let point = [source[0] + Math.cos(angle) * geometry.startRadius, Math.sin(angle) * geometry.startRadius];
    const points = [point];
    for (let step = 0; step < sampling.steps; step += 1) {
      const direction = vectorAt(point);
      point = [point[0] + direction[0] * geometry.stepSize, point[1] + direction[1] * geometry.stepSize];
      points.push(point);
      if (Math.hypot(point[0] - sink[0], point[1] - sink[1]) <= geometry.startRadius * 1.15) break;
      if (Math.hypot(point[0], point[1]) > geometry.maxRadius) break;
    }
    paths.push({ role: 'field-line', index: line, points, opacity: line === (sampling.lines - 1) / 2 ? 0.92 : 0.72 });
  }
  paths.push(circle(source, geometry.poleRadius, 'source-pole'));
  paths.push(circle(sink, geometry.poleRadius, 'sink-pole'));
  return paths;
}

function renderFamily(scene) {
  if (scene.family === 'surface-revolution') return renderSurface(scene);
  if (scene.family === 'projection-rays') return renderProjectionRays(scene);
  if (scene.family === 'orbital-rings') return renderOrbits(scene);
  if (scene.family === 'transform-array') return renderTransformArray(scene);
  if (scene.family === 'deformation-grid') return renderGrid(scene);
  if (scene.family === 'parametric-curves') return renderParametricCurves(scene);
  if (scene.family === 'converging-helix') return renderConvergingHelix(scene);
  if (scene.family === 'layered-grid') return renderLayeredGrid(scene);
  return renderDipoleField(scene);
}

function boundsFor(paths) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const pathItem of paths) {
    for (const point of pathItem.points) {
      if (!point.every(Number.isFinite)) throw new Error('Geometry contains non-finite coordinates');
      bounds.minX = Math.min(bounds.minX, point[0]);
      bounds.minY = Math.min(bounds.minY, point[1]);
      bounds.maxX = Math.max(bounds.maxX, point[0]);
      bounds.maxY = Math.max(bounds.maxY, point[1]);
    }
  }
  if (!(bounds.maxX > bounds.minX) || !(bounds.maxY > bounds.minY)) throw new Error('Geometry collapsed to zero area');
  return bounds;
}

function fitPaths(paths, viewport) {
  const source = boundsFor(paths);
  const availableWidth = viewport.width - viewport.padding * 2;
  const availableHeight = viewport.height - viewport.padding * 2;
  const scale = Math.min(availableWidth / (source.maxX - source.minX), availableHeight / (source.maxY - source.minY));
  const sourceCenterX = (source.minX + source.maxX) / 2;
  const sourceCenterY = (source.minY + source.maxY) / 2;
  const targetCenterX = viewport.width / 2;
  const targetCenterY = viewport.height / 2;
  const fitted = paths.map(pathItem => ({ ...pathItem, points: pathItem.points.map(([x, y]) => [
    targetCenterX + (x - sourceCenterX) * scale,
    targetCenterY + (y - sourceCenterY) * scale
  ]) }));
  return { paths: fitted, bounds: boundsFor(fitted), scale };
}

function number(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pathData(points) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${number(x)} ${number(y)}`).join(' ');
}

function buildSvg(scene, fitted) {
  const { viewport, style } = scene;
  const background = viewport.background === 'none' ? '' : `  <rect width="100%" height="100%" fill="${escapeXml(viewport.background)}"/>\n`;
  const pathMarkup = fitted.paths.map(item => {
    const attributes = [`data-role="${escapeXml(item.role)}"`, `d="${pathData(item.points)}"`];
    if (item.dash) attributes.push(`stroke-dasharray="${item.dash.map(number).join(' ')}"`);
    if (Number.isFinite(item.strokeWidth)) attributes.push(`stroke-width="${number(item.strokeWidth)}"`);
    if (Number.isFinite(item.opacity)) attributes.push(`stroke-opacity="${number(item.opacity)}"`);
    return `    <path ${attributes.join(' ')}/>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}" fill="none" data-family="${scene.family}" data-seed="${escapeXml(scene.variant.seed)}">\n${background}  <g stroke="${escapeXml(style.stroke)}" stroke-width="${number(style.strokeWidth)}" stroke-opacity="${number(style.opacity)}" fill="none" stroke-linecap="${escapeXml(style.lineCap || 'round')}" stroke-linejoin="${escapeXml(style.lineJoin || 'round')}" vector-effect="non-scaling-stroke">\n${pathMarkup}\n  </g>\n</svg>\n`;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function generate(sceneInput, outputDirectory) {
  const baseScene = normalizeScene(sceneInput);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const items = [];
  for (let index = 0; index < baseScene.variants.count; index += 1) {
    const scene = resolveVariant(baseScene, index);
    const fitted = fitPaths(renderFamily(scene), scene.viewport);
    const suffix = String(index + 1).padStart(2, '0');
    const baseName = `${baseScene.name}-${suffix}`;
    const svgName = `${baseName}.svg`;
    const sceneName = `${baseName}.json`;
    fs.writeFileSync(path.join(outputDirectory, svgName), buildSvg(scene, fitted));
    writeJson(path.join(outputDirectory, sceneName), scene);
    items.push({
      index,
      seed: scene.variant.seed,
      family: scene.family,
      svg: svgName,
      scene: sceneName,
      pathCount: fitted.paths.length,
      bounds: Object.fromEntries(Object.entries(fitted.bounds).map(([key, value]) => [key, Math.round(value * 1000) / 1000]))
    });
  }
  const manifest = {
    version: 1,
    name: baseScene.name,
    family: baseScene.family,
    sourceFingerprint: hashSeed(stableStringify(baseScene)),
    viewport: baseScene.viewport,
    items
  };
  writeJson(path.join(outputDirectory, 'manifest.json'), manifest);
  return manifest;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene || !args.out) throw new Error('Usage: node render.cjs --scene scene.json --out output-directory');
  const scenePath = path.resolve(args.scene);
  const outputDirectory = path.resolve(args.out);
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const manifest = generate(scene, outputDirectory);
  process.stdout.write(`${path.join(outputDirectory, 'manifest.json')} (${manifest.items.length} variants)\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`render: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildSvg, fitPaths, generate, hashSeed, normalizeScene, renderFamily, resolveVariant, stableStringify };
