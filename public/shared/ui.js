// Peças de interface usadas pelas três telas.
import { icone } from '/shared/icones.js';

export { icone };

// Cria um elemento. Texto sempre entra como texto (nunca como HTML), o que evita injeção.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function mount(root, ...children) {
  root.replaceChildren(...children.flat(Infinity).filter(Boolean));
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (n) => BRL.format(Number(n) || 0);
export const km = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;

export function phoneMask(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function dateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_PT = {
  searching: 'Procurando motoqueiro',
  accepted: 'Motoqueiro a caminho',
  arrived: 'Motoqueiro no local',
  in_progress: 'Em viagem',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  no_drivers: 'Sem motoqueiro disponível',
};
export const PAYMENT_PT = { cash: 'Dinheiro', pix: 'Pix' };

let toastTimer;
export function toast(message, kind = 'info') {
  let box = document.querySelector('.toast');
  if (!box) {
    box = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.dataset.kind = kind;
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('on'), 3800);
}

// Executa uma ação de botão: trava o botão enquanto roda e mostra o erro, se houver.
export async function run(button, fn) {
  if (button && button.disabled) return;
  if (button) button.disabled = true;
  try {
    return await fn();
  } catch (err) {
    toast(err.message || 'Algo deu errado', 'error');
    return undefined;
  } finally {
    if (button) button.disabled = false;
  }
}

export function confirmBox(message, okLabel = 'Confirmar', cancelLabel = 'Voltar') {
  return new Promise((resolve) => {
    const close = (answer) => {
      overlay.remove();
      resolve(answer);
    };
    const overlay = h(
      'div',
      { class: 'overlay', onclick: (e) => e.target === overlay && close(false) },
      h(
        'div',
        { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
        h('p', {}, message),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => close(false) }, cancelLabel),
          h('button', { class: 'btn danger', onclick: () => close(true) }, okLabel)
        )
      )
    );
    document.body.append(overlay);
  });
}

// Aviso sonoro de corrida nova. O navegador só libera som depois de um toque na tela,
// por isso `unlockSound` é chamado no primeiro toque.
let audioCtx = null;
export function unlockSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}
export function beep() {
  if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    for (const [offset, freq] of [[0, 880], [0.22, 1175]]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    }
  } catch {
    /* sem som: segue só com a vibração */
  }
}

// Tela de entrar / criar conta.
export function authScreen({ client, title, subtitle, allowRegister = true, extraFields = [], onDone }) {
  let mode = 'login';
  const root = h('main', { class: 'auth' });

  function render() {
    const registering = mode === 'register';
    const fields = {};
    const input = (name, label, attrs) => {
      fields[name] = h('input', { id: `f-${name}`, name, required: true, ...attrs });
      return h('label', { class: 'field', for: `f-${name}` }, h('span', {}, label), fields[name]);
    };
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, registering ? 'Criar conta' : 'Entrar');
    const form = h(
      'form',
      {
        class: 'card',
        onsubmit: (e) => {
          e.preventDefault();
          run(submit, async () => {
            const values = Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value.trim()]));
            if (registering) await client.register(values);
            else await client.login(values.phone, values.password);
            onDone();
          });
        },
      },
      registering && input('name', 'Seu nome', { autocomplete: 'name', maxlength: 60 }),
      input('phone', 'Telefone com DDD', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '(00) 00000-0000' }),
      registering && extraFields.map((f) => input(f.name, f.label, f.attrs || {})),
      input('password', registering ? 'Crie uma senha (mínimo 6)' : 'Senha', {
        type: 'password',
        minlength: 6,
        autocomplete: registering ? 'new-password' : 'current-password',
      }),
      submit,
      registering &&
        h('p', { class: 'aceite' }, 'Ao criar a conta, você concorda com os ', h('a', { href: '/termos.html', target: '_blank', rel: 'noopener' }, 'Termos de uso e a Política de privacidade'), '.')
    );
    mount(
      root,
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, icone('moto')), h('h1', {}, title), h('p', {}, subtitle)),
      form,
      allowRegister &&
        h(
          'button',
          { class: 'btn link', onclick: () => ((mode = registering ? 'login' : 'register'), render()) },
          registering ? 'Já tenho conta. Entrar' : 'Não tem conta? Criar agora'
        )
    );
  }
  render();
  return root;
}

// Registra o service worker (permite instalar como app). Falhar aqui não atrapalha nada.
export function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* ---------- Marca e tema ---------- */

