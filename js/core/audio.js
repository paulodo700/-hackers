// Áudio procedural: efeitos e músicas sintetizados com Web Audio (sem arquivos externos).
(() => {
  const V = (window.V = window.V || {});
  const { makeRng } = V.Util;

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Escalas (intervalos em semitons).
  const SCALES = {
    dorian: [0, 2, 3, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
    pent: [0, 3, 5, 7, 10],
  };

  // Faixas de música: a melodia é gerada a partir da semente, então cada faixa tem identidade própria.
  const TRACKS = {
    title: { root: 50, scale: 'dorian', bpm: 84, seed: 11, wave: 'triangle', density: 0.55 },
    forest: { root: 50, scale: 'pent', bpm: 98, seed: 23, wave: 'triangle', density: 0.6 },
    mines: { root: 43, scale: 'phrygian', bpm: 86, seed: 37, wave: 'sawtooth', density: 0.45 },
    tower: { root: 45, scale: 'minor', bpm: 112, seed: 53, wave: 'square', density: 0.7 },
    shop: { root: 55, scale: 'major', bpm: 100, seed: 71, wave: 'triangle', density: 0.5 },
    boss: { root: 41, scale: 'phrygian', bpm: 128, seed: 89, wave: 'sawtooth', density: 0.85 },
  };

  const Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    enabled: true,
    track: null,
    _timer: null,
    _nextTime: 0,
    _step: 0,
    _pattern: null,
    _trackName: null,

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.55;
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.22;
        this.musicBus.connect(this.master);
      } catch (e) {
        this.ctx = null;
      }
    },

    // Chamado a partir de um gesto do usuário (navegadores exigem isso).
    unlock() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (this.enabled && this._trackName && !this._timer) this.playTrack(this._trackName);
    },

    setEnabled(on) {
      this.enabled = on;
      V.Util.store.set('sound', on);
      if (!this.musicBus) return;
      this.musicBus.gain.value = on ? 0.22 : 0;
      this.sfxBus.gain.value = on ? 0.55 : 0;
      if (on) this.unlock();
    },

    _tone(freq, dur, o = {}) {
      if (!this.ctx || !this.enabled) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
      const vol = o.vol == null ? 0.2 : o.vol;
      const att = o.attack == null ? 0.004 : o.attack;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + att);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(o.bus || this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    _noise(dur, o = {}) {
      if (!this.ctx || !this.enabled) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = o.filter || 'lowpass';
      filter.frequency.value = o.freq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.value = o.vol == null ? 0.3 : o.vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus);
      src.start(t0);
    },

    sfx(name) {
      if (!this.ctx || !this.enabled) return;
      const T = this._tone.bind(this);
      const N = this._noise.bind(this);
      switch (name) {
        case 'shoot':
          T(880, 0.08, { type: 'square', vol: 0.07, slideTo: 440 });
          break;
        case 'enemyShoot':
          T(260, 0.12, { type: 'sawtooth', vol: 0.06, slideTo: 180 });
          break;
        case 'hit':
          T(520, 0.05, { type: 'triangle', vol: 0.12, slideTo: 300 });
          break;
        case 'crit':
          T(990, 0.09, { type: 'square', vol: 0.1, slideTo: 1400 });
          break;
        case 'hurt':
          T(180, 0.22, { type: 'sawtooth', vol: 0.18, slideTo: 60 });
          N(0.12, { vol: 0.15, freq: 900 });
          break;
        case 'die':
          T(300, 0.5, { type: 'triangle', vol: 0.2, slideTo: 40 });
          N(0.35, { vol: 0.25, freq: 500 });
          break;
        case 'enemyDie':
          T(400, 0.18, { type: 'triangle', vol: 0.12, slideTo: 90 });
          N(0.1, { vol: 0.12, freq: 1600 });
          break;
        case 'coin':
          T(988, 0.07, { type: 'square', vol: 0.08 });
          T(1319, 0.12, { type: 'square', vol: 0.08, delay: 0.06 });
          break;
        case 'gem':
          [660, 880, 1320].forEach((f, i) => T(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.05 }));
          break;
        case 'heal':
          [523, 659, 784, 1046].forEach((f, i) => T(f, 0.18, { type: 'sine', vol: 0.14, delay: i * 0.07 }));
          break;
        case 'xp':
          T(1200, 0.05, { type: 'sine', vol: 0.05 });
          break;
        case 'levelup':
          [392, 523, 659, 784, 1046].forEach((f, i) => T(f, 0.2, { type: 'square', vol: 0.09, delay: i * 0.09 }));
          break;
        case 'click':
          T(640, 0.05, { type: 'triangle', vol: 0.12, slideTo: 520 });
          break;
        case 'select':
          T(520, 0.09, { type: 'triangle', vol: 0.14 });
          T(780, 0.12, { type: 'triangle', vol: 0.12, delay: 0.07 });
          break;
        case 'buy':
          T(740, 0.08, { type: 'square', vol: 0.09 });
          T(1110, 0.14, { type: 'square', vol: 0.09, delay: 0.07 });
          break;
        case 'deny':
          T(160, 0.18, { type: 'square', vol: 0.12, slideTo: 110 });
          break;
        case 'telegraph':
          T(220, 0.35, { type: 'sine', vol: 0.1, slideTo: 440 });
          break;
        case 'slam':
          T(90, 0.5, { type: 'sine', vol: 0.35, slideTo: 35 });
          N(0.4, { vol: 0.35, freq: 400 });
          break;
        case 'roar':
          T(110, 0.9, { type: 'sawtooth', vol: 0.22, slideTo: 55 });
          N(0.8, { vol: 0.18, freq: 300 });
          break;
        case 'blink':
          T(1400, 0.15, { type: 'sine', vol: 0.08, slideTo: 300 });
          break;
        case 'web':
          N(0.2, { vol: 0.12, freq: 3000, filter: 'highpass' });
          break;
        case 'portal':
          T(300, 0.6, { type: 'sine', vol: 0.12, slideTo: 900 });
          break;
        case 'roomClear':
          [523, 659, 784].forEach((f, i) => T(f, 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
          break;
        case 'victory':
          [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) =>
            T(f, 0.25, { type: 'square', vol: 0.1, delay: i * 0.13 })
          );
          break;
        case 'defeat':
          [392, 370, 349, 330].forEach((f, i) => T(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.22 }));
          break;
        case 'type':
          T(900 + Math.random() * 200, 0.03, { type: 'square', vol: 0.03 });
          break;
        default:
          break;
      }
    },

    playTrack(name) {
      this._trackName = name;
      if (!this.ctx || !this.enabled) return;
      if (this.track === name && this._timer) return;
      this.stopMusic();
      const def = TRACKS[name];
      if (!def) return;
      this.track = name;
      this._pattern = buildPattern(def);
      this._step = 0;
      this._nextTime = this.ctx.currentTime + 0.1;
      this._timer = setInterval(() => this._schedule(), 40);
    },

    stopMusic() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
      this.track = null;
    },

    _schedule() {
      if (!this.ctx || !this.enabled || !this._pattern) return;
      const p = this._pattern;
      const stepDur = 60 / p.bpm / 2; // colcheias
      while (this._nextTime < this.ctx.currentTime + 0.25) {
        const i = this._step % p.length;
        const t = this._nextTime;
        const mel = p.melody[i];
        if (mel) this._musicNote(midiHz(mel.m), stepDur * mel.len, t, p.wave, 0.09);
        if (i % 4 === 0) {
          const b = p.bass[(i / 4) % p.bass.length];
          this._musicNote(midiHz(b), stepDur * 3.6, t, 'triangle', 0.16);
        }
        if (i % 8 === 0 && p.pad) {
          const chord = p.pad[(i / 8) % p.pad.length];
          for (const m of chord) this._musicNote(midiHz(m), stepDur * 7.2, t, 'sine', 0.03);
        }
        this._nextTime += stepDur;
        this._step++;
      }
    },

    _musicNote(freq, dur, t, wave, vol) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.musicBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
  };

  // Gera um padrão de 32 colcheias (melodia com passos suaves), baixo e acordes.
  function buildPattern(def) {
    const rng = makeRng(def.seed);
    const scale = SCALES[def.scale];
    const rootMidi = def.root;
    const degreeToMidi = (d) => {
      const oct = Math.floor(d / scale.length);
      const idx = ((d % scale.length) + scale.length) % scale.length;
      return rootMidi + 12 + oct * 12 + scale[idx];
    };
    const length = 32;
    const melody = [];
    let deg = 0;
    for (let i = 0; i < length; i++) {
      if (rng.next() < def.density) {
        deg += rng.pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
        deg = Math.max(-2, Math.min(scale.length + 2, deg));
        melody.push({ m: degreeToMidi(deg), len: rng.chance(0.3) ? 2 : 1 });
        if (rng.chance(0.25)) i++; // respiração entre notas
      } else {
        melody.push(null);
      }
    }
    const bass = [
      rootMidi - 12,
      rootMidi - 12 + 7,
      rootMidi - 12 + 5,
      rootMidi - 12 + 7,
    ];
    const pad = [
      [rootMidi, rootMidi + 3, rootMidi + 7],
      [rootMidi - 2, rootMidi + 2, rootMidi + 5],
      [rootMidi - 4, rootMidi, rootMidi + 3],
      [rootMidi - 2, rootMidi + 2, rootMidi + 7],
    ];
    return { bpm: def.bpm, wave: def.wave, length, melody: fitMelody(melody, length), bass, pad };
  }

  function fitMelody(melody, length) {
    const out = new Array(length).fill(null);
    for (let i = 0; i < melody.length && i < length; i++) out[i] = melody[i];
    return out;
  }

  Audio.TRACKS = TRACKS;
  V.Audio = Audio;
})();
