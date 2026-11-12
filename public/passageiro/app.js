// App do passageiro: pedir corrida, acompanhar o motoqueiro, avaliar e ver o histórico.
import { createClient } from '/shared/api.js';
import {
  h, mount, brl, km, toast, run, confirmBox, authScreen, registerSW, dateTime, STATUS_PT, PAYMENT_PT,
  icone, carregarMarca, nomeDaMarca, sloganDaMarca, esqueleto, contatoCentral,
} from '/shared/ui.js';
import { criarMenu, abrirPerfil, abrirAjuda, abrirPix } from '/shared/menu.js';
import { criarMapa, criarCamada, criarRota, enquadrar, ondeEstou, campoEndereco, minutosAte } from '/shared/mapa.js';

const client = createClient('passageiro');
const root = document.getElementById('root');
const ATIVA = ['searching', 'accepted', 'arrived', 'in_progress'];

let map, camada, rota, painel, pagina, mapaEl;
let tempoEl = null; // texto do tempo estimado, atualizado conforme a moto anda
const st = {
  aba: 'pedir',
  ride: null, // corrida em andamento ou a última encerrada (até a pessoa dispensar)
  origem: null,
  destino: null,
  alvo: 'origem', // qual endereço o toque no mapa preenche
  cotacao: null,
  pagamento: 'cash',
  obs: '',
  centro: null,
  central: '',
  cfg: {},
};
let form = null; // peças do formulário de pedido (não são recriadas enquanto a pessoa digita)
let cotacaoSeq = 0;

registerSW();
client.onLogout = iniciar;
document.title = nomeDaMarca();
// Nome e cor da marca vêm do servidor; se mudaram, a tela de entrada é redesenhada.
const nomeAntes = nomeDaMarca();
const configPronta = carregarMarca(client).then((cfg) => {
  document.title = nomeDaMarca();
  // Só redesenha a entrada se o nome mudou (para não apagar o que a pessoa já digitou).
  if (!client.user && nomeDaMarca() !== nomeAntes) iniciar();
  return cfg;
});
iniciar();

function iniciar() {
  if (!client.user) {
    mount(
      root,
      authScreen({
        client,
        title: nomeDaMarca(),
        subtitle: sloganDaMarca(),
        onDone: iniciar,
      })
    );
    return;
  }
  montarEstrutura();
}

