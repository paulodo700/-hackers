// Paleta, fontes e funções puras do visual (sem canvas). Estilo de ARPG sombrio: ouro envelhecido, couro, pedra e
// orbes coloridos. Não usa marca, fonte proprietária nem arte de terceiros: só cores e fontes do sistema.

export const TEMA = {
  ouro: '#c9a45c',
  ouroClaro: '#f3d88f',
  ouroEscuro: '#5e4520',
  couro: '#15110c',
  couroClaro: '#2e2319',
  pedra: '#09080b',
  sangue: '#7a1717',
  sangueClaro: '#e54b40',
  arcano: '#2d6fd6',
  arcanoClaro: '#a6d3ff',
  esmeralda: '#2fbf71',
  texto: '#efe4c9',
  textoDim: '#998a6e',
  alerta: '#ff8d6b',
};

// Raridade dos itens: comum (cinza-claro), raro (azul), épico (dourado-alaranjado).
export const RARIDADE = { comum: '#d7d1c4', raro: '#6aa9ff', epico: '#ffb640' };

// Cor de luz de cada elemento de falha.
export const ELEMENTO = { calor: '#ff7a3d', frio: '#8fe3ff', corrente: '#ffe066', sinal: '#7dffb0', neutro: '#e9e0cc' };

export const fonteTitulo = (tam) => `${tam}px "Palatino Linotype", "Book Antiqua", Palatino, Georgia, "DejaVu Serif", serif`;
export const fonteTexto = (tam) => `${tam}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;

export const corRaridade = (r) => RARIDADE[r] ?? RARIDADE.comum;
export const corElemento = (e) => ELEMENTO[e] ?? ELEMENTO.neutro;

// '#ff7a3d' -> '255,122,61' (formato das luzes coloridas). Cor inválida vira branco.
export function hexParaRgb(hex) {
  let h = String(hex ?? '').replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '255,255,255';
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// Fração de um orbe entre 0 e 1; valores inválidos viram vazio.
export const nivelOrbe = (frac) => (Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0);

// Barra fantasma: sobe de imediato quando a vida aumenta e desce devagar, mostrando o dano recente.
export function avancarFantasma(atual, alvo, dt) {
  if (alvo >= atual) return alvo;
  return alvo + (atual - alvo) * Math.exp(-dt / 350);
}

// Oscilação suave em torno de uma base (brilhos e avisos que pulsam).
export function pulsar(t, periodo, amp, base = 0) {
  return base + amp * Math.sin(t / periodo);
}

// Posição (x, y) de um item numa grade de colunas fixas, preenchida linha a linha.
export function posicaoNaGrade(indice, colunas, tamanho, espaco, x0, y0) {
  const coluna = indice % colunas;
  const linha = Math.floor(indice / colunas);
  return { x: x0 + coluna * (tamanho + espaco), y: y0 + linha * (tamanho + espaco) };
}

// Quebra um texto em linhas de no máximo n caracteres, sem partir palavras.
export function quebrarTexto(s, n) {
  const linhas = [];
  let atual = '';
  for (const palavra of String(s ?? '').split(' ')) {
    if (!palavra) continue;
    if ((atual + ' ' + palavra).trim().length > n) {
      if (atual.trim()) linhas.push(atual.trim());
      atual = palavra;
    } else {
      atual += ' ' + palavra;
    }
  }
  if (atual.trim()) linhas.push(atual.trim());
  return linhas;
}
