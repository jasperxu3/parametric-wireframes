(() => {
  'use strict';

  const SELECTOR = 'canvas[data-animation="converging-helix-embed"]';
  const TAU = Math.PI * 2;
  const instances = new WeakMap();
  const defaults = {
    accent: '#83c9ff',
    amplitude: 0.52,
    amplitudeSpread: 0.15,
    background: 'transparent',
    compression: 1.22,
    dashGap: 8,
    dashLength: 5,
    decay: 1.05,
    lineWidth: 1,
    mirror: false,
    opacity: 0.86,
    phaseSpan: 4.8,
    rotation: [0, 0.01, 0],
    showDataSquares: true,
    speed: 1,
    strands: 7,
    turnSpread: 0.42,
    turns: 2.25
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  class ConvergingHelixAnimation {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      if (!this.context) return;
      this.options = { ...defaults, rotation: [...defaults.rotation] };
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery.matches;
      this.abortController = new AbortController();
      this.frame = 0;
      this.visible = false;
      this.width = 1;
      this.height = 1;
      this.elapsed = 0;
      this.introElapsed = 0;
      this.lastFrameAt = null;

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries[0]?.isIntersecting ?? false;
        this.visible ? this.start() : this.stop();
      });
      this.motionQuery.addEventListener('change', event => {
        this.reducedMotion = event.matches;
        this.restart();
      }, { signal: this.abortController.signal });
      document.addEventListener('visibilitychange', () => {
        document.hidden ? this.stop() : this.start();
      }, { signal: this.abortController.signal });
      this.resizeObserver.observe(canvas);
      this.intersectionObserver.observe(canvas);
      this.resize();
      canvas.dataset.animationReady = 'true';
    }

    point(strand, progress, rotationPhase) {
      const { amplitude, amplitudeSpread, compression, decay, mirror, phaseSpan, rotation, strands, turnSpread, turns } = this.options;
      const normalized = strands === 1 ? 0 : strand / (strands - 1) * 2 - 1;
      const strandPhase = normalized * phaseSpan * 0.5;
      const strandTurns = turns + normalized * turnSpread;
      const strandAmplitude = amplitude * (1 + Math.abs(normalized) * amplitudeSpread);
      const compressed = 1 - Math.pow(1 - progress, compression);
      const sourceX = -1 + 1.2 * compressed;
      const radius = strandAmplitude * Math.pow(1 - progress, decay);
      const angle = TAU * strandTurns * progress + strandPhase - rotationPhase;
      const [rotatedX, rotatedY, rotatedZ] = rotate3D([sourceX, radius * Math.cos(angle), radius * Math.sin(angle)], rotation);
      const perspective = 1 + rotatedZ * 0.03;
      return [(mirror ? -rotatedX : rotatedX) * perspective, rotatedY * perspective];
    }

    map([x, y]) {
      const padding = Math.min(this.width, this.height) * 0.08;
      const availableWidth = this.width - padding * 2;
      const availableHeight = this.height - padding * 2;
      const scale = Math.min(availableWidth / 1.5, availableHeight / 1.3);
      return [
        this.width * 0.5 + (x + (this.options.mirror ? 0.28 : -0.28)) * scale,
        this.height * 0.5 + y * scale
      ];
    }

    drawPath(points, reveal) {
      if (reveal <= 0) return;
      const finalIndex = Math.max(1, Math.ceil((points.length - 1) * reveal));
      const context = this.context;
      context.beginPath();
      context.moveTo(...this.map(points[0]));
      for (let index = 1; index <= finalIndex; index += 1) context.lineTo(...this.map(points[index]));
      context.lineWidth = this.options.lineWidth;
      context.lineCap = 'round';
      context.strokeStyle = this.options.accent;
      context.globalAlpha = this.options.opacity;
      context.setLineDash([this.options.dashLength, this.options.dashGap]);
      context.stroke();
    }

    drawDataSquares(rotationPhase) {
      if (this.reducedMotion || !this.options.showDataSquares) return;
      const context = this.context;
      context.setLineDash([]);
      context.globalAlpha = 1;
      context.fillStyle = this.options.accent;
      for (let index = 0; index < Math.min(4, this.options.strands); index += 1) {
        const period = 1950 + index * 170;
        if ((this.elapsed + index * 430) % period > 260) continue;
        const progress = 0.16 + index * 0.17;
        const [x, y] = this.map(this.point(index, progress, rotationPhase));
        const size = 7 + index % 2 * 2;
        context.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }

    render() {
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      if (this.options.background !== 'transparent') {
        context.globalAlpha = 1;
        context.fillStyle = this.options.background;
        context.fillRect(0, 0, this.width, this.height);
      }
      const rotationPhase = this.reducedMotion ? 0 : (this.elapsed % 8400) / 8400 * TAU;
      for (let strand = 0; strand < this.options.strands; strand += 1) {
        const points = [];
        for (let segment = 0; segment <= 260; segment += 1) points.push(this.point(strand, segment / 260, rotationPhase));
        const reveal = this.reducedMotion ? 1 : clamp((this.introElapsed - strand * 45) / 760, 0, 1);
        this.drawPath(points, 1 - Math.pow(1 - reveal, 3));
      }
      this.drawDataSquares(rotationPhase);
      context.globalAlpha = 1;
      context.setLineDash([]);
    }

    tick = now => {
      this.frame = 0;
      if (!this.visible || document.hidden || this.reducedMotion) return;
      const delta = this.lastFrameAt === null ? 0 : Math.min(64, now - this.lastFrameAt);
      this.lastFrameAt = now;
      this.elapsed += delta * this.options.speed;
      this.introElapsed += delta;
      this.render();
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
      this.render();
    }

    setOptions(options = {}) {
      const numeric = {
        amplitude: [0.05, 1.5], amplitudeSpread: [0, 1], compression: [0.2, 4], dashGap: [0.5, 40],
        dashLength: [0.5, 40], decay: [0.2, 4], lineWidth: [0.25, 8], opacity: [0, 1], phaseSpan: [0, 12],
        speed: [0, 4], strands: [1, 16], turnSpread: [0, 2], turns: [0.25, 8]
      };
      Object.entries(numeric).forEach(([key, range]) => {
        const value = Number(options[key]);
        if (Number.isFinite(value)) this.options[key] = key === 'strands'
          ? Math.round(clamp(value, range[0], range[1]))
          : clamp(value, range[0], range[1]);
      });
      if (typeof options.accent === 'string' && options.accent) this.options.accent = options.accent;
      if (typeof options.background === 'string' && options.background) this.options.background = options.background;
      if (typeof options.mirror === 'boolean') this.options.mirror = options.mirror;
      if (typeof options.showDataSquares === 'boolean') this.options.showDataSquares = options.showDataSquares;
      if (Array.isArray(options.rotation) && options.rotation.length === 3 && options.rotation.every(Number.isFinite)) {
        this.options.rotation = options.rotation.map(Number);
      }
      this.render();
    }

    restart() {
      this.stop();
      this.elapsed = 0;
      this.introElapsed = this.reducedMotion ? 1000 : 0;
      this.lastFrameAt = null;
      this.render();
      this.start();
    }

    start() {
      if (!this.context || document.hidden) return;
      if (this.reducedMotion) {
        this.render();
        return;
      }
      if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    }

    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.lastFrameAt = null;
    }

    destroy() {
      this.stop();
      this.abortController.abort();
      this.resizeObserver.disconnect();
      this.intersectionObserver.disconnect();
      instances.delete(this.canvas);
      delete this.canvas.__convergingHelixAnimation;
      delete this.canvas.dataset.animationReady;
    }
  }

  function initialize(canvas) {
    const canvases = canvas ? [canvas] : document.querySelectorAll(SELECTOR);
    canvases.forEach(item => {
      if (instances.has(item)) return;
      const instance = new ConvergingHelixAnimation(item);
      if (!instance.context) return;
      instances.set(item, instance);
      item.__convergingHelixAnimation = instance;
    });
  }

  function destroy(canvas) {
    instances.get(canvas)?.destroy();
  }

  window.__convergingHelixEmbed = { destroy, initialize };
})();
