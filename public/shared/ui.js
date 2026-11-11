// Peças de interface usadas pelas três telas.

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
      submit
    );
    mount(
      root,
      h('div', { class: 'brand' }, h('img', { src: '/icon.svg', alt: '', width: 64, height: 64 }), h('h1', {}, title), h('p', {}, subtitle)),
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
