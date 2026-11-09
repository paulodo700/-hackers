// Efeitos visuais: partículas, números de dano, ondas, tremor, flash e faixas de título. A lógica (criar,
// avançar, limitar, expirar) é pura e testada em test/visual-efeitos.test.mjs. Cada efeito está em coordenadas
// de mundo (com câmera) ou de tela (tela: true), que é como a batalha desenha por cima da arena.
import { textoComContorno } from './desenho.js';
import { TEMA } from './tema.js';

export function criarParticula(o) {
  return {
    x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0,
    vida: o.vida ?? 800, idade: 0, tam: o.tam ?? 3, cor: o.cor ?? '#ffffff', tipo: o.tipo ?? 'brilho', tela: !!o.tela,
  };
}

// Avança a partícula no tempo (dt em ms). Devolve false quando ela já viveu o bastante e deve sair.
export function avancarParticula(p, dt) {
  p.idade += dt;
  p.x += (p.vx * dt) / 16;
  p.y += (p.vy * dt) / 16;
  p.vy += (p.g * dt) / 16;
  return p.idade < p.vida;
}

const TAMANHO_TEXTO = { info: 13, destaque: 17, dano: 18, critico: 24 };
const VIDA_TEXTO = { info: 900, destaque: 1100, dano: 900, critico: 1200 };

export class Efeitos {
  constructor({ limite = 420 } = {}) {
    this.limite = limite;
    this.reiniciar();
  }

  reiniciar() {
    this.particulas = [];
    this.textos = [];
    this.ondas = [];
    this.banners = [];
    this.tremor = 0;
    this.flash = null;
  }

  emitir(o) {
    if (this.particulas.length < this.limite) this.particulas.push(criarParticula(o));
  }

