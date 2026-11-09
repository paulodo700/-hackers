// Primitivas de desenho no estilo do tema: molduras de couro e ouro, quadros de item, botões de ação, orbes de
// vida e energia, barras entalhadas, brilhos e sombras. Recebe o contexto de desenho; não cria canvas.
import { TEMA, fonteTitulo, fonteTexto, nivelOrbe, hexParaRgb } from './tema.js';

export function texto(ctx, s, x, y, cor = TEMA.texto, tam = 13, alinhar = 'left', fonte = 'texto') {
  ctx.font = fonte === 'titulo' ? fonteTitulo(tam) : fonteTexto(tam);
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'top';
  ctx.fillStyle = cor;
  ctx.fillText(s, x, y);
}

// Texto com contorno escuro (leitura sobre qualquer fundo), centrado verticalmente.
export function textoComContorno(ctx, s, x, y, cor = TEMA.texto, tam = 18, alinhar = 'center', fonte = 'titulo', contorno = 'rgba(0,0,0,0.92)', espessura = 4) {
  ctx.font = fonte === 'titulo' ? fonteTitulo(tam) : fonteTexto(tam);
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = espessura;
  ctx.strokeStyle = contorno;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = cor;
  ctx.fillText(s, x, y);
}

function losango(ctx, x, y, tam = 4, cor = TEMA.ouro) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x, y - tam);
  ctx.lineTo(x + tam, y);
  ctx.lineTo(x, y + tam);
  ctx.lineTo(x - tam, y);
  ctx.closePath();
  ctx.fill();
}

// Filete horizontal que some nas pontas, com um losango no centro.
export function divisor(ctx, x, y, w, cor = TEMA.ouro) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, cor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 1);
  losango(ctx, x + w / 2, y + 0.5, 3, cor);
}

// Quadro escuro com borda colorida e filete interno (slots, retratos, cartões).
export function quadro(ctx, x, y, w, h, borda = TEMA.ouro, fundo = 'rgba(16, 12, 9, 0.95)') {
  ctx.fillStyle = fundo;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borda;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  if (w >= 60 && h >= 60) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  }
}

// Moldura de couro escuro com borda dupla e losangos nos cantos.
export function moldura(ctx, x, y, w, h, { borda = TEMA.ouro, opacidade = 0.94, cantos = true } = {}) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(44, 33, 23, ${opacidade})`);
  g.addColorStop(1, `rgba(14, 10, 7, ${opacidade})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borda;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = TEMA.ouroEscuro;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  if (cantos) {
    losango(ctx, x + 7, y + 7, 3, borda);
    losango(ctx, x + w - 7, y + 7, 3, borda);
    losango(ctx, x + 7, y + h - 7, 3, borda);
    losango(ctx, x + w - 7, y + h - 7, 3, borda);
  }
}

// Brilho aditivo circular (luz, auréola, calor). cor é uma cor CSS (ex.: 'rgba(255,200,120,1)').
export function brilho(ctx, x, y, raio, cor, forca = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
  g.addColorStop(0, cor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = forca;
  ctx.fillStyle = g;
  ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  ctx.restore();
}

// Sombra elíptica sob personagens e falhas.
export function sombra(ctx, x, y, rx, ry, forca = 0.5) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${forca})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Orbe de vida ou energia: vidro escuro, líquido com onda, aro dourado e reflexo.
// fantFrac (opcional) mostra, em tom claro, a parte da vida perdida recentemente.
export function orbe(ctx, cx, cy, raio, frac, cor, corEscura, t = 0, fantFrac = null) {
  const topoDe = (f) => cy + raio - nivelOrbe(f) * raio * 2;
  const topo = topoDe(frac);
  brilho(ctx, cx, cy, raio * 1.7, `rgba(${hexParaRgb(cor)}, 1)`, 0.16);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.clip();
  const fundo = ctx.createRadialGradient(cx, cy - raio * 0.3, raio * 0.1, cx, cy, raio);
  fundo.addColorStop(0, '#1a1414');
  fundo.addColorStop(1, '#030202');
  ctx.fillStyle = fundo;
  ctx.fillRect(cx - raio, cy - raio, raio * 2, raio * 2);
  if (fantFrac !== null && fantFrac > frac) {
    ctx.fillStyle = 'rgba(255, 240, 220, 0.32)';
    ctx.fillRect(cx - raio, topoDe(fantFrac), raio * 2, topo - topoDe(fantFrac));
  }
  ctx.beginPath();
  for (let x = cx - raio; x <= cx + raio; x += 3) {
    const y = topo + Math.sin(((x - cx) / raio) * 3.2 + t / 260) * 3;
    if (x === cx - raio) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(cx + raio, cy + raio + 6);
  ctx.lineTo(cx - raio, cy + raio + 6);
  ctx.closePath();
  const liq = ctx.createLinearGradient(0, topo, 0, cy + raio);
  liq.addColorStop(0, cor);
  liq.addColorStop(1, corEscura);
  ctx.fillStyle = liq;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.strokeStyle = TEMA.ouro;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, raio - 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx - raio * 0.32, cy - raio * 0.5, raio * 0.42, raio * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.restore();
}

// Barra entalhada com gradiente; fant (opcional) é a faixa fantasma de dano recente.
export function barra(ctx, x, y, w, h, frac, cor, fant = null) {
  ctx.fillStyle = '#0c0907';
  ctx.fillRect(x, y, w, h);
  if (fant !== null && fant > frac) {
    ctx.fillStyle = 'rgba(245, 230, 200, 0.55)';
    ctx.fillRect(x, y, w * nivelOrbe(fant), h);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cor);
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * nivelOrbe(frac), h);
  ctx.strokeStyle = TEMA.ouroEscuro;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Botão de ação. Alto (slot da barra): tecla no canto e nome embaixo. Linha: tecla e nome centrados.
export function botao(ctx, x, y, w, h, { tecla = '', rotulo = '', ativo = false, desativado = false, linha = false } = {}) {
  quadro(ctx, x, y, w, h, ativo ? TEMA.ouroClaro : desativado ? '#3a3026' : TEMA.ouro, ativo ? '#2c200f' : '#120e0a');
  if (linha) {
    const cor = desativado ? TEMA.textoDim : TEMA.texto;
    texto(ctx, tecla ? `${tecla}  ${rotulo}` : rotulo, x + w / 2, y + h / 2 - 7, cor, 12, 'center');
    return;
  }
  if (tecla) texto(ctx, tecla, x + 5, y + 3, TEMA.ouroClaro, 10, 'left', 'titulo');
  if (rotulo) texto(ctx, rotulo, x + w / 2, y + h - 14, TEMA.texto, 10, 'center');
}
