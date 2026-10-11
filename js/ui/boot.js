const SESSION_KEY = 'signal.booted';

const LINES = [
  ['POWER SUPPLY', 'OK'],
  ['OSCILLATOR 650 Hz', 'OK'],
  ['KEY CIRCUIT', 'OK'],
  ['CHANNEL 01', 'OPEN']
];

export function runBoot({ root, log, bar, skip }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try {
    seen = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {}

  if (seen || reduced || skip) {
    root.remove();
    return Promise.resolve();
  }

  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {}

  root.hidden = false;
  const timers = [];

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey, true);
      root.removeEventListener('pointerdown', finish);
      root.classList.add('is-leaving');
      setTimeout(() => root.remove(), 380);
      resolve();
    };
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish();
    };

    window.addEventListener('keydown', onKey, true);
    root.addEventListener('pointerdown', finish);

    LINES.forEach(([label, value], i) => {
      timers.push(
        setTimeout(() => {
          const li = document.createElement('li');
          li.innerHTML = `<span></span><b></b>`;
          li.firstChild.textContent = label;
          li.lastChild.textContent = value;
          log.append(li);
          bar.style.transform = `scaleX(${(i + 1) / (LINES.length + 1)})`;
        }, 220 + i * 230)
      );
    });

    timers.push(
      setTimeout(() => {
        const li = document.createElement('li');
        li.className = 'is-final';
        li.textContent = 'SYSTEM INITIALIZED';
        log.append(li);
        bar.style.transform = 'scaleX(1)';
      }, 220 + LINES.length * 230 + 120)
    );
    timers.push(setTimeout(finish, 220 + LINES.length * 230 + 900));
  });
}
