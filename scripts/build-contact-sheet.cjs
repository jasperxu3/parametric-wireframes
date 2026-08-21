#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadSharp } = require('./runtime.cjs');

function parseArgs(argv) {
  const manifestIndex = argv.indexOf('--manifest');
  if (manifestIndex === -1 || !argv[manifestIndex + 1]) throw new Error('Usage: node build-contact-sheet.cjs --manifest output/manifest.json');
  return path.resolve(argv[manifestIndex + 1]);
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildContactSheet(manifestPath) {
  const sharp = loadSharp();
  const directory = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.items.length) throw new Error('Manifest contains no items');
  const columns = Math.min(3, manifest.items.length);
  const rows = Math.ceil(manifest.items.length / columns);
  const cellWidth = 420;
  const imageSize = 360;
  const headerHeight = 76;
  const cellHeight = imageSize + 72;
  const sheetWidth = columns * cellWidth;
  const sheetHeight = headerHeight + rows * cellHeight;
  const background = '#11121a';
  const cells = manifest.items.map((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = headerHeight + row * cellHeight;
    const svg = fs.readFileSync(path.join(directory, item.svg));
    const data = svg.toString('base64');
    return `  <g transform="translate(${x} ${y})">
    <rect x="18" y="10" width="384" height="${cellHeight - 20}" rx="12" fill="#1b1d28" stroke="#343746"/>
    <image x="30" y="24" width="${imageSize}" height="${imageSize}" href="data:image/svg+xml;base64,${data}"/>
    <text x="30" y="410" fill="#f0f2ff" font-family="Arial, sans-serif" font-size="16">${escapeXml(item.svg)}</text>
    <text x="390" y="410" text-anchor="end" fill="#858ba0" font-family="Arial, sans-serif" font-size="13">seed ${item.seed}</text>
  </g>`;
  }).join('\n');
  const sheetSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
  <rect width="100%" height="100%" fill="${background}"/>
  <text x="24" y="34" fill="#f0f2ff" font-family="Arial, sans-serif" font-weight="700" font-size="20">${escapeXml(manifest.name)}</text>
  <text x="24" y="56" fill="#858ba0" font-family="Arial, sans-serif" font-size="13">${escapeXml(manifest.family)} · ${manifest.items.length} deterministic variants</text>
${cells}
</svg>
`;
  const sheetSvgPath = path.join(directory, 'contact-sheet.svg');
  const sheetPngPath = path.join(directory, 'contact-sheet.png');
  fs.writeFileSync(sheetSvgPath, sheetSvg);
  await sharp(Buffer.from(sheetSvg)).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(sheetPngPath);
  const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(manifest.name)} contact sheet</title><style>html,body{margin:0;background:${background}}img{display:block;width:100%;height:auto}</style><img src="contact-sheet.svg" alt="${escapeXml(manifest.name)} wireframe variants"></html>
`;
  fs.writeFileSync(path.join(directory, 'contact-sheet.html'), html);
  manifest.contactSheet = {
    svg: 'contact-sheet.svg',
    png: 'contact-sheet.png',
    html: 'contact-sheet.html'
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { sheetSvgPath, sheetPngPath };
}

if (require.main === module) {
  buildContactSheet(parseArgs(process.argv.slice(2)))
    .then(result => process.stdout.write(`${result.sheetPngPath}\n`))
    .catch(error => {
      process.stderr.write(`build-contact-sheet: ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = { buildContactSheet };
