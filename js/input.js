const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;

function isFormField(el) {
  return !!el && (FIELD.test(el.tagName) || el.isContentEditable);
}

function isSpace(e) {
  return e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
}

// Mouse, toque e barra de espaço entram pelo mesmo caminho: keyer.press / keyer.release.
// Só a fonte que iniciou o sinal pode encerrá-lo; as demais são ignoradas enquanto isso.
export function bindKeyInputs({ keyer, keyEl, onGesture, isBlocked = () => false }) {
  let pointerId = null;
  let spaceHeld = false;

  keyEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (pointerId !== null) return;
    onGesture?.();
    if (!keyer.press('pointer')) return;
    pointerId = e.pointerId;
    try {
      keyEl.setPointerCapture(e.pointerId);
    } catch {}
  });

  const endPointer = (e, cancelled = false) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    pointerId = null;
    if (cancelled) keyer.cancel();
    else keyer.release('pointer');
  };

  keyEl.addEventListener('pointerup', (e) => endPointer(e));
  keyEl.addEventListener('lostpointercapture', (e) => endPointer(e));
  keyEl.addEventListener('pointercancel', (e) => endPointer(e, true));
  window.addEventListener('pointerup', (e) => endPointer(e));
  window.addEventListener('pointercancel', (e) => endPointer(e, true));

  keyEl.addEventListener('contextmenu', (e) => e.preventDefault());
  keyEl.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  keyEl.addEventListener('click', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (!isSpace(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isFormField(e.target) || isBlocked()) return;
    e.preventDefault();
    if (e.repeat || spaceHeld) return;
    spaceHeld = true;
    onGesture?.();
    keyer.press('keyboard');
  });

  window.addEventListener('keyup', (e) => {
    if (!isSpace(e)) return;
    if (!spaceHeld) return;
    e.preventDefault();
    spaceHeld = false;
    keyer.release('keyboard');
  });

  const abort = () => {
    spaceHeld = false;
    pointerId = null;
    keyer.cancel();
  };

  window.addEventListener('blur', abort);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) abort();
  });

  return { abort };
}

export { isFormField };
