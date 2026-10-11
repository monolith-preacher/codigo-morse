export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const DIGITS = '0123456789'.split('');
export const CHARACTERS = [...LETTERS, ...DIGITS];

export const MORSE = Object.freeze({
  A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',     F: '..-.',
  G: '--.',   H: '....',  I: '..',    J: '.---',  K: '-.-',   L: '.-..',
  M: '--',    N: '-.',    O: '---',   P: '.--.',  Q: '--.-',  R: '.-.',
  S: '...',   T: '-',     U: '..-',   V: '...-',  W: '.--',   X: '-..-',
  Y: '-.--',  Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.'
});

const BY_CODE = new Map(CHARACTERS.map((ch) => [MORSE[ch], ch]));

const PREFIXES = new Set();
for (const code of BY_CODE.keys()) {
  for (let i = 1; i <= code.length; i++) PREFIXES.add(code.slice(0, i));
}

export function decode(code) {
  return BY_CODE.get(code) ?? null;
}

export function encodeChar(ch) {
  return MORSE[String(ch).toUpperCase()] ?? null;
}

export function isPrefix(code) {
  return PREFIXES.has(code);
}

export function candidates(code) {
  if (!code) return [];
  return CHARACTERS.filter((ch) => MORSE[ch].startsWith(code));
}

export function normalizeText(text) {
  return String(text)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Retorna palavras -> caracteres: [[{ char, code }, ...], ...]
export function encodeText(text) {
  return normalizeText(text)
    .split(' ')
    .filter(Boolean)
    .map((word) => [...word].map((char) => ({ char, code: MORSE[char] })));
}

export function pretty(code, sep = ' ') {
  return [...code].map((el) => (el === '.' ? '·' : '−')).join(sep);
}

export function spoken(code) {
  return [...code].map((el) => (el === '.' ? 'ponto' : 'traço')).join(' ');
}
