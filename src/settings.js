// Ajustes do jogador: som, vibração, tamanho do texto e alto contraste.
// Salvos à parte do progresso, em localStorage, sempre com try/catch.

const KEY = 'anel-zero-settings-v1';
const VERSION = 1;

export const TEXT_SIZES = ['normal', 'lg', 'xl'];

export const settings = {
  version: VERSION,
  sound: true,
  vibe: true,
  text: 'normal', // normal | lg | xl
  hc: false,      // alto contraste
  volMusic: 1,    // volume da trilha (0 a 1)
  volSfx: 1,      // volume dos efeitos (0 a 1)
  captions: true, // legendas visuais para sons importantes
  repairHard: false, // última escolha de dificuldade do reparo
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    // Migração: versões futuras podem renomear campos aqui.
    const merged = { ...settings, ...data };
    if (!TEXT_SIZES.includes(merged.text)) merged.text = 'normal';
    Object.assign(settings, merged, { version: VERSION });
  } catch (e) {
    // Ajustes corrompidos: mantém os padrões.
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}

// Aplica as classes visuais no <body>
export function applySettings() {
  const b = document.body;
  b.classList.toggle('hc', !!settings.hc);
  b.classList.toggle('text-lg', settings.text === 'lg');
  b.classList.toggle('text-xl', settings.text === 'xl');
}

// Vibração curta em celulares (ignorada quando não suportada)
export function vibrate(pattern) {
  if (!settings.vibe) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    // Dispositivo sem suporte: nada a fazer.
  }
}

// Anúncio para leitores de tela
export function announce(text) {
  try {
    const el = document.getElementById('sr');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = text; }, 40);
  } catch (e) {
    // ignorar
  }
}
