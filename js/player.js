import { encodeText } from './morse.js';
import { buildTimeline } from './timing.js';

const LEAD = 0.06;

export class Player {
  constructor(audio, getTiming) {
    this.audio = audio;
    this.getTiming = getTiming;
    this.current = null;
  }

  get active() {
    return this.current !== null;
  }

  play(text, handlers = {}) {
    this.stop();
    const timeline = buildTimeline(encodeText(text), this.getTiming());
    if (!timeline.elements.length) return Promise.resolve({ stopped: false });

    const latency = this.audio.schedule(timeline.elements, LEAD);
    const start = performance.now() + (LEAD + latency) * 1000;

    return new Promise((resolve) => {
      const run = { handlers, resolve, timeline, start, index: 0, on: false, raf: 0 };
      this.current = run;
      handlers.onStart?.(timeline);

      const tick = () => {
        if (this.current !== run) return;
        const t = performance.now() - start;
        const { elements } = timeline;

        while (run.index < elements.length) {
          const el = elements[run.index];
          if (!run.on && t >= el.start) {
            run.on = true;
            handlers.onElement?.(true, el);
          }
          if (run.on && t >= el.end) {
            run.on = false;
            handlers.onElement?.(false, el);
            run.index++;
            continue;
          }
          break;
        }

        if (run.index >= elements.length) {
          this.current = null;
          handlers.onEnd?.({ stopped: false });
          resolve({ stopped: false });
          return;
        }
        run.raf = requestAnimationFrame(tick);
      };

      run.raf = requestAnimationFrame(tick);
    });
  }

  stop() {
    const run = this.current;
    if (!run) return;
    this.current = null;
    cancelAnimationFrame(run.raf);
    this.audio.stopScheduled();
    if (run.on) run.handlers.onElement?.(false, run.timeline.elements[run.index]);
    run.handlers.onEnd?.({ stopped: true });
    run.resolve({ stopped: true });
  }
}
