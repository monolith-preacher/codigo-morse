import { DIGITS, MORSE, pretty } from './morse.js';

export const STAGE_GOAL = 8;

const WORDS = [
  'SOS', 'CQ', 'OK', 'HI', 'TEST', 'RADIO', 'MORSE', 'HELLO', 'SIGNAL', 'ECHO',
  'ALPHA', 'BRAVO', 'DELTA', 'TANGO', 'ROGER', 'OVER', 'NORTH', 'WAVE', 'KEY',
  'BASE', 'CODE', 'SEA', 'SKY', 'SOL', 'MAR', 'PAZ', 'CASA', 'LUZ', 'ONDA',
  'SINAL', 'RUMO', 'QTH', 'QRZ', '73'
];

export const STAGES = [
  { name: 'LETRAS SIMPLES', pool: ['E', 'T', 'I', 'M', 'A', 'N'] },
  { name: 'LETRAS COMUNS', pool: ['S', 'O', 'H', 'K', 'R', 'U', 'D', 'W', 'G'] },
  { name: 'LETRAS COMPLEXAS', pool: ['B', 'C', 'F', 'J', 'L', 'P', 'Q', 'V', 'X', 'Y', 'Z'] },
  { name: 'NÚMEROS', pool: DIGITS },
  { name: 'PALAVRAS CURTAS', pool: WORDS, words: true }
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function pickChallenge(stageIndex, previous = null, random = Math.random) {
  const stage = STAGES[stageIndex] ?? STAGES[0];
  let pool = stage.pool;
  // Revisão: um quarto dos desafios vem das etapas de letras anteriores.
  if (!stage.words && stageIndex > 0 && random() < 0.25) {
    pool = STAGES.slice(0, stageIndex).flatMap((s) => s.pool);
  }
  const options = pool.length > 1 ? pool.filter((item) => item !== previous) : pool;
  return pick(options);
}

const ordinal = (n) => `${n}º`;

function compareCodes(expected, sent) {
  const e = expected.code;
  const g = sent.code;
  const name = sent.char ? `(${sent.char})` : '(não corresponde a nenhum caractere)';

  if (g.length > e.length && g.startsWith(e)) {
    const extra = g.length - e.length;
    return `Você enviou ${extra} sinal${extra > 1 ? 'is' : ''} a mais ${name}.`;
  }
  if (g.length < e.length && e.startsWith(g)) {
    const missing = e.length - g.length;
    return `Faltou ${missing} sinal${missing > 1 ? 'is' : ''} no final ${name}.`;
  }
  if (g.length === e.length) {
    const notes = [];
    for (let i = 0; i < e.length; i++) {
      if (e[i] === g[i]) continue;
      notes.push(
        e[i] === '-'
          ? `o ${ordinal(i + 1)} sinal deveria ser traço (segure por mais tempo)`
          : `o ${ordinal(i + 1)} sinal deveria ser ponto (solte mais rápido)`
      );
    }
    const text = notes.join('; ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${name}.`;
  }
  return `Esperados ${e.length} sinais, recebidos ${g.length} ${name}.`;
}

function explain(expected, attempt) {
  const joinedExpected = expected.map((x) => x.code).join('');
  const joinedSent = attempt.map((x) => x.code).join('');

  if (joinedExpected === joinedSent) {
    return attempt.length < expected.length
      ? 'Os pontos e traços estão certos, mas faltou pausa entre as letras. Espere cerca de 3 unidades ao terminar cada letra.'
      : 'Os pontos e traços estão certos, mas houve uma pausa longa dentro de uma letra. Mantenha o ritmo entre os sinais.';
  }

  if (expected.length === 1 && attempt.length === 1) return compareCodes(expected[0], attempt[0]);

  for (let i = 0; i < expected.length; i++) {
    const sent = attempt[i];
    if (!sent) return `Transmissão interrompida: faltou a letra ${expected[i].char} (${pretty(expected[i].code)}).`;
    if (sent.code !== expected[i].code) {
      return `Letra ${i + 1} (${expected[i].char}): ${compareCodes(expected[i], sent).replace(/^./, (c) => c.toLowerCase())}`;
    }
  }
  return 'Foram transmitidas letras a mais.';
}

// attempt: [{ char, code }] na ordem em que o keyer fechou cada caractere.
export function evaluateTransmission(target, attempt) {
  const expected = [...target].map((char) => ({ char, code: MORSE[char] }));
  const correct =
    attempt.length === expected.length && attempt.every((a, i) => a.code === expected[i].code);
  return {
    correct,
    expected,
    attempt,
    reason: correct ? '' : explain(expected, attempt)
  };
}

export function evaluateReception(target, answer) {
  const clean = String(answer).toUpperCase().replace(/\s+/g, ' ').trim();
  return { correct: clean === target, answer: clean };
}
