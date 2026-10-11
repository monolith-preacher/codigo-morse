import { keyingTiming, playbackTiming, PROFILES, WPM_MAX, WPM_MIN } from './timing.js';
import { AudioEngine } from './audio.js';
import { Player } from './player.js';
import { Keyer, STATE } from './keyer.js';
import { bindKeyInputs, isFormField } from './input.js';
import { emptyModeStats, loadSettings, loadStats, saveSettings, saveStats } from './storage.js';
import { Screen } from './ui/screen.js';
import { ReferenceTable } from './ui/table.js';
import { SettingsPanel } from './ui/settings.js';
import { runBoot } from './ui/boot.js';
import { FreeMode } from './modes/free.js';
import { TransmitTraining } from './modes/transmit.js';
import { ReceiveTraining } from './modes/receive.js';

const $ = (sel) => document.querySelector(sel);
const body = document.body;

const settings = loadSettings();
const stats = loadStats();
const audio = new AudioEngine(settings);

let mode = null;

function timingInput() {
  return {
    wpm: settings.wpm,
    tolerance: settings.tolerance / 100,
    profile: settings.profile,
    ...(mode?.timingOverrides() ?? {})
  };
}

const keyer = new Keyer(() => keyingTiming(timingInput()));
const player = new Player(audio, () => playbackTiming(timingInput()));

const keyEl = $('#key');
const lampEls = [$('#lamp'), $('#ledTx')];
const screen = new Screen($('#crt'));
const announcer = $('#announcer');

let statusFlash = null;
let statusTimer = 0;

function refreshStatus() {
  let text;
  let tone = '';
  if (player.active) {
    text = 'RECEIVING SIGNAL';
    tone = 'rx';
  } else if (keyer.isDown) {
    text = 'TRANSMISSION ACTIVE';
    tone = 'tx';
  } else if (statusFlash) {
    ({ text, tone } = statusFlash);
  } else {
    text = mode?.idleStatus?.() ?? 'CHANNEL OPEN';
  }
  if (!settings.audio && !player.active && !keyer.isDown && !statusFlash) text += ' · AUDIO OFF';
  screen.setStatus(text, tone);
  $('#statusText').textContent = text;
  $('#statusWindow').dataset.tone = tone;
}

function flashStatus(text, tone = '', ms = 1500) {
  statusFlash = { text, tone };
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusFlash = null;
    refreshStatus();
  }, ms);
  refreshStatus();
}

function announce(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => (announcer.textContent = text));
}

function setLamp(on, kind = 'tx') {
  for (const el of lampEls) {
    el.classList.toggle('is-on', on);
    el.dataset.kind = kind;
  }
}

let looping = false;
function frame(now) {
  const busy = screen.frame(keyer.snapshot(), now);
  if (busy || player.active || (keyer.state !== STATE.IDLE && keyer.state !== STATE.DISABLED)) {
    requestAnimationFrame(frame);
  } else {
    looping = false;
    screen.renderMeter(keyer.snapshot());
  }
}
function wake() {
  if (looping) return;
  looping = true;
  requestAnimationFrame(frame);
}

function transmit(text, { lamp = true, trace = true, onElement, onStart, onEnd } = {}) {
  if (keyer.isDown) return Promise.resolve({ stopped: true });
  audio.unlock();
  return player.play(text, {
    onStart: (timeline) => {
      onStart?.(timeline);
      refreshStatus();
      wake();
    },
    onElement: (on, el) => {
      if (lamp) setLamp(on, 'rx');
      if (trace) screen.trace.mark(on, 'play');
      onElement?.(on, el);
    },
    onEnd: (result) => {
      setLamp(false);
      onEnd?.(result);
      refreshStatus();
    }
  });
}

function stopPlayback() {
  player.stop();
}

const table = new ReferenceTable($('#tablePanel'), {
  onSelect: (ch) => {
    transmit(ch, {
      onStart: () => table.demoStart(ch),
      onElement: (on, el) => table.demoElement(el.elementIndex, on),
      onEnd: () => table.demoEnd()
    });
  }
});

keyer.on('down', () => {
  player.stop();
  audio.keyOn();
  setLamp(true, 'tx');
  keyEl.classList.add('is-down');
  keyEl.setAttribute('aria-pressed', 'true');
  screen.trace.mark(true, 'key');
  mode?.onKeyDown?.();
  refreshStatus();
  wake();
});

keyer.on('up', () => {
  audio.keyOff();
  setLamp(false);
  keyEl.classList.remove('is-down');
  keyEl.setAttribute('aria-pressed', 'false');
  screen.trace.mark(false, 'key');
  refreshStatus();
  wake();
});

keyer.on('sequence', ({ sequence }) => {
  screen.setSequence(sequence);
  table.markCandidates(sequence);
});

keyer.on('char', (e) => {
  table.markCandidates('');
  if (e.valid) {
    screen.setSequence('');
    table.flash(e.char);
    announce(e.char);
  } else {
    screen.flashInvalid(e.code);
    flashStatus('INVALID SEQUENCE', 'err');
    announce('Sequência inválida');
  }
  mode?.onChar(e);
});

keyer.on('word', () => mode?.onWord?.());

bindKeyInputs({
  keyer,
  keyEl,
  onGesture: () => audio.unlock(),
  isBlocked: () => settingsPanel.isOpen
});

