import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, MORSE, decode, encodeText, isPrefix, normalizeText, pretty } from '../js/morse.js';

const ITU = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....',
  7: '--...', 8: '---..', 9: '----.'
};

test('tabela tem A-Z e 0-9 com os códigos ITU', () => {
  assert.equal(CHARACTERS.length, 36);
  for (const [ch, code] of Object.entries(ITU)) {
    assert.equal(MORSE[ch], code, `código de ${ch}`);
    assert.equal(decode(code), ch, `decodificação de ${code}`);
  }
});

test('nenhum código se repete', () => {
  const codes = CHARACTERS.map((c) => MORSE[c]);
  assert.equal(new Set(codes).size, codes.length);
});

test('SOS vira ... --- ...', () => {
  const [word] = encodeText('sos');
  assert.deepEqual(word.map((x) => x.code), ['...', '---', '...']);
  assert.equal(word.map((x) => pretty(x.code, '')).join(' '), '··· −−− ···');
});

test('texto é normalizado antes de codificar', () => {
  assert.equal(normalizeText('  olá,  mundo! '), 'OLA MUNDO');
  assert.equal(encodeText('HELLO WORLD').length, 2);
});

test('prefixos inválidos e válidos', () => {
  assert.ok(isPrefix('..--'));
  assert.equal(decode('..--'), null);
  assert.ok(!isPrefix('......'));
});
