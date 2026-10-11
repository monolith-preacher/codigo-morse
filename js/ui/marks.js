import { MORSE } from '../morse.js';

export function marksHTML(code, cls = 'marks') {
  const items = [...code].map((el) => `<i class="${el === '.' ? 'dot' : 'dash'}"></i>`).join('');
  return `<span class="${cls}">${items}</span>`;
}

export function textMarksHTML(text) {
  return `<span class="marks-line">${[...text].map((ch) => marksHTML(MORSE[ch] ?? '')).join('')}</span>`;
}