  // Rajada radial de n partículas, com pequena variação de velocidade e tamanho.
  rajada(x, y, cor, n = 14, forca = 2.4, vida = 600, tipo = 'brilho', tam = 3, tela = false) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const v = forca * (0.5 + Math.random());
      this.emitir({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.02, cor, tipo, tela,
        vida: vida * (0.7 + Math.random() * 0.5), tam: tam * (0.6 + Math.random() * 0.8),
      });
    }
  }

  texto(s, x, y, cor = TEMA.texto, tipo = 'info', tela = false) {
    this.textos.push({ s: String(s), x, y, cor, tipo, tela, idade: 0, vida: VIDA_TEXTO[tipo] ?? 900 });
  }

  onda(x, y, cor, raio = 70, vida = 520) {
    this.ondas.push({ x, y, cor, raio, vida, idade: 0 });
  }

  tremorAdd(forca) {
    this.tremor = Math.min(14, Math.max(this.tremor, Number(forca) || 0));
  }

  flashAdd(cor, duracao = 180) {
    this.flash = { cor, duracao, idade: 0 };
  }

  // Faixa de título no alto da área do mapa (ex.: entrada numa camada).
  banner(titulo, subtitulo = '', cor = TEMA.ouroClaro, vida = 2600) {
    this.banners.push({ titulo, subtitulo, cor, vida, idade: 0 });
  }

  brasa(x, y) {
    this.emitir({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.6, vida: 900, cor: '#ff9a3c', tipo: 'brilho', tam: 2.2 });
  }

  poeira(x, y) {
    this.emitir({ x, y, vx: (Math.random() - 0.5) * 0.1, vy: -0.04 - Math.random() * 0.06, vida: 4200, cor: '#d9d0b8', tipo: 'brilho', tam: 1.1 });
  }

  gelo(x, y) { this.rajada(x, y, '#9be7ff', 10, 1.2, 700, 'brilho', 2.2); }
  fogo(x, y) { this.rajada(x, y, '#ff7a2a', 12, 1.8, 500, 'brilho', 2.6); }
  faisca(x, y, cor = '#ffe9a0', tela = false) { this.rajada(x, y, cor, 12, 2.6, 380, 'brilho', 2.2, tela); }
  fumaca(x, y) { this.rajada(x, y, '#2a2420', 8, 0.8, 1000, 'fumaca', 6); }

  cura(x, y, tela = false) {
    for (let i = 0; i < 9; i++) {
      this.emitir({ x: x + (Math.random() - 0.5) * 26, y: y + Math.random() * 12, vx: 0, vy: -0.9 - Math.random() * 0.6, vida: 900, cor: '#7dffb0', tipo: 'cruz', tam: 3.4, tela });
    }
  }

  nivel(x, y) {
    this.onda(x, y, TEMA.ouroClaro, 110, 700);
    this.rajada(x, y, TEMA.ouroClaro, 28, 3.2, 900, 'brilho', 3);
  }

  morte(x, y) {
    this.fumaca(x, y);
    this.onda(x, y, '#3a0d0d', 64, 500);
  }

  // Coluna de luz de item raro: sobe a partir do ponto.
  feixe(x, y, cor) {
    for (let i = 0; i < 16; i++) this.emitir({ x, y: y - i * 9, vx: 0, vy: -0.4, vida: 1400, cor, tipo: 'brilho', tam: 2.4 });
  }

  // Tira os efeitos de tela (da batalha) quando ela termina.
  removerTela() {
    this.particulas = this.particulas.filter((p) => !p.tela);
    this.textos = this.textos.filter((t) => !t.tela);
  }

  // Aplica um comando vindo de eventos.js. Devolve false para comandos que não existem.
  executar(cmd) {
    switch (cmd?.efeito) {
      case 'texto': this.texto(cmd.s, cmd.x, cmd.y, cmd.cor, cmd.tipo, !!cmd.tela); return true;
      case 'faisca': this.faisca(cmd.x, cmd.y, cmd.cor, !!cmd.tela); return true;
      case 'fogo': this.fogo(cmd.x, cmd.y); return true;
      case 'gelo': this.gelo(cmd.x, cmd.y); return true;
      case 'cura': this.cura(cmd.x, cmd.y, !!cmd.tela); return true;
      case 'nivel': this.nivel(cmd.x, cmd.y); return true;
      case 'feixe': this.feixe(cmd.x, cmd.y, cmd.cor); return true;
      case 'flash': this.flashAdd(cmd.cor, cmd.duracao); return true;
      case 'tremor': this.tremorAdd(cmd.forca); return true;
      case 'banner': this.banner(cmd.titulo, cmd.subtitulo, cmd.cor); return true;
      default: return false;
    }
  }

  // Avança o tempo (dt em ms) e remove o que já expirou.
  atualizar(dt) {
    this.particulas = this.particulas.filter((p) => avancarParticula(p, dt));
    for (const t of this.textos) t.idade += dt;
    this.textos = this.textos.filter((t) => t.idade < t.vida);
    for (const o of this.ondas) o.idade += dt;
    this.ondas = this.ondas.filter((o) => o.idade < o.vida);
    for (const b of this.banners) b.idade += dt;
    this.banners = this.banners.filter((b) => b.idade < b.vida);
    if (this.tremor > 0) this.tremor = Math.max(0, this.tremor - dt * 0.03);
    if (this.flash) {
      this.flash.idade += dt;
      if (this.flash.idade >= this.flash.duracao) this.flash = null;
    }
  }

  // Partículas (ondas só no mundo). Com { tela: true } desenha os efeitos de coordenadas de tela.
  desenharParticulas(ctx, ox, oy, cx, cy, { tela = false } = {}) {
    for (const p of this.particulas) {
      if (p.tela !== tela) continue;
      const f = p.idade / p.vida;
      const x = p.tela ? p.x : ox + p.x - cx;
      const y = p.tela ? p.y : oy + p.y - cy;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f);
      if (p.tipo === 'fumaca') {
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(x, y, p.tam * (1 + f), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.tipo === 'cruz') {
        ctx.fillStyle = p.cor;
        ctx.fillRect(x - p.tam / 2, y - p.tam / 6, p.tam, p.tam / 3);
        ctx.fillRect(x - p.tam / 6, y - p.tam / 2, p.tam / 3, p.tam);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.2, p.tam * (1 - f * 0.5)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (tela) return;
    for (const o of this.ondas) {
      const f = o.idade / o.vida;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f);
      ctx.strokeStyle = o.cor;
      ctx.lineWidth = 3 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(ox + o.x - cx, oy + o.y - cy, o.raio * f + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Números de dano e textos: crescem, sobem e somem.
  desenharTextos(ctx, ox, oy, cx, cy, { tela = false } = {}) {
    for (const t of this.textos) {
      if (t.tela !== tela) continue;
      const f = t.idade / t.vida;
      const k = t.idade < 140 ? 0.5 + (t.idade / 140) * 0.7 : 1.2 - Math.min(0.2, (t.idade - 140) / 900);
      ctx.save();
      ctx.globalAlpha = f > 0.7 ? Math.max(0, (1 - f) / 0.3) : 1;
      ctx.translate(t.tela ? t.x : ox + t.x - cx, (t.tela ? t.y : oy + t.y - cy) - f * 28);
      ctx.scale(k, k);
      textoComContorno(ctx, t.s, 0, 0, t.cor, TAMANHO_TEXTO[t.tipo] ?? 13, 'center', t.tipo === 'info' ? 'texto' : 'titulo');
      ctx.restore();
    }
  }

  // Flash de tela: um véu colorido que apaga em poucos quadros (dano, camada nova, alerta de calor).
  desenharFlash(ctx, x, y, w, h) {
    if (!this.flash) return;
    const k = Math.max(0, 1 - this.flash.idade / this.flash.duracao);
    ctx.save();
    ctx.globalAlpha = 0.45 * k;
    ctx.fillStyle = this.flash.cor;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Faixas de título: entram deslizando, ficam e somem.
  desenharBanners(ctx, x, y, w, h) {
    for (const b of this.banners) {
      const entra = Math.min(1, b.idade / 350);
      const sai = Math.min(1, (b.vida - b.idade) / 700);
      const cx = x + w / 2;
      const cy = y + h * 0.28 - (1 - entra) * 14;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(entra, sai));
      textoComContorno(ctx, b.titulo, cx, cy, b.cor, 30, 'center', 'titulo', 'rgba(0,0,0,0.95)', 6);
      const meia = ctx.measureText(b.titulo).width / 2;
      ctx.fillStyle = b.cor;
      ctx.fillRect(cx - meia - 90, cy, 70, 1);
      ctx.fillRect(cx + meia + 20, cy, 70, 1);
      textoComContorno(ctx, b.subtitulo, cx, cy + 30, TEMA.textoDim, 13, 'center', 'texto', 'rgba(0,0,0,0.9)', 3);
      ctx.restore();
    }
  }
}
