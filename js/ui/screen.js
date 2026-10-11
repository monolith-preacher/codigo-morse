import { decode, isPrefix } from '../morse.js';
import { STATE } from '../keyer.js';

const TRACE_WINDOW = 4500;

class Trace {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.events = [];
    this.width = 0;
    this.height = 0;
    this.resize();
    new ResizeObserver(() => {
      this.resize();
      this.render(performance.now());
    }).observe(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  mark(on, kind) {
    const now = performance.now();
    this.events.push({ t: now, on, kind });
    const cutoff = now - TRACE_WINDOW * 2;
    while (this.events.length > 2 && this.events[1].t < cutoff) this.events.shift();
  }

  clear() {
    this.events = [];
    this.render(performance.now());
  }

  pulses(now) {
    const out = [];
    const open = {};
    for (const e of this.events) {
      if (e.on) open[e.kind] = e.t;
      else if (open[e.kind] != null) {
        out.push({ kind: e.kind, from: open[e.kind], to: e.t });
        open[e.kind] = null;
      }
    }
    for (const kind of Object.keys(open)) {
      if (open[kind] != null) out.push({ kind, from: open[kind], to: now, live: true });
    }
    return out;
  }

  render(now) {
    const { ctx, width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);

    const low = h - 7;
    const high = 7;
    const x = (t) => w - ((now - t) / TRACE_WINDOW) * w;

    ctx.strokeStyle = 'rgba(109, 255, 138, 0.08)';
    ctx.lineWidth = 1;
    const offset = now % 500;
    for (let t = now - offset; t > now - TRACE_WINDOW; t -= 500) {
      const px = Math.round(x(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 3);
      ctx.lineTo(px, h - 3);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(109, 255, 138, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, low + 0.5);
    ctx.lineTo(w, low + 0.5);
    ctx.stroke();

    let busy = false;
    for (const p of this.pulses(now)) {
      if (now - p.to > TRACE_WINDOW) continue;
      busy = true;
      const x1 = Math.max(0, x(p.from));
      const x2 = x(p.to);
      const color = p.kind === 'play' ? '255, 184, 74' : '109, 255, 138';
      ctx.fillStyle = `rgba(${color}, 0.16)`;
      ctx.fillRect(x1, high, Math.max(1, x2 - x1), low - high);
      ctx.strokeStyle = `rgba(${color}, 0.95)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(${color}, 0.8)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, low);
      ctx.lineTo(x1, high);
      ctx.lineTo(x2, high);
      ctx.lineTo(x2, low);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (p.live) busy = true;
    }
    return busy;
  }
}

export class Screen {
  constructor(root) {
    this.root = root;
    const q = (sel) => root.querySelector(sel);
    this.stateEl = q('[data-screen="state"]');
    this.speedEl = q('[data-screen="speed"]');
    this.profileEl = q('[data-screen="profile"]');
    this.seqEl = q('[data-screen="seq"]');
    this.preview = q('[data-screen="preview"]');
    this.previewChar = q('[data-screen="preview-char"]');
    this.previewTag = q('[data-screen="preview-tag"]');
    this.meter = q('[data-screen="meter"]');
    this.meterFill = q('[data-screen="meter-fill"]');
    this.markA = q('[data-screen="mark-a"]');
    this.markB = q('[data-screen="mark-b"]');
    this.msgLabel = q('[data-screen="msg-label"]');
    this.msgBox = q('[data-screen="msg"]');
    this.msgText = q('[data-screen="msg-text"]');
    this.trace = new Trace(q('[data-screen="trace"]'));
    this.rejectTimer = 0;
    this.meterKey = '';
  }

  setStatus(text, tone = '') {
    if (this.stateEl.textContent !== text) this.stateEl.textContent = text;
    this.stateEl.dataset.tone = tone;
  }

  setHead({ wpm, profile }) {
    this.speedEl.textContent = `${String(wpm).padStart(2, '0')} WPM`;
    this.profileEl.textContent = profile;
  }

  setLabel(text) {
    this.msgLabel.textContent = text;
  }

  renderElements(code) {
    this.seqEl.replaceChildren(
      ...[...code].map((el) => {
        const i = document.createElement('i');
        i.className = el === '.' ? 'dot' : el === '-' ? 'dash' : 'gap';
        return i;
      })
    );
  }

  setSequence(code) {
    clearTimeout(this.rejectTimer);
    this.renderElements(code);
    this.seqEl.classList.remove('is-rejected');
    let state = '';
    let char = '';
    let tag = '';
    if (code) {
      const ch = decode(code);
      if (ch) {
        state = 'pending';
        char = ch;
        tag = 'NÃO CONFIRMADO';
      } else if (isPrefix(code)) {
        state = 'partial';
        char = '…';
        tag = 'INCOMPLETO';
      } else {
        state = 'invalid';
        char = '?';
        tag = 'SEM CORRESPONDÊNCIA';
      }
    }
    this.preview.dataset.state = state;
    this.previewChar.textContent = char;
    this.previewTag.textContent = tag;
  }

  // Mostra códigos completos separados por pausa de letra (usado na recepção).
  showCodes(codes) {
    clearTimeout(this.rejectTimer);
    this.renderElements(codes.join(' '));
    this.preview.dataset.state = '';
    this.previewChar.textContent = '';
    this.previewTag.textContent = '';
  }

  flashInvalid(code) {
    this.renderElements(code);
    this.seqEl.classList.add('is-rejected');
    this.preview.dataset.state = 'rejected';
    this.previewChar.textContent = '✕';
    this.previewTag.textContent = 'SEQUÊNCIA INVÁLIDA';
    this.root.classList.remove('is-glitch');
    void this.root.offsetWidth;
    this.root.classList.add('is-glitch');
    clearTimeout(this.rejectTimer);
    this.rejectTimer = setTimeout(() => this.setSequence(''), 1600);
  }

  // parts: string ou [{ text, cls }]
  setMessage(parts, animateLast = false) {
    const list = typeof parts === 'string' ? [...parts].map((text) => ({ text })) : parts;
    const nodes = list.map((p, i) => {
      const span = document.createElement('span');
      span.textContent = p.text;
      if (p.cls) span.className = p.cls;
      if (animateLast && i === list.length - 1) span.classList.add('is-new');
      return span;
    });
    this.msgText.replaceChildren(...nodes);
    this.msgBox.scrollTop = this.msgBox.scrollHeight;
  }

  renderMeter(snap) {
    const { state, timing } = snap;
    let mode = 'idle';
    let fill = 0;
    let a = null;
    let b = null;

    if (state === STATE.DOWN) {
      mode = snap.press >= snap.threshold ? 'press dash' : 'press';
      const max = snap.threshold * 2.2;
      fill = snap.press / max;
      a = { pos: snap.threshold / max, label: 'TRAÇO' };
    } else if (state === STATE.ELEMENT_GAP || state === STATE.CHAR_GAP) {
      mode = state === STATE.CHAR_GAP ? 'gap char' : 'gap';
      const max = timing.wordGap * 1.12;
      fill = snap.silence / max;
      a = { pos: timing.charGap / max, label: 'LETRA' };
      b = { pos: timing.wordGap / max, label: 'PALAVRA' };
    }

    this.meter.dataset.mode = mode;
    this.meterFill.style.transform = `scaleX(${Math.min(1, Math.max(0, fill)).toFixed(4)})`;
    const key = `${mode}|${a?.pos.toFixed(3)}|${b?.pos.toFixed(3)}`;
    if (key === this.meterKey) return;
    this.meterKey = key;
    for (const [el, mark] of [[this.markA, a], [this.markB, b]]) {
      el.hidden = !mark;
      if (!mark) continue;
      el.style.left = `${(mark.pos * 100).toFixed(2)}%`;
      el.firstElementChild.textContent = mark.label;
    }
  }

  frame(snap, now) {
    this.renderMeter(snap);
    return this.trace.render(now);
  }

  reset() {
    this.setSequence('');
    this.setMessage('');
    this.trace.clear();
  }

  degauss() {
    this.root.classList.remove('is-degauss');
    void this.root.offsetWidth;
    this.root.classList.add('is-degauss');
  }
}
