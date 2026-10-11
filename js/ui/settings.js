import { keyingTiming, PROFILES } from '../timing.js';

const PROFILE_HINTS = {
  beginner:
    'Pausas longas para fechar letras e palavras. O limite entre ponto e traço se ajusta ao seu ritmo.',
  realistic:
    'Proporções do código internacional: traço = 3 pontos, letra após 3 unidades, palavra após 7.'
};

const ms = (v) => `${Math.round(v)} ms`;

export class SettingsPanel {
  constructor({ root, backdrop, openButton, settings, onChange, onRadioCheck, onResetStats, statsSummary }) {
    this.root = root;
    this.backdrop = backdrop;
    this.openButton = openButton;
    this.settings = settings;
    this.onChange = onChange;
    this.statsSummary = statsSummary;
    this.returnFocus = null;

    this.inputs = [...root.querySelectorAll('[data-setting]')];
    for (const input of this.inputs) {
      input.addEventListener('input', () => this.handle(input));
      input.addEventListener('change', () => this.handle(input));
    }

    openButton.addEventListener('click', () => this.open());
    backdrop.addEventListener('click', () => this.close());
    root.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    root.querySelector('[data-action="radio-check"]').addEventListener('click', onRadioCheck);
    root.querySelector('[data-action="reset-stats"]').addEventListener('click', () => {
      if (confirm('Zerar estatísticas e progresso dos treinos?')) {
        onResetStats();
        this.renderStats();
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
      if (e.key === 'Tab') this.trapFocus(e);
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open() {
    this.returnFocus = document.activeElement;
    this.render();
    this.root.hidden = false;
    this.backdrop.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.openButton.setAttribute('aria-expanded', 'true');
    this.root.querySelector('[data-action="close"]').focus();
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.remove('is-open');
    this.root.hidden = true;
    this.backdrop.hidden = true;
    this.openButton.setAttribute('aria-expanded', 'false');
    this.returnFocus?.focus?.();
  }

  trapFocus(e) {
    const focusable = [...this.root.querySelectorAll('button, input, select')].filter(
      (el) => !el.disabled && el.offsetParent !== null
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  handle(input) {
    const key = input.dataset.setting;
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else if (input.type === 'radio') {
      if (!input.checked) return;
      value = input.value;
    } else if (input.type === 'range') value = Number(input.value);
    else value = input.value;
    if (this.settings[key] === value) return;
    this.onChange({ [key]: value });
    this.render();
  }

  render() {
    const s = this.settings;
    for (const input of this.inputs) {
      const key = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = !!s[key];
      else if (input.type === 'radio') input.checked = s[key] === input.value;
      else input.value = s[key];
    }
    const out = (name, text) => {
      const el = this.root.querySelector(`[data-output="${name}"]`);
      if (el) el.textContent = text;
    };
    out('wpm', `${s.wpm} WPM`);
    out('tolerance', `${s.tolerance}%`);
    out('frequency', `${s.frequency} Hz`);
    out('volume', `${s.volume}%`);
    out('profile-hint', PROFILE_HINTS[s.profile]);

    const t = keyingTiming({ wpm: s.wpm, tolerance: s.tolerance / 100, profile: s.profile });
    out('t-unit', ms(t.unit));
    out('t-dash', `≥ ${ms(t.dashThreshold)}`);
    out('t-char', ms(t.charGap));
    out('t-word', ms(t.wordGap));
    out('t-profile', PROFILES[s.profile].label);

    this.root.querySelectorAll('[data-requires="audio"]').forEach((el) => {
      el.classList.toggle('is-disabled', !s.audio);
      el.querySelectorAll('input').forEach((i) => (i.disabled = !s.audio));
    });
    this.renderStats();
  }

  renderStats() {
    const el = this.root.querySelector('[data-output="stats"]');
    if (el) el.textContent = this.statsSummary();
  }
}