// Libera o áudio no primeiro gesto do usuário em qualquer lugar da página.
const unlockOnce = () => audio.unlock();
window.addEventListener('pointerdown', unlockOnce, { capture: true });
window.addEventListener('keydown', unlockOnce, { capture: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    player.stop();
    audio.suspend();
  }
});

const ctx = {
  settings,
  stats,
  audio,
  keyer,
  screen,
  table,
  transmit,
  stopPlayback,
  flashStatus,
  refreshStatus,
  announce,
  saveStats: () => saveStats(stats),
  setLevel,
  updateSettings
};

const modes = {
  free: new FreeMode(ctx),
  tx: new TransmitTraining(ctx, $('#txPanel')),
  rx: new ReceiveTraining(ctx, $('#rxPanel'))
};

function setMode(name, { force = false } = {}) {
  if (!force && mode?.name === name) return;
  player.stop();
  keyer.reset();
  mode?.exit();
  mode = modes[name];
  settings.mode = name;
  saveSettings(settings);

  body.dataset.mode = name;
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === name));
  });

  keyer.setEnabled(mode.usesKey);
  keyer.recalibrate();
  screen.reset();
  statusFlash = null;
  mode.enter();
  applyLayout();
  updateReadouts();
  refreshStatus();
  wake();
}

function setLevel(level) {
  if (settings.level === level) return;
  settings.level = level;
  saveSettings(settings);
  keyer.recalibrate();
  mode?.onLevelChange?.();
  applyLayout();
  updateReadouts();
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

function applyLayout() {
  const policy = mode?.tablePolicy() ?? 'show';
  const locked = policy === 'hidden';
  const visible = !locked && settings.showTable;
  body.dataset.table = locked ? 'locked' : visible ? 'on' : 'off';
  const btn = $('#btnTable');
  btn.disabled = locked;
  btn.setAttribute('aria-pressed', String(visible));
  body.dataset.effects = settings.effects;
}

function updateReadouts() {
  const t = timingInput();
  const profile = PROFILES[t.profile].label;
  screen.setHead({ wpm: settings.wpm, profile });
  $('#wpmReadout').textContent = String(settings.wpm).padStart(2, '0');
  $('#profileReadout').textContent = profile;
}

function updateSettings(patch) {
  const before = { ...settings };
  Object.assign(settings, patch);
  saveSettings(settings);

  if ('frequency' in patch) audio.setFrequency(settings.frequency);
  if ('volume' in patch) audio.setVolume(settings.volume);
  if ('audio' in patch) {
    audio.setEnabled(settings.audio);
    if (settings.audio) audio.unlock();
  }
  if (before.wpm !== settings.wpm || before.profile !== settings.profile) keyer.recalibrate();
  applyLayout();
  updateReadouts();
  refreshStatus();
}

$('#btnTable').addEventListener('click', () => updateSettings({ showTable: !settings.showTable }));

$('#wpmDown').addEventListener('click', () =>
  updateSettings({ wpm: Math.max(WPM_MIN, settings.wpm - 1) })
);
$('#wpmUp').addEventListener('click', () =>
  updateSettings({ wpm: Math.min(WPM_MAX, settings.wpm + 1) })
);
$('#profileToggle').addEventListener('click', () =>
  updateSettings({ profile: settings.profile === 'beginner' ? 'realistic' : 'beginner' })
);

function deleteSignal() {
  if (!keyer.removeLastElement()) mode?.deleteChar();
}

$('#btnUndoSignal').addEventListener('click', () => keyer.removeLastElement());
$('#btnUndoChar').addEventListener('click', () => mode?.deleteChar());
$('#btnClear').addEventListener('click', () => {
  keyer.reset();
  mode?.clear();
  screen.setSequence('');
});
$('#btnReset').addEventListener('click', () => {
  player.stop();
  keyer.reset();
  keyer.recalibrate();
  mode?.clear();
  screen.reset();
  screen.degauss();
  flashStatus('RADIO CHECK', 'rx', 1200);
  wake();
});
$('#btnCopy').addEventListener('click', () => mode?.copy());

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (settingsPanel.isOpen) settingsPanel.close();
    else player.stop();
    return;
  }
  if (isFormField(e.target) || settingsPanel.isOpen) return;
  if (e.key === 'Backspace' && mode?.usesKey) {
    e.preventDefault();
    deleteSignal();
  }
});

const settingsPanel = new SettingsPanel({
  root: $('#settings'),
  backdrop: $('#settingsBackdrop'),
  openButton: $('#btnSettings'),
  settings,
  onChange: updateSettings,
  onRadioCheck: () => transmit('VVV'),
  onResetStats: () => {
    stats.tx = emptyModeStats();
    stats.rx = emptyModeStats();
    saveStats(stats);
    mode?.onLevelChange?.();
    if (mode?.name !== 'free') mode.next();
  },
  statsSummary: () => {
    const line = (label, s) =>
      `${label}: ${s.total} exercícios · ${s.correct} certos · ${s.wrong} errados · melhor sequência ${s.best}`;
    return `${line('TX', stats.tx)}\n${line('RX', stats.rx)}`;
  }
});

audio.setFrequency(settings.frequency);
setMode(settings.mode, { force: true });
document.documentElement.dataset.ready = '1';

const bootSkip = settings.effects === 'off';
runBoot({ root: $('#boot'), log: $('#bootLog'), bar: $('#bootBar'), skip: bootSkip }).then(() => {
  flashStatus('SIGNAL READY', 'ok', 1800);
});
