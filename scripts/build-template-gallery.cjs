#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { generate, hashSeed, stableStringify } = require('./render.cjs');
const { loadSharp } = require('./runtime.cjs');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || !argv[index + 1]) throw new Error('Usage: node build-template-gallery.cjs --catalog catalog.json --out output-directory');
    args[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!args.catalog || !args.out) throw new Error('Usage: node build-template-gallery.cjs --catalog catalog.json --out output-directory');
  return { catalogPath: path.resolve(args.catalog), outputDirectory: path.resolve(args.out) };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineSvg(svg) {
  return svg.replace(/^<\?xml[^>]*>\s*/i, '');
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function buildHtml(catalog, templates) {
  const cards = templates.map((template, index) => `
      <article class="card" style="--accent:${escapeHtml(template.accent)}">
        <div class="preview">${inlineSvg(template.svg)}</div>
        <div class="card-body">
          <div class="eyebrow"><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(template.familyLabel)}</div>
          <h2>${escapeHtml(template.title)}</h2>
          <code class="formula">${escapeHtml(template.formula)}</code>
          <div class="actions">
            <button type="button" data-id="${escapeHtml(template.id)}" data-kind="svg">复制 SVG</button>
            <button class="secondary" type="button" data-id="${escapeHtml(template.id)}" data-kind="scene">复制参数</button>
          </div>
        </div>
      </article>`).join('');
  const payload = Object.fromEntries(templates.map(template => [template.id, { svg: template.svg, scene: JSON.stringify(template.scene, null, 2) }]));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(catalog.title)}</title>
  <style>
    :root{color-scheme:dark;--bg:#0d0f14;--panel:#151821;--line:#292e3b;--text:#f4f5f8;--muted:#9299a8}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;color:var(--text);background:radial-gradient(circle at 50% -20%,#252b3a 0,transparent 38rem),var(--bg);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{max-width:1480px;margin:auto;padding:72px 28px 42px;border-bottom:1px solid var(--line)}
    .kicker{margin:0 0 16px;color:#8fa1c6;font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase}
    h1{max-width:900px;margin:0;font-size:clamp(38px,6vw,78px);line-height:.96;letter-spacing:-.055em}
    header p{max-width:720px;margin:24px 0 0;color:var(--muted);font-size:16px;line-height:1.7}
    .legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.legend span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:#bbc1cc;font-size:12px}
    main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;max-width:1480px;margin:auto;padding:28px 28px 80px}
    .card{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,#171a23,#12151c);box-shadow:0 18px 48px rgba(0,0,0,.16)}
    .preview{aspect-ratio:4/3;background:#0b0d12;border-bottom:1px solid var(--line)}.preview svg{display:block;width:100%;height:100%}
    .card-body{padding:20px}.eyebrow{display:flex;justify-content:space-between;color:var(--accent);font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.eyebrow span{color:#697182}
    h2{margin:14px 0 8px;font-size:22px;letter-spacing:-.025em}.formula{display:block;min-height:42px;color:#a8afbd;background:transparent;white-space:normal;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
    .actions{display:flex;gap:8px;margin-top:18px}button{flex:1;min-height:42px;border:1px solid color-mix(in srgb,var(--accent) 55%,#283040);border-radius:10px;color:#091014;background:var(--accent);font:650 13px/1 inherit;cursor:pointer;transition:transform .15s ease,filter .15s ease}button:hover{filter:brightness(1.08);transform:translateY(-1px)}button:active{transform:translateY(0)}button.secondary{color:#dce1ea;background:#202530;border-color:#343b4a}button.copied{color:#08110e;background:#72e3b9;border-color:#72e3b9}
    .toast{position:fixed;right:22px;bottom:22px;z-index:3;padding:12px 15px;border:1px solid #3b4557;border-radius:11px;color:#eef1f7;background:#1a202b;box-shadow:0 12px 40px rgba(0,0,0,.35);opacity:0;transform:translateY(10px);pointer-events:none;transition:.2s ease}.toast.show{opacity:1;transform:none}
    footer{max-width:1480px;margin:auto;padding:0 28px 48px;color:#676e7d;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
    @media(max-width:1000px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){header{padding-top:48px}main{grid-template-columns:1fr;padding-inline:16px}header,footer{padding-inline:20px}.card-body{padding:18px}}
  </style>
</head>
<body>
  <header>
    <p class="kicker">Deterministic SVG / ${templates.length} base systems</p>
    <h1>${escapeHtml(catalog.title)}</h1>
    <p>${escapeHtml(catalog.description)}。每张图都由明确公式和参数生成；点击按钮可直接复制完整 SVG 或对应场景 JSON。</p>
    <div class="legend"><span>旋转曲面</span><span>投影射线</span><span>三维轨道</span><span>矩阵重复</span><span>解析形变网格</span><span>分层网格</span><span>向量场线</span><span>参数曲线</span><span>三维螺旋</span></div>
  </header>
  <main>${cards}
  </main>
  <footer>Same scene JSON + same seed = byte-identical SVG. No raster tracing and no image-generation model.</footer>
  <div class="toast" role="status" aria-live="polite">已复制</div>
  <script>
    const templates = ${safeJson(payload)};
    const toast = document.querySelector('.toast');
    let toastTimer;
    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly',''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      const ok = document.execCommand('copy'); area.remove();
      if (!ok) throw new Error('copy failed');
    }
    document.addEventListener('click', async event => {
      const button = event.target.closest('button[data-id]');
      if (!button) return;
      const value = templates[button.dataset.id][button.dataset.kind];
      try {
        await copyText(value);
        const original = button.textContent;
        button.textContent = '已复制'; button.classList.add('copied');
        toast.textContent = button.dataset.kind === 'svg' ? 'SVG 代码已复制' : '参数 JSON 已复制';
        toast.classList.add('show'); clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
        setTimeout(() => { button.textContent = original; button.classList.remove('copied'); }, 1200);
      } catch (error) {
        toast.textContent = '复制失败，请在浏览器中打开'; toast.classList.add('show');
      }
    });
  </script>
</body>
</html>
`;
}

async function buildPreview(catalog, templates, outputPath) {
  const sharp = loadSharp();
  const columns = 3;
  const cardWidth = 480;
  const cardHeight = 390;
  const headerHeight = 130;
  const rows = Math.ceil(templates.length / columns);
  const width = columns * cardWidth;
  const height = headerHeight + rows * cardHeight;
  const cards = templates.map((template, index) => {
    const x = (index % columns) * cardWidth;
    const y = headerHeight + Math.floor(index / columns) * cardHeight;
    const data = Buffer.from(template.svg).toString('base64');
    return `<g transform="translate(${x} ${y})"><rect x="12" y="10" width="456" height="366" rx="14" fill="#171a23" stroke="#2b3040"/><image x="22" y="20" width="436" height="327" href="data:image/svg+xml;base64,${data}"/><text x="24" y="366" fill="#f1f3f7" font-family="Arial,sans-serif" font-size="16">${String(index + 1).padStart(2, '0')}  ${escapeHtml(template.title)}</text><text x="452" y="366" text-anchor="end" fill="${escapeHtml(template.accent)}" font-family="Arial,sans-serif" font-size="12">${escapeHtml(template.familyLabel)}</text></g>`;
  }).join('');
  const familyCount = new Set(templates.map(item => item.scene.family)).size;
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0d0f14"/><text x="24" y="48" fill="#f4f5f8" font-family="Arial,sans-serif" font-size="28" font-weight="700">${escapeHtml(catalog.title)}</text><text x="24" y="78" fill="#9299a8" font-family="Arial,sans-serif" font-size="15">${escapeHtml(catalog.description)}</text><text x="24" y="105" fill="#687083" font-family="monospace" font-size="12">${familyCount} mathematical families · deterministic SVG</text>${cards}</svg>`;
  await sharp(Buffer.from(sheet)).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);
}

async function buildGallery(catalogPath, outputDirectory) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(catalog.templates) || catalog.templates.length < 1) throw new Error('Catalog must contain at least one template');
  const ids = new Set(catalog.templates.map(item => item.id));
  if (ids.size !== catalog.templates.length) throw new Error('Template IDs must be unique');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const templateRoot = path.join(outputDirectory, 'templates');
  const templates = catalog.templates.map(item => {
    if (item.scene.variants?.count !== 1) throw new Error(`${item.id}: gallery template must render exactly one variant`);
    const directory = path.join(templateRoot, item.id);
    const manifest = generate(item.scene, directory);
    const svgPath = path.join(directory, manifest.items[0].svg);
    return { ...item, svg: fs.readFileSync(svgPath, 'utf8') };
  });
  const htmlPath = path.join(outputDirectory, 'index.html');
  const previewPath = path.join(outputDirectory, 'template-gallery-preview.png');
  fs.writeFileSync(htmlPath, buildHtml(catalog, templates));
  await buildPreview(catalog, templates, previewPath);
  const manifest = {
    version: 1,
    title: catalog.title,
    templateCount: templates.length,
    families: [...new Set(templates.map(item => item.scene.family))],
    catalogFingerprint: hashSeed(stableStringify(catalog)),
    html: path.basename(htmlPath),
    preview: path.basename(previewPath),
    templates: templates.map(item => ({ id: item.id, title: item.title, family: item.scene.family, scene: `templates/${item.id}/${item.id}-01.json`, svg: `templates/${item.id}/${item.id}-01.svg` }))
  };
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { htmlPath, previewPath };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  buildGallery(args.catalogPath, args.outputDirectory)
    .then(result => process.stdout.write(`${result.htmlPath}\n${result.previewPath}\n`))
    .catch(error => { process.stderr.write(`build-template-gallery: ${error.message}\n`); process.exitCode = 1; });
}

module.exports = { buildGallery };
