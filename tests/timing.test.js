import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeText } from '../js/morse.js';
import { buildTimeline, keyingTiming, levelOverrides, playbackTiming, unitFor } from '../js/timing.js';

test('unidade segue PARIS: 1200 / WPM', () => {
  assert.equal(unitFor(12), 100);
  assert.equal(unitFor(20), 60);
});

test('limites de pausa ficam em ordem em qualquer configuração', () => {
  for (const profile of ['beginner', 'realistic']) {
    for (let wpm = 5; wpm <= 30; wpm++) {
      for (let tol = 0; tol <= 1; tol += 0.25) {
        const t = keyingTiming({ wpm, tolerance: tol, profile });
        assert.ok(t.charGap > t.unit * 1.5, 'fecha letra só depois da pausa entre sinais');
        assert.ok(t.wordGap > t.charGap + t.unit, 'palavra exige pausa maior que letra');
        assert.ok(t.minPress < t.unit * 0.5);
      }
    }
  }
});

test('tolerância maior dá mais tempo para fechar letras', () => {
  const strict = keyingTiming({ wpm: 15, tolerance: 0, profile: 'realistic' });
  const loose = keyingTiming({ wpm: 15, tolerance: 1, profile: 'realistic' });
  assert.ok(loose.charGap > strict.charGap);
  assert.ok(loose.wordGap > strict.wordGap);
});

test('reprodução realista de PARIS dura 43 unidades (50 com o espaço final)', () => {
  const pt = playbackTiming({ wpm: 20, profile: 'realistic' });
  const tl = buildTimeline(encodeText('PARIS'), pt);
  assert.equal(Math.round(tl.duration / pt.unit), 43);
});

test('timeline respeita 1/3/7 unidades', () => {
  const pt = playbackTiming({ wpm: 12, profile: 'realistic' });
  const tl = buildTimeline(encodeText('E E'), pt);
  assert.equal(tl.elements.length, 2);
  assert.equal(tl.elements[1].start - tl.elements[0].end, 7 * pt.unit);

  const sos = buildTimeline(encodeText('SOS'), pt);
  assert.equal(sos.elements.length, 9);
  assert.equal(sos.elements[1].start - sos.elements[0].end, pt.unit);
  assert.equal(sos.elements[3].start - sos.elements[2].end, 3 * pt.unit);
  assert.equal(sos.elements[3].end - sos.elements[3].start, 3 * pt.unit);
});

test('níveis de treino ajustam perfil e tolerância', () => {
  assert.deepEqual(levelOverrides('beginner', 0.2), { profile: 'beginner', tolerance: 0.6 });
  assert.deepEqual(levelOverrides('advanced', 0.8), { profile: 'realistic', tolerance: 0.25 });
  assert.deepEqual(levelOverrides('intermediate', 0.5), {});
});
