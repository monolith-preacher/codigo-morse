import { WPM_MAX, WPM_MIN } from './timing.js';

const SETTINGS_KEY = 'signal.settings.v1';
const STATS_KEY = 'signal.stats.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'free',
  profile: 'beginner',
  wpm: 12,
  tolerance: 50,
  frequency: 650,
  volume: 60,
  audio: true,
  effects: 'full',
  showTable: true,
  rxLamp: true,
  level: 'beginner'
});

const RULES = {
  mode: (v) => ['free', 'tx', 'rx'].includes(v),
  profile: (v) => ['beginner', 'realistic'].includes(v),
  wpm: (v) => Number.isFinite(v) && v >= WPM_MIN && v <= WPM_MAX,
  tolerance: (v) => Number.isFinite(v) && v >= 0 && v <= 100,
  frequency: (v) => Number.isFinite(v) && v >= 300 && v <= 1200,
  volume: (v) => Number.isFinite(v) && v >= 0 && v <= 100,
  audio: (v) => typeof v === 'boolean',
  effects: (v) => ['full', 'reduced', 'off'].includes(v),
  showTable: (v) => typeof v === 'boolean',
  rxLamp: (v) => typeof v === 'boolean',
  level: (v) => ['beginner', 'intermediate', 'advanced'].includes(v)
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY) ?? {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const [key, valid] of Object.entries(RULES)) {
    if (key in saved && valid(saved[key])) settings[key] = saved[key];
  }
  return settings;
}

let pending = null;
export function saveSettings(settings) {
  clearTimeout(pending);
  pending = setTimeout(() => write(SETTINGS_KEY, settings), 150);
}

export function emptyModeStats() {
  return { total: 0, correct: 0, wrong: 0, streak: 0, best: 0, stage: 0, progress: {} };
}

export function loadStats() {
  const saved = read(STATS_KEY) ?? {};
  const stats = {};
  for (const mode of ['tx', 'rx']) {
    const base = emptyModeStats();
    const s = saved[mode] ?? {};
    for (const key of Object.keys(base)) {
      if (key === 'progress') base.progress = s.progress && typeof s.progress === 'object' ? { ...s.progress } : {};
      else if (Number.isFinite(s[key]) && s[key] >= 0) base[key] = Math.floor(s[key]);
    }
    stats[mode] = base;
  }
  return stats;
}

export function saveStats(stats) {
  write(STATS_KEY, stats);
}

export function recordResult(modeStats, correct) {
  modeStats.total++;
  if (correct) {
    modeStats.correct++;
    modeStats.streak++;
    modeStats.best = Math.max(modeStats.best, modeStats.streak);
    const key = String(modeStats.stage);
    modeStats.progress[key] = (modeStats.progress[key] ?? 0) + 1;
  } else {
    modeStats.wrong++;
    modeStats.streak = 0;
  }
}
