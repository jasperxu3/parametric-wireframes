#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadSharp } = require('./runtime.cjs');

function parseArgs(argv) {
  const manifestIndex = argv.indexOf('--manifest');
  if (manifestIndex === -1 || !argv[manifestIndex + 1]) throw new Error('Usage: node export-png.cjs --manifest output/manifest.json');
  return path.resolve(argv[manifestIndex + 1]);
}

async function exportPngs(manifestPath) {
  const sharp = loadSharp();
  const directory = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const item of manifest.items) {
    const svgPath = path.join(directory, item.svg);
    const pngName = item.svg.replace(/\.svg$/i, '.png');
    const pngPath = path.join(directory, pngName);
    await sharp(svgPath, { density: 96 })
      .resize(manifest.viewport.width, manifest.viewport.height, { fit: 'fill' })
      .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
      .toFile(pngPath);
    item.png = pngName;
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  exportPngs(parseArgs(process.argv.slice(2)))
    .then(manifest => process.stdout.write(`${manifest.items.length} PNG files exported\n`))
    .catch(error => {
      process.stderr.write(`export-png: ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = { exportPngs };
