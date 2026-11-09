// Iluminação 2D: escuridão com buracos de luz (destination-out), luzes coloridas aditivas, vinheta e grão.
// Os canvas auxiliares são criados só quando o navegador existe (document); não roda no Node.
export class Luz {
  constructor() {
    this.buffer = null;
    this.bctx = null;
    this.halos = new Map();
    this.grao = null;
  }

  // Halo radial reutilizável: branco (apaga a escuridão) ou colorido (soma cor).
  halo(raio, cor = null) {
    const k = `${Math.round(raio)}|${cor ?? 'branco'}`;
    if (!this.halos.has(k)) {
      const c = document.createElement('canvas');
      const d = Math.max(2, Math.round(raio) * 2);
      c.width = d;
      c.height = d;
      const x = c.getContext('2d');
      const r = d / 2;
      const g = x.createRadialGradient(r, r, 0, r, r, r);
      const base = cor ?? '255,255,255';
      g.addColorStop(0, `rgba(${base},1)`);
      g.addColorStop(0.45, `rgba(${base},0.5)`);
      g.addColorStop(1, `rgba(${base},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, d, d);
      this.halos.set(k, c);
    }
    return this.halos.get(k);
  }

  garantirBuffer(w, h) {
    if (!this.buffer || this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer = document.createElement('canvas');
      this.buffer.width = w;
      this.buffer.height = h;
      this.bctx = this.buffer.getContext('2d');
    }
  }

  // luzes: [{x, y, raio, forca, cor?}] em coordenadas locais da área (x0, y0, w, h).
  aplicar(ctx, x0, y0, w, h, luzes, escuridao) {
    this.garantirBuffer(w, h);
    const b = this.bctx;
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, w, h);
    b.fillStyle = `rgba(3, 2, 6, ${escuridao})`;
    b.fillRect(0, 0, w, h);
    b.globalCompositeOperation = 'destination-out';
    for (const l of luzes) {
      b.globalAlpha = Math.min(1, l.forca ?? 1);
      b.drawImage(this.halo(l.raio), l.x - l.raio, l.y - l.raio, l.raio * 2, l.raio * 2);
    }
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.buffer, x0, y0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of luzes) {
      if (!l.cor) continue;
      ctx.globalAlpha = 0.5 * Math.min(1, l.forca ?? 1);
      ctx.drawImage(this.halo(l.raio, l.cor), x0 + l.x - l.raio, y0 + l.y - l.raio, l.raio * 2, l.raio * 2);
    }
    ctx.restore();
  }

  vinheta(ctx, x, y, w, h, forca = 0.6) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.38, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${forca})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  // Grão fino (textura de filme), gerado uma vez com semente fixa.
  granulado(ctx, x, y, w, h, alfa = 0.06) {
    if (!this.grao) {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      const g = c.getContext('2d');
      const im = g.createImageData(96, 96);
      let s = 1234567;
      for (let i = 0; i < im.data.length; i += 4) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const v = s % 255;
        im.data[i] = v;
        im.data[i + 1] = v;
        im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      this.grao = c;
    }
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.fillStyle = ctx.createPattern(this.grao, 'repeat');
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}
