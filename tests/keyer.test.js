import test from 'node:test';
import assert from 'node:assert/strict';
import { Keyer, STATE } from '../js/keyer.js';
import { CHARACTERS, MORSE } from '../js/morse.js';
import { keyingTiming } from '../js/timing.js';
import { fakeClock } from './clock.js';

function setup({ wpm = 12, tolerance = 0.5, profile = 'realistic' } = {}) {
  const clock = fakeClock();
  const timing = () => keyingTiming({ wpm, tolerance, profile });
  const keyer = new Keyer(timing, clock);
  const out = { text: '', chars: [], invalid: [], words: 0 };
  keyer.on('char', (e) => {
    out.chars.push(e);
    if (e.valid) out.text += e.char;
    else out.invalid.push(e.code);
  });
  keyer.on('word', () => {
    out.words++;
    out.text += ' ';
  });
  return { keyer, clock, out, unit: timing().unit };
}

// Envia texto com fatores de tempo (1 = perfeito). jitter(i) devolve multiplicador.
// spread alonga as pausas entre letras e palavras, como na reprodução do perfil iniciante.
function send(ctx, text, jitter = () => 1, spread = 1, source = 'keyboard') {
  const { keyer, clock, unit } = ctx;
  let i = 0;
  const words = text.split(' ');
  words.forEach((word, wi) => {
    [...word].forEach((ch, ci) => {
      [...MORSE[ch]].forEach((el, ei) => {
        if (ei > 0) clock.advance(unit * jitter(i++));
        keyer.press(source);
        clock.advance((el === '.' ? unit : unit * 3) * jitter(i++));
        keyer.release(source);
      });
      if (ci < word.length - 1) clock.advance(unit * 3 * spread * jitter(i++));
    });
    if (wi < words.length - 1) clock.advance(unit * 7 * spread * jitter(i++));
  });
  clock.advance(unit * 20);
}

test('SOS é decodificado corretamente', () => {
  const ctx = setup();
  send(ctx, 'SOS');
  assert.equal(ctx.out.text.trim(), 'SOS');
  assert.equal(ctx.out.words, 1);
});

test('todos os caracteres A-Z e 0-9, em várias velocidades e nos dois perfis', () => {
  for (const profile of ['realistic', 'beginner']) {
    for (const wpm of [5, 10, 15, 20, 25, 30]) {
      const ctx = setup({ wpm, profile });
      for (const ch of CHARACTERS) {
        ctx.out.text = '';
        send(ctx, ch);
        assert.equal(ctx.out.text.trim(), ch, `${ch} a ${wpm} WPM (${profile})`);
      }
    }
  }
});

test('HELLO WORLD com espaço entre palavras e sem espaço duplicado', () => {
  const ctx = setup();
  send(ctx, 'HELLO WORLD');
  ctx.clock.advance(10_000);
  assert.equal(ctx.out.text, 'HELLO WORLD ');
});

function lcg(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

test('variações de ±25% no tempo não geram caracteres errados (realista, tolerância 0%)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ctx = setup({ wpm: 15, tolerance: 0, profile: 'realistic' });
    const rand = lcg(seed);
    send(ctx, 'THE QUICK BROWN FOX 1943', () => 0.75 + rand() * 0.5);
    assert.equal(ctx.out.text.trim(), 'THE QUICK BROWN FOX 1943', `semente ${seed}`);
  }
});

test('variações de ±15% no tempo com tolerância 50%', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ctx = setup({ wpm: 18, tolerance: 0.5, profile: 'realistic' });
    const rand = lcg(seed);
    send(ctx, 'SOS HELLO 73', () => 0.85 + rand() * 0.3);
    assert.equal(ctx.out.text.trim(), 'SOS HELLO 73', `semente ${seed}`);
  }
});

test('perfil iniciante com o espaçamento da própria reprodução e ±20%', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ctx = setup({ wpm: 12, tolerance: 0.5, profile: 'beginner' });
    const rand = lcg(seed);
    send(ctx, 'SOS HELLO 73', () => 0.8 + rand() * 0.4, 1.6);
    assert.equal(ctx.out.text.trim(), 'SOS HELLO 73', `semente ${seed}`);
  }
});

test('perfil iniciante aceita pausas longas dentro de uma letra', () => {
  const ctx = setup({ wpm: 12, profile: 'beginner', tolerance: 0.5 });
  const { keyer, clock, unit } = ctx;
  for (let i = 0; i < 3; i++) {
    keyer.press('pointer');
    clock.advance(unit * 1.3);
    keyer.release('pointer');
    clock.advance(unit * 3.2);
  }
  clock.advance(unit * 20);
  assert.equal(ctx.out.text.trim(), 'S');
});

