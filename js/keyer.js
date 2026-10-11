import { decode } from './morse.js';
import { ElementClassifier } from './timing.js';

export const STATE = Object.freeze({
  IDLE: 'idle',
  DOWN: 'down',
  ELEMENT_GAP: 'element-gap',
  CHAR_GAP: 'char-gap',
  DISABLED: 'disabled'
});

// IDLE ──press──▶ DOWN ──release──▶ ELEMENT_GAP ──charGap──▶ CHAR_GAP ──wordGap──▶ IDLE
//                  ▲                     │                       │
//                  └──────── press ──────┴───────── press ───────┘
export class Keyer {
  constructor(getTiming, clock = {}) {
    this.getTiming = getTiming;
    this.now = clock.now ?? (() => performance.now());
    this.setTimer = clock.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = clock.clearTimeout ?? ((id) => clearTimeout(id));

    this.classifier = new ElementClassifier();
    this.listeners = new Map();
    this.state = STATE.IDLE;
    this.source = null;
    this.downAt = 0;
    this.upAt = 0;
    this.sequence = '';
    this.wordPending = false;
    this.timer = null;
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }

  emit(type, detail = {}) {
    this.listeners.get(type)?.forEach((fn) => fn(detail));
  }

  get isDown() {
    return this.state === STATE.DOWN;
  }

  get enabled() {
    return this.state !== STATE.DISABLED;
  }

  press(source) {
    if (this.state === STATE.DISABLED || this.state === STATE.DOWN) return false;
    this.cancelTimer();
    this.state = STATE.DOWN;
    this.source = source;
    this.downAt = this.now();
    this.emit('down', { source });
    return true;
  }

  release(source) {
    if (this.state !== STATE.DOWN || source !== this.source) return false;
    const now = this.now();
    const duration = now - this.downAt;
    const timing = this.getTiming();
    this.source = null;
    this.upAt = now;

    if (duration < timing.minPress) {
      this.emit('up', { duration, ignored: true });
      this.scheduleSilence();
      return true;
    }

    const element = this.classifier.classify(duration, timing);
    this.sequence += element;
    this.emit('up', { duration, element });
    this.emit('sequence', { sequence: this.sequence, element, duration });
    this.scheduleSilence();
    return true;
  }

  // Interrompe um acionamento sem gerar sinal (perda de foco, toque cancelado).
  cancel() {
    if (this.state !== STATE.DOWN) return false;
    this.source = null;
    this.upAt = this.now();
    this.emit('up', { duration: this.upAt - this.downAt, cancelled: true });
    this.scheduleSilence();
    return true;
  }

  removeLastElement() {
    if (this.state === STATE.DOWN || !this.sequence) return false;
    this.sequence = this.sequence.slice(0, -1);
    this.upAt = this.now();
    this.emit('sequence', { sequence: this.sequence, removed: true });
    this.scheduleSilence();
    return true;
  }

  reset() {
    const wasDown = this.state === STATE.DOWN;
    this.cancelTimer();
    if (wasDown) this.emit('up', { duration: this.now() - this.downAt, cancelled: true });
    this.source = null;
    this.sequence = '';
    this.wordPending = false;
    this.upAt = 0;
    if (this.state !== STATE.DISABLED) this.state = STATE.IDLE;
    this.emit('sequence', { sequence: '', reset: true });
  }

  setEnabled(enabled) {
    if (enabled === this.enabled) return;
    if (!enabled) {
      this.reset();
      this.state = STATE.DISABLED;
    } else {
      this.state = STATE.IDLE;
    }
  }

  recalibrate() {
    this.classifier.reset();
  }

  scheduleSilence() {
    this.cancelTimer();
    const timing = this.getTiming();
    const elapsed = this.now() - this.upAt;
    if (this.sequence) {
      this.state = STATE.ELEMENT_GAP;
      this.timer = this.setTimer(() => this.commitChar(), Math.max(0, timing.charGap - elapsed));
    } else if (this.wordPending) {
      this.state = STATE.CHAR_GAP;
      this.timer = this.setTimer(() => this.commitWord(), Math.max(0, timing.wordGap - elapsed));
    } else {
      this.state = STATE.IDLE;
    }
  }

  commitChar() {
    this.timer = null;
    const code = this.sequence;
    if (!code) return;
    this.sequence = '';
    this.wordPending = true;
    const char = decode(code);
    this.emit('sequence', { sequence: '' });
    this.emit('char', { char, code, valid: char !== null });
    this.scheduleSilence();
  }

  commitWord() {
    this.timer = null;
    this.wordPending = false;
    this.state = STATE.IDLE;
    this.emit('word');
  }

  cancelTimer() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  snapshot() {
    const now = this.now();
    const timing = this.getTiming();
    return {
      state: this.state,
      sequence: this.sequence,
      press: this.state === STATE.DOWN ? now - this.downAt : 0,
      silence: this.upAt ? now - this.upAt : 0,
      timing,
      threshold: this.classifier.threshold(timing)
    };
  }
}
