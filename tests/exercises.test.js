import test from 'node:test';
import assert from 'node:assert/strict';
import { MORSE, decode } from '../js/morse.js';
import { STAGES, evaluateReception, evaluateTransmission, pickChallenge } from '../js/exercises.js';
import { emptyModeStats, recordResult } from '../js/storage.js';

const sent = (...codes) => codes.map((code) => ({ code, char: decode(code) }));

test('todos os desafios usam apenas caracteres da tabela', () => {
  for (const stage of STAGES) {
    for (const item of stage.pool) {
      for (const ch of item) assert.ok(MORSE[ch], `${item} em ${stage.name}`);
    }
  }
});

test('desafio não repete o anterior', () => {
  for (let i = 0; i < 200; i++) {
    assert.notEqual(pickChallenge(0, 'E'), 'E');
  }
});

test('letra correta', () => {
  assert.equal(evaluateTransmission('A', sent('.-')).correct, true);
});

test('letra errada explica a diferença', () => {
  const r = evaluateTransmission('A', sent('..'));
  assert.equal(r.correct, false);
  assert.match(r.reason, /2º sinal deveria ser traço/);

  const extra = evaluateTransmission('A', sent('.--'));
  assert.match(extra.reason, /1 sinal a mais/);
});

test('palavra avalia os limites entre letras', () => {
  assert.equal(evaluateTransmission('SOS', sent('...', '---', '...')).correct, true);

  const merged = evaluateTransmission('SOS', sent('...---', '...'));
  assert.equal(merged.correct, false);
  assert.match(merged.reason, /faltou pausa entre as letras/);

  const split = evaluateTransmission('AN', sent('.', '-', '-.'));
  assert.equal(split.correct, false);
  assert.match(split.reason, /pausa longa dentro de uma letra/);
});

test('recepção ignora caixa e espaços extras', () => {
  assert.equal(evaluateReception('SOS', ' sos ').correct, true);
  assert.equal(evaluateReception('SOS', 'SOD').correct, false);
});

test('placar acumula acertos, erros e melhor sequência', () => {
  const s = emptyModeStats();
  [true, true, false, true, true, true].forEach((ok) => recordResult(s, ok));
  assert.equal(s.total, 6);
  assert.equal(s.correct, 5);
  assert.equal(s.wrong, 1);
  assert.equal(s.streak, 3);
  assert.equal(s.best, 3);
  assert.equal(s.progress['0'], 5);
});
