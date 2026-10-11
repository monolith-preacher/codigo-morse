import { MORSE } from '../morse.js';
import { STAGES, STAGE_GOAL, evaluateReception, pickChallenge } from '../exercises.js';
import { levelOverrides } from '../timing.js';
import { recordResult } from '../storage.js';
import { textMarksHTML } from '../ui/marks.js';
import { bindLevelSwitch, bindStageBar, renderScoreboard, renderStage, replayLimit } from '../ui/training.js';

export class ReceiveTraining {
  constructor(ctx, root) {
    this.ctx = ctx;
    this.root = root;
    this.name = 'rx';
    this.usesKey = false;
    this.target = null;
    this.phase = 'idle';
    this.replaysLeft = 0;
    this.played = false;
    this.timer = 0;

    const q = (sel) => root.querySelector(sel);
    this.el = {
      form: q('[data-rx="form"]'),
      input: q('[data-rx="input"]'),
      submit: q('[data-rx="submit"]'),
      feedback: q('[data-rx="feedback"]'),
      replay: q('[data-rx="replay"]'),
      replayCount: q('[data-rx="replay-count"]'),
      lamp: q('[data-rx="lamp"]'),
      lampToggle: q('[data-rx="lamp-toggle"]'),
      state: q('[data-rx="state"]'),
      skip: q('[data-rx="skip"]'),
      score: q('[data-rx="score"]'),
      stage: q('[data-rx="stage"]')
    };

    this.renderLevel = bindLevelSwitch(q('[data-rx="levels"]'), (level) => ctx.setLevel(level));
    bindStageBar(this.el.stage, (dir) => this.moveStage(dir));

    this.el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.phase === 'answered') this.next();
      else this.submit();
    });
    this.el.replay.addEventListener('click', () => this.replay());
    this.el.skip.addEventListener('click', () => this.next());
    this.el.lampToggle.addEventListener('click', () => {
      ctx.updateSettings({ rxLamp: !ctx.settings.rxLamp });
      this.renderLampToggle();
    });
    this.el.input.addEventListener('input', () => {
      const clean = this.el.input.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
      if (clean !== this.el.input.value) this.el.input.value = clean;
    });
  }

  get stats() {
    return this.ctx.stats.rx;
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

  idleStatus() {
    return this.phase === 'answered' ? 'MESSAGE DECODED' : 'RADIO CHECK';
  }

  enter() {
    this.root.hidden = false;
    this.ctx.screen.setLabel('RX');
    this.onLevelChange();
    this.renderLampToggle();
    this.next();
  }

  exit() {
    clearTimeout(this.timer);
    this.root.hidden = true;
    this.phase = 'idle';
    this.setLamp(false);
  }

  onLevelChange() {
    this.renderLevel(this.level);
    renderScoreboard(this.el.score, this.stats);
    renderStage(this.el.stage, this.stats);
    if (this.phase !== 'answered') this.replaysLeft = replayLimit(this.level);
    this.renderReplay();
  }

  renderLampToggle() {
    this.el.lampToggle.setAttribute('aria-pressed', String(this.ctx.settings.rxLamp));
  }

  renderReplay() {
    const left = this.replaysLeft;
    this.el.replayCount.textContent = left === Infinity ? '∞' : String(left);
    this.el.replay.disabled = this.phase === 'listen' && this.played && left <= 0;
  }

  setLamp(on) {
    this.el.lamp.classList.toggle('is-on', on);
  }

  setState(text) {
    this.el.state.textContent = text;
  }

  moveStage(dir) {
    const stage = Math.min(STAGES.length - 1, Math.max(0, this.stats.stage + dir));
    if (stage === this.stats.stage) return;
    this.stats.stage = stage;
    this.ctx.saveStats();
    renderStage(this.el.stage, this.stats);
    this.next();
  }

  next() {
    clearTimeout(this.timer);
    this.ctx.stopPlayback();
    this.target = pickChallenge(this.stats.stage, this.target);
    this.phase = 'listen';
    this.played = false;
    this.replaysLeft = replayLimit(this.level);
    this.el.input.value = '';
    this.el.input.disabled = false;
    this.el.submit.textContent = 'VERIFICAR';
    this.el.feedback.innerHTML = '';
    this.el.feedback.dataset.tone = '';
    this.ctx.screen.setSequence('');
    this.ctx.screen.setMessage('');
    this.renderReplay();
    this.ctx.refreshStatus();

    if (!this.ctx.settings.audio && !this.ctx.settings.rxLamp) {
      this.setState('ÁUDIO E LUZ DESLIGADOS');
      this.el.feedback.innerHTML =
        '<span class="fb-note">Ative o áudio nos ajustes ou ligue a luz de transmissão para receber sinais.</span>';
      return;
    }

    if (this.ctx.audio.ready || !this.ctx.settings.audio) {
      this.setState('AGUARDANDO SINAL');
      this.timer = setTimeout(() => this.play(), 550);
    } else {
      this.setState('PRESSIONE ▶ PARA RECEBER');
    }
    if (!matchMedia('(pointer: coarse)').matches) this.el.input.focus({ preventScroll: true });
  }

  play() {
    if (!this.target) return;
    clearTimeout(this.timer);
    this.played = true;
    this.renderReplay();
    const lamp = this.ctx.settings.rxLamp;
    this.setState('RECEIVING SIGNAL');
    this.ctx
      .transmit(this.target, {
        lamp,
        trace: lamp,
        onElement: (on) => lamp && this.setLamp(on)
      })
      .then(() => {
        this.setLamp(false);
        if (this.phase === 'listen') this.setState('DIGITE O QUE OUVIU');
      });
  }

  replay() {
    if (this.phase === 'listen' && this.played) {
      if (this.replaysLeft <= 0) return;
      this.replaysLeft--;
      this.renderReplay();
    }
    this.play();
  }

  submit() {
    if (this.phase !== 'listen') return;
    const value = this.el.input.value.trim();
    if (!value) {
      this.el.input.focus();
      return;
    }
    this.ctx.stopPlayback();
    const result = evaluateReception(this.target, value);
    recordResult(this.stats, result.correct);
    this.phase = 'answered';
    this.el.input.disabled = true;
    this.el.submit.textContent = 'PRÓXIMO ▸';

    const codes = [...this.target].map((ch) => MORSE[ch]);
    this.ctx.screen.showCodes(codes);
    this.ctx.screen.setMessage(this.target, true);

    let extra = '';
    if (result.correct) {
      const progress = this.stats.progress[String(this.stats.stage)] ?? 0;
      if (progress === STAGE_GOAL && this.stats.stage < STAGES.length - 1) {
        this.stats.stage++;
        extra = `<span class="fb-note">Etapa concluída. Próxima: ${STAGES[this.stats.stage].name}.</span>`;
      }
      this.el.feedback.innerHTML =
        `<strong>MESSAGE DECODED</strong>` +
        `<span class="fb-row"><em>SINAL</em><span class="fb-code">${textMarksHTML(this.target)}</span><b>${this.target}</b></span>${extra}`;
      this.el.feedback.dataset.tone = 'ok';
      this.ctx.flashStatus('MESSAGE DECODED', 'ok');
      this.ctx.announce(`Correto: ${this.target}`);
      [...this.target].forEach((ch) => this.ctx.table.flash(ch));
    } else {
      const answer = document.createElement('b');
      answer.textContent = result.answer;
      this.el.feedback.innerHTML =
        `<strong>INCORRECT COPY</strong>` +
        `<span class="fb-row"><em>ENVIADO</em><span class="fb-code">${textMarksHTML(this.target)}</span><b>${this.target}</b></span>` +
        `<span class="fb-row"><em>SUA LEITURA</em><span class="fb-code"></span>${answer.outerHTML}</span>`;
      this.el.feedback.dataset.tone = 'err';
      this.ctx.flashStatus('INCORRECT COPY', 'err');
      this.ctx.announce(`Incorreto. Era ${this.target}`);
    }

    this.setState(result.correct ? 'CÓPIA CORRETA' : 'CÓPIA INCORRETA');
    this.ctx.saveStats();
    renderScoreboard(this.el.score, this.stats);
    renderStage(this.el.stage, this.stats);
    this.renderReplay();
    this.el.submit.focus({ preventScroll: true });
  }

  deleteChar() {}
  clear() {}
  copy() {}
}
