#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildContactSheet } = require('./build-contact-sheet.cjs');
const { buildGallery } = require('./build-template-gallery.cjs');
const { exportPngs } = require('./export-png.cjs');
const { fitPaths, generate, normalizeScene, renderFamily, resolveVariant } = require('./render.cjs');
const { loadSharp } = require('./runtime.cjs');

const skillRoot = path.resolve(__dirname, '..');
const sceneDirectory = path.join(skillRoot, 'assets', 'scenes');
const sceneFiles = [
  'surface-revolution.json',
  'projection-rays.json',
  'orbital-rings.json',
  'transform-array.json',
  'deformation-grid.json',
  'parametric-curves.json',
  'converging-helix.json',
  'layered-grid.json',
  'dipole-field.json'
];

function digest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertSvg(svgPath, family, expectedPathCount) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  assert(svg.includes(`data-family="${family}"`), `${family}: missing family metadata`);
  assert(!/NaN|Infinity|undefined/.test(svg), `${family}: invalid numeric output`);
  assert(svg.includes(' fill="none"'), `${family}: wireframe must not be filled`);
  assert.strictEqual((svg.match(/<path /g) || []).length, expectedPathCount, `${family}: unexpected path count`);
}

async function run() {
  const sharp = loadSharp();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'parametric-wireframes-test-'));
  try {
    for (const sceneFile of sceneFiles) {
      const input = JSON.parse(fs.readFileSync(path.join(sceneDirectory, sceneFile), 'utf8'));
      const firstDirectory = path.join(temporaryRoot, `${input.family}-a`);
      const secondDirectory = path.join(temporaryRoot, `${input.family}-b`);
      const firstManifest = generate(input, firstDirectory);
      const secondManifest = generate(input, secondDirectory);
      assert.strictEqual(firstManifest.items.length, 6, `${input.family}: default batch size`);
      assert.deepStrictEqual(firstManifest, secondManifest, `${input.family}: manifest is not deterministic`);

      for (let index = 0; index < firstManifest.items.length; index += 1) {
        const firstItem = firstManifest.items[index];
        const secondItem = secondManifest.items[index];
        assert.strictEqual(digest(path.join(firstDirectory, firstItem.svg)), digest(path.join(secondDirectory, secondItem.svg)), `${input.family}: SVG differs for same seed`);
        assert.strictEqual(digest(path.join(firstDirectory, firstItem.scene)), digest(path.join(secondDirectory, secondItem.scene)), `${input.family}: resolved scene differs for same seed`);
        assertSvg(path.join(firstDirectory, firstItem.svg), input.family, firstItem.pathCount);
        assert(firstItem.bounds.minX >= input.viewport.padding - 0.01, `${input.family}: left bound escaped padding`);
        assert(firstItem.bounds.minY >= input.viewport.padding - 0.01, `${input.family}: top bound escaped padding`);
        assert(firstItem.bounds.maxX <= input.viewport.width - input.viewport.padding + 0.01, `${input.family}: right bound escaped padding`);
        assert(firstItem.bounds.maxY <= input.viewport.height - input.viewport.padding + 0.01, `${input.family}: bottom bound escaped padding`);
      }

      await exportPngs(path.join(firstDirectory, 'manifest.json'));
      await exportPngs(path.join(secondDirectory, 'manifest.json'));
      const pngManifestA = JSON.parse(fs.readFileSync(path.join(firstDirectory, 'manifest.json'), 'utf8'));
      const pngManifestB = JSON.parse(fs.readFileSync(path.join(secondDirectory, 'manifest.json'), 'utf8'));
      assert.deepStrictEqual(pngManifestA, pngManifestB, `${input.family}: PNG manifest differs`);
      for (let index = 0; index < pngManifestA.items.length; index += 1) {
        const itemA = pngManifestA.items[index];
        const itemB = pngManifestB.items[index];
        const pngA = path.join(firstDirectory, itemA.png);
        const pngB = path.join(secondDirectory, itemB.png);
        assert.strictEqual(digest(pngA), digest(pngB), `${input.family}: PNG differs for same seed`);
        const metadata = await sharp(pngA).metadata();
        assert.strictEqual(metadata.width, input.viewport.width, `${input.family}: PNG width`);
        assert.strictEqual(metadata.height, input.viewport.height, `${input.family}: PNG height`);
      }
      await buildContactSheet(path.join(firstDirectory, 'manifest.json'));
      assert(fs.statSync(path.join(firstDirectory, 'contact-sheet.png')).size > 1000, `${input.family}: contact sheet missing`);
    }

    const symmetricInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'surface-revolution.json'), 'utf8'));
    symmetricInput.variants.count = 1;
    const symmetricScene = resolveVariant(normalizeScene(symmetricInput), 0);
    const fitted = fitPaths(renderFamily(symmetricScene), symmetricScene.viewport);
    const centerX = symmetricScene.viewport.width / 2;
    assert(Math.abs((fitted.bounds.minX + fitted.bounds.maxX) / 2 - centerX) < 0.01, 'mirrorX scene is not centered symmetrically');

    const frustumInput = {
      version: 1,
      seed: 5042,
      name: 'frustum-test',
      family: 'surface-revolution',
      geometry: { profile: 'frustum', axis: 'horizontal', radiusStart: 0.1, radiusEnd: 0.9, exponent: 1, height: 1.3 },
      projection: { type: 'weak-perspective', strength: 0.14, rotation: [0, 0.18, 0] },
      sampling: { rings: 17, meridians: 21, uSegments: 96, vSegments: 72 },
      style: { stroke: '#24334a', strokeWidth: 1, opacity: 0.8, fill: 'none' },
      constraints: { mirrorX: false, mirrorY: true },
      variants: { count: 1, includeBase: true, parameters: {} }
    };
    const frustumScene = resolveVariant(normalizeScene(frustumInput), 0);
    const frustumPaths = renderFamily(frustumScene);
    assert.strictEqual(frustumPaths.length, 38, 'frustum path count');
    assert(frustumPaths.every(item => item.points.every(point => point.every(Number.isFinite))), 'frustum has non-finite coordinates');

    const orbitalInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'orbital-rings.json'), 'utf8'));
    orbitalInput.variants.count = 1;
    orbitalInput.variants.presets = [orbitalInput.variants.presets[0]];
    const orbitalScene = resolveVariant(normalizeScene(orbitalInput), 0);
    const orbitalPaths = renderFamily(orbitalScene);
    const orbitalRoles = new Set(orbitalPaths.map(item => item.role));
    ['orbit', 'hub', 'marker', 'axis', 'axis-arrow', 'axis-marker'].forEach(role => assert(orbitalRoles.has(role), `augmented orbital scene missing ${role}`));
    assert(orbitalPaths.some(item => item.dash), 'augmented orbital scene missing dashed orbit');

    const parametricInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'parametric-curves.json'), 'utf8'));
    parametricInput.variants.count = 1;
    const parametricScene = resolveVariant(normalizeScene(parametricInput), 0);
    const parametricPaths = renderFamily(parametricScene);
    assert.strictEqual(parametricPaths.length, parametricInput.sampling.curves, 'parametric curve count');
    assert(parametricPaths.every(item => item.role === 'parametric-curve'), 'parametric curve role');

    const helixInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'converging-helix.json'), 'utf8'));
    helixInput.variants.count = 1;
    const helixScene = resolveVariant(normalizeScene(helixInput), 0);
    const helixPaths = renderFamily(helixScene);
    const helixStrands = helixPaths.filter(item => item.role === 'helix-strand');
    assert.strictEqual(helixStrands.length, helixInput.sampling.strands, 'converging helix strand count');
    assert(helixStrands.every(item => item.dash && item.points.length === helixInput.sampling.segments + 1), 'converging helix must use dashed sampled curves');
    assert.strictEqual(helixPaths.filter(item => item.role === 'helix-axis').length, 1, 'converging helix axis');
    assert.strictEqual(helixPaths.filter(item => item.role === 'tail').length, 1, 'converging helix tail');
    assert.strictEqual(helixPaths.filter(item => item.role === 'particle').length, 0, 'converging helix must not render isolated particles');

    const layeredInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'layered-grid.json'), 'utf8'));
    layeredInput.variants.count = 1;
    const layeredScene = resolveVariant(normalizeScene(layeredInput), 0);
    const layeredPaths = renderFamily(layeredScene);
    assert.strictEqual(layeredPaths.filter(item => item.role === 'layer-row').length, layeredInput.geometry.layers * layeredInput.sampling.rows, 'layered grid row count');
    assert.strictEqual(layeredPaths.filter(item => item.role === 'layer-column').length, layeredInput.geometry.layers * layeredInput.sampling.columns, 'layered grid column count');

    const dipoleInput = JSON.parse(fs.readFileSync(path.join(sceneDirectory, 'dipole-field.json'), 'utf8'));
    dipoleInput.variants.count = 1;
    const dipoleScene = resolveVariant(normalizeScene(dipoleInput), 0);
    const dipolePaths = renderFamily(dipoleScene);
    assert.strictEqual(dipolePaths.filter(item => item.role === 'field-line').length, dipoleInput.sampling.lines, 'dipole field line count');
    ['field-axis', 'source-pole', 'sink-pole'].forEach(role => assert(dipolePaths.some(item => item.role === role), `dipole field missing ${role}`));

    assert.throws(() => normalizeScene({ version: 1, family: 'unknown' }), /Unsupported family/);
    assert.throws(() => normalizeScene({ version: 1, family: 'orbital-rings', style: { fill: '#fff' } }), /fill must be none/);
    assert.throws(() => normalizeScene({ version: 1, family: 'deformation-grid', sampling: { rows: 1 } }), /sampling.rows/);
    assert.throws(() => normalizeScene({ version: 1, family: 'parametric-curves', geometry: { curve: 'unknown' } }), /Unsupported parametric curve/);
    assert.throws(() => normalizeScene({ version: 1, family: 'converging-helix', sampling: { segments: 2 } }), /sampling.segments/);
    assert.throws(() => normalizeScene({ version: 1, family: 'layered-grid', geometry: { layers: 0 } }), /geometry.layers/);
    assert.throws(() => normalizeScene({ version: 1, family: 'dipole-field', sampling: { lines: 2 } }), /sampling.lines/);

    const galleryDirectory = path.join(temporaryRoot, 'template-gallery');
    await buildGallery(path.join(skillRoot, 'assets', 'template-library', 'catalog.json'), galleryDirectory);
    const galleryHtml = fs.readFileSync(path.join(galleryDirectory, 'index.html'), 'utf8');
    const galleryManifest = JSON.parse(fs.readFileSync(path.join(galleryDirectory, 'manifest.json'), 'utf8'));
    assert.strictEqual(galleryManifest.templateCount, 13, 'template gallery count');
    assert.strictEqual(galleryManifest.families.length, 9, 'template gallery family count');
    assert.strictEqual((galleryHtml.match(/<article class="card"/g) || []).length, 13, 'template gallery card count');
    assert.strictEqual((galleryHtml.match(/<button /g) || []).length, 26, 'template gallery copy-button count');
    assert.strictEqual((galleryHtml.match(/<svg /g) || []).length, 13, 'template gallery inline SVG count');
    assert(fs.statSync(path.join(galleryDirectory, 'template-gallery-preview.png')).size > 1000, 'template gallery preview missing');
    process.stdout.write(`PASS: ${sceneFiles.length} families, deterministic SVG/PNG, bounds, symmetry, and validation\n`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

run().catch(error => {
  process.stderr.write(`FAIL: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
