// Menu lateral (gaveta) das telas de passageiro e motoqueiro, e a janela "Meu perfil".
import { h, mount, icone, run, toast, phoneMask, botaoTema, contatoCentral, brl, copiar } from '/shared/ui.js';

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
  return { fechar, fundo };
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

// Meu perfil: dados pessoais, contato de emergência, moto e CNH (motorista), e troca de senha.
export async function abrirPerfil(client, aoMudar = () => {}) {
  const corpo = h('div', {}, h('div', { class: 'linha-status' }, h('div', { class: 'girando' }), 'Carregando seus dados…'));
  const j = janela('Meu perfil', corpo);
  let eu;
  try {
    eu = await client.api('/auth/me');
  } catch (err) {
    return mount(corpo, h('p', {}, err.message));
  }
  const u = eu.user;
  const d = eu.driver || null;
  const campo = (rotulo, el) => h('label', { class: 'field' }, h('span', {}, rotulo), el);
  const inp = (valor, attrs = {}) => h('input', { value: valor || '', ...attrs });

  const nome = inp(u.name, { maxlength: 60, required: true, autocomplete: 'name' });
  const email = inp(u.email, { type: 'email', maxlength: 80, autocomplete: 'email', placeholder: 'seu@email.com' });
  const contatoNome = inp(u.emergency_name, { maxlength: 60, placeholder: 'Ex.: Mãe, esposa, irmão' });
  const contatoFone = inp(u.emergency_phone ? phoneMask(u.emergency_phone) : '', { type: 'tel', placeholder: '(00) 00000-0000' });
  // CPF só é pedido ao passageiro para cobrar o Pix pelo gateway.
  const cpf = inp(u.cpf_masked || '', { inputmode: 'numeric', maxlength: 14, placeholder: 'Somente números' });
  const placa = d ? inp(d.plate, { maxlength: 10, autocapitalize: 'characters' }) : null;
  const modelo = d ? inp(d.moto_model, { maxlength: 40 }) : null;
  const cnh = d ? inp(d.cnh_expires, { type: 'date', 'aria-label': 'Validade da CNH' }) : null;
  const salvar = h('button', { class: 'btn primary block', type: 'submit' }, 'Salvar meus dados');

  const atual = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const nova = h('input', { type: 'password', minlength: 6, maxlength: 72, required: true, autocomplete: 'new-password' });
  const trocar = h('button', { class: 'btn dark block', type: 'submit' }, 'Trocar senha');

  mount(
    corpo,
    h(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          run(salvar, async () => {
            const body = {
              name: nome.value,
              email: email.value,
              emergency_name: contatoNome.value,
              emergency_phone: contatoFone.value,
              cpf: cpf.value,
            };
            if (d) Object.assign(body, { plate: placa.value, moto_model: modelo.value, cnh_expires: cnh.value });
            const { user } = await client.api('/auth/profile', { method: 'PUT', body });
            client.rename(user.name);
            toast('Dados salvos.', 'ok');
            aoMudar();
          });
        },
      },
      h('p', { class: 'muted', style: 'margin-bottom:12px' }, `Telefone: ${phoneMask(u.phone)} (para trocar, fale com a central)`),
      h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Dados pessoais'),
      campo('Seu nome', nome),
      campo('E-mail (para avisos e recibos)', email),
      h('h3', { class: 'bloco-titulo' }, 'Documento para pagamento Pix'),
      h('p', { class: 'muted', style: 'margin-bottom:8px' }, 'Seu CPF é enviado ao gateway de pagamento para gerar o Pix da corrida. Não é mostrado a motoristas.'),
      campo('CPF', cpf),
      h('h3', { class: 'bloco-titulo' }, 'Contato de emergência'),
      h('p', { class: 'muted', style: 'margin-bottom:8px' }, 'Quem a central avisa se algo acontecer durante uma corrida.'),
      h('div', { class: 'duas' }, campo('Nome', contatoNome), campo('Telefone', contatoFone)),
      d && h('h3', { class: 'bloco-titulo' }, 'Moto e habilitação'),
      d && h('div', { class: 'duas' }, campo('Placa', placa), campo('Modelo da moto', modelo)),
      d && campo('Validade da CNH', cnh),
      d && h('p', { class: 'muted' }, 'A central é avisada quando a CNH estiver perto de vencer.'),
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
      h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Trocar senha'),
      campo('Senha atual', atual),
      campo('Nova senha (mínimo 6)', nova),
      trocar
    )
  );
  return j;
}

