// Todas as regras de tempo ficam aqui: reconhecimento da chave, reprodução
// automática e exercícios leem os mesmos parâmetros.
//
// Referência (PARIS): 1 unidade = 1200 / WPM ms
//   ponto = 1u, traço = 3u
//   pausa entre sinais = 1u, entre letras = 3u, entre palavras = 7u

export const WPM_MIN = 5;
export const WPM_MAX = 30;

// Limites de silêncio (em unidades) para fechar uma letra e uma palavra.
// O primeiro valor vale para tolerância 0%, o segundo para 100%.
// Os limites ficam entre os intervalos que a própria reprodução usa:
//   realista:  1u | 3u | 7u
//   iniciante: 1u | 4.8u | 11.2u (pausas esticadas, sinais na velocidade normal)
// Assim pequenas variações para mais ou para menos não juntam nem quebram letras.
export const PROFILES = {
  beginner: {
    label: 'INICIANTE',
    charGap: [3, 4.2],
    wordGap: [7, 9],
    adaptive: true,
    playbackSpread: 1.6
  },
  realistic: {
    label: 'REALISTA',
    charGap: [2, 2.7],
    wordGap: [4.5, 5.8],
    adaptive: false,
    playbackSpread: 1
  }
};

export const LEVELS = {
  beginner: { label: 'INICIANTE', profile: 'beginner', minTolerance: 0.6, replays: Infinity },
  intermediate: { label: 'INTERMEDIÁRIO', profile: null, replays: 2 },
  advanced: { label: 'AVANÇADO', profile: 'realistic', maxTolerance: 0.25, replays: 1 }
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function unitFor(wpm) {
  return 1200 / clamp(wpm, WPM_MIN, WPM_MAX);
}

// Nível de treino ajusta o perfil e a tolerância sem mexer nas configurações salvas.
export function levelOverrides(level, tolerance) {
  const rules = LEVELS[level];
  if (!rules) return {};
  const out = {};
  if (rules.profile) out.profile = rules.profile;
  if (rules.minTolerance != null) out.tolerance = Math.max(tolerance, rules.minTolerance);
  if (rules.maxTolerance != null) out.tolerance = Math.min(tolerance, rules.maxTolerance);
  return out;
}

export function keyingTiming({ wpm, tolerance, profile }) {
  const unit = unitFor(wpm);
  const p = PROFILES[profile] ?? PROFILES.beginner;
  const t = clamp(tolerance, 0, 1);
  return {
    unit,
    profile,
    dashThreshold: 2 * unit,
    charGap: unit * lerp(p.charGap[0], p.charGap[1], t),
    wordGap: unit * lerp(p.wordGap[0], p.wordGap[1], t),
    minPress: Math.min(15, unit * 0.15),
    adaptive: p.adaptive
  };
}

export function playbackTiming({ wpm, profile }) {
  const unit = unitFor(wpm);
  const spread = (PROFILES[profile] ?? PROFILES.beginner).playbackSpread;
  return {
    unit,
    dot: unit,
    dash: 3 * unit,
    intra: unit,
    char: 3 * unit * spread,
    word: 7 * unit * spread
  };
}

// words: saída de encodeText(). Tempos em ms a partir do início.
export function buildTimeline(words, pt) {
  const elements = [];
  const chars = [];
  let t = 0;
  let first = true;

  words.forEach((word) => {
    word.forEach((item, ci) => {
      if (!first) t += ci === 0 ? pt.word : pt.char;
      first = false;
      const start = t;
      [...item.code].forEach((element, ei) => {
        if (ei > 0) t += pt.intra;
        const len = element === '.' ? pt.dot : pt.dash;
        elements.push({
          index: elements.length,
          charIndex: chars.length,
          elementIndex: ei,
          element,
          char: item.char,
          start: t,
          end: t + len
        });
        t += len;
      });
      chars.push({ char: item.char, code: item.code, start, end: t });
    });
  });

  return { elements, chars, duration: t };
}

// No perfil iniciante o limite ponto/traço acompanha o ritmo real do operador.
export class ElementClassifier {
  constructor() {
    this.reset();
  }

  reset() {
    this.dot = null;
    this.dash = null;
  }

  threshold(timing) {
    if (!timing.adaptive) return timing.dashThreshold;
    const dot = this.dot ?? timing.unit;
    const dash = this.dash ?? timing.unit * 3;
    return clamp((dot + dash) / 2, timing.unit * 1.5, timing.unit * 3);
  }

  classify(duration, timing) {
    const element = duration < this.threshold(timing) ? '.' : '-';
    if (timing.adaptive) {
      const base = element === '.' ? this.dot ?? timing.unit : this.dash ?? timing.unit * 3;
      const sample = element === '.'
        ? clamp(duration, timing.unit * 0.4, timing.unit * 2.5)
        : clamp(duration, timing.unit * 1.8, timing.unit * 6);
      const next = base * 0.75 + sample * 0.25;
      if (element === '.') this.dot = next;
      else this.dash = next;
    }
    return element;
  }
}
