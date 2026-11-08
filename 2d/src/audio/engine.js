// Reprodução via WebAudio. Criação preguiçosa do AudioContext (só em unlock, chamado num gesto do usuário).
// Sem WebAudio (Node, navegadores antigos) todos os métodos viram operações silenciosas e nunca lançam erro.
import { buildSfx } from './sfx.js';
import { buildMusic, TRACKS } from './music.js';

const RATE = 22050;
const FADE = 0.5;

export function audioAvailable(globals = globalThis) {
  try {
    return !!globals && typeof (globals.AudioContext || globals.webkitAudioContext) === 'function';
  } catch {
    return false;
  }
}

function ramp(param, ctx, from, to, dur) {
  if (!param) return;
  const now = ctx.currentTime || 0;
  if (typeof param.setValueAtTime === 'function' && typeof param.linearRampToValueAtTime === 'function') {
    if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
    param.setValueAtTime(from, now);
    param.linearRampToValueAtTime(to, now + dur);
  } else {
    param.value = to;
  }
}

export class AudioEngine {
  constructor(globals = globalThis) {
    this.globals = globals;
    this.available = audioAvailable(globals);
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.6;
    this.sfxCache = new Map();
    this.musicCache = new Map();
    this.music = null; // { id, source, gain }
    this.wantedMusic = null;
  }

  unlock() {
    if (!this.available) return false;
    try {
      if (!this.ctx) {
        const Ctor = this.globals.AudioContext || this.globals.webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this._applyVolume();
      }
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      if (this.wantedMusic && (!this.music || this.music.id !== this.wantedMusic)) this._startMusic(this.wantedMusic);
      return true;
    } catch {
      this.available = false;
      this.ctx = null;
      this.master = null;
      return false;
    }
  }

  _buffer(cache, key, build) {
    let buf = cache.get(key);
    if (!buf) {
      const data = build();
      buf = this.ctx.createBuffer(1, data.length, RATE);
      if (typeof buf.copyToChannel === 'function') buf.copyToChannel(data, 0);
      else buf.getChannelData(0).set(data);
      cache.set(key, buf);
    }
    return buf;
  }

  playSfx(id) {
    if (!this.ctx || this.muted) return;
    try {
      const buffer = this._buffer(this.sfxCache, id, () => buildSfx(id, RATE));
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch { /* som é opcional */ }
  }

  playMusic(id) {
    if (this.wantedMusic === id && (!this.ctx || (this.music && this.music.id === id))) return;
    this.wantedMusic = id;
    if (!this.ctx) return;
    try { this._startMusic(id); } catch { /* som é opcional */ }
  }

  _startMusic(id) {
    if (this.music && this.music.id === id) return;
    const seconds = TRACKS[id]?.seconds ?? 16;
    const buffer = this._buffer(this.musicCache, id, () => buildMusic(id, RATE, seconds));
    this._fadeOutCurrent();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain);
    gain.connect(this.master);
    ramp(gain.gain, this.ctx, 0, 0.8, FADE);
    src.start();
    this.music = { id, source: src, gain };
  }

  _fadeOutCurrent() {
    const m = this.music;
    this.music = null;
    if (!m) return;
    try {
      ramp(m.gain.gain, this.ctx, m.gain.gain.value ?? 0.8, 0, FADE);
      m.source.stop((this.ctx.currentTime || 0) + FADE + 0.05);
    } catch { /* já parado */ }
  }

  stopMusic() {
    this.wantedMusic = null;
    if (!this.ctx) return;
    this._fadeOutCurrent();
  }

  setMuted(on) {
    this.muted = !!on;
    this._applyVolume();
  }

  isMuted() {
    return this.muted;
  }

  setVolume(v) {
    const n = Number(v);
    this.volume = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : this.volume;
    this._applyVolume();
  }

  _applyVolume() {
    if (!this.master) return;
    try { this.master.gain.value = this.muted ? 0 : this.volume; } catch { /* ignora */ }
  }

  dispose() {
    try {
      if (this.music) this.music.source.stop();
    } catch { /* ignora */ }
    this.music = null;
    this.wantedMusic = null;
    try {
      if (this.ctx && typeof this.ctx.close === 'function') {
        const p = this.ctx.close();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch { /* ignora */ }
    this.ctx = null;
    this.master = null;
    this.sfxCache.clear();
    this.musicCache.clear();
  }
}
