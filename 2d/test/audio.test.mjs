import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX_IDS, MUSIC_IDS, buildSfx, buildMusic, AudioEngine, audioAvailable } from '../src/audio/index.js';

const SR = 22050;

function peakOf(buf) {
  let p = 0;
  for (const v of buf) {
    assert.ok(Number.isFinite(v), 'amostra não finita');
    p = Math.max(p, Math.abs(v));
  }
  return p;
}

test('listas de ids seguem o contrato', () => {
  assert.equal(SFX_IDS.length, 26);
  assert.equal(MUSIC_IDS.length, 12);
  assert.ok(SFX_IDS.includes('sobreaquecer') && MUSIC_IDS.includes('controlador_memoria'));
});

test('todo efeito gera Float32Array finito com duração e pico dentro dos limites', () => {
  for (const id of SFX_IDS) {
    const buf = buildSfx(id, SR);
    assert.ok(buf instanceof Float32Array, id);
    const dur = buf.length / SR;
    assert.ok(dur >= 0.05 && dur <= 1.2, `${id}: duração ${dur}`);
    const p = peakOf(buf);
    assert.ok(p > 0.05 && p <= 0.9, `${id}: pico ${p}`);
  }
});

test('efeito desconhecido devolve buffer curto e silencioso', () => {
  const buf = buildSfx('nao_existe', SR);
  assert.ok(buf instanceof Float32Array && buf.length > 0 && buf.length <= SR);
  assert.equal(peakOf(buf), 0);
  assert.doesNotThrow(() => buildSfx(undefined));
});

test('buildSfx é determinístico', () => {
  for (const id of SFX_IDS) assert.deepEqual(buildSfx(id, SR), buildSfx(id, SR), id);
});

test('toda trilha tem o tamanho pedido, pico <= 0.6 e emenda suave', () => {
  for (const id of MUSIC_IDS) {
    const seconds = id === 'vitoria_musica' ? 6 : 16;
    const buf = buildMusic(id, SR, seconds);
    assert.ok(buf instanceof Float32Array, id);
    assert.equal(buf.length, Math.round(seconds * SR), id);
    const p = peakOf(buf);
    assert.ok(p > 0.05 && p <= 0.6, `${id}: pico ${p}`);
    const seam = Math.abs(buf[0] - buf[buf.length - 1]);
    assert.ok(seam <= 0.2, `${id}: emenda ${seam}`);
  }
  assert.equal(buildMusic('titulo', 8000, 3.3).length, Math.round(3.3 * 8000));
});

test('trilhas diferentes geram buffers diferentes; trilha é determinística', () => {
  const bufs = MUSIC_IDS.map((id) => buildMusic(id, 8000, 8));
  for (let i = 0; i < bufs.length; i++) {
    for (let j = i + 1; j < bufs.length; j++) {
      assert.notDeepEqual(bufs[i], bufs[j], `${MUSIC_IDS[i]} = ${MUSIC_IDS[j]}`);
    }
  }
  assert.deepEqual(buildMusic('chefe', 8000, 4), buildMusic('chefe', 8000, 4));
});

test('AudioEngine sem AudioContext é inerte e nunca lança', () => {
  assert.equal(audioAvailable({}), false);
  assert.equal(audioAvailable(null), false);
  const eng = new AudioEngine({});
  assert.equal(eng.available, false);
  assert.equal(eng.unlock(), false);
  assert.doesNotThrow(() => {
    eng.playSfx('dano');
    eng.playMusic('titulo');
    eng.playMusic('titulo');
    eng.stopMusic();
    eng.setMuted(true);
    eng.setVolume(0.3);
    eng.setVolume('x');
    eng.dispose();
  });
  assert.equal(eng.isMuted(), true);
  assert.doesNotThrow(() => new AudioEngine().playSfx('mover')); // globalThis do Node
});

function fakeGlobals() {
  const log = { contexts: 0, sources: [], gains: [], buffers: 0, resumed: 0, closed: 0 };
  const param = () => ({ value: 1, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; },
    cancelScheduledValues() {} });
  class FakeContext {
    constructor() { log.contexts++; this.sampleRate = 44100; this.state = 'suspended'; this.currentTime = 0;
      this.destination = { kind: 'destination' }; }
    resume() { log.resumed++; this.state = 'running'; return Promise.resolve(); }
    close() { log.closed++; return Promise.resolve(); }
    createGain() { const g = { gain: param(), connect() {} }; log.gains.push(g); return g; }
    createBuffer(ch, length, rate) {
      log.buffers++;
      const data = new Float32Array(length);
      return { numberOfChannels: ch, length, sampleRate: rate, getChannelData: () => data };
    }
    createBufferSource() {
      const s = { buffer: null, loop: false, started: false, stopped: false, connect() {},
        start() { this.started = true; }, stop() { this.stopped = true; } };
      log.sources.push(s);
      return s;
    }
  }
  return { globals: { AudioContext: FakeContext }, log };
}

test('AudioEngine com AudioContext falso toca efeitos e música', () => {
  const { globals, log } = fakeGlobals();
  const eng = new AudioEngine(globals);
  assert.equal(eng.available, true);
  assert.equal(log.contexts, 0, 'não cria contexto antes do gesto');
  eng.playMusic('dissipador'); // pedido antes do unlock fica guardado
  assert.equal(eng.unlock(), true);
  assert.equal(log.contexts, 1);
  assert.equal(log.resumed, 1);
  assert.equal(log.sources.length, 1, 'música pedida antes do unlock começa');
  assert.equal(log.sources[0].loop, true);

  eng.playSfx('dano');
  eng.playSfx('dano');
  assert.equal(log.sources.length, 3);
  assert.ok(log.sources[1].started && log.sources[2].started);
  const buffersAfterSfx = log.buffers;
  eng.playSfx('dano');
  assert.equal(log.buffers, buffersAfterSfx, 'buffer de efeito fica em cache');

  eng.playMusic('dissipador');
  assert.equal(log.sources.length, 4, 'mesma trilha não reinicia');
  eng.playMusic('batalha');
  assert.equal(log.sources.length, 5);
  assert.equal(log.sources[0].stopped, true, 'trilha anterior sai com fade');
  assert.equal(log.sources[4].loop, true);

  eng.setVolume(0.25);
  assert.equal(log.gains[0].gain.value, 0.25);
  eng.setMuted(true);
  assert.equal(log.gains[0].gain.value, 0);
  assert.equal(eng.isMuted(), true);
  eng.playSfx('mover');
  assert.equal(log.sources.length, 5, 'mudo não toca efeitos');
  eng.setMuted(false);
  assert.equal(log.gains[0].gain.value, 0.25);

  eng.stopMusic();
  assert.equal(log.sources[4].stopped, true);
  eng.dispose();
  assert.equal(log.closed, 1);
  assert.doesNotThrow(() => { eng.playSfx('cura'); eng.playMusic('chefe'); eng.stopMusic(); });
});
