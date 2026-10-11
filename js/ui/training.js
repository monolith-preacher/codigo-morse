import { STAGES, STAGE_GOAL } from '../exercises.js';
import { LEVELS } from '../timing.js';

export function renderScoreboard(el, s) {
  const accuracy = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  const rows = [
    ['ACERTOS', s.correct, 'ok'],
    ['ERROS', s.wrong, 'err'],
    ['SEQUÊNCIA', s.streak, ''],
    ['MELHOR', s.best, ''],
    ['PRECISÃO', `${accuracy}%`, ''],
    ['TOTAL', s.total, '']
  ];
  el.replaceChildren(
    ...rows.map(([label, value, tone]) => {
      const box = document.createElement('div');
      box.className = 'score';
      if (tone) box.dataset.tone = tone;
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      box.append(dt, dd);
      return box;
    })
  );
}

export function renderStage(root, s) {
  const stage = STAGES[s.stage];
  const done = Math.min(STAGE_GOAL, s.progress[String(s.stage)] ?? 0);
  root.querySelector('[data-stage="name"]').textContent = `ETAPA ${s.stage + 1}/${STAGES.length} · ${stage.name}`;
  const pips = root.querySelector('[data-stage="pips"]');
  pips.replaceChildren(
    ...Array.from({ length: STAGE_GOAL }, (_, i) => {
      const pip = document.createElement('i');
      if (i < done) pip.className = 'is-lit';
      return pip;
    })
  );
  pips.setAttribute('aria-label', `${done} de ${STAGE_GOAL} acertos nesta etapa`);
  root.querySelector('[data-dir="-1"]').disabled = s.stage === 0;
  root.querySelector('[data-dir="1"]').disabled = s.stage === STAGES.length - 1;
}

export function bindStageBar(root, onMove) {
  root.querySelectorAll('[data-dir]').forEach((btn) =>
    btn.addEventListener('click', () => onMove(Number(btn.dataset.dir)))
  );
}

export function bindLevelSwitch(root, onChange) {
  const buttons = [...root.querySelectorAll('[data-level]')];
  buttons.forEach((btn) => btn.addEventListener('click', () => onChange(btn.dataset.level)));
  return (level) => {
    buttons.forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.level === level)));
  };
}

export function replayLimit(level) {
  return LEVELS[level]?.replays ?? Infinity;
}
