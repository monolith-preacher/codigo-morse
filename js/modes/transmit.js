import { STAGES, STAGE_GOAL, evaluateTransmission, pickChallenge } from '../exercises.js';
import { levelOverrides } from '../timing.js';
import { recordResult } from '../storage.js';
import { textMarksHTML, marksHTML } from '../ui/marks.js';
import { bindLevelSwitch, bindStageBar, renderScoreboard, renderStage } from '../ui/training.js';

const NEXT_DELAY = 1300;

export class TransmitTraining {
  constructor(ctx, root) {
    this.ctx = ctx;
    this.root = root;
    this.name = 'tx';
    this.usesKey = true;
    this.target = null;
    this.attempt = [];
    this.phase = 'idle';
    this.timer = 0;
    this.hintOpen = false;

    const q = (sel) => root.querySelector(sel);
    this.el = {
      target: q('[data-tx="target"]'),
      hint: q('[data-tx="hint"]'),
      feedback: q('[data-tx="feedback"]'),
      listen: q('[data-tx="listen"]'),
      hintBtn: q('[data-tx="hint-btn"]'),
      skip: q('[data-tx="skip"]'),
      score: q('[data-tx="score"]'),
      stage: q('[data-tx="stage"]')
    };

    this.renderLevel = bindLevelSwitch(q('[data-tx="levels"]'), (level) => ctx.setLevel(level));
    bindStageBar(this.el.stage, (dir) => this.moveStage(dir));
    this.el.listen.addEventListener('click', () => this.listen());
    this.el.hintBtn.addEventListener('click', () => {
      this.hintOpen = !this.hintOpen;
      this.renderHint();
    });
    this.el.skip.addEventListener('click', () => this.next());
  }

  get stats() {
    return this.ctx.stats.tx;
  }

  get level() {
    return this.ctx.settings.level;
  }

  timingOverrides() {
    return levelOverrides(this.level, this.ctx.settings.tolerance / 100);
  }

  tablePolicy() {
    return this.level === 'advanced' ? 'hidden' : 'show';
  }

  enter() {
    this.root.hidden = false;
    this.ctx.screen.setLabel('TX');
    this.onLevelChange();
    this.next();
  }

  exit() {
    clearTimeout(this.timer);
    this.root.hidden = true;
    this.phase = 'idle';
  }

  onLevelChange() {
    this.renderLevel(this.level);
    this.el.listen.hidden = this.level === 'advanced';
    this.el.hintBtn.hidden = this.level !== 'intermediate';
    this.renderHint();
    renderScoreboard(this.el.score, this.stats);
    renderStage(this.el.stage, this.stats);
  }

  moveStage(dir) {
    const stage = Math.min(STAGES.length - 1, Math.max(0, this.stats.stage + dir));
    if (stage === this.stats.stage) return;
    this.stats.stage = stage;
    this.ctx.saveStats();
    renderStage(this.el.stage, this.stats);
    this.next();
  }

  next({ keepKeyer = false } = {}) {
    clearTimeout(this.timer);
    this.ctx.stopPlayback();
    if (!keepKeyer) this.ctx.keyer.reset();
    this.target = pickChallenge(this.stats.stage, this.target);
    this.attempt = [];
    this.phase = 'await';
    this.hintOpen = false;
    this.el.target.textContent = this.target;
    this.el.target.classList.toggle('is-word', this.target.length > 1);
    this.el.target.dataset.result = '';
    this.setFeedback('');
    this.renderHint();
    this.renderAttempt(false);
  }

  renderHint() {
    if (!this.target) return;
    const show = this.level === 'beginner' || (this.level === 'intermediate' && this.hintOpen);
    this.el.hint.innerHTML = show ? textMarksHTML(this.target) : '';
    this.el.hint.hidden = !show;
    this.el.hintBtn.setAttribute('aria-pressed', String(this.hintOpen));
  }

  renderAttempt(animate) {
    const parts = this.attempt.map((a) => ({ text: a.char ?? '?', cls: a.char ? '' : 'is-bad' }));
    this.ctx.screen.setMessage(parts, animate);
  }

  setFeedback(html, tone = '') {
    this.el.feedback.innerHTML = html;
    this.el.feedback.dataset.tone = tone;
  }

  listen() {
    if (!this.target) return;
    this.ctx.transmit(this.target, { lamp: true, trace: true });
  }

  onKeyDown() {
    if (this.phase === 'done') {
      this.next({ keepKeyer: true });
    } else if (this.phase === 'retry') {
      this.attempt = [];
      this.phase = 'await';
      this.el.target.dataset.result = '';
      this.renderAttempt(false);
    }
  }

  onChar({ char, code }) {
    if (this.phase !== 'await') return;
    this.attempt.push({ char, code });
    this.renderAttempt(true);
    if (this.attempt.length >= this.target.length) this.evaluate();
  }

  onWord() {
    if (this.phase === 'await' && this.attempt.length) this.evaluate();
  }

  evaluate() {
    const result = evaluateTransmission(this.target, this.attempt);
    recordResult(this.stats, result.correct);
    this.el.target.dataset.result = result.correct ? 'ok' : 'err';

    if (result.correct) {
      this.phase = 'done';
      result.expected.forEach((x) => this.ctx.table.flash(x.char));
      let extra = '';
      const progress = this.stats.progress[String(this.stats.stage)] ?? 0;
      if (progress === STAGE_GOAL && this.stats.stage < STAGES.length - 1) {
        this.stats.stage++;
        extra = `<span class="fb-note">Etapa concluída. Avançando para ${STAGES[this.stats.stage].name}.</span>`;
      }
      this.setFeedback(
        `<strong>MESSAGE CONFIRMED</strong><span class="fb-code">${textMarksHTML(this.target)}</span>${extra}`,
        'ok'
      );
      this.ctx.flashStatus('MESSAGE CONFIRMED', 'ok');
      this.ctx.announce(`Correto: ${this.target}`);
      this.timer = setTimeout(() => this.next({ keepKeyer: true }), NEXT_DELAY + (extra ? 900 : 0));
    } else {
      this.phase = 'retry';
      const sent = `<span class="marks-line">${result.attempt.map((a) => marksHTML(a.code)).join('')}</span>`;
      const sentText = result.attempt.map((a) => a.char ?? '?').join('');
      this.setFeedback(
        `<strong>SIGNAL ERROR</strong>` +
          `<span class="fb-row"><em>ESPERADO</em><span class="fb-code">${textMarksHTML(this.target)}</span><b>${this.target}</b></span>` +
          `<span class="fb-row"><em>ENVIADO</em><span class="fb-code">${sent}</span><b>${sentText}</b></span>` +
          `<span class="fb-note">${result.reason} Transmita novamente.</span>`,
        'err'
      );
      this.ctx.flashStatus('SIGNAL ERROR', 'err');
      this.ctx.announce(`Incorreto. ${result.reason}`);
    }

    this.ctx.saveStats();
    renderScoreboard(this.el.score, this.stats);
    renderStage(this.el.stage, this.stats);
  }

  deleteChar() {
    if (this.phase !== 'await' || !this.attempt.length) return;
    this.attempt.pop();
    this.renderAttempt(false);
  }

  clear() {
    if (this.phase === 'done') return;
    this.attempt = [];
    this.phase = 'await';
    this.el.target.dataset.result = '';
    this.renderAttempt(false);
  }

  copy() {}
}
