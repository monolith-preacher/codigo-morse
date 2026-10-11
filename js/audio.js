const RAMP = 0.005;

export class AudioEngine {
  constructor({ frequency = 650, volume = 60, audio = true } = {}) {
    this.ctx = null;
    this.frequency = frequency;
    this.volume = volume;
    this.enabled = audio;
    this.nodes = null;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && this.enabled;
  }

  get usable() {
    return !!this.nodes && this.enabled;
  }

  // Precisa ser chamado dentro de um gesto do usuário (clique, toque, tecla).
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: 'interactive' });

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = this.frequency;

    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.value = this.frequency * 2;
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.04;

    const tone = ctx.createGain();
    tone.gain.value = 0.9;

    const keyGain = ctx.createGain();
    keyGain.gain.value = 0;
    const playGain = ctx.createGain();
    playGain.gain.value = 0;

    const master = ctx.createGain();
    master.gain.value = this.masterLevel();

    fundamental.connect(tone);
    harmonic.connect(harmonicGain).connect(tone);
    tone.connect(keyGain).connect(master);
    tone.connect(playGain).connect(master);
    master.connect(ctx.destination);

    fundamental.start();
    harmonic.start();

    this.ctx = ctx;
    this.nodes = { fundamental, harmonic, keyGain, playGain, master };
  }

  masterLevel() {
    const v = Math.min(100, Math.max(0, this.volume)) / 100;
    return v * v * 0.7;
  }

  setFrequency(hz) {
    this.frequency = hz;
    if (!this.nodes) return;
    const t = this.ctx.currentTime;
    this.nodes.fundamental.frequency.setTargetAtTime(hz, t, 0.01);
    this.nodes.harmonic.frequency.setTargetAtTime(hz * 2, t, 0.01);
  }

  setVolume(volume) {
    this.volume = volume;
    if (!this.nodes) return;
    this.nodes.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.02);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.silence();
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    }
  }

  ramp(param, value) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + RAMP);
  }

  keyOn() {
    if (!this.usable) return;
    this.ramp(this.nodes.keyGain.gain, 1);
  }

  keyOff() {
    if (!this.nodes) return;
    this.ramp(this.nodes.keyGain.gain, 0);
  }

  // elements: [{ start, end }] em ms. Retorna a latência estimada de saída em segundos.
  schedule(elements, lead) {
    if (!this.usable) return 0;
    const g = this.nodes.playGain.gain;
    const now = this.ctx.currentTime;
    const t0 = now + lead;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + RAMP);
    for (const el of elements) {
      const start = t0 + el.start / 1000;
      const end = t0 + el.end / 1000;
      g.setValueAtTime(0, start);
      g.linearRampToValueAtTime(1, start + RAMP);
      g.setValueAtTime(1, end);
      g.linearRampToValueAtTime(0, end + RAMP);
    }
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  stopScheduled() {
    if (!this.nodes) return;
    this.ramp(this.nodes.playGain.gain, 0);
  }

  silence() {
    this.keyOff();
    this.stopScheduled();
  }

  suspend() {
    this.silence();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
}
