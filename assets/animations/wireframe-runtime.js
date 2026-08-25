(() => {
  'use strict';

  const SELECTOR = 'canvas[data-animation]:not([data-animation="catenoid-field"])';
  const instances = new WeakMap();

  class WireframeAnimation {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.id = canvas.dataset.animation;
      this.definition = window.__parametricWireframeDefinitions?.[this.id];
      if (!this.context || !this.definition) return;

      this.preview = canvas.closest('.preview');
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduceMotion = this.motionQuery.matches;
      this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      this.abortController = new AbortController();
      this.width = 1;
      this.height = 1;
      this.visible = false;
      this.frame = 0;
      this.viewRotation = null;
      this.startedAt = performance.now();
      this.lastFrameAt = null;
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries[0]?.isIntersecting ?? false;
        this.visible ? this.start() : this.stop();
      }, { threshold: 0 });

      this.bindEvents();
      this.resizeObserver.observe(canvas);
      this.intersectionObserver.observe(canvas);
      this.resize();
      this.preview?.classList.add('is-animated');
      canvas.dataset.animationReady = 'true';
    }

    bindEvents() {
      const { signal } = this.abortController;
      this.motionQuery.addEventListener('change', event => {
        this.reduceMotion = event.matches;
        this.restart();
      }, { signal });
      if (this.finePointer) {
        this.canvas.addEventListener('pointermove', event => {
          if (this.reduceMotion) return;
          const bounds = this.canvas.getBoundingClientRect();
          this.pointer.targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
          this.pointer.targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        }, { signal });
        this.canvas.addEventListener('pointerleave', () => {
          this.pointer.targetX = 0;
          this.pointer.targetY = 0;
        }, { signal });
      }
      document.addEventListener('visibilitychange', () => {
        document.hidden ? this.stop() : this.start();
      }, { signal });
      window.addEventListener('pagehide', () => this.stop(), { once: true, signal });
    }

    render(now = performance.now(), delta = 0) {
      if (!this.context || this.width < 2 || this.height < 2) return;
      const elapsed = this.reduceMotion ? 0 : Math.max(0, now - this.startedAt);
      this.definition.draw({
        context: this.context,
        width: this.width,
        height: this.height,
        elapsed,
        delta,
        intro: this.reduceMotion ? 1 : Math.min(1, elapsed / 1200),
        reducedMotion: this.reduceMotion,
        pointer: this.reduceMotion || this.viewRotation ? { x: 0, y: 0 } : { x: this.pointer.x, y: this.pointer.y },
        frontView: Boolean(this.viewRotation?.every(value => value === 0)),
        viewRotation: this.viewRotation
      });
    }

    tick = now => {
      this.frame = 0;
      if (!this.visible || document.hidden || this.reduceMotion) return;
      const delta = this.lastFrameAt === null ? 0 : Math.min(64, now - this.lastFrameAt);
      this.lastFrameAt = now;
      this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.055;
      this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.055;
      this.render(now, delta);
      this.frame = requestAnimationFrame(this.tick);
    };

    resize() {
      if (!this.context) return;
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

    restart() {
      if (!this.context) return;
      this.stop();
      this.startedAt = performance.now();
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.resize();
      this.render(this.startedAt);
      this.start();
    }

    setFrontView(enabled) {
      this.setViewRotation(enabled ? [0, 0, 0] : null);
    }

    setViewRotation(rotation) {
      this.viewRotation = rotation ? rotation.map(Number) : null;
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.render();
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
      this.lastFrameAt = null;
    }

    destroy() {
      this.stop();
      this.abortController.abort();
      this.resizeObserver.disconnect();
      this.intersectionObserver.disconnect();
      instances.delete(this.canvas);
      delete this.canvas.__wireframeAnimation;
      delete this.canvas.dataset.animationReady;
    }
  }

  function initialize(canvas) {
    const canvases = canvas ? [canvas] : document.querySelectorAll(SELECTOR);
    canvases.forEach(item => {
      if (item.dataset.animation === 'catenoid-field' || instances.has(item)) return;
      const instance = new WireframeAnimation(item);
      if (!instance.context || !instance.definition) return;
      instances.set(item, instance);
      item.__wireframeAnimation = instance;
    });
  }

  function destroy(canvas) {
    instances.get(canvas)?.destroy();
  }

  window.__parametricWireframeRuntime = { initialize, destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(), { once: true });
  } else {
    initialize();
  }
})();
