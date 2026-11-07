// Núcleo: canvas com escala para qualquer tela (letterbox), gerenciador de cenas e loop principal.
(() => {
  const V = (window.V = window.V || {});

  const W = 360;
  const H = 640;

  const Game = {
    W,
    H,
    scenes: {},
    cur: null,
    curName: null,
    canvas: null,
    g: null,
    k: 1,
    ox: 0,
    oy: 0,
    dpr: 1,
    cssW: W,
    cssH: H,
    last: 0,
    t: 0,

    register(name, scene) {
      this.scenes[name] = scene;
    },

    go(name, data) {
      const next = this.scenes[name];
      if (!next) throw new Error('Cena desconhecida: ' + name);
      if (this.cur && this.cur.exit) this.cur.exit();
      this.curName = name;
      this.cur = next;
      next.enter && next.enter(data || {});
    },

    // Converte coordenadas da janela para coordenadas lógicas (360×640).
    toLogical(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (cx - r.left - this.ox) / this.k,
        y: (cy - r.top - this.oy) / this.k,
      };
    },

    resize() {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      this.dpr = dpr;
      this.cssW = cw;
      this.cssH = ch;
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      this.k = Math.min(cw / W, ch / H);
      this.ox = (cw - W * this.k) / 2;
      this.oy = (ch - H * this.k) / 2;
    },

    frame(ts) {
      const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000 || 0.016));
      this.last = ts;
      this.t += dt;
      const g = this.g;
      try {
        if (this.cur && this.cur.update) this.cur.update(dt);
      } catch (err) {
        this.report(err);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#07050c';
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      g.setTransform(this.dpr * this.k, 0, 0, this.dpr * this.k, this.dpr * this.ox, this.dpr * this.oy);
      g.save();
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      try {
        if (this.cur && this.cur.draw) this.cur.draw(g);
      } catch (err) {
        this.report(err);
      }
      g.restore();
      V.Input.clearFrame();
      requestAnimationFrame((t) => this.frame(t));
    },

    // Relata erros de quadro uma única vez por mensagem, sem parar o loop.
    report(err) {
      const key = String(err && err.message);
      if (!this._reported) this._reported = new Set();
      if (this._reported.has(key)) return;
      this._reported.add(key);
      console.error('[Vaelmor]', err);
    },

    start(startScene) {
      this.canvas = document.getElementById('game');
      this.g = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      V.Input.init(
        this.canvas,
        (cx, cy) => this.toLogical(cx, cy),
        (code, down, e) => {
          if (down) V.Audio.unlock();
          if (this.cur && this.cur.onKey) this.cur.onKey(code, down, e);
        },
        (type, x, y) => {
          if (type === 'down') V.Audio.unlock();
          if (this.cur && this.cur.onPointer) this.cur.onPointer(type, x, y);
        }
      );
      this.go(startScene);
      requestAnimationFrame((t) => {
        this.last = t;
        this.frame(t);
      });
    },

    // Salva a run atual (ou remove o salvamento se não houver run ativa).
    saveRun() {
      if (V.Run.active) V.Util.store.set('run', V.Run.serialize());
    },

    clearRun() {
      V.Util.store.set('run', null);
    },

    hasSavedRun() {
      const d = V.Util.store.get('run', null);
      return !!(d && typeof d === 'object' && d.stats && d.stats.hp > 0);
    },
  };

  V.Game = Game;
})();