async function montarEstrutura() {
  mapaEl = h('div', { class: 'mapa', 'aria-label': 'Mapa' });
  painel = h('section', { class: 'painel', 'aria-live': 'polite' });
  pagina = h('section', { class: 'pagina', hidden: true });
  const titulo = h('h1', {}, `Olá, ${client.user.name.split(' ')[0]}`);
  const avisoEl = h('div', { class: 'aviso', role: 'status', hidden: true });
  // Menu lateral: os itens seguem o que a central deixou ligado.
  const menu = criarMenu({
    client,
    papel: 'passageiro',
    aoSair: sair,
    itens: () => [
      { icone: 'local', rotulo: 'Pedir corrida', atual: st.aba === 'pedir', acao: () => trocarAba('pedir') },
      st.cfg.p_history && { icone: 'relogio', rotulo: 'Histórico', atual: st.aba === 'historico', acao: () => trocarAba('historico') },
      { icone: 'usuario', rotulo: 'Meu perfil', acao: () => abrirPerfil(client, () => (titulo.textContent = `Olá, ${client.user.name.split(' ')[0]}`)) },
      st.cfg.p_support && st.central && { icone: 'ajuda', rotulo: 'Falar com a central', acao: () => abrirAjuda(st.central, 'Olá! Sou passageiro e preciso de ajuda.') },
      st.cfg.p_terms && { icone: 'documento', rotulo: 'Termos e privacidade', href: '/termos.html' },
    ],
  });
  mount(
    root,
    h('div', { class: 'app' }, h('header', { class: 'topo' }, menu.botao, titulo), avisoEl, mapaEl, painel, pagina),
    menu.fundo,
    menu.gaveta
  );

  const cfg = (await configPronta) || { city_lat: -15.78, city_lng: -47.93 };
  if (!client.user) return;
  st.centro = { lat: cfg.city_lat, lng: cfg.city_lng };
  st.central = cfg.support_phone || '';
  st.cfg = cfg;
  if (cfg.notice_passenger) {
    mount(avisoEl, icone('ajuda'), h('span', {}, cfg.notice_passenger));
    avisoEl.hidden = false;
  }
  // Só as formas de pagamento que a central deixou ligadas.
  if (cfg.pay_cash === 0) st.pagamento = 'pix';
  if (cfg.pay_pix === 0) st.pagamento = 'cash';
  map = criarMapa(mapaEl, st.centro, 14);
  camada = criarCamada(map);
  rota = criarRota(map);
  map.on('click', (e) => marcarNoMapa({ lat: e.latlng.lat, lng: e.latlng.lng }));

  const socket = client.connect({ onReconnect: recarregar });
  socket.on('ride:update', (ride) => {
    if (ride.passenger_id !== client.user.id) return;
    if (st.ride && st.ride.id !== ride.id && ATIVA.includes(st.ride.status)) return;
    definirCorrida(ride);
  });
  socket.on('driver:location', (loc) => {
    if (st.ride && st.ride.driver && st.ride.driver.id === loc.driverId) {
      st.ride.driver.lat = loc.lat;
      st.ride.driver.lng = loc.lng;
      camada.set('moto', 'moto', loc);
      atualizarTempo();
    }
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && recarregar());

  await recarregar();
  if (!st.ride) usarMinhaPosicao(true);
}

async function sair() {
  if (st.ride && ATIVA.includes(st.ride.status)) {
    if (!(await confirmBox('Você tem uma corrida em andamento. Sair mesmo assim?', 'Sair'))) return;
  }
  client.logout();
}

// Busca no servidor a situação atual (ao abrir, ao voltar para o app e ao reconectar).
async function recarregar() {
  try {
    const { ride } = await client.api('/rides/active');
    if (ride) return definirCorrida(ride);
    if (st.ride && ATIVA.includes(st.ride.status)) {
      const atual = await client.api(`/rides/${st.ride.id}`);
      return definirCorrida(atual.ride);
    }
  } catch (err) {
    if (client.user) toast(err.message, 'error');
  }
  if (!st.ride) desenhar();
}

function definirCorrida(ride) {
  const antes = st.ride && st.ride.id === ride.id ? st.ride.status : null;
  st.ride = ride;
  if (antes !== ride.status) {
    if (ride.status === 'accepted' && antes) toast('Motoqueiro a caminho!', 'ok');
    if (ride.status === 'arrived') toast('Seu motoqueiro chegou!', 'ok');
    if (ride.status === 'searching' && antes && antes !== 'searching') toast('Procurando outro motoqueiro…');
    if (navigator.vibrate && antes) navigator.vibrate(200);
  }
  desenhar();
}

function trocarAba(aba) {
  st.aba = aba;
  const hist = aba === 'historico';
  mapaEl.hidden = hist;
  painel.hidden = hist;
  pagina.hidden = !hist;
  if (hist) desenharHistorico();
  else {
    map.invalidateSize();
    desenhar();
  }
}

/* ---------- Pedido ---------- */

async function usarMinhaPosicao(silencioso) {
  try {
    const pos = await ondeEstou();
    if (st.ride) return;
    await definirPonto('origem', { ...pos, text: '', precise: true }, true);
    map.setView([pos.lat, pos.lng], 16);
  } catch (err) {
    if (!silencioso) toast(err.message, 'error');
  }
}

async function marcarNoMapa(pos) {
  if (st.ride || st.aba !== 'pedir') return;
  await definirPonto(st.alvo, { ...pos, text: '', precise: true }, true);
}

// Define partida ou destino. Se não veio texto, descobre o endereço pela posição.
async function definirPonto(qual, ponto, buscarTexto) {
  st[qual] = ponto;
  if (qual === 'origem' && !st.destino) st.alvo = 'destino';
  desenharMapaPedido();
  atualizarFormulario();
  cotar();
  if (buscarTexto && !ponto.text) {
    let label = null;
    try {
      label = (await client.api(`/geo/reverse?lat=${ponto.lat}&lng=${ponto.lng}`)).label;
    } catch {
      label = null;
    }
    if (st[qual] === ponto) {
      ponto.text = label || 'Local marcado no mapa';
      atualizarFormulario();
    }
  }
}

function desenharMapaPedido() {
  camada.set('origem', 'origem', st.origem, 'Partida');
  camada.set('destino', 'destino', st.destino, 'Destino');
  camada.remove('moto');
  camada.remove('pulso');
  rota.set(st.origem && st.destino && st.cotacao ? st.cotacao.route : null);
  if (st.origem && st.destino) enquadrar(map, [st.origem, st.destino]);
}

async function cotar() {
  const meu = ++cotacaoSeq;
  st.cotacao = null;
  if (!st.origem || !st.destino) return atualizarFormulario();
  atualizarFormulario(true);
  try {
    const c = await client.api('/rides/estimate', { body: { origin: st.origem, dest: st.destino } });
    if (meu === cotacaoSeq) st.cotacao = c;
  } catch (err) {
    if (meu === cotacaoSeq) toast(err.message, 'error');
  }
  if (meu === cotacaoSeq) {
    atualizarFormulario();
    if (!st.ride) rota.set(st.cotacao ? st.cotacao.route : null);
  }
}

function montarFormulario() {
  const perto = () => st.origem || st.centro;
  const f = {};
  f.origem = campoEndereco({
    client, h, label: 'Partida', placeholder: 'De onde você sai?', near: perto,
    onFocus: () => ((st.alvo = 'origem'), atualizarFormulario()),
    onPick: (p) => definirPonto('origem', p, false),
  });
  f.destino = campoEndereco({
    client, h, label: 'Destino', placeholder: 'Para onde você vai?', near: perto,
    onFocus: () => ((st.alvo = 'destino'), atualizarFormulario()),
    onPick: (p) => definirPonto('destino', p, false),
  });
  f.dica = h('p', { class: 'dica-mapa' });
  f.gps = h('button', { class: 'btn small', type: 'button', onclick: () => run(f.gps, () => usarMinhaPosicao(false)) }, icone('gps'), 'Usar minha localização');
  f.resumo = h('div', { class: 'pilha', hidden: true });
  f.preco = h('strong', { class: 'num' });
  f.distancia = h('span', { class: 'muted' });
  const pagamento = (valor, rotulo) =>
    h(
      'label',
      {},
      h('input', { type: 'radio', name: 'pag', value: valor, checked: st.pagamento === valor, onchange: () => (st.pagamento = valor) }),
      h('span', {}, rotulo)
    );
  f.obs = h('input', {
    placeholder: 'Observação (ex.: portão azul)', maxlength: 200, 'aria-label': 'Observação para o motoqueiro',
    value: st.obs, oninput: () => (st.obs = f.obs.value),
  });
  f.pedir = h('button', { class: 'btn primary big block', onclick: () => run(f.pedir, pedir) }, 'Pedir mototáxi');
  mount(
    f.resumo,
    h('div', { class: 'preco' }, h('div', {}, h('b', {}, 'Valor da corrida'), h('br'), f.distancia), f.preco),
    st.cfg.pay_cash !== 0 && st.cfg.pay_pix !== 0
      ? h('div', { class: 'escolha', role: 'radiogroup', 'aria-label': 'Forma de pagamento' }, pagamento('cash', 'Dinheiro'), pagamento('pix', 'Pix'))
      : h('p', { class: 'muted' }, `Pagamento em ${PAYMENT_PT[st.pagamento].toLowerCase()}, direto ao motoqueiro.`),
    f.obs,
    f.pedir
  );
  f.el = h('div', { class: 'pilha' }, h('h2', {}, 'Para onde vamos?'), f.origem.el, f.destino.el, h('div', { class: 'pilha' }, f.dica, f.gps), f.resumo);
  return f;
}

function atualizarFormulario(calculando) {
  if (!form || st.ride) return;
  if (st.origem && document.activeElement !== form.origem.input) form.origem.set(st.origem.text);
  if (st.destino && document.activeElement !== form.destino.input) form.destino.set(st.destino.text);
  form.origem.ativo(st.alvo === 'origem');
  form.destino.ativo(st.alvo === 'destino');
  form.dica.textContent =
    st.alvo === 'origem'
      ? 'Digite o endereço ou toque no mapa para marcar a partida.'
      : 'Digite o endereço ou toque no mapa para marcar o destino.';
  form.gps.hidden = st.alvo !== 'origem';
  const pronto = !!(st.origem && st.destino);
  form.resumo.hidden = !pronto;
  if (pronto) {
    form.preco.textContent = st.cotacao ? brl(st.cotacao.price) : '…';
    form.distancia.textContent = st.cotacao
      ? `${km(st.cotacao.distance_km)} · cerca de ${st.cotacao.duration_min} min`
      : calculando ? 'Calculando…' : '';
    form.pedir.disabled = !st.cotacao;
    form.pedir.textContent = st.cotacao ? `Pedir mototáxi · ${brl(st.cotacao.price)}` : 'Pedir mototáxi';
  }
}

async function pedir() {
  const { ride } = await client.api('/rides', {
    body: { origin: st.origem, dest: st.destino, payment: st.pagamento, notes: st.obs },
  });
  definirCorrida(ride);
}

function novaCorrida(manterPontos) {
  st.ride = null;
  form = null;
  if (!manterPontos) {
    st.destino = null;
    st.cotacao = null;
    st.obs = '';
    st.alvo = st.origem ? 'destino' : 'origem';
  }
  desenhar();
  if (manterPontos) cotar();
}

/* ---------- Telas por situação ---------- */

function desenhar() {
  if (!painel || st.aba !== 'pedir') return;
  const r = st.ride;
  if (!r) {
    if (!form) {
      form = montarFormulario();
      mount(painel, form.el);
    }
    desenharMapaPedido();
    atualizarFormulario();
    return;
  }
  form = null;
  tempoEl = null;
  camada.set('origem', 'origem', r.origin, 'Partida');
  camada.set('destino', 'destino', r.dest, 'Destino');
  rota.set(ATIVA.includes(r.status) ? r.route : null);
  if (r.status === 'searching') camada.set('pulso', 'pulso', r.origin);
  else camada.remove('pulso');
  if (r.driver && ['accepted', 'arrived', 'in_progress'].includes(r.status)) {
    camada.set('moto', 'moto', r.driver, r.driver.name);
    enquadrar(map, r.status === 'in_progress' ? [r.driver, r.dest] : [r.driver, r.origin]);
  } else {
    camada.remove('moto');
    enquadrar(map, [r.origin, r.dest]);
  }
  mount(painel, (TELAS[r.status] || telaEncerrada)(r));
  atualizarTempo();
}

// Barrinha de etapas: procurando → a caminho → no local → em viagem.
function passos(r) {
  const feito = { searching: 1, accepted: 2, arrived: 3, in_progress: 4 }[r.status] || 0;
  return h('div', { class: 'passos', 'aria-hidden': 'true' }, [1, 2, 3, 4].map((n) => h('i', { class: n <= feito ? 'feito' : '' })));
}

function caixaTempo() {
  tempoEl = h('span');
  return h('p', { class: 'tempo' }, icone('relogio'), tempoEl);
}

// Tempo estimado: até a moto chegar (a caminho) ou até o destino (em viagem).
function atualizarTempo() {
  const r = st.ride;
  if (!tempoEl || !r || !r.driver) return;
  if (r.status === 'accepted') {
    const m = minutosAte(r.driver, r.origin);
    tempoEl.textContent = m ? `Chega em cerca de ${m} min` : 'A caminho';
  } else if (r.status === 'in_progress') {
    const m = minutosAte(r.driver, r.dest);
    tempoEl.textContent = m ? `Cerca de ${m} min até o destino` : 'Em viagem';
  }
}

const trajeto = (r) =>
  h(
    'div',
    { class: 'trajeto' },
    h('div', {}, h('i'), h('span', {}, h('b', {}, 'Partida'), r.origin.text || 'Local marcado no mapa')),
    h('div', {}, h('i'), h('span', {}, h('b', {}, 'Destino'), r.dest.text || 'Local marcado no mapa'))
  );

const valor = (r) =>
  h('div', { class: 'preco' }, h('div', {}, h('b', {}, 'Valor'), h('br'), h('span', { class: 'muted' }, `${PAYMENT_PT[r.payment]} · ${km(r.distance_km)}${r.duration_min ? ` · ${r.duration_min} min` : ''}`)), h('strong', {}, brl(r.price)));

function botaoCancelar(r) {
  const b = h(
    'button',
    {
      class: 'btn ghost block',
      onclick: async () => {
        if (!(await confirmBox('Cancelar esta corrida?', 'Cancelar corrida'))) return;
        run(b, async () => definirCorrida((await client.api(`/rides/${r.id}/cancel`, { body: {} })).ride));
      },
    },
    'Cancelar corrida'
  );
  return b;
}

const cartaoMotoqueiro = (r) =>
  h(
    'div',
    { class: 'pessoa' },
    h('div', { class: 'avatar', 'aria-hidden': 'true' }, icone('moto')),
    h('div', {}, h('strong', {}, r.driver.name), h('span', { class: 'muted' }, `${r.driver.moto_model} · `), h('span', { class: 'tag dark' }, r.driver.plate)),
    h('a', { class: 'btn small', href: `tel:${r.driver.phone}`, 'aria-label': `Ligar para ${r.driver.name}` }, icone('telefone'), 'Ligar')
  );

const TELAS = {
  searching: (r) =>
    h(
      'div',
      { class: 'pilha' },
      passos(r),
      h('div', { class: 'linha-status' }, h('div', { class: 'girando' }), h('div', {}, h('h2', {}, 'Procurando motoqueiro…'), h('p', { class: 'sub' }, 'Isso costuma levar menos de um minuto.'))),
      trajeto(r),
      valor(r),
      botaoCancelar(r)
    ),
  accepted: (r) =>
    h('div', { class: 'pilha' }, passos(r), h('div', {}, h('h2', {}, 'Motoqueiro a caminho'), h('p', { class: 'sub' }, 'Acompanhe a moto no mapa e aguarde no local de partida.')), caixaTempo(), cartaoMotoqueiro(r), trajeto(r), valor(r), botaoCancelar(r)),
  arrived: (r) =>
    h('div', { class: 'pilha' }, passos(r), h('div', {}, h('h2', {}, 'Seu motoqueiro chegou!'), h('p', { class: 'sub' }, `Procure a moto de placa ${r.driver.plate}.`)), cartaoMotoqueiro(r), valor(r), botaoCancelar(r)),
  in_progress: (r) =>
    h('div', { class: 'pilha' }, passos(r), h('div', {}, h('h2', {}, 'Em viagem'), h('p', { class: 'sub' }, 'Boa viagem! Use o capacete.')), caixaTempo(), cartaoMotoqueiro(r), trajeto(r), valor(r), botaoPix(r)),
  completed: telaConcluida,
};

// Corrida em Pix: abre o QR Code com o valor exato, que cai direto na conta do motoqueiro.
function botaoPix(r) {
  if (r.payment !== 'pix') return null;
  return h('button', { class: 'btn dark block', type: 'button', onclick: () => abrirPix(client, `/rides/${r.id}/pix`, 'Pagar com Pix') }, 'Pagar com Pix');
}

function telaConcluida(r) {
  if (r.rating) {
    return h('div', { class: 'pilha' }, h('h2', {}, 'Obrigado!'), h('p', { class: 'sub' }, 'Sua avaliação foi registrada.'), h('button', { class: 'btn primary block', onclick: () => novaCorrida(false) }, 'Nova corrida'));
  }
  let nota = 0;
  const estrelas = h('div', { class: 'estrelas', role: 'radiogroup', 'aria-label': 'Nota de 1 a 5' });
  const enviar = h('button', { class: 'btn primary block', disabled: true, onclick: () => run(enviar, async () => definirCorrida((await client.api(`/rides/${r.id}/rate`, { body: { rating: nota } })).ride)) }, 'Enviar avaliação');
  const pintar = () => {
    mount(
      estrelas,
      [1, 2, 3, 4, 5].map((n) =>
        h('button', { class: n <= nota ? 'on' : '', 'aria-label': `${n} estrela${n > 1 ? 's' : ''}`, 'aria-pressed': String(n <= nota), onclick: () => ((nota = n), (enviar.disabled = false), pintar()) }, '★')
      )
    );
  };
  pintar();
  return h(
    'div',
    { class: 'pilha' },
    h('div', {}, h('h2', {}, 'Você chegou!'), h('p', { class: 'sub' }, `Pague ${brl(r.price)} em ${PAYMENT_PT[r.payment].toLowerCase()} ao motoqueiro.`)),
    botaoPix(r),
    h('p', {}, `Como foi a corrida com ${r.driver ? r.driver.name : 'o motoqueiro'}?`),
    estrelas,
    enviar,
    h('button', { class: 'btn link', onclick: () => novaCorrida(false) }, 'Pular')
  );
}

function telaEncerrada(r) {
  if (r.status === 'no_drivers') {
    return h(
      'div',
      { class: 'pilha' },
      h('div', {}, h('h2', {}, 'Nenhum motoqueiro livre agora'), h('p', { class: 'sub' }, st.central ? 'Tente de novo em instantes ou fale com a central.' : 'Tente de novo em instantes.')),
      h('button', { class: 'btn primary block', onclick: () => novaCorrida(true) }, 'Tentar de novo'),
      contatoCentral(st.central, 'Olá! Não encontrei motoqueiro pelo aplicativo. Pode me ajudar?'),
      h('button', { class: 'btn link', onclick: () => novaCorrida(false) }, 'Mudar o destino')
    );
  }
  const quem = r.cancelled_by === 'admin' ? 'pela central' : 'por você';
  return h(
    'div',
    { class: 'pilha' },
    h('div', {}, h('h2', {}, 'Corrida cancelada'), h('p', { class: 'sub' }, `Cancelada ${quem}.${r.cancel_reason ? ' Motivo: ' + r.cancel_reason : ''}`)),
    h('button', { class: 'btn primary block', onclick: () => novaCorrida(false) }, 'Nova corrida')
  );
}

/* ---------- Histórico ---------- */

async function desenharHistorico() {
  const cabeca = () => h('div', { class: 'cabeca-pagina' }, h('button', { class: 'btn small', onclick: () => trocarAba('pedir') }, icone('voltar'), 'Voltar'), h('h2', {}, 'Minhas corridas'));
  mount(pagina, cabeca(), esqueleto(3));
  let rides = [];
  try {
    rides = (await client.api('/rides/history')).rides;
  } catch (err) {
    return mount(pagina, cabeca(), h('p', { class: 'vazio-lista' }, err.message));
  }
  const tag = { completed: 'ok', cancelled: 'bad', no_drivers: 'warn' };
  mount(
    pagina,
    cabeca(),
    rides.length
      ? h(
          'div',
          { class: 'lista' },
          rides.map((r) =>
            h(
              'article',
              { class: 'item' },
              h('div', { class: 'cab' }, h('span', { class: 'muted' }, dateTime(r.created_at)), h('strong', {}, brl(r.price))),
              trajeto(r),
              h(
                'div',
                { class: 'acoes-linha' },
                h('span', { class: `tag ${tag[r.status] || ''}` }, STATUS_PT[r.status]),
                r.driver && h('span', { class: 'tag' }, r.driver.name),
                r.rating && h('span', { class: 'tag' }, `${'★'.repeat(r.rating)}`)
              )
            )
          )
        )
      : h('p', { class: 'vazio-lista' }, 'Você ainda não fez nenhuma corrida.')
  );
}
