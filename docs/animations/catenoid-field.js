(() => {
  'use strict';

  const SELECTOR = 'canvas[data-animation="catenoid-field"]';
  const TAU = Math.PI * 2;
  const PATH_REVEAL_MS = 1200;
  const PATH_STAGGER_MS = 40;
  const RING_CYCLE_MS = 5600;
  const DATA_PULSE_DELAY_MS = 900;
  const HYPER_CYCLE_MS = 4200;
  const HYPER_ACTIVE_MS = 650;
  const HYPER_GLYPHS = '01<>/{}[]+-=';
  const POINTER_EASE = 0.055;
  const ACCENT = '#77e1ca';
  const SECONDARY = '#a98bff';
  const BACKGROUND = '#0f141a';

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function easeInOut(value) {
    return -(Math.cos(Math.PI * clamp(value)) - 1) / 2;
  }

  function rgba(hex, alpha) {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
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

  class CatenoidFieldAnimation {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      if (!this.context) return;

      this.preview = canvas.closest('.preview');
      this.workspace = canvas.closest('.workbench') || this.preview;
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduceMotion = this.motionQuery.matches;
      this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      this.abortController = new AbortController();
      this.width = 1;
      this.height = 1;
      this.frame = 0;
      this.visible = false;
      this.introStart = null;
      this.lastFrameTime = null;
      this.autoYaw = 0;
      this.cycleElapsed = 0;
      this.rotation = { pitch: 0, yaw: 0, targetPitch: 0, targetYaw: 0 };
      this.settings = {
        autoRotate: true,
        pointerFollow: true,
        rotationSpeed: 1,
        cycleSpeed: 1
      };
      this.paths = this.createPaths();
      this.dataPulses = this.createDataPulses();

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.intersectionObserver = new IntersectionObserver(entries => {
        const visible = entries[0].isIntersecting;
        if (visible && this.introStart === null) this.introStart = performance.now();
        this.visible = visible;
        visible ? this.start() : this.stop();
      }, { threshold: 0 });

      this.bindEvents();
      this.resizeObserver.observe(this.canvas);
      this.intersectionObserver.observe(this.canvas);
      this.resize();
      this.preview?.classList.add('is-animated');
      this.canvas.dataset.animationReady = 'true';
    }

    createPaths() {
      const rings = Array.from({ length: 12 }, (_, index) => index === 0 || index === 11
        ? { type: 'ring', fixedV: index === 0 ? -1 : 1, segments: 120 }
        : { type: 'ring', phase: (index - 0.5) / 10, segments: 120 });
      const meridians = Array.from({ length: 17 }, (_, index) => ({
        type: 'meridian',
        u: (index / 17) * TAU,
        segments: 90
      }));
      return [...rings, ...meridians];
    }

    createDataPulses() {
      const random = seededRandom(1201);
      return Array.from({ length: 8 }, (_, index) => ({
        index,
        period: 1700 + Math.round(random() * 900),
        visibleFor: 280 + Math.round(random() * 180),
        offset: Math.round(random() * 1500),
        activation: -1,
        position: null
      }));
    }

    bindEvents() {
      const { signal } = this.abortController;
      this.workspace?.querySelectorAll('[data-animation-setting]').forEach(input => {
        const updateSetting = () => {
          const setting = input.dataset.animationSetting;
          this.settings[setting] = input.type === 'checkbox'
            ? input.checked
            : Number(input.value) / 100;
          if (setting === 'pointerFollow' && !this.settings.pointerFollow) {
            this.rotation.targetPitch = 0;
            this.rotation.targetYaw = 0;
          }
          const output = input.closest('.animation-setting')?.querySelector('output');
          if (output) output.value = `${this.settings[setting].toFixed(1)}×`;
        };
        if (this.reduceMotion) input.disabled = true;
        input.addEventListener('input', updateSetting, { signal });
        updateSetting();
      });
      this.motionQuery.addEventListener('change', event => {
        this.reduceMotion = event.matches;
        this.workspace?.querySelectorAll('[data-animation-setting]').forEach(input => { input.disabled = event.matches; });
        this.restart();
      }, { signal });
      if (this.finePointer && !this.reduceMotion) {
        this.canvas.addEventListener('pointermove', event => {
          const bounds = this.canvas.getBoundingClientRect();
          if (this.settings.pointerFollow) {
            this.rotation.targetYaw = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.55;
            this.rotation.targetPitch = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.3;
          }
        }, { signal });
        this.canvas.addEventListener('pointerleave', () => {
          this.rotation.targetYaw = 0;
          this.rotation.targetPitch = 0;
        }, { signal });
      }
      document.addEventListener('visibilitychange', () => {
        document.hidden ? this.stop() : this.start();
      }, { signal });
      window.addEventListener('pagehide', () => this.stop(), { once: true, signal });
    }

    profileRadius(v) {
      const magnitude = Math.abs(v);
      const normalized = (Math.cosh(1.9 * magnitude) - 1) / (Math.cosh(1.9) - 1);
      return 0.11 + (0.94 - 0.11) * normalized;
    }

    surfacePoint(u, v) {
      const radius = this.profileRadius(v);
      const point = [radius * Math.cos(u), 1.08 * v, radius * Math.sin(u)];
      const rotation = [
        0.36 + this.rotation.pitch,
        this.autoYaw + this.rotation.yaw,
        0
      ];
      const [x, y, z] = rotate3D(point, rotation);
      const perspective = 1 + z * 0.1;
      const scale = Math.min(this.width, this.height) * 0.29;
      return {
        x: this.width * 0.5 + x * perspective * scale,
        y: this.height * 0.5 + y * perspective * scale,
        z
      };
    }

    ringProgress(path) {
      return this.reduceMotion
        ? path.phase
        : (path.phase + this.cycleElapsed / RING_CYCLE_MS) % 1;
    }

    ringV(path, progress) {
      return path.fixedV ?? (-0.9 + progress * 1.8);
    }

    samplePath(path, ringProgress) {
      const points = [];
      for (let index = 0; index <= path.segments; index += 1) {
        const progress = index / path.segments;
        points.push(path.type === 'ring'
          ? this.surfacePoint(progress * TAU, this.ringV(path, ringProgress))
          : this.surfacePoint(path.u, -1 + progress * 2));
      }
      return points;
    }

    pathReveal(index, now) {
      if (this.reduceMotion || this.introStart === null) return 1;
      return easeInOut((now - this.introStart - index * PATH_STAGGER_MS) / PATH_REVEAL_MS);
    }

    drawPath(points, reveal, opacity, lineWidth) {
      if (reveal <= 0) return;
      const context = this.context;
      const finalIndex = Math.max(1, Math.ceil((points.length - 1) * reveal));
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index <= finalIndex; index += 1) {
        context.lineTo(points[index].x, points[index].y);
      }
      context.lineWidth = lineWidth;
      context.strokeStyle = rgba(ACCENT, opacity);
      context.stroke();
    }

    hyperText(label, index) {
      if (this.reduceMotion) return label;
      const local = (this.cycleElapsed + index * 940) % HYPER_CYCLE_MS;
      if (local >= HYPER_ACTIVE_MS) return label;
      const settled = Math.floor((local / HYPER_ACTIVE_MS) * label.length);
      return Array.from(label, (character, characterIndex) => {
        if (characterIndex < settled || character === ' ') return character;
        const glyphIndex = Math.floor(local / 55 + characterIndex * 3 + index * 5) % HYPER_GLYPHS.length;
        return HYPER_GLYPHS[glyphIndex];
      }).join('');
    }

    drawTextTicker(context, fontSize) {
      const label = 'SAMPLE · PROJECT · ROTATE · VERIFY · ';
      if (this.reduceMotion) {
        context.save();
        context.translate(this.width * 0.955, this.height * 0.23);
        context.rotate(Math.PI / 2);
        context.fillText(label, 0, 0);
        context.restore();
        return;
      }
      const startY = this.height * 0.2;
      const trackLength = this.height * 0.6;
      const repeatWidth = context.measureText(label).width + fontSize * 3;
      const offset = (this.cycleElapsed * 0.018) % repeatWidth;
      context.save();
      context.beginPath();
      context.rect(this.width * 0.93, startY, this.width * 0.06, trackLength);
      context.clip();
      context.translate(this.width * 0.955, startY);
      context.rotate(Math.PI / 2);
      for (let position = -offset - repeatWidth; position < trackLength + repeatWidth; position += repeatWidth) {
        context.fillText(label, position, 0);
      }
      context.restore();
    }

    drawDecorativeText() {
      const context = this.context;
      const compact = this.width < 520;
      const fontSize = compact ? 7 : 8;
      context.save();
      context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.fillStyle = rgba(ACCENT, 0.4);
      context.textBaseline = 'top';
      ['PARAMETRIC', 'RING / 12', 'SAMPLE / 120', 'CYCLE / ACTIVE'].forEach((label, index) => {
        context.fillText(this.hyperText(label, index), this.width * (compact ? 0.15 : 0.055), this.height * 0.25 + index * (fontSize + 4));
      });
      context.fillStyle = rgba(SECONDARY, 0.38);
      context.textAlign = compact ? 'left' : 'right';
      context.fillText('V / -1.00', this.width * (compact ? 0.15 : 0.24), this.height * 0.86);
      context.fillText('V / +1.00', this.width * (compact ? 0.68 : 0.94), this.height * 0.86);
      if (!compact) {
        context.textAlign = 'left';
        context.fillStyle = rgba(ACCENT, 0.34);
        this.drawTextTicker(context, fontSize);
      }
      context.restore();
    }

    samplePulsePosition(pulse, activation) {
      const random = seededRandom(1201 + pulse.index * 4099 + activation * 7919);
      const rings = this.paths.filter(path => path.type === 'ring' && path.fixedV === undefined);
      const ring = rings[Math.floor(random() * rings.length)];
      const meridian = Math.floor(random() * 17);
      const progress = this.ringProgress(ring);
      const v = this.ringV(ring, progress);
      return {
        ...this.surfacePoint((meridian / 17) * TAU, v),
        size: [14, 16, 18][Math.floor(random() * 3)]
      };
    }

    drawDataPulses(now) {
      if (this.reduceMotion || this.introStart === null || now - this.introStart < DATA_PULSE_DELAY_MS) return;
      const context = this.context;
      context.save();
      context.fillStyle = ACCENT;
      this.dataPulses.forEach(pulse => {
        const elapsed = this.cycleElapsed + pulse.offset;
        const activation = Math.floor(elapsed / pulse.period);
        if (elapsed % pulse.period >= pulse.visibleFor) return;
        if (pulse.activation !== activation || !pulse.position) {
          pulse.activation = activation;
          pulse.position = this.samplePulsePosition(pulse, activation);
        }
        const { x, y, size } = pulse.position;
        context.fillRect(x - size / 2, y - size / 2, size, size);
      });
      context.restore();
    }

    render(now = performance.now()) {
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      context.fillStyle = BACKGROUND;
      context.fillRect(0, 0, this.width, this.height);
      this.drawDecorativeText();

      const sampledPaths = this.paths.map((path, index) => {
        const movingRing = path.type === 'ring' && path.fixedV === undefined;
        const progress = movingRing ? this.ringProgress(path) : 0;
        const points = this.samplePath(path, progress);
        const averageDepth = points.reduce((sum, point) => sum + point.z, 0) / points.length;
        const edgeFade = Math.min(clamp(progress / 0.08), clamp((1 - progress) / 0.08));
        const edgeOpacity = movingRing ? 0.35 + edgeFade * 0.65 : 1;
        return { path, points, index, averageDepth, edgeOpacity, reveal: this.pathReveal(index, now) };
      }).sort((a, b) => a.averageDepth - b.averageDepth);

      sampledPaths.forEach(item => {
        const isRing = item.path.type === 'ring';
        const depthOpacity = isRing
          ? clamp(0.68 + (item.averageDepth + 1) * 0.14, 0.62, 0.96)
          : clamp(0.2 + (item.averageDepth + 1) * 0.12, 0.18, 0.46);
        this.drawPath(item.points, item.reveal, depthOpacity * item.edgeOpacity, isRing ? 1.15 : 0.85);
      });
      this.drawDataPulses(now);
    }

    tick = now => {
      this.frame = 0;
      if (!this.visible || document.hidden || this.reduceMotion) return;
      const delta = this.lastFrameTime === null ? 0 : Math.min(now - this.lastFrameTime, 64);
      this.lastFrameTime = now;
      if (this.settings.autoRotate) {
        this.autoYaw += delta * 0.00008 * this.settings.rotationSpeed;
      }
      this.cycleElapsed += delta * this.settings.cycleSpeed;
      this.rotation.pitch += (this.rotation.targetPitch - this.rotation.pitch) * POINTER_EASE;
      this.rotation.yaw += (this.rotation.targetYaw - this.rotation.yaw) * POINTER_EASE;
      this.render(now);
      this.frame = requestAnimationFrame(this.tick);
    };

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = bounds.width;
      this.height = bounds.height;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dataPulses.forEach(pulse => { pulse.activation = -1; pulse.position = null; });
      this.render();
    }

    restart() {
      if (!this.context) return;
      this.stop();
      this.introStart = performance.now();
      this.autoYaw = 0;
      this.cycleElapsed = 0;
      this.rotation = { pitch: 0, yaw: 0, targetPitch: 0, targetYaw: 0 };
      this.dataPulses.forEach(pulse => { pulse.activation = -1; pulse.position = null; });
      this.resize();
      this.render(this.introStart);
      this.start();
    }

    start() {
      if (!this.context || document.hidden) return;
      if (this.reduceMotion) {
        this.render();
        return;
      }
      if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    }

    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.lastFrameTime = null;
    }

    destroy() {
      this.stop();
      this.abortController.abort();
      this.resizeObserver.disconnect();
      this.intersectionObserver.disconnect();
    }
  }

  function initialize() {
    document.querySelectorAll(SELECTOR).forEach(canvas => {
      if (!canvas.__catenoidFieldAnimation) {
        canvas.__catenoidFieldAnimation = new CatenoidFieldAnimation(canvas);
      }
    });
  }

  window.__parametricWireframesAnimations = {
    initialize,
    destroy(canvas) {
      canvas.__catenoidFieldAnimation?.destroy();
      delete canvas.__catenoidFieldAnimation;
      delete canvas.dataset.animationReady;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
