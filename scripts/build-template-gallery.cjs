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

function inlineSvg(svg, className) {
  const markup = svg.replace(/^<\?xml[^>]*>\s*/i, '');
  return className ? markup.replace('<svg ', `<svg class="${className}" preserveAspectRatio="xMidYMid meet" `) : markup;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function buildHtml(catalog, templates) {
  const initialTemplate = templates[0];
  const templateButtons = templates.map((template, index) => `
        <button class="template-option${index === 0 ? ' is-active' : ''}" style="--template-accent:${escapeHtml(template.accent)}" type="button" data-template-id="${escapeHtml(template.id)}" aria-label="${escapeHtml(template.title)}" title="${escapeHtml(template.title)}" aria-pressed="${index === 0}">${inlineSvg(template.svg, 'template-thumbnail')}</button>`).join('');
  const payload = Object.fromEntries(templates.map(template => [template.id, {
    svg: template.svg,
    scene: JSON.stringify(template.scene, null, 2),
    title: template.title,
    familyLabel: template.familyLabel,
    formula: template.formula,
    accent: template.accent
  }]));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(catalog.title)}</title>
  <style>
    :root{color-scheme:dark;--page:#090c10;--surface:#11161c;--surface-raised:#171d25;--stage:#0f141a;--line:#252d37;--text:#f4f7f9;--muted:#87919e;--ease-out:cubic-bezier(.23,1,.32,1)}
    *{box-sizing:border-box}html,body{min-height:100%;background:var(--page)}body{margin:0;overflow:hidden;color:var(--text);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input{font:inherit}
    .workbench{--left-width:224px;--right-width:300px;--active-accent:${escapeHtml(initialTemplate.accent)};display:grid;grid-template-columns:var(--left-width) minmax(0,1fr) var(--right-width);gap:12px;height:100dvh;padding:12px;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--active-accent) 7%,transparent),transparent 42%),var(--page);transition:grid-template-columns 220ms var(--ease-out)}.workbench.left-collapsed{--left-width:62px}.workbench.right-collapsed{--right-width:62px}
    .sidebar,.workspace{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 18px 55px rgba(0,0,0,.24)}.sidebar{display:flex;min-height:0;flex-direction:column}.panel-header{display:flex;min-height:64px;align-items:center;justify-content:space-between;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line)}.library-panel>.panel-header{justify-content:flex-end;padding-left:12px}.panel-title{min-width:0}.panel-title p{margin:0 0 4px;color:var(--muted);font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}.panel-title h1,.panel-title h2{margin:0;overflow:hidden;font-size:15px;line-height:1.2;letter-spacing:-.015em;white-space:nowrap;text-overflow:ellipsis}
    .icon-button{display:grid;width:40px;height:40px;flex:none;place-items:center;border:1px solid var(--line);border-radius:11px;color:#cbd3dc;background:#171d24;cursor:pointer;touch-action:manipulation;transition:transform 140ms var(--ease-out),border-color 140ms ease,background-color 140ms ease}.icon-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transition:transform 180ms var(--ease-out)}.icon-button:active{transform:scale(.96)}.icon-button:focus-visible,.template-option:focus-visible,.action-button:focus-visible{outline:2px solid var(--active-accent);outline-offset:2px}.library-panel.is-collapsed .icon-button svg,.inspector-panel.is-collapsed .icon-button svg{transform:rotate(180deg)}
    .template-list{display:grid;min-height:0;flex:1;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:max-content;align-content:start;gap:8px;overflow:auto;padding:10px}.template-option{position:relative;display:block;width:100%;aspect-ratio:1;overflow:hidden;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--stage);cursor:pointer;touch-action:manipulation;transition:transform 140ms var(--ease-out),border-color 140ms ease,box-shadow 140ms ease}.template-option svg{display:block;width:100%;height:100%;pointer-events:none}.template-option svg>rect:first-child{fill:var(--stage)}.template-option svg path{stroke:color-mix(in srgb,var(--template-accent) 82%,white)}.template-option.is-active{border-color:color-mix(in srgb,var(--template-accent) 72%,white);box-shadow:0 0 0 2px color-mix(in srgb,var(--template-accent) 18%,transparent),0 8px 24px rgba(0,0,0,.24)}.template-option:active{transform:scale(.97)}
    .sidebar.is-collapsed .panel-header{justify-content:center;padding:11px}.sidebar.is-collapsed .panel-title,.sidebar.is-collapsed .template-list,.sidebar.is-collapsed .inspector-scroll,.sidebar.is-collapsed .inspector-footer{display:none}
    .workspace{display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--stage)}.stage-header,.stage-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px}.stage-header{border-bottom:1px solid var(--line)}.stage-heading{min-width:0}.stage-heading p{margin:0 0 5px;color:var(--active-accent);font:650 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}.stage-heading h2{margin:0;overflow:hidden;font-size:18px;letter-spacing:-.025em;white-space:nowrap;text-overflow:ellipsis}.stage-status{display:flex;align-items:center;gap:7px;color:#88939f;font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.stage-status::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--active-accent);box-shadow:0 0 9px var(--active-accent)}
    .stage-shell{position:relative;display:grid;min-height:0;overflow:hidden;place-items:center;padding:clamp(18px,4vw,52px);background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:32px 32px}.stage-shell::before,.stage-shell::after{content:"";position:absolute;z-index:0;background:rgba(255,255,255,.055);pointer-events:none}.stage-shell::before{top:50%;left:0;width:100%;height:1px}.stage-shell::after{top:0;left:50%;width:1px;height:100%}.stage-render{position:relative;z-index:1;width:min(100%,920px);max-height:100%;aspect-ratio:4/3;overflow:hidden;border:1px solid color-mix(in srgb,var(--active-accent) 24%,var(--line));border-radius:18px;background:var(--stage);box-shadow:0 24px 80px rgba(0,0,0,.34)}.stage-svg,.stage-svg svg,.mini-preview svg{display:block;width:100%;height:100%}.stage-svg svg>rect:first-child,.mini-preview svg>rect:first-child{fill:var(--stage)}.stage-svg svg path,.mini-preview svg path{stroke:color-mix(in srgb,var(--active-accent) 82%,white)}.stage-render.is-restarting .stage-svg{animation:preview-enter 520ms var(--ease-out) both}.stage-controls{position:absolute;top:12px;right:12px;z-index:3;display:flex;align-items:center;gap:8px}.stage-refresh{width:38px;height:38px;border-color:color-mix(in srgb,var(--active-accent) 30%,var(--line));background:rgba(15,20,26,.82);backdrop-filter:blur(10px)}.stage-view-button{min-height:38px;padding:0 12px;border:1px solid color-mix(in srgb,var(--active-accent) 30%,var(--line));border-radius:10px;color:#cbd3dc;background:rgba(15,20,26,.82);font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;backdrop-filter:blur(10px)}.stage-view-button.is-active{border-color:var(--active-accent);color:#08110e;background:var(--active-accent)}.stage-view-button:focus-visible{outline:2px solid var(--active-accent);outline-offset:2px}.parametric-animation{position:absolute;inset:0;display:block;width:100%;height:100%;opacity:0}.parametric-animation[hidden]{display:none}.preview.is-animated.show-animation .stage-svg{visibility:hidden}.preview.is-animated.show-animation .parametric-animation{opacity:1}.stage-footer{min-height:56px;border-top:1px solid var(--line);color:#7f8995}.stage-footer code{overflow:hidden;color:#adb6c1;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;text-overflow:ellipsis}.stage-zoom{flex:none;padding:6px 9px;border:1px solid var(--line);border-radius:8px;color:#7f8995;font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:#151b22}@keyframes preview-enter{from{opacity:0;transform:scale(.975)}to{opacity:1;transform:none}}
    .inspector-scroll{min-height:0;flex:1;overflow:auto;padding:14px}.section-label{margin:0 0 8px;color:#75818e;font:650 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}.mini-preview{aspect-ratio:4/3;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--stage)}.inspector-block{margin-top:14px;padding:13px;border:1px solid var(--line);border-radius:14px;background:#141a21}.meta-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.meta-row+.meta-row{margin-top:10px}.meta-row span{color:#77828f;font-size:11px}.meta-row strong,.meta-row code{max-width:65%;color:#d9dee4;font-size:11px;text-align:right}.meta-row strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.meta-row code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.45;overflow-wrap:anywhere}
    .animation-settings{display:grid;gap:12px;margin:0;padding:0;border:0}.animation-settings legend{margin:0 0 2px;padding:0;color:#75818e;font:650 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase}.toggle-setting,.animation-setting{color:#cbd1db;font-size:12px}.toggle-setting{display:flex;min-height:30px;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}.toggle-setting input{position:absolute;width:1px;height:1px;opacity:0}.switch{position:relative;width:34px;height:20px;flex:none;border:1px solid #485361;border-radius:999px;background:#262d36;transition:background-color 160ms ease,border-color 160ms ease}.switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#aeb7c2;transition:transform 180ms var(--ease-out),background-color 160ms ease}.toggle-setting input:checked+.switch{border-color:var(--active-accent);background:color-mix(in srgb,var(--active-accent) 22%,#222932)}.toggle-setting input:checked+.switch::after{background:var(--active-accent);transform:translateX(14px)}.toggle-setting input:focus-visible+.switch,.animation-setting input:focus-visible{outline:2px solid var(--active-accent);outline-offset:2px}.toggle-setting input:disabled+.switch{opacity:.45}.animation-setting{display:grid;gap:7px}.animation-setting>span{display:flex;justify-content:space-between}.animation-setting output{color:var(--active-accent);font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.animation-setting input{width:100%;height:18px;margin:0;accent-color:var(--active-accent);cursor:pointer}.view-reset-button{min-height:34px;border:1px solid #303945;border-radius:9px;color:#cbd3dc;background:#1b222b;font-size:11px;cursor:pointer}.view-reset-button:disabled{opacity:.42;cursor:default}.view-reset-button:focus-visible{outline:2px solid var(--active-accent);outline-offset:2px}.static-notice{margin:0;color:#7f8a96;font-size:11px;line-height:1.6}.inspector-footer{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-top:1px solid var(--line)}.action-button{min-height:42px;padding:0 12px;border:1px solid color-mix(in srgb,var(--active-accent) 40%,var(--line));border-radius:11px;color:#08110e;background:var(--active-accent);font-weight:700;cursor:pointer;touch-action:manipulation;transition:transform 140ms var(--ease-out),filter 140ms ease}.action-button.secondary{color:#dce2e8;background:#1b222b;border-color:#303945}.action-button:active{transform:scale(.98)}.action-button.copied{background:#72e3b9;border-color:#72e3b9}.toast{position:fixed;right:24px;bottom:24px;z-index:30;padding:11px 14px;border:1px solid #374250;border-radius:10px;color:#eef2f6;background:#171e27;box-shadow:0 14px 42px rgba(0,0,0,.38);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 180ms var(--ease-out),transform 180ms var(--ease-out)}.toast.show{opacity:1;transform:none}
    @media(hover:hover) and (pointer:fine){.icon-button:hover{border-color:#3a4552;background:#1a212a}.template-option:hover{border-color:color-mix(in srgb,var(--template-accent) 48%,white)}.action-button:hover{filter:brightness(1.08)}}
    @media(max-width:1080px){.workbench{--left-width:190px;--right-width:274px}.template-list{gap:7px;padding:8px}}
    @media(max-width:760px){body{overflow:auto}.workbench{display:block;min-height:100dvh;height:auto;padding:8px}.workspace{min-height:calc(100dvh - 16px)}.sidebar{position:fixed;z-index:20;top:8px;bottom:8px;width:min(300px,calc(100vw - 16px));transition:transform 220ms var(--ease-out)}.library-panel{left:8px}.inspector-panel{right:8px}.library-panel.is-collapsed{transform:translateX(calc(-100% + 52px))}.inspector-panel.is-collapsed{transform:translateX(calc(100% - 52px))}.sidebar.is-collapsed .panel-title,.sidebar.is-collapsed .template-list,.sidebar.is-collapsed .inspector-scroll,.sidebar.is-collapsed .inspector-footer{display:none}.sidebar.is-collapsed .panel-header{justify-content:flex-end}.inspector-panel.is-collapsed .panel-header{justify-content:flex-start}.stage-header,.stage-footer{padding-inline:60px}.stage-status,.stage-zoom{display:none}.stage-shell{min-height:62vh;padding:20px}.stage-render{width:100%}.stage-controls{right:52px}}
    @media(prefers-reduced-motion:reduce){.workbench,.sidebar,.icon-button,.template-option,.action-button,.toast,.switch,.switch::after{transition-duration:0ms}.stage-render.is-restarting .stage-svg{animation:none}}
  </style>
</head>
<body>
  <div class="workbench" style="--active-accent:${escapeHtml(initialTemplate.accent)}">
    <aside class="sidebar library-panel" aria-label="图形库">
      <div class="panel-header">
        <button class="icon-button" type="button" data-panel-toggle="library" aria-label="折叠图形库" title="折叠图形库" aria-expanded="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button>
      </div>
      <nav class="template-list" aria-label="选择参数化图形">${templateButtons}
      </nav>
    </aside>
    <main class="workspace">
      <header class="stage-header">
        <div class="stage-heading"><p data-active-family>${escapeHtml(initialTemplate.familyLabel)}</p><h2 data-active-title>${escapeHtml(initialTemplate.title)}</h2></div>
        <span class="stage-status">LIVE CANVAS</span>
      </header>
      <section class="stage-shell" aria-label="参数化图形调试区域">
        <div class="stage-render preview show-animation" data-stage>
          <div class="stage-svg" data-stage-svg>${inlineSvg(initialTemplate.svg)}</div>
          <canvas class="parametric-animation" data-animation="catenoid-field" aria-hidden="true"></canvas>
          <div class="stage-controls"><button class="stage-view-button" type="button" data-front-view aria-pressed="false">正视图</button><button class="icon-button stage-refresh" type="button" data-refresh-preview aria-label="重新播放入场动画" title="重新播放入场动画"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a6.5 6.5 0 1 0 .2 5.5M16 3v4h-4"/></svg></button></div>
        </div>
      </section>
      <footer class="stage-footer"><code data-active-formula>${escapeHtml(initialTemplate.formula)}</code><span class="stage-zoom">FIT · 100%</span></footer>
    </main>
    <aside class="sidebar inspector-panel" aria-label="图形调试面板">
      <div class="panel-header">
        <div class="panel-title"><p>Inspector</p><h2>预览与参数</h2></div>
        <button class="icon-button" type="button" data-panel-toggle="inspector" aria-label="折叠调试面板" title="折叠调试面板" aria-expanded="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>
      </div>
      <div class="inspector-scroll">
        <p class="section-label">当前图形</p>
        <div class="mini-preview" data-mini-preview>${inlineSvg(initialTemplate.svg)}</div>
        <div class="inspector-block">
          <div class="meta-row"><span>名称</span><strong data-meta-title>${escapeHtml(initialTemplate.title)}</strong></div>
          <div class="meta-row"><span>家族</span><strong data-meta-family>${escapeHtml(initialTemplate.familyLabel)}</strong></div>
          <div class="meta-row"><span>公式</span><code data-meta-formula>${escapeHtml(initialTemplate.formula)}</code></div>
        </div>
        <div class="inspector-block">
          <fieldset class="animation-settings view-settings">
            <legend>视角参数</legend>
            <label class="animation-setting"><span>俯仰 X <output data-view-output="0">默认</output></span><input type="range" data-view-axis="0" aria-label="俯仰 X" min="-90" max="90" step="1" value="0"></label>
            <label class="animation-setting"><span>水平 Y <output data-view-output="1">默认</output></span><input type="range" data-view-axis="1" aria-label="水平 Y" min="-180" max="180" step="1" value="0"></label>
            <label class="animation-setting"><span>滚转 Z <output data-view-output="2">默认</output></span><input type="range" data-view-axis="2" aria-label="滚转 Z" min="-180" max="180" step="1" value="0"></label>
            <button class="view-reset-button" type="button" data-reset-view disabled>恢复默认视角</button>
          </fieldset>
        </div>
        <div class="inspector-block" data-animation-only>
          <fieldset class="animation-settings">
            <legend>动画调试</legend>
            <label class="toggle-setting"><span>自动旋转</span><input type="checkbox" data-animation-setting="autoRotate" checked><span class="switch" aria-hidden="true"></span></label>
            <label class="toggle-setting"><span>鼠标跟随</span><input type="checkbox" data-animation-setting="pointerFollow" checked><span class="switch" aria-hidden="true"></span></label>
            <label class="animation-setting"><span>旋转速度 <output>1.0×</output></span><input type="range" data-animation-setting="rotationSpeed" min="0" max="200" step="10" value="100"></label>
            <label class="animation-setting"><span>圆环速度 <output>1.0×</output></span><input type="range" data-animation-setting="cycleSpeed" min="0" max="200" step="10" value="100"></label>
          </fieldset>
        </div>
        <div class="inspector-block" data-generic-animation hidden><p class="static-notice">该动态图形根据自身几何家族使用确定性的运动与文字编排；刷新按钮可重新播放入场。</p></div>
      </div>
      <footer class="inspector-footer">
        <button class="action-button secondary" type="button" data-copy-kind="scene">复制参数</button>
        <button class="action-button" type="button" data-copy-kind="svg">复制 SVG</button>
      </footer>
    </aside>
  </div>
  <div class="toast" role="status" aria-live="polite">已复制</div>
  <script src="animations/definitions/spatial.js" defer></script>
  <script src="animations/definitions/arrays-grids.js" defer></script>
  <script src="animations/definitions/fields-curves.js" defer></script>
  <script src="animations/definitions/generated-shapes.js" defer></script>
  <script src="animations/wireframe-runtime.js" defer></script>
  <script src="animations/catenoid-field.js" defer></script>
  <script>
    const templates = ${safeJson(payload)};
    const workbench = document.querySelector('.workbench');
    const stage = document.querySelector('[data-stage]');
    const stageSvg = document.querySelector('[data-stage-svg]');
    const animationCanvas = document.querySelector('[data-animation]');
    const miniPreview = document.querySelector('[data-mini-preview]');
    const toast = document.querySelector('.toast');
    let activeTemplateId = ${safeJson(initialTemplate.id)};
    let viewRotation = null;
    let toastTimer;
    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly',''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      const ok = document.execCommand('copy'); area.remove();
      if (!ok) throw new Error('copy failed');
    }
    function destroyAnimation() {
      window.__parametricWireframesAnimations?.destroy(animationCanvas);
      window.__parametricWireframeRuntime?.destroy(animationCanvas);
    }
    function initializeAnimation(id, restart = false) {
      animationCanvas.dataset.animation = id;
      if (id === 'catenoid-field') {
        window.__parametricWireframesAnimations?.initialize();
        if (restart) animationCanvas.__catenoidFieldAnimation?.restart();
        animationCanvas.__catenoidFieldAnimation?.setViewRotation(viewRotation?.map(value => value * Math.PI / 180) ?? null);
      } else {
        window.__parametricWireframeRuntime?.initialize(animationCanvas);
        if (restart) animationCanvas.__wireframeAnimation?.restart();
        animationCanvas.__wireframeAnimation?.setViewRotation(viewRotation?.map(value => value * Math.PI / 180) ?? null);
      }
    }
    function applyViewRotation() {
      const radians = viewRotation?.map(value => value * Math.PI / 180) ?? null;
      if (activeTemplateId === 'catenoid-field') animationCanvas.__catenoidFieldAnimation?.setViewRotation(radians);
      else animationCanvas.__wireframeAnimation?.setViewRotation(radians);
      const button = document.querySelector('[data-front-view]');
      const frontView = viewRotation?.every(value => value === 0) ?? false;
      button.classList.toggle('is-active', frontView);
      button.setAttribute('aria-pressed', String(frontView));
      document.querySelector('[data-reset-view]').disabled = !viewRotation;
      document.querySelectorAll('[data-view-output]').forEach((output, index) => {
        output.value = viewRotation ? viewRotation[index] + '°' : '默认';
      });
      document.querySelectorAll('[data-animation-setting="autoRotate"],[data-animation-setting="pointerFollow"],[data-animation-setting="rotationSpeed"]').forEach(input => {
        input.disabled = Boolean(viewRotation);
      });
    }
    function toggleFrontView() {
      const frontView = viewRotation?.every(value => value === 0) ?? false;
      viewRotation = frontView ? null : [0, 0, 0];
      document.querySelectorAll('[data-view-axis]').forEach(input => { input.value = '0'; });
      applyViewRotation();
    }
    function restartPreview() {
      const template = templates[activeTemplateId];
      stageSvg.innerHTML = template.svg;
      stage.classList.remove('is-restarting');
      void stage.offsetWidth;
      stage.classList.add('is-restarting');
      if (activeTemplateId === 'catenoid-field') animationCanvas.__catenoidFieldAnimation?.restart();
      else animationCanvas.__wireframeAnimation?.restart();
    }
    function selectTemplate(id) {
      const template = templates[id];
      if (!template) return;
      destroyAnimation();
      activeTemplateId = id;
      workbench.style.setProperty('--active-accent', template.accent);
      stageSvg.innerHTML = template.svg;
      miniPreview.innerHTML = template.svg;
      stage.classList.add('show-animation');
      animationCanvas.hidden = false;
      document.querySelector('[data-animation-only]').hidden = id !== 'catenoid-field';
      document.querySelector('[data-generic-animation]').hidden = id === 'catenoid-field';
      document.querySelector('[data-active-title]').textContent = template.title;
      document.querySelector('[data-active-family]').textContent = template.familyLabel;
      document.querySelector('[data-active-formula]').textContent = template.formula;
      document.querySelector('[data-meta-title]').textContent = template.title;
      document.querySelector('[data-meta-family]').textContent = template.familyLabel;
      document.querySelector('[data-meta-formula]').textContent = template.formula;
      document.querySelectorAll('[data-template-id]').forEach(button => {
        const selected = button.dataset.templateId === id;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      initializeAnimation(id, true);
    }
    function setPanelCollapsed(name, collapsed) {
      const panel = document.querySelector(name === 'library' ? '.library-panel' : '.inspector-panel');
      panel.classList.toggle('is-collapsed', collapsed);
      workbench.classList.toggle(name === 'library' ? 'left-collapsed' : 'right-collapsed', collapsed);
      const toggle = panel.querySelector('[data-panel-toggle]');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? '展开面板' : '折叠面板');
      toggle.setAttribute('title', collapsed ? '展开面板' : '折叠面板');
    }
    document.addEventListener('click', async event => {
      if (event.target.closest('[data-front-view]')) {
        toggleFrontView();
        return;
      }
      if (event.target.closest('[data-refresh-preview]')) {
        restartPreview();
        return;
      }
      if (event.target.closest('[data-reset-view]')) {
        viewRotation = null;
        document.querySelectorAll('[data-view-axis]').forEach(input => { input.value = '0'; });
        applyViewRotation();
        return;
      }
      const templateButton = event.target.closest('[data-template-id]');
      if (templateButton) {
        selectTemplate(templateButton.dataset.templateId);
        if (window.matchMedia('(max-width: 760px)').matches) setPanelCollapsed('library', true);
        return;
      }
      const panelToggle = event.target.closest('[data-panel-toggle]');
      if (panelToggle) {
        const name = panelToggle.dataset.panelToggle;
        const panel = panelToggle.closest('.sidebar');
        const willCollapse = !panel.classList.contains('is-collapsed');
        setPanelCollapsed(name, willCollapse);
        if (!willCollapse && window.matchMedia('(max-width: 760px)').matches) {
          setPanelCollapsed(name === 'library' ? 'inspector' : 'library', true);
        }
        return;
      }
      const button = event.target.closest('[data-copy-kind]');
      if (!button) return;
      const kind = button.dataset.copyKind;
      const value = templates[activeTemplateId][kind];
      try {
        await copyText(value);
        const original = button.textContent;
        button.textContent = '已复制'; button.classList.add('copied');
        toast.textContent = kind === 'svg' ? 'SVG 代码已复制' : '参数 JSON 已复制';
        toast.classList.add('show'); clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
        setTimeout(() => { button.textContent = original; button.classList.remove('copied'); }, 1200);
      } catch (error) {
        toast.textContent = '复制失败，请在浏览器中打开'; toast.classList.add('show');
      }
    });
    document.addEventListener('input', event => {
      const input = event.target.closest('[data-view-axis]');
      if (!input) return;
      viewRotation ||= [0, 0, 0];
      viewRotation[Number(input.dataset.viewAxis)] = Number(input.value);
      applyViewRotation();
    });
    if (window.matchMedia('(max-width: 760px)').matches) {
      setPanelCollapsed('library', true);
      setPanelCollapsed('inspector', true);
    }
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
  fs.rmSync(templateRoot, { recursive: true, force: true });
  fs.mkdirSync(templateRoot, { recursive: true });
  const templates = catalog.templates.map(item => {
    if (item.scene.variants?.count !== 1) throw new Error(`${item.id}: gallery template must render exactly one variant`);
    const directory = path.join(templateRoot, item.id);
    const manifest = generate(item.scene, directory);
    const svgPath = path.join(directory, manifest.items[0].svg);
    return { ...item, svg: fs.readFileSync(svgPath, 'utf8') };
  });
  const htmlPath = path.join(outputDirectory, 'index.html');
  const previewPath = path.join(outputDirectory, 'template-gallery-preview.png');
  const animationDirectory = path.join(outputDirectory, 'animations');
  const animationSource = path.resolve(__dirname, '..', 'assets', 'animations');
  fs.rmSync(animationDirectory, { recursive: true, force: true });
  fs.cpSync(animationSource, animationDirectory, { recursive: true });
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
