import { CHARACTERS, MORSE, spoken } from '../morse.js';

function codeMarks(code) {
  const wrap = document.createElement('span');
  wrap.className = 'code-marks';
  for (const el of code) {
    const i = document.createElement('i');
    i.className = el === '.' ? 'dot' : 'dash';
    wrap.append(i);
  }
  return wrap;
}

export class ReferenceTable {
  constructor(root, { onSelect }) {
    this.root = root;
    this.grid = root.querySelector('[data-table="grid"]');
    this.demoChar = root.querySelector('[data-table="demo-char"]');
    this.demoBars = root.querySelector('[data-table="demo-bars"]');
    this.demoCode = root.querySelector('[data-table="demo-code"]');
    this.cells = new Map();
    this.flashTimers = new Map();
    this.playing = null;

    for (const ch of CHARACTERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cell${/\d/.test(ch) ? ' is-digit' : ''}`;
      btn.dataset.char = ch;
      btn.setAttribute('aria-label', `${ch}: ${spoken(MORSE[ch])}. Ouvir.`);
      const label = document.createElement('span');
      label.className = 'cell-char';
      label.textContent = ch;
      btn.append(label, codeMarks(MORSE[ch]));
      btn.addEventListener('click', () => onSelect(ch));
      this.grid.append(btn);
      this.cells.set(ch, btn);
    }
  }

  markCandidates(sequence) {
    this.grid.classList.toggle('is-filtering', !!sequence);
    for (const [ch, cell] of this.cells) {
      const code = MORSE[ch];
      cell.classList.toggle('is-candidate', !!sequence && code.startsWith(sequence));
      cell.classList.toggle('is-exact', !!sequence && code === sequence);
    }
  }

  flash(ch) {
    const cell = this.cells.get(ch);
    if (!cell) return;
    clearTimeout(this.flashTimers.get(ch));
    cell.classList.remove('is-hit');
    void cell.offsetWidth;
    cell.classList.add('is-hit');
    this.flashTimers.set(ch, setTimeout(() => cell.classList.remove('is-hit'), 900));
  }

  demoStart(ch) {
    this.demoEnd();
    const code = MORSE[ch];
    this.playing = ch;
    this.cells.get(ch)?.classList.add('is-playing');
    this.demoChar.textContent = ch;
    this.demoCode.textContent = spoken(code).toUpperCase();
    this.demoBars.replaceChildren(
      ...[...code].map((el) => {
        const bar = document.createElement('i');
        bar.className = el === '.' ? 'dot' : 'dash';
        return bar;
      })
    );
  }

  demoElement(index, on) {
    const bar = this.demoBars.children[index];
    if (!bar) return;
    bar.classList.toggle('is-on', on);
    if (!on) bar.classList.add('is-done');
  }

  demoEnd() {
    if (this.playing) this.cells.get(this.playing)?.classList.remove('is-playing');
    this.playing = null;
    for (const bar of this.demoBars.children) bar.classList.remove('is-on');
  }
}