// Escolhe texto preto ou branco conforme a cor de fundo, para sempre dar leitura.
export function corSobre(hex) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return lum > 0.4 ? '#151515' : '#ffffff';
}

// Aplica nome e cor da marca vindos do servidor e guarda para a próxima abertura.
export function aplicarMarca(cfg) {
  const cor = cfg && /^#[0-9a-f]{6}$/i.test(cfg.brand_color || '') ? cfg.brand_color : '#ffc107';
  const sobre = corSobre(cor);
  document.documentElement.style.setProperty('--marca', cor);
  document.documentElement.style.setProperty('--sobre-marca', sobre);
  const nome = (cfg && cfg.brand_name) || 'Mototáxi';
  const slogan = (cfg && cfg.slogan) || 'Peça sua moto em poucos toques';
  const tema = cfg && ['claro', 'escuro'].includes(cfg.default_theme) ? cfg.default_theme : 'auto';
  try {
    localStorage.setItem('mototaxi:marca', JSON.stringify({ cor, sobre, nome, slogan, tema }));
    // Tema padrão escolhido pela central vale para quem ainda não escolheu o seu no aparelho.
    if (!localStorage.getItem('mototaxi:tema')) {
      if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
      else document.documentElement.setAttribute('data-tema', tema);
    }
  } catch {
    /* segue sem guardar */
  }
  return nome;
}

export function nomeDaMarca() {
  try {
    return (JSON.parse(localStorage.getItem('mototaxi:marca') || 'null') || {}).nome || 'Mototáxi';
  } catch {
    return 'Mototáxi';
  }
}

export function sloganDaMarca() {
  try {
    return (JSON.parse(localStorage.getItem('mototaxi:marca') || 'null') || {}).slogan || 'Peça sua moto em poucos toques';
  } catch {
    return 'Peça sua moto em poucos toques';
  }
}

// Copia um texto (ex.: chave Pix) e avisa.
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Copiado!', 'ok');
  } catch {
    toast(`Copie: ${texto}`);
  }
}

// Caixa com a chave Pix e botão de copiar. Sem chave configurada, não mostra nada.
export function caixaPix(chave) {
  if (!chave) return null;
  return h('div', { class: 'pix' }, h('div', {}, h('b', {}, 'Chave Pix'), h('span', {}, chave)), h('button', { class: 'btn small', type: 'button', onclick: () => copiar(chave) }, icone('copiar'), 'Copiar'));
}

export async function carregarMarca(client) {
  try {
    const cfg = await client.api('/public/config');
    aplicarMarca(cfg);
    return cfg;
  } catch {
    return null;
  }
}

const temaEscuro = () => {
  const t = document.documentElement.getAttribute('data-tema');
  return t ? t === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Botão que alterna entre claro e escuro. `comTexto` mostra o nome ao lado (menu da central).
export function botaoTema({ comTexto = false, classe = 'btn so-icone' } = {}) {
  const botao = h('button', { class: classe, type: 'button' });
  const pintar = () => {
    const escuro = temaEscuro();
    const rotulo = escuro ? 'Modo claro' : 'Modo escuro';
    botao.setAttribute('aria-label', rotulo);
    botao.title = rotulo;
    mount(botao, icone(escuro ? 'sol' : 'lua'), comTexto && rotulo);
  };
  botao.addEventListener('click', () => {
    const novo = temaEscuro() ? 'claro' : 'escuro';
    document.documentElement.setAttribute('data-tema', novo);
    try {
      localStorage.setItem('mototaxi:tema', novo);
    } catch {
      /* segue sem guardar */
    }
    pintar();
  });
  pintar();
  return botao;
}

// Blocos de "carregando" no formato de uma lista.
export function esqueleto(n = 3) {
  return h('div', { class: 'esqueleto', 'aria-label': 'Carregando', role: 'status' }, Array.from({ length: n }, () => h('div')));
}

export const minutos = (n) => (n ? `${n} min` : '');

// Botões para falar com a central (telefone e WhatsApp). Sem número configurado, não mostra nada.
export function contatoCentral(digitos, mensagem = 'Olá! Preciso de ajuda.') {
  const d = String(digitos || '');
  if (d.length !== 10 && d.length !== 11) return null;
  return h(
    'div',
    { class: 'row' },
    h('a', { class: 'btn small', href: `tel:+55${d}` }, icone('telefone'), 'Ligar para a central'),
    h('a', { class: 'btn small', href: `https://wa.me/55${d}?text=${encodeURIComponent(mensagem)}`, target: '_blank', rel: 'noopener' }, 'WhatsApp')
  );
}
