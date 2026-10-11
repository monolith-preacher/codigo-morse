const MAX_LENGTH = 400;

export class FreeMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.name = 'free';
    this.usesKey = true;
    this.message = '';
  }

  timingOverrides() {
    return {};
  }

  tablePolicy() {
    return 'show';
  }

  enter() {
    this.ctx.screen.setLabel('MSG');
    this.render(false);
  }

  exit() {}

  render(animate) {
    this.ctx.screen.setMessage(this.message, animate);
  }

  onChar({ char }) {
    if (!char) return;
    this.message = (this.message + char).slice(-MAX_LENGTH);
    this.render(true);
    this.ctx.flashStatus('MESSAGE DECODED', 'ok', 900);
  }

  onWord() {
    if (this.message && !this.message.endsWith(' ')) {
      this.message += ' ';
      this.render(false);
    }
  }

  deleteChar() {
    if (!this.message) return;
    this.message = this.message.slice(0, -1);
    this.render(false);
  }

  clear() {
    this.message = '';
    this.render(false);
  }

  async copy() {
    const text = this.message.trim();
    if (!text) {
      this.ctx.flashStatus('NO MESSAGE', 'warn');
      return;
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      try {
        ok = document.execCommand('copy');
      } catch {}
      area.remove();
    }
    this.ctx.flashStatus(ok ? 'MESSAGE COPIED' : 'COPY FAILED', ok ? 'ok' : 'err');
  }
}
