// Menu lateral (gaveta) das telas de passageiro e motoqueiro, e a janela "Meu perfil".
import { h, mount, icone, run, toast, phoneMask, botaoTema, contatoCentral } from '/shared/ui.js';

// Janela simples por cima da tela. Devolve { fechar }.
export function janela(titulo, ...conteudo) {
  const fechar = () => fundo.remove();
  const fundo = h(
    'div',
    { class: 'overlay', onclick: (e) => e.target === fundo && fechar() },
    h(
      'div',
      { class: 'dialog largo', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('div', { class: 'dialog-topo' }, h('h2', {}, titulo), h('button', { class: 'btn small so-icone', 'aria-label': 'Fechar', onclick: fechar }, icone('fechar'))),
      conteudo
    )
  );
  document.body.append(fundo);
  return { fechar };
}

// `itens`: lista de { icone, rotulo, acao } ou { icone, rotulo, href }; itens nulos são ignorados.
export function criarMenu({ client, papel, itens, aoSair }) {
  let aberto = false;
  const lista = h('nav', { class: 'gaveta-itens' });
  const cabeca = h('div', { class: 'gaveta-topo' });
  const gaveta = h('aside', { class: 'gaveta', 'aria-label': 'Menu', 'aria-hidden': 'true', inert: true }, cabeca, lista);
  const fundo = h('div', { class: 'gaveta-fundo', onclick: () => fechar() });
  const botao = h('button', { class: 'btn so-icone', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', onclick: () => (aberto ? fechar() : abrir()) }, icone('menu'));

  function pintar() {
    const u = client.user || { name: '', phone: '' };
    mount(
      cabeca,
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, icone(papel === 'motoqueiro' ? 'moto' : 'usuario')),
      h('div', {}, h('strong', {}, u.name), h('span', {}, phoneMask(u.phone)))
    );
    mount(
      lista,
      itens()
        .filter(Boolean)
        .map((item) => {
          const conteudo = [icone(item.icone), h('span', {}, item.rotulo)];
          if (item.href) return h('a', { href: item.href, target: '_blank', rel: 'noopener', onclick: () => fechar() }, conteudo);
          return h('button', { type: 'button', 'aria-current': item.atual ? 'page' : null, onclick: () => (fechar(), item.acao()) }, conteudo);
        }),
      h('div', { class: 'gaveta-fim' }, botaoTema({ comTexto: true, classe: '' }), h('button', { type: 'button', onclick: () => (fechar(), aoSair()) }, icone('sair'), h('span', {}, 'Sair')))
    );
  }

  function abrir() {
    pintar();
    aberto = true;
    gaveta.classList.add('aberta');
    fundo.classList.add('aberta');
    gaveta.removeAttribute('inert');
    gaveta.setAttribute('aria-hidden', 'false');
    botao.setAttribute('aria-expanded', 'true');
    const primeiro = lista.querySelector('button, a');
    if (primeiro) primeiro.focus();
  }
  function fechar() {
    aberto = false;
    gaveta.classList.remove('aberta');
    fundo.classList.remove('aberta');
    gaveta.setAttribute('inert', '');
    gaveta.setAttribute('aria-hidden', 'true');
    botao.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('keydown', (e) => e.key === 'Escape' && aberto && fechar());

  return { botao, gaveta, fundo, abrir, fechar };
}

// Meu perfil: corrigir o nome e trocar a senha.
export function abrirPerfil(client, aoMudar = () => {}) {
  const nome = h('input', { maxlength: 60, required: true, value: client.user.name, autocomplete: 'name' });
  const salvar = h('button', { class: 'btn primary block', type: 'submit' }, 'Salvar nome');
  const atual = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const nova = h('input', { type: 'password', minlength: 6, maxlength: 72, required: true, autocomplete: 'new-password' });
  const trocar = h('button', { class: 'btn dark block', type: 'submit' }, 'Trocar senha');
  janela(
    'Meu perfil',
    h('p', { class: 'muted', style: 'margin-bottom:14px' }, `Telefone: ${phoneMask(client.user.phone)}`),
    h(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          run(salvar, async () => {
            const { user } = await client.api('/auth/profile', { method: 'PUT', body: { name: nome.value } });
            client.rename(user.name);
            toast('Nome atualizado.', 'ok');
            aoMudar();
          });
        },
      },
      h('label', { class: 'field' }, h('span', {}, 'Seu nome'), nome),
      salvar
    ),
    h(
      'form',
      {
        style: 'margin-top:22px',
        onsubmit: (e) => {
          e.preventDefault();
          run(trocar, async () => {
            client.adopt(await client.api('/auth/password', { body: { current: atual.value, password: nova.value } }));
            atual.value = '';
            nova.value = '';
            toast('Senha trocada.', 'ok');
            aoMudar();
          });
        },
      },
      h('label', { class: 'field' }, h('span', {}, 'Senha atual'), atual),
      h('label', { class: 'field' }, h('span', {}, 'Nova senha (mínimo 6)'), nova),
      trocar
    )
  );
}

// Falar com a central.
export function abrirAjuda(telefone, mensagem) {
  janela('Falar com a central', h('p', { style: 'margin-bottom:14px' }, 'Precisa de ajuda? A central atende por telefone e WhatsApp.'), contatoCentral(telefone, mensagem));
}