// Falar com a central.
export function abrirAjuda(telefone, mensagem) {
  janela('Falar com a central', h('p', { style: 'margin-bottom:14px' }, 'Precisa de ajuda? A central atende por telefone e WhatsApp.'), contatoCentral(telefone, mensagem));
}

// Janela com o QR Code Pix e o código "copia e cola". `extra` são botões a mais (opcional).
export async function abrirPix(client, caminho, titulo, extra = () => null) {
  const corpo = h('div', { class: 'pilha' }, h('div', { class: 'linha-status' }, h('div', { class: 'girando' }), 'Gerando o Pix…'));
  const j = janela(titulo, corpo);
  try {
    const pix = await client.api(caminho);
    const codigo = h('textarea', { readonly: true, rows: 3, 'aria-label': 'Código Pix copia e cola' }, pix.code);
    mount(
      corpo,
      h('div', { class: 'preco' }, h('div', {}, h('b', {}, 'Valor'), h('br'), h('span', { class: 'muted' }, `Para: ${pix.holder}`)), h('strong', {}, brl(pix.amount))),
      h('img', { class: 'qr', alt: 'QR Code Pix', src: pix.qrImage ? `data:image/png;base64,${pix.qrImage}` : `data:image/svg+xml;utf8,${encodeURIComponent(pix.qr)}` }),
      h('p', { class: 'muted', style: 'text-align:center' }, 'Abra o aplicativo do banco, escolha Pix e aponte a câmera. Ou copie o código abaixo.'),
      codigo,
      h('button', { class: 'btn primary block', type: 'button', onclick: () => copiar(pix.code) }, icone('copiar'), 'Copiar código Pix'),
      pix.to === 'motoqueiro' && h('p', { class: 'muted', style: 'text-align:center' }, 'O valor vai direto para a conta do motoqueiro.'),
      extra(j)
    );
  } catch (err) {
    mount(corpo, h('p', {}, err.message));
  }
  return j;
}

const TIPOS_PIX = [['telefone', 'Telefone'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']];

// Formulário de conta bancária (motoqueiro e central). A senha é pedida para confirmar.
export function formularioBanco({ atual, rotuloBotao = 'Salvar conta', aoSalvar }) {
  const c = {
    holder_name: h('input', { maxlength: 60, required: true, autocomplete: 'name', value: (atual && atual.holder_name) || '' }),
    holder_doc: h('input', { maxlength: 20, required: true, inputmode: 'numeric', placeholder: atual ? 'Digite de novo para confirmar' : 'Somente números' }),
    bank_name: h('input', { maxlength: 40, placeholder: 'Ex.: Nubank, Caixa, Banco do Brasil', value: (atual && atual.bank_name) || '' }),
    pix_type: h('select', { required: true }, TIPOS_PIX.map(([v, t]) => h('option', { value: v, selected: atual && atual.pix_type === v }, t))),
    pix_key: h('input', { maxlength: 80, required: true, value: (atual && atual.pix_key) || '' }),
    password: h('input', { type: 'password', required: true, autocomplete: 'current-password' }),
  };
  const botao = h('button', { class: 'btn primary block', type: 'submit' }, rotuloBotao);
  const campo = (rotulo, el) => h('label', { class: 'field' }, h('span', {}, rotulo), el);
  return h(
    'form',
    {
      onsubmit: (e) => {
        e.preventDefault();
        run(botao, async () => {
          await aoSalvar(Object.fromEntries(Object.entries(c).map(([k, el]) => [k, el.value.trim()])));
          c.password.value = '';
          c.holder_doc.value = '';
        });
      },
    },
    campo('Nome completo do titular da conta', c.holder_name),
    campo('CPF ou CNPJ do titular', c.holder_doc),
    campo('Banco (opcional)', c.bank_name),
    h('div', { class: 'duas' }, campo('Tipo da chave Pix', c.pix_type), campo('Chave Pix', c.pix_key)),
    campo('Sua senha (para confirmar)', c.password),
    botao
  );
}

// Reduz a foto antes de enviar (fotos de celular chegam a 10 MB; aqui ficam com menos de 1 MB).
export async function reduzirFoto(arquivo, lado = 1600) {
  const img = await createImageBitmap(arquivo).catch(() => null);
  if (!img) throw new Error('Não foi possível ler a foto. Tente tirar outra.');
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Não foi possível preparar a foto.');
  return blob;
}
