// WebSocket client with auto-reconnect (Render's free plan sleeps; the first connect can be slow).
export class Net {
  constructor() {
    this.handlers = {};
    this.ws = null; this.id = null; this.profile = null;
    this.retry = 0; this.everConnected = false;
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  emit(type, data) { for (const fn of this.handlers[type] || []) fn(data); }

  connect(profile) {
    this.profile = profile;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({ t: 'join', name: profile.name, char: profile.char, pin: profile.pin || undefined }));
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'welcome') {
        const again = this.everConnected;
        this.id = m.id; this.role = m.role; this.everConnected = true;
        this.emit('status', 'online');
        this.emit('welcome', { ...m, again });
      } else this.emit(m.t, m);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.id = null;
      this.emit('status', ev.code === 1013 ? 'full' : 'offline');
      const wait = Math.min(8000, 800 * 2 ** this.retry++);
      setTimeout(() => this.connect(this.profile), wait);
    };
  }

  send(obj) {
    if (this.ws?.readyState === 1 && this.id) this.ws.send(JSON.stringify(obj));
  }
}
