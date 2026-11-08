// Navegação por teclado: setas circulam pelos botões da tela aberta, Esc volta, foco inicial em cada tela.
// Não mexe em teclas de jogo (WASD, E, M) — só age quando uma tela de menu está aberta.
const SCREENS = ['#repair', '#shop', '#menu', '#slots', '#controls', '#battle', '#title'];

function isOpen(sel) {
  const el = document.querySelector(sel);
  return !!el && !el.classList.contains('hidden');
}

// Raiz ativa: escolhas do diálogo têm prioridade; depois a tela aberta de cima
export function activeRoot() {
  const choices = document.getElementById('dlg-choices');
  if (choices && !choices.classList.contains('hidden') && choices.children.length) return '#dlg-choices';
  return SCREENS.find((s) => isOpen(s)) || null;
}

function focusables(root) {
  const el = document.querySelector(root);
  if (!el) return [];
  return [...el.querySelectorAll('button:not([disabled]), canvas[tabindex="0"]')]
    .filter((e) => e.getClientRects().length > 0);
}

// Foca o primeiro elemento de uma raiz (chamado ao abrir telas)
export function focusFirst(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  const first = el.matches('button, canvas[tabindex="0"]') ? el : el.querySelector('button:not([disabled]), canvas[tabindex="0"]');
  if (first) setTimeout(() => first.focus(), 0);
}

export function initNav() {
  window.addEventListener('keydown', (e) => {
    const root = activeRoot();
    if (!root || root === '#repair') return; // o reparo trata as próprias teclas
    if (e.code === 'Escape') {
      const back = root === '#slots' ? '#slots-back' : root === '#controls' ? '#btn-controls-back' : null;
      if (back) { e.preventDefault(); document.querySelector(back).click(); }
      return;
    }
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.code];
    if (!dir) return;
    const list = focusables(root);
    if (!list.length) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement);
    const next = i === -1 ? 0 : (i + dir + list.length) % list.length;
    list[next].focus();
  });
}