test('perfil iniciante se adapta a traços longos', () => {
  const ctx = setup({ wpm: 12, profile: 'beginner' });
  const { keyer, clock, unit } = ctx;
  const tap = (d) => {
    keyer.press('pointer');
    clock.advance(d);
    keyer.release('pointer');
    clock.advance(unit * 1.5);
  };
  for (let i = 0; i < 5; i++) {
    tap(unit * 1.4);
    tap(unit * 5.5);
    clock.advance(unit * 12);
  }
  assert.equal(ctx.out.text.replace(/ /g, ''), 'AAAAA');
  // Um sinal de 2.4u agora conta como ponto, porque o operador faz traços muito longos.
  tap(unit * 2.4);
  clock.advance(unit * 12);
  assert.equal(ctx.out.text.replace(/ /g, '').at(-1), 'E');
});

test('segurar a chave produz um único traço, mesmo com press repetido', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  assert.equal(keyer.press('keyboard'), true);
  for (let i = 0; i < 30; i++) {
    clock.advance(30);
    assert.equal(keyer.press('keyboard'), false);
  }
  clock.advance(unit * 2);
  keyer.release('keyboard');
  clock.advance(unit * 10);
  assert.deepEqual(ctx.out.chars.map((c) => c.code), ['-']);
});

test('soltar por outra fonte não encerra o sinal', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  keyer.press('pointer');
  assert.equal(keyer.press('keyboard'), false);
  clock.advance(unit);
  assert.equal(keyer.release('keyboard'), false);
  assert.equal(keyer.state, STATE.DOWN);
  clock.advance(unit * 2);
  keyer.release('pointer');
  clock.advance(unit * 10);
  assert.equal(ctx.out.text.trim(), 'T');
});

test('cancelar (perda de foco) não gera sinal', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  keyer.press('keyboard');
  clock.advance(unit * 3);
  keyer.cancel();
  assert.equal(keyer.state, STATE.IDLE);
  clock.advance(unit * 20);
  assert.equal(ctx.out.chars.length, 0);
});

test('reset cancela timers pendentes', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  keyer.press('pointer');
  clock.advance(unit);
  keyer.release('pointer');
  keyer.reset();
  assert.equal(clock.pending(), 0);
  clock.advance(unit * 20);
  assert.equal(ctx.out.chars.length, 0);
  assert.equal(ctx.out.words, 0);
});

test('nova transmissão adia o fechamento da letra', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  keyer.press('pointer');
  clock.advance(unit);
  keyer.release('pointer');
  clock.advance(unit * 2);
  keyer.press('pointer');
  clock.advance(unit * 5);
  assert.equal(ctx.out.chars.length, 0, 'não fecha letra com a chave pressionada');
  keyer.release('pointer');
  clock.advance(unit * 20);
  assert.deepEqual(ctx.out.chars.map((c) => c.char), ['A']);
});

test('apagar o último sinal antes de fechar a letra', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  for (const len of [1, 1, 3]) {
    keyer.press('pointer');
    clock.advance(unit * len);
    keyer.release('pointer');
    clock.advance(unit);
  }
  keyer.removeLastElement();
  clock.advance(unit * 20);
  assert.equal(ctx.out.text.trim(), 'I');
});

test('sequência sem correspondência é sinalizada como inválida', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  for (let i = 0; i < 6; i++) {
    keyer.press('pointer');
    clock.advance(unit);
    keyer.release('pointer');
    clock.advance(unit);
  }
  clock.advance(unit * 20);
  assert.deepEqual(ctx.out.invalid, ['......']);
});

test('toques muito curtos (ruído) são ignorados', () => {
  const ctx = setup();
  const { keyer, clock } = ctx;
  keyer.press('pointer');
  clock.advance(3);
  keyer.release('pointer');
  clock.advance(5000);
  assert.equal(ctx.out.chars.length, 0);
});

test('desabilitar a chave descarta o que estava em andamento', () => {
  const ctx = setup();
  const { keyer, clock, unit } = ctx;
  keyer.press('pointer');
  clock.advance(unit);
  keyer.setEnabled(false);
  assert.equal(keyer.press('pointer'), false);
  clock.advance(unit * 20);
  assert.equal(ctx.out.chars.length, 0);
  keyer.setEnabled(true);
  assert.equal(keyer.press('pointer'), true);
});
