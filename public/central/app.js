// Painel da central: mapa ao vivo, lançar corridas, motoqueiros, relatórios e configurações.
import { createClient } from '/shared/api.js';
import {
  h, mount, brl, km, toast, run, confirmBox, authScreen, registerSW, dateTime, phoneMask, STATUS_PT, PAYMENT_PT,
  icone, botaoTema, carregarMarca, aplicarMarca, nomeDaMarca, esqueleto,
} from '/shared/ui.js';
import { criarMapa, criarCamada, criarRota, enquadrar, campoEndereco, ondeEstou, removerMapa, enderecoDoPonto } from '/shared/mapa.js';
import { janela, formularioBanco } from '/shared/menu.js';

const client = createClient('central');
const root = document.getElementById('root');

const ABAS = [
  ['vivo', 'aovivo', 'Ao vivo'],
  ['nova', 'mais', 'Nova corrida'],
  ['motoqueiros', 'moto', 'Motoqueiros'],
  ['passageiros', 'pessoas', 'Passageiros'],
  ['corridas', 'lista', 'Corridas'],
  ['acertos', 'carteira', 'Acertos'],
  ['relatorios', 'grafico', 'Relatórios'],
  ['personalizar', 'pincel', 'Personalizar'],
  ['config', 'ajustes', 'Configurações'],
];
const TAG = { searching: 'warn', accepted: 'ok', arrived: 'ok', in_progress: 'ok', completed: 'ok', cancelled: 'bad', no_drivers: 'bad' };
const SITUACAO = { pending: ['Aguardando aprovação', 'warn'], approved: ['Aprovado', 'ok'], blocked: ['Bloqueado', 'bad'] };

const st = { aba: 'vivo', visao: null, centro: { lat: -15.78, lng: -47.93 }, cidade: '' };
let conteudo, lateral;
let tela = null; // tela atual: { atualizar?(), sair?() }
let recarregando = null;

registerSW();
client.onLogout = iniciar;
document.title = `${nomeDaMarca()} · Central`;
// Nome e cor da marca vêm do servidor; se mudaram, a tela de entrada é redesenhada.
const nomeAntes = nomeDaMarca();
const configPronta = carregarMarca(client).then((cfg) => {
  document.title = `${nomeDaMarca()} · Central`;
  // Só redesenha a entrada se o nome mudou (para não apagar o que a pessoa já digitou).
  if (!client.user && nomeDaMarca() !== nomeAntes) iniciar();
  return cfg;
});
iniciar();

function iniciar() {
  if (tela && tela.sair) tela.sair();
  tela = null;
  if (!client.user) {
    mount(root, authScreen({ client, title: 'Central', subtitle: `Painel de controle · ${nomeDaMarca()}`, allowRegister: false, onDone: iniciar }));
    return;
  }
  montarEstrutura();
}

async function montarEstrutura() {
  lateral = h('nav', { class: 'lateral', 'aria-label': 'Menu' });
  conteudo = h('main', { class: 'conteudo-central' });
  mount(root, h('div', { class: 'central' }, lateral, conteudo));

  const cfg = await configPronta;
  if (!client.user) return;
  if (cfg) {
    st.centro = { lat: cfg.city_lat, lng: cfg.city_lng };
    st.cidade = cfg.city_name;
    st.tz = cfg.tz_offset_hours || 0;
  }

  client.connect({ onReconnect: carregarVisao });
  ligarEventos();
  setInterval(() => client.user && carregarVisao(), 30000);

  await carregarVisao();
  abrir(st.aba);
}

function ligarEventos() {
  const socket = client.socket;
  // Qualquer novidade pede uma nova fotografia do sistema (agrupada para não sobrecarregar).
  for (const ev of ['ride:update', 'drivers:update', 'offers:update']) socket.on(ev, agendarVisao);
  socket.on('driver:location', (loc) => {
    const d = st.visao && st.visao.drivers.find((x) => x.id === loc.driverId);
    if (d) Object.assign(d, { lat: loc.lat, lng: loc.lng, fresh: true });
    if (tela && tela.posicao) tela.posicao(loc);
  });
}

function agendarVisao() {
  clearTimeout(recarregando);
  recarregando = setTimeout(carregarVisao, 250);
}

async function carregarVisao() {
  if (!client.user) return;
  try {
    st.visao = await client.api('/admin/overview');
  } catch (err) {
    if (client.user && err.status !== 401) toast(err.message, 'error');
    return;
  }
  desenharMenu();
  if (tela && tela.atualizar) tela.atualizar();
}

function desenharMenu() {
  const pendentes = st.visao ? st.visao.stats.pending_drivers : 0;
  mount(
    lateral,
    h('div', { class: 'marca' }, h('div', { class: 'logo pequeno' }, icone('moto')), 'Central'),
    ABAS.map(([id, nomeIcone, nome]) =>
      h(
        'button',
        { 'aria-current': st.aba === id ? 'page' : null, onclick: () => abrir(id) },
        icone(nomeIcone),
        nome,
        id === 'motoqueiros' && pendentes > 0 && h('span', { class: 'badge', 'aria-label': `${pendentes} aguardando aprovação` }, pendentes)
      )
    ),
    h('div', { class: 'fim' }, botaoTema({ comTexto: true, classe: '' }), h('button', { onclick: () => client.logout() }, icone('sair'), 'Sair'))
  );
}

function abrir(id) {
  if (tela && tela.sair) tela.sair();
  st.aba = id;
  desenharMenu();
  tela = TELAS[id]();
}

const livres = () => (st.visao ? st.visao.drivers.filter((d) => d.status === 'approved' && d.online && !d.busy) : []);

function seletorMotoqueiro(primeiro = 'Automático (mais próximo)') {
  return h(
    'select',
    { 'aria-label': 'Motoqueiro' },
    h('option', { value: '' }, primeiro),
    livres().map((d) => h('option', { value: d.id }, `${d.name} · ${d.plate}`))
  );
}

const tipoPin = (d) => (d.busy ? 'moto-ocupada' : d.fresh ? 'moto' : 'moto-sumida');

function trajeto(r) {
  return h(
    'div',
    { class: 'trajeto' },
    h('div', {}, h('i'), h('span', {}, h('b', {}, 'Partida'), r.origin.text || 'Local marcado no mapa')),
    h('div', {}, h('i'), h('span', {}, h('b', {}, 'Destino'), r.dest.text || 'Local marcado no mapa'))
  );
}

/* ---------- Ao vivo ---------- */

function telaVivo() {
  const indicadores = h('div', { class: 'indicadores' });
  const mapaEl = h('div', { class: 'mapa' });
  const lista = h('div', { class: 'lista' });
  mount(
    conteudo,
    h('h2', {}, `Ao vivo${st.cidade ? ' · ' + st.cidade : ''}`),
    indicadores,
    h(
      'div',
      { class: 'vivo' },
      h(
        'div',
        {},
        mapaEl,
        h(
          'div',
          { class: 'legenda' },
          h('span', {}, h('i', { style: 'background:#ffc107' }), 'Livre'),
          h('span', {}, h('i', { style: 'background:#ffb38a;border-color:#d9730d' }), 'Em corrida'),
          h('span', {}, h('i', { style: 'background:#d5d4cf;border-color:#8b8a85' }), 'Sem sinal há mais de 2 min')
        )
      ),
      h('div', {}, h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Corridas em andamento'), lista)
    )
  );
  const map = criarMapa(mapaEl, st.centro, 14, { animado: false });
  const camada = criarCamada(map);
  let enquadrado = false;
  let listaAtual = null;

  function atualizar() {
    const v = st.visao;
    if (!v) return;
    const card = (rotulo, valor) => h('div', { class: 'indicador' }, h('b', {}, rotulo), h('strong', {}, valor));
    mount(
      indicadores,
      card('Corridas hoje', v.stats.today_rides),
      card('Faturamento hoje', brl(v.stats.today_revenue)),
      card('Motoqueiros online', v.stats.online_drivers),
      card('Em andamento', v.activeRides.filter((r) => r.status !== 'no_drivers').length)
    );

    const keys = new Set();
    for (const d of v.drivers) {
      if (d.status !== 'approved' || !d.online || d.lat === null) continue;
      keys.add(`d${d.id}`);
      camada.set(`d${d.id}`, tipoPin(d), d, `${d.name} · ${d.plate}`);
    }
    for (const r of v.activeRides) {
      if (r.status === 'in_progress') {
        keys.add(`f${r.id}`);
        camada.set(`f${r.id}`, 'destino', r.dest, `#${r.id} destino de ${r.passenger_name}`);
      } else {
        keys.add(`o${r.id}`);
        camada.set(`o${r.id}`, 'origem', r.origin, `#${r.id} ${r.passenger_name}`);
      }
    }
    camada.keep(keys);
    if (!enquadrado) {
      const pontos = [...v.drivers.filter((d) => d.online && d.lat !== null), ...v.activeRides.map((r) => r.origin)];
      if (pontos.length) {
        enquadrar(map, pontos);
        enquadrado = true;
      }
    }

    // A lista só é refeita quando algo mudou; assim uma escolha em andamento (ex.: motoqueiro) não se perde.
    const assinatura = JSON.stringify([
      v.activeRides.map((r) => [r.id, r.status, r.driver_id]),
      v.drivers.filter((d) => d.status === 'approved' && d.online && !d.busy).map((d) => d.id),
    ]);
    if (assinatura !== listaAtual) {
      listaAtual = assinatura;
      mount(
        lista,
        v.activeRides.length
          ? v.activeRides.map((r) => cartaoCorrida(r))
          : h('p', { class: 'vazio-lista' }, 'Nenhuma corrida em andamento.')
      );
    }
  }

  function cartaoCorrida(r) {
    const acoes = h('div', { class: 'acoes-linha' });
    if (r.status === 'no_drivers') {
      const sel = seletorMotoqueiro();
      const reenviar = h(
        'button',
        { class: 'btn small primary', onclick: () => run(reenviar, () => client.api(`/admin/rides/${r.id}/retry`, { body: { driver_id: sel.value || null } })) },
        'Reenviar'
      );
      acoes.append(sel, reenviar);
    }
    const cancelar = h(
      'button',
      {
        class: 'btn small',
        onclick: async () => {
          if (!(await confirmBox(`Cancelar a corrida #${r.id} de ${r.passenger_name}?`, 'Cancelar corrida'))) return;
          run(cancelar, () => client.api(`/admin/rides/${r.id}/cancel`, { body: { reason: 'Cancelada pela central' } }));
        },
      },
      'Cancelar'
    );
    acoes.append(cancelar);
    return h(
      'article',
      { class: 'item' },
      h('div', { class: 'cab' }, h('span', {}, h('b', {}, `#${r.id} `), r.passenger_name, r.passenger_phone ? ` · ${phoneMask(r.passenger_phone)}` : ''), h('strong', {}, brl(r.price))),
      trajeto(r),
      h(
        'div',
        { class: 'acoes-linha' },
        h('span', { class: `tag ${TAG[r.status]}` }, STATUS_PT[r.status]),
        h('span', { class: 'tag' }, r.source === 'central' ? 'Pela central' : 'Pelo app'),
        h('span', { class: 'tag' }, PAYMENT_PT[r.payment]),
        r.driver && h('span', { class: 'tag dark' }, `${r.driver.name} · ${r.driver.plate}`)
      ),
      acoes
    );
  }

  atualizar();
  return {
    atualizar,
    posicao(loc) {
      const d = st.visao && st.visao.drivers.find((x) => x.id === loc.driverId);
      if (d && d.online) camada.set(`d${d.id}`, tipoPin(d), loc);
    },
    sair: () => removerMapa(map),
  };
}

/* ---------- Nova corrida ---------- */

function telaNova() {
  const f = { origem: null, destino: null, alvo: 'origem', cotacao: null, seq: 0 };
  const mapaEl = h('div', { class: 'mapa' });
  const nome = h('input', { maxlength: 60, placeholder: 'Nome de quem vai na moto', required: true });
  const fone = h('input', { type: 'tel', placeholder: '(00) 00000-0000' });
  const obs = h('input', { maxlength: 200, placeholder: 'Ex.: portão azul, levar troco' });
  const pagamento = h('select', {}, h('option', { value: 'cash' }, 'Dinheiro'), h('option', { value: 'pix' }, 'Pix'));
  const motoBox = h('div', {});
  let moto = seletorMotoqueiro();
  motoBox.append(moto);
  const preco = h('strong', {}, '—');
  const dist = h('span', { class: 'muted' }, 'Marque partida e destino');
  const dica = h('p', { class: 'dica-mapa' });
  const lancar = h('button', { class: 'btn primary big block', type: 'submit', disabled: true }, 'Lançar corrida');

  const campo = (qual, label, placeholder) =>
    campoEndereco({
      client, h, label, placeholder, near: () => f.origem || st.centro,
      onFocus: () => ((f.alvo = qual), pintar()),
      onPick: (p) => definir(qual, p),
    });
  const cOrigem = campo('origem', 'Partida', 'Onde buscar o passageiro?');
  const cDestino = campo('destino', 'Destino', 'Para onde ele vai?');

  const form = h(
    'form',
    {
      class: 'card pilha',
      onsubmit: (e) => {
        e.preventDefault();
        run(lancar, async () => {
          const { ride } = await client.api('/admin/rides', {
            body: {
              passenger_name: nome.value, passenger_phone: fone.value, origin: f.origem, dest: f.destino,
              payment: pagamento.value, notes: obs.value, driver_id: moto.value || null,
            },
          });
          toast(`Corrida #${ride.id} lançada.`, 'ok');
          abrir('vivo');
        });
      },
    },
    h('div', { class: 'duas' }, h('label', { class: 'field' }, h('span', {}, 'Passageiro'), nome), h('label', { class: 'field' }, h('span', {}, 'Telefone (opcional)'), fone)),
    cOrigem.el,
    cDestino.el,
    dica,
    h('div', { class: 'preco' }, h('div', {}, h('b', {}, 'Valor'), h('br'), dist), preco),
    h('div', { class: 'duas' }, h('label', { class: 'field' }, h('span', {}, 'Pagamento'), pagamento), h('label', { class: 'field' }, h('span', {}, 'Enviar para'), motoBox)),
    h('label', { class: 'field' }, h('span', {}, 'Observação'), obs),
    lancar
  );
  mount(conteudo, h('h2', {}, 'Nova corrida'), h('div', { class: 'novo' }, form, mapaEl));

  const map = criarMapa(mapaEl, st.centro, 14, { animado: false });
  const camada = criarCamada(map);
  const rota = criarRota(map);
  map.on('click', (e) => definir(f.alvo, { lat: e.latlng.lat, lng: e.latlng.lng, text: '', precise: true }));

  function pintar() {
    cOrigem.ativo(f.alvo === 'origem');
    cDestino.ativo(f.alvo === 'destino');
    dica.textContent = `Digite o endereço ou clique no mapa para marcar ${f.alvo === 'origem' ? 'a partida' : 'o destino'}.`;
    preco.textContent = f.cotacao ? brl(f.cotacao.price) : '—';
    if (f.cotacao) dist.textContent = `${km(f.cotacao.distance_km)} · cerca de ${f.cotacao.duration_min} min`;
    rota.set(f.cotacao ? f.cotacao.route : null);
    lancar.disabled = !f.cotacao;
  }

  async function definir(qual, ponto) {
    f[qual] = ponto;
    if (qual === 'origem' && !f.destino) f.alvo = 'destino';
    camada.set(qual, qual, ponto);
    if (f.origem && f.destino) enquadrar(map, [f.origem, f.destino]);
    (qual === 'origem' ? cOrigem : cDestino).set(ponto.text || 'Buscando endereço…');
    pintar();
    cotar();
    if (!ponto.text) {
      const label = await enderecoDoPonto(client, ponto.lat, ponto.lng);
      if (f[qual] === ponto) {
        ponto.text = label || 'Local marcado no mapa';
        (qual === 'origem' ? cOrigem : cDestino).set(ponto.text);
      }
    }
  }

  async function cotar() {
    const meu = ++f.seq;
    f.cotacao = null;
    if (!f.origem || !f.destino) return pintar();
    dist.textContent = 'Calculando…';
    pintar();
    try {
      const c = await client.api('/admin/rides/estimate', { body: { origin: f.origem, dest: f.destino } });
      if (meu === f.seq) f.cotacao = c;
    } catch (err) {
      if (meu === f.seq) toast(err.message, 'error');
    }
    if (meu === f.seq) pintar();
  }

  function atualizar() {
    // Atualiza a lista de motoqueiros livres sem perder a escolha.
    const escolhido = moto.value;
    const novo = seletorMotoqueiro();
    if ([...novo.options].some((o) => o.value === escolhido)) novo.value = escolhido;
    moto.replaceWith(novo);
    moto = novo;
    const keys = new Set(['origem', 'destino']);
    for (const d of livres()) {
      if (d.lat === null) continue;
      keys.add(`d${d.id}`);
      camada.set(`d${d.id}`, tipoPin(d), d, d.name);
    }
    camada.keep(keys);
  }

  pintar();
  atualizar();
  nome.focus();
  return { atualizar, sair: () => removerMapa(map) };
}

/* ---------- Motoqueiros ---------- */

function telaMotoqueiros() {
  const caixa = h('div', { class: 'tabela-caixa' });
  let numeros = new Map();
  client
    .api('/admin/drivers/stats')
    .then(({ stats }) => {
      numeros = new Map(stats.map((x) => [x.id, x]));
      atualizar();
    })
    .catch(() => {});
  mount(conteudo, h('h2', {}, 'Motoqueiros'), h('p', { class: 'muted', style: 'margin:-8px 0 14px' }, 'Quem se cadastra pelo app do motoqueiro aparece aqui para aprovação.'), caixa);

  function atualizar() {
    const lista = st.visao ? st.visao.drivers : [];
    if (!lista.length) return mount(caixa, h('p', { class: 'vazio-lista' }, 'Nenhum motoqueiro cadastrado ainda.'));
    const mudar = (d, status, pergunta) => async (e) => {
      const b = e.currentTarget;
      if (pergunta && !(await confirmBox(pergunta, 'Confirmar'))) return;
      run(b, () => client.api(`/admin/drivers/${d.id}/status`, { body: { status } }));
    };
    mount(
      caixa,
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, ['Nome', 'Telefone', 'Moto', 'Corridas', 'Faturou', 'Nota', 'Situação', 'Agora', ''].map((t) => h('th', {}, t)))),
        h(
          'tbody',
          {},
          lista.map((d) =>
            h(
              'tr',
              {},
              h('td', {}, h('b', {}, d.name)),
              h('td', {}, h('a', { href: `tel:${d.phone}` }, phoneMask(d.phone))),
              h('td', {}, `${d.moto_model} · ${d.plate}`),
              h('td', { class: 'n' }, (numeros.get(d.id) || {}).rides || 0),
              h('td', { class: 'n' }, brl((numeros.get(d.id) || {}).revenue || 0)),
              h('td', { class: 'n' }, (numeros.get(d.id) || {}).rating ? `★ ${String(numeros.get(d.id).rating).replace('.', ',')}` : '—'),
              h('td', {}, h('span', { class: `tag ${SITUACAO[d.status][1]}` }, SITUACAO[d.status][0])),
              h('td', {}, d.status !== 'approved' ? '—' : d.busy ? h('span', { class: 'tag warn' }, 'Em corrida') : d.online ? h('span', { class: 'tag ok' }, d.fresh ? 'Online' : 'Online, sem sinal') : h('span', { class: 'tag' }, 'Offline')),
              h(
                'td',
                {},
                h(
                  'div',
                  { class: 'acoes-linha', style: 'margin:0' },
                  h('button', { class: 'btn small', onclick: () => abrirFicha(d.id) }, 'Ver ficha'),
                  d.status !== 'approved' && h('button', { class: 'btn small go', onclick: mudar(d, 'approved') }, d.status === 'blocked' ? 'Desbloquear' : 'Aprovar'),
                  d.status !== 'blocked' && h('button', { class: 'btn small', onclick: mudar(d, 'blocked', `Bloquear ${d.name}? Ele deixa de receber corridas.`) }, 'Bloquear')
                )
              )
            )
          )
        )
      )
    );
  }
  atualizar();
  return { atualizar };
}

/* ---------- Corridas ---------- */

// Datas contadas no fuso da cidade (o mesmo do servidor), e não no relógio do navegador.
const dataLocal = (ms) => new Date(ms + (st.tz || 0) * 3600 * 1000).toISOString().slice(0, 10);
const hoje = () => dataLocal(Date.now());
const diasAtras = (n) => dataLocal(Date.now() - n * 86400000);

function telaCorridas() {
  const de = h('input', { type: 'date', value: hoje() });
  const ate = h('input', { type: 'date', value: hoje() });
  const status = h('select', {}, h('option', { value: '' }, 'Todas'), Object.entries(STATUS_PT).map(([v, t]) => h('option', { value: v }, t)));
  const caixa = h('div', { class: 'tabela-caixa' });
  const buscar = h('button', { class: 'btn small dark', onclick: () => run(buscar, carregar) }, 'Filtrar');
  mount(
    conteudo,
    h('h2', {}, 'Corridas'),
    h('div', { class: 'filtros' }, h('label', { class: 'field' }, h('span', {}, 'De'), de), h('label', { class: 'field' }, h('span', {}, 'Até'), ate), h('label', { class: 'field' }, h('span', {}, 'Situação'), status), buscar),
    caixa
  );

  async function carregar() {
    const qs = new URLSearchParams({ from: de.value, to: ate.value, ...(status.value ? { status: status.value } : {}) });
    const { rides } = await client.api(`/admin/rides?${qs}`);
    if (!rides.length) return mount(caixa, h('p', { class: 'vazio-lista' }, 'Nenhuma corrida neste período.'));
    mount(
      caixa,
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, ['#', 'Quando', 'Passageiro', 'Trajeto', 'Motoqueiro', 'Situação'].map((t) => h('th', {}, t)), h('th', { class: 'n' }, 'Valor'))),
        h(
          'tbody',
          {},
          rides.map((r) =>
            h(
              'tr',
              {},
              h('td', {}, r.id),
              h('td', {}, dateTime(r.created_at)),
              h('td', {}, r.passenger_name, r.passenger_phone ? h('div', { class: 'muted' }, phoneMask(r.passenger_phone)) : null),
              h('td', {}, `${r.origin.text || 'Partida'} → ${r.dest.text || 'Destino'}`, h('div', { class: 'muted' }, `${km(r.distance_km)} · ${PAYMENT_PT[r.payment]} · ${r.source === 'central' ? 'central' : 'app'}`)),
              h('td', {}, r.driver ? r.driver.name : '—'),
              h('td', {}, h('span', { class: `tag ${TAG[r.status]}` }, STATUS_PT[r.status]), r.rating ? ` ${'★'.repeat(r.rating)}` : ''),
              h('td', { class: 'n' }, brl(r.price))
            )
          )
        )
      )
    );
  }
  mount(caixa, esqueleto(3));
  run(buscar, carregar);
  return {};
}

/* ---------- Relatórios ---------- */

function telaRelatorios() {
  const de = h('input', { type: 'date', value: diasAtras(6) });
  const ate = h('input', { type: 'date', value: hoje() });
  const corpo = h('div', {});
  const gerar = h('button', { class: 'btn small dark', onclick: () => run(gerar, carregar) }, 'Gerar');
  mount(
    conteudo,
    h('h2', {}, 'Relatórios'),
    h('div', { class: 'filtros' }, h('label', { class: 'field' }, h('span', {}, 'De'), de), h('label', { class: 'field' }, h('span', {}, 'Até'), ate), gerar),
    corpo
  );

  async function carregar() {
    const rep = await client.api(`/admin/reports?${new URLSearchParams({ from: de.value, to: ate.value })}`);
    const card = (rotulo, valor) => h('div', { class: 'indicador' }, h('b', {}, rotulo), h('strong', {}, valor));
    const maior = Math.max(1, ...rep.byDay.map((d) => d.revenue));
    mount(
      corpo,
      h(
        'div',
        { class: 'indicadores' },
        card('Corridas concluídas', rep.totals.rides),
        card('Faturamento', brl(rep.totals.revenue)),
        card(`Comissão (${rep.commission_percent}%)`, brl(rep.totals.commission)),
        card('Canceladas', rep.totals.cancelled)
      ),
      h('h3', { class: 'bloco-titulo' }, 'Por motoqueiro'),
      rep.byDriver.length
        ? h(
            'div',
            { class: 'tabela-caixa' },
            h(
              'table',
              {},
              h('thead', {}, h('tr', {}, h('th', {}, 'Motoqueiro'), h('th', { class: 'n' }, 'Corridas'), h('th', { class: 'n' }, 'Faturou'), h('th', { class: 'n' }, 'Comissão a pagar'))),
              h('tbody', {}, rep.byDriver.map((d) => h('tr', {}, h('td', {}, h('b', {}, d.name)), h('td', { class: 'n' }, d.rides), h('td', { class: 'n' }, brl(d.revenue)), h('td', { class: 'n' }, brl(d.commission)))))
            )
          )
        : h('p', { class: 'vazio-lista' }, 'Nenhuma corrida concluída neste período.'),
      rep.byDay.length > 0 && h('h3', { class: 'bloco-titulo' }, 'Por dia'),
      rep.byDay.length > 0 &&
        h(
          'div',
          { class: 'card' },
          rep.byDay.map((d) =>
            h(
              'div',
              { class: 'barra' },
              h('span', {}, `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`),
              h('span', {}, h('i', { style: `width:${Math.round((d.revenue / maior) * 100)}%` })),
              h('span', {}, `${brl(d.revenue)} · ${d.rides}`)
            )
          )
        )
    );
  }
  mount(corpo, esqueleto(3));
  run(gerar, carregar);
  return {};
}

/* ---------- Configurações ---------- */

function telaConfig() {
  const mapaEl = h('div', { class: 'mapa' });
  const campos = {};
  const numero = (nome, rotulo, passo = '0.5') => {
    campos[nome] = h('input', { type: 'number', step: passo, min: '0', inputmode: 'decimal', required: true });
    return h('label', { class: 'field' }, h('span', {}, rotulo), campos[nome]);
  };
  campos.city_name = h('input', { maxlength: 80, required: true });
  const posicao = h('p', { class: 'muted' });
  let centro = { ...st.centro };
  const salvar = h('button', { class: 'btn primary block', type: 'submit' }, 'Salvar configurações');
  const exemplo = h('p', { class: 'muted' });

  const form = h(
    'form',
    {
      class: 'card',
      onsubmit: (e) => {
        e.preventDefault();
        run(salvar, async () => {
          const body = { city_name: campos.city_name.value, city_lat: centro.lat, city_lng: centro.lng };
          for (const k of ['base_fare', 'per_km', 'min_fare', 'commission_percent', 'offer_timeout_s']) body[k] = Number(campos[k].value);
          const { settings } = await client.api('/admin/settings', { method: 'PUT', body });
          st.centro = { lat: settings.city_lat, lng: settings.city_lng };
          st.cidade = settings.city_name;
          toast('Configurações salvas.', 'ok');
        });
      },
    },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Preço da corrida'),
    h('div', { class: 'duas' }, numero('base_fare', 'Taxa inicial (R$)'), numero('per_km', 'Valor por km (R$)')),
    h('div', { class: 'duas' }, numero('min_fare', 'Valor mínimo (R$)'), numero('commission_percent', 'Comissão da central (%)', '1')),
    exemplo,
    h('h3', { class: 'bloco-titulo' }, 'Funcionamento'),
    numero('offer_timeout_s', 'Tempo para o motoqueiro aceitar (segundos)', '1'),
    h('h3', { class: 'bloco-titulo' }, 'Cidade'),
    h('label', { class: 'field' }, h('span', {}, 'Nome da cidade'), campos.city_name),
    posicao,
    salvar
  );
  const gps = h('button', { class: 'btn small', onclick: () => run(gps, async () => mover(await ondeEstou())) }, icone('gps'), 'Usar minha localização');
  mount(
    conteudo,
    h('h2', {}, 'Configurações'),
    h('div', { class: 'config' }, h('div', { class: 'pilha' }, form, cartaoMinhaConta(), cartaoRedefinir(), cartaoMinhaSenha(), cartaoRegistro()), h('div', { class: 'pilha' }, h('p', { class: 'muted' }, 'Clique no mapa para marcar o centro da cidade. É onde o mapa abre e onde a busca de endereços procura.'), mapaEl, gps))
  );

  const map = criarMapa(mapaEl, centro, 13, { animado: false });
  const camada = criarCamada(map);
  function mover(p) {
    centro = { lat: p.lat, lng: p.lng };
    camada.set('centro', 'destino', centro, 'Centro da cidade');
    map.setView([centro.lat, centro.lng]);
    posicao.textContent = `Centro marcado: ${centro.lat.toFixed(5)}, ${centro.lng.toFixed(5)}`;
  }
  map.on('click', (e) => mover({ lat: e.latlng.lat, lng: e.latlng.lng }));

  function mostrarExemplo() {
    const b = Number(campos.base_fare.value) || 0;
    const k = Number(campos.per_km.value) || 0;
    const m = Number(campos.min_fare.value) || 0;
    const p = (d) => brl(Math.ceil(Math.max(m, b + k * d) * 2 - 1e-9) / 2);
    exemplo.textContent = `Exemplos: 1 km = ${p(1)} · 3 km = ${p(3)} · 5 km = ${p(5)}`;
  }
  for (const k of ['base_fare', 'per_km', 'min_fare']) campos[k].addEventListener('input', mostrarExemplo);

  (async () => {
    try {
      const { settings } = await client.api('/admin/settings');
      for (const [k, el] of Object.entries(campos)) el.value = settings[k];
      mover({ lat: settings.city_lat, lng: settings.city_lng });
      mostrarExemplo();
    } catch (err) {
      toast(err.message, 'error');
    }
  })();

  return { sair: () => removerMapa(map) };
}

// Quem esqueceu a senha liga para a central, que cria uma nova pelo telefone cadastrado.
function cartaoRedefinir() {
  const fone = h('input', { type: 'tel', placeholder: '(00) 00000-0000', required: true, 'aria-label': 'Telefone da conta' });
  const nova = h('input', { type: 'text', minlength: 6, maxlength: 72, required: true, placeholder: 'Nova senha (mínimo 6)', 'aria-label': 'Nova senha', autocomplete: 'off' });
  const botao = h('button', { class: 'btn dark block', type: 'submit' }, 'Definir nova senha');
  return h(
    'form',
    {
      class: 'card',
      onsubmit: (e) => {
        e.preventDefault();
        run(botao, async () => {
          const r = await client.api('/admin/users/password', { body: { phone: fone.value, password: nova.value } });
          toast(`Senha de ${r.name} trocada. Avise a nova senha a ${r.role === 'driver' ? 'ele(a)' : 'quem pediu'}.`, 'ok');
          fone.value = '';
          nova.value = '';
        });
      },
    },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Esqueceram a senha?'),
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, 'Digite o telefone do passageiro ou motoqueiro e crie uma senha nova para ele.'),
    h('label', { class: 'field' }, h('span', {}, 'Telefone da conta'), fone),
    h('label', { class: 'field' }, h('span', {}, 'Nova senha'), nova),
    botao
  );
}

function cartaoMinhaSenha() {
  const atual = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const nova = h('input', { type: 'password', minlength: 6, maxlength: 72, required: true, autocomplete: 'new-password' });
  const botao = h('button', { class: 'btn dark block', type: 'submit' }, 'Trocar minha senha');
  return h(
    'form',
    {
      class: 'card',
      onsubmit: (e) => {
        e.preventDefault();
        run(botao, async () => {
          client.adopt(await client.api('/auth/password', { body: { current: atual.value, password: nova.value } }));
          client.connect({ onReconnect: carregarVisao }); // reconecta o tempo real com o login novo
          ligarEventos();
          atual.value = '';
          nova.value = '';
          toast('Senha da central trocada.', 'ok');
        });
      },
    },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Minha senha'),
    h('label', { class: 'field' }, h('span', {}, 'Senha atual'), atual),
    h('label', { class: 'field' }, h('span', {}, 'Nova senha (mínimo 6)'), nova),
    botao
  );
}

/* ---------- Passageiros ---------- */

function telaPassageiros() {
  const busca = h('input', { type: 'search', placeholder: 'Buscar por nome ou telefone', 'aria-label': 'Buscar passageiro' });
  const total = h('p', { class: 'muted', style: 'margin:-8px 0 14px' });
  const caixa = h('div', { class: 'tabela-caixa' });
  let timer;
  busca.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(carregar, 350);
  });
  mount(conteudo, h('h2', {}, 'Passageiros'), total, h('div', { class: 'filtros' }, h('label', { class: 'field', style: 'flex:1;max-width:360px' }, busca)), caixa);
  mount(caixa, esqueleto(3));

  async function carregar() {
    let dados;
    try {
      dados = await client.api(`/admin/passengers?${new URLSearchParams({ q: busca.value.trim() })}`);
    } catch (err) {
      return mount(caixa, h('p', { class: 'vazio-lista' }, err.message));
    }
    total.textContent = `${dados.total} passageiro${dados.total === 1 ? '' : 's'} cadastrado${dados.total === 1 ? '' : 's'}.`;
    if (!dados.passengers.length) return mount(caixa, h('p', { class: 'vazio-lista' }, busca.value ? 'Ninguém encontrado.' : 'Nenhum passageiro cadastrado ainda.'));
    mount(
      caixa,
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, ['Nome', 'Telefone', 'Desde'].map((t) => h('th', {}, t)), h('th', { class: 'n' }, 'Corridas'), h('th', { class: 'n' }, 'Canceladas'), h('th', { class: 'n' }, 'Gastou'), h('th', {}, 'Última corrida'), h('th', {}, 'Situação'), h('th', {}, ''))),
        h(
          'tbody',
          {},
          dados.passengers.map((p) => {
            const botao = h(
              'button',
              {
                class: `btn small ${p.blocked ? 'go' : ''}`,
                onclick: async () => {
                  if (!p.blocked && !(await confirmBox(`Bloquear ${p.name}? Essa pessoa não conseguirá mais pedir corridas.`, 'Bloquear'))) return;
                  await run(botao, () => client.api(`/admin/passengers/${p.id}/block`, { body: { blocked: !p.blocked } }));
                  carregar();
                },
              },
              p.blocked ? 'Desbloquear' : 'Bloquear'
            );
            return h(
              'tr',
              {},
              h('td', {}, h('b', {}, p.name)),
              h('td', {}, h('a', { href: `tel:${p.phone}` }, phoneMask(p.phone))),
              h('td', {}, dateTime(p.created_at).slice(0, 5)),
              h('td', { class: 'n' }, p.rides),
              h('td', { class: 'n' }, p.cancelled),
              h('td', { class: 'n' }, brl(p.spent)),
              h('td', {}, p.last_ride ? dateTime(p.last_ride) : '—'),
              h('td', {}, p.blocked ? h('span', { class: 'tag bad' }, 'Bloqueado') : h('span', { class: 'tag ok' }, 'Ativo')),
              h('td', {}, botao)
            );
          })
        )
      )
    );
  }
  carregar();
  return {};
}

/* ---------- Personalizar ---------- */

function telaPersonalizar() {
  const c = {};
  const texto = (nome, rotulo, attrs = {}) => {
    c[nome] = h('input', { maxlength: 160, ...attrs });
    return h('label', { class: 'field' }, h('span', {}, rotulo), c[nome]);
  };
  const liga = (nome, rotulo, detalhe) => {
    c[nome] = h('input', { type: 'checkbox' });
    return h('label', { class: 'interruptor' }, h('span', {}, rotulo, detalhe && h('small', {}, detalhe)), c[nome], h('i'));
  };
  // A cor é mostrada na hora; só vale para todos depois de salvar.
  const previa = () => aplicarMarca({ brand_name: c.brand_name.value, brand_color: c.brand_color.value, slogan: c.slogan.value, default_theme: c.default_theme.value });
  c.brand_color = h('input', { type: 'color', 'aria-label': 'Cor da marca', oninput: previa });
  const paleta = h(
    'div',
    { class: 'cores' },
    ['#ffc107', '#ff6b00', '#e53935', '#0a7cff', '#12a150', '#7b3ff2', '#151515'].map((cor) =>
      h('button', { type: 'button', style: `background:${cor}`, 'aria-label': `Usar a cor ${cor}`, onclick: () => ((c.brand_color.value = cor), previa()) })
    )
  );
  c.default_theme = h('select', {}, h('option', { value: 'auto' }, 'Automático (segue o celular)'), h('option', { value: 'claro' }, 'Claro'), h('option', { value: 'escuro' }, 'Escuro'));
  const salvar = h('button', { class: 'btn primary big block', type: 'submit' }, 'Salvar personalização');
  const cartao = (titulo, ...filhos) => h('section', { class: 'card' }, h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, titulo), filhos);
  const FLAGS = ['pay_cash', 'pay_pix', 'require_docs', 'p_history', 'p_support', 'p_terms', 'd_earnings', 'd_support', 'd_terms'];
  const TEXTOS = ['brand_name', 'brand_color', 'slogan', 'default_theme', 'support_phone', 'notice_passenger', 'notice_driver'];

  const form = h(
    'form',
    {
      onsubmit: (e) => {
        e.preventDefault();
        run(salvar, async () => {
          const body = {};
          for (const k of TEXTOS) body[k] = c[k].value;
          for (const k of FLAGS) body[k] = c[k].checked;
          const { settings } = await client.api('/admin/settings', { method: 'PUT', body });
          aplicarMarca(settings);
          document.title = `${nomeDaMarca()} · Central`;
          toast('Personalização salva. Passageiros e motoqueiros veem ao abrir o app de novo.', 'ok');
        });
      },
    },
    h(
      'div',
      { class: 'personalizar' },
      cartao(
        'Sua marca',
        texto('brand_name', 'Nome do serviço', { maxlength: 30, required: true }),
        texto('slogan', 'Frase de apresentação (tela de entrada do passageiro)', { maxlength: 60, required: true }),
        h('div', { class: 'field' }, h('span', {}, 'Cor da marca'), h('div', { class: 'cor' }, c.brand_color, paleta)),
        h('label', { class: 'field' }, h('span', {}, 'Tema padrão do aplicativo'), c.default_theme)
      ),
      cartao(
        'Avisos e contato',
        texto('notice_passenger', 'Aviso para os passageiros (faixa no topo; vazio = sem aviso)', { placeholder: 'Ex.: Atendemos das 6h às 23h' }),
        texto('notice_driver', 'Aviso para os motoqueiros (vazio = sem aviso)', { placeholder: 'Ex.: Acerto da comissão toda segunda' }),
        texto('support_phone', 'Telefone/WhatsApp da central', { type: 'tel', maxlength: 30, placeholder: '(00) 00000-0000' })
      ),
      cartao(
        'Pagamento e cadastro',
        liga('pay_cash', 'Aceitar dinheiro'),
        liga('pay_pix', 'Aceitar Pix', 'O passageiro recebe um QR Code e o valor cai direto na conta do motoqueiro'),
        liga('require_docs', 'Exigir documentos e conta para aprovar motoqueiro', 'CNH, documento da moto, selfie e chave Pix')
      ),
      cartao(
        'Menu do passageiro',
        liga('p_history', 'Histórico', 'Lista das corridas que a pessoa já fez'),
        liga('p_support', 'Falar com a central', 'Aparece se o telefone da central estiver preenchido'),
        liga('p_terms', 'Termos e privacidade')
      ),
      cartao(
        'Menu do motoqueiro',
        liga('d_earnings', 'Ganhos', 'Total do dia, da semana e últimas corridas'),
        liga('d_support', 'Falar com a central', 'Aparece se o telefone da central estiver preenchido'),
        liga('d_terms', 'Termos e privacidade')
      )
    ),
    h('div', { class: 'barra-salvar' }, salvar)
  );
  const carregando = esqueleto(2);
  mount(conteudo, h('h2', {}, 'Personalizar'), h('p', { class: 'muted', style: 'margin:-8px 0 16px' }, 'Deixe o aplicativo com a cara do seu serviço. "Pedir corrida", "Início", "Meu perfil" e "Sair" ficam sempre no menu.'), carregando);

  (async () => {
    try {
      const { settings } = await client.api('/admin/settings');
      for (const k of TEXTOS) c[k].value = settings[k];
      for (const k of FLAGS) c[k].checked = !!settings[k];
      if (carregando.isConnected) carregando.replaceWith(form);
    } catch (err) {
      toast(err.message, 'error');
    }
  })();

  // Saindo sem salvar, volta o que está valendo de verdade.
  return { sair: () => carregarMarca(client) };
}


/* ---------- Ficha do motoqueiro ---------- */

const TIPO_PIX = { telefone: 'Telefone', cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', aleatoria: 'Chave aleatória' };

async function abrirFicha(id) {
  const corpo = h('div', {}, esqueleto(2));
  const j = janela('Ficha do motoqueiro', corpo);
  j.fundo.firstChild.classList.add('ficha');
  let f;
  try {
    f = await client.api(`/admin/drivers/${id}`);
  } catch (err) {
    return mount(corpo, h('p', {}, err.message));
  }
  const d = f.driver;
  const item = (rotulo, valor) => [h('dt', {}, rotulo), h('dd', {}, valor || '—')];
  const fotos = h('div', { class: 'fotos' });
  // As fotos são protegidas: cada uma é baixada com o login da central.
  for (const kind of Object.keys(f.labels)) {
    const fig = h('figure', {}, h('div', { class: 'falta' }, f.docs[kind] ? 'Carregando…' : 'Não enviada'), h('figcaption', {}, f.labels[kind]));
    fotos.append(fig);
    if (!f.docs[kind]) continue;
    client
      .fileUrl(`/admin/drivers/${id}/documents/${kind}`)
      .then((url) => {
        const img = h('img', { src: url, alt: f.labels[kind], tabindex: 0, onclick: () => janela(f.labels[kind], h('img', { class: 'foto-grande', src: url, alt: f.labels[kind] })).fundo.firstChild.classList.add('ficha') });
        fig.firstChild.replaceWith(img);
      })
      .catch(() => (fig.firstChild.textContent = 'Erro ao abrir'));
  }
  const completo = Object.values(f.docs).every(Boolean) && !!f.bank;
  const acao = (rotulo, classe, status, pergunta) =>
    h(
      'button',
      {
        class: `btn ${classe}`,
        onclick: async (e) => {
          const b = e.currentTarget;
          if (pergunta && !(await confirmBox(pergunta, 'Confirmar'))) return;
          const ok = await run(b, () => client.api(`/admin/drivers/${id}/status`, { body: { status } }));
          if (ok) {
            toast(status === 'approved' ? `${d.name} aprovado.` : `${d.name} bloqueado.`, 'ok');
            j.fechar();
          }
        },
      },
      rotulo
    );
  mount(
    corpo,
    !completo && h('p', { class: 'alerta' }, 'Cadastro incompleto: confira abaixo o que falta o motoqueiro enviar.'),
    h(
      'div',
      { class: 'ficha-grade' },
      h('dl', {}, item('Nome', d.name), item('Telefone', phoneMask(d.phone)), item('Moto', `${d.moto_model} · ${d.plate}`), item('Cadastro', dateTime(d.created_at)), item('Situação', SITUACAO[d.status][0])),
      h(
        'dl',
        {},
        f.bank
          ? [item('Titular da conta', f.bank.holder_name), item('CPF/CNPJ do titular', f.bank.holder_doc), item('Banco', f.bank.bank_name), item('Chave Pix', `${TIPO_PIX[f.bank.pix_type]}: ${f.bank.pix_key}`)]
          : item('Conta para receber', 'Não cadastrada'),
        item('Comissão em aberto', `${brl(f.owed.amount)} (${f.owed.rides} corrida${f.owed.rides === 1 ? '' : 's'})`)
      )
    ),
    h('h3', { class: 'bloco-titulo' }, 'Documentos'),
    h('p', { class: 'muted' }, 'Compare o rosto da selfie com a foto da CNH e confira se a placa bate com o documento da moto. Clique na foto para ampliar.'),
    fotos,
    h('div', { class: 'acoes-linha', style: 'margin-top:18px' }, d.status !== 'approved' && acao(d.status === 'blocked' ? 'Desbloquear' : 'Aprovar motoqueiro', 'go', 'approved'), d.status !== 'blocked' && acao('Bloquear', '', 'blocked', `Bloquear ${d.name}? Ele deixa de receber corridas.`))
  );
}

/* ---------- Acertos (comissão) ---------- */

function telaAcertos() {
  const corpo = h('div', {}, esqueleto(3));
  mount(conteudo, h('h2', {}, 'Acertos de comissão'), h('p', { class: 'muted', style: 'margin:-8px 0 16px' }, 'As corridas são pagas direto ao motoqueiro. Aqui você vê quanto cada um deve de comissão e confirma quando o Pix cair na sua conta.'), corpo);

  async function carregar() {
    let v;
    try {
      v = await client.api('/admin/settlements');
    } catch (err) {
      return mount(corpo, h('p', { class: 'vazio-lista' }, err.message));
    }
    const card = (rotulo, valor) => h('div', { class: 'indicador' }, h('b', {}, rotulo), h('strong', {}, valor));
    mount(
      corpo,
      !v.central_ready && h('p', { class: 'alerta' }, 'Você ainda não cadastrou sua conta para receber. Vá em Configurações → Minha conta para receber. Sem ela os motoqueiros não conseguem gerar o Pix da comissão.'),
      h('div', { class: 'indicadores' }, card('Total a receber', brl(v.total)), card('Motoqueiros devendo', v.drivers.length), card('Avisaram que pagaram', v.drivers.filter((d) => d.notice_at).length), card('Acertos confirmados', v.history.length)),
      h('h3', { class: 'bloco-titulo' }, 'Em aberto'),
      v.drivers.length
        ? h(
            'div',
            { class: 'tabela-caixa' },
            h(
              'table',
              {},
              h('thead', {}, h('tr', {}, h('th', {}, 'Motoqueiro'), h('th', {}, 'Telefone'), h('th', { class: 'n' }, 'Corridas'), h('th', { class: 'n' }, 'Deve'), h('th', {}, 'Aviso'), h('th', {}, ''))),
              h(
                'tbody',
                {},
                v.drivers.map((d) => {
                  const botao = h(
                    'button',
                    {
                      class: 'btn small go',
                      onclick: async () => {
                        if (!(await confirmBox(`Confirmar que recebeu ${brl(d.amount)} de ${d.name}? Confira antes no extrato do seu banco.`, 'Recebi'))) return;
                        const ok = await run(botao, () => client.api('/admin/settlements', { body: { driver_id: d.id } }));
                        if (ok) {
                          toast('Acerto confirmado.', 'ok');
                          carregar();
                        }
                      },
                    },
                    'Confirmar recebimento'
                  );
                  return h(
                    'tr',
                    {},
                    h('td', {}, h('b', {}, d.name)),
                    h('td', {}, h('a', { href: `tel:${d.phone}` }, phoneMask(d.phone))),
                    h('td', { class: 'n' }, d.rides),
                    h('td', { class: 'n' }, h('b', {}, brl(d.amount))),
                    h('td', {}, d.notice_at ? h('span', { class: 'tag ok' }, `Avisou que pagou em ${dateTime(d.notice_at)}`) : h('span', { class: 'tag' }, 'Sem aviso')),
                    h('td', {}, botao)
                  );
                })
              )
            )
          )
        : h('p', { class: 'vazio-lista' }, 'Ninguém deve comissão no momento.'),
      v.history.length > 0 && h('h3', { class: 'bloco-titulo' }, 'Últimos acertos confirmados'),
      v.history.length > 0 &&
        h(
          'div',
          { class: 'tabela-caixa' },
          h(
            'table',
            {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Motoqueiro'), h('th', { class: 'n' }, 'Corridas'), h('th', { class: 'n' }, 'Valor'))),
            h('tbody', {}, v.history.map((x) => h('tr', {}, h('td', {}, dateTime(x.paid_at)), h('td', {}, x.driver_name), h('td', { class: 'n' }, x.rides), h('td', { class: 'n' }, brl(x.amount)))))
          )
        )
    );
  }
  carregar();
  return {};
}

/* ---------- Conta da central e registro de atividades ---------- */

function cartaoMinhaConta() {
  const caixa = h('div', {}, esqueleto(1));
  const pintar = (bank) =>
    mount(
      caixa,
      bank
        ? h('p', { class: 'tag ok', style: 'margin-bottom:12px' }, `Conta cadastrada: ${bank.holder_name} · ${TIPO_PIX[bank.pix_type]}: ${bank.pix_key}`)
        : h('p', { class: 'alerta' }, 'Nenhuma conta cadastrada. Os motoqueiros só conseguem pagar a comissão por Pix depois disso.'),
      formularioBanco({
        atual: bank,
        rotuloBotao: bank ? 'Atualizar minha conta' : 'Salvar minha conta',
        aoSalvar: async (dados) => {
          const r = await client.api('/admin/bank', { method: 'PUT', body: dados });
          toast('Conta da central salva.', 'ok');
          pintar(r.bank);
        },
      })
    );
  client
    .api('/admin/bank')
    .then((r) => pintar(r.bank))
    .catch((err) => mount(caixa, h('p', {}, err.message)));
  return h(
    'section',
    { class: 'card' },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Minha conta para receber'),
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, 'É para esta conta que os motoqueiros pagam a comissão. Use uma chave Pix no seu nome ou no da sua empresa.'),
    caixa
  );
}

function cartaoRegistro() {
  const lista = h('div', { class: 'registro' }, 'Carregando…');
  client
    .api('/admin/audit')
    .then(({ entries }) =>
      mount(
        lista,
        entries.length
          ? entries.map((e) => h('div', {}, h('time', {}, `${dateTime(e.at)} · ${e.user_name || 'sistema'}`), h('br'), h('b', {}, e.action), e.detail ? ` — ${e.detail}` : ''))
          : 'Nenhuma atividade registrada ainda.'
      )
    )
    .catch((err) => (lista.textContent = err.message));
  return h(
    'section',
    { class: 'card' },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Registro de atividades'),
    h('p', { class: 'muted', style: 'margin-bottom:8px' }, 'Tudo que mexe com dinheiro, senhas e cadastros fica anotado aqui.'),
    lista
  );
}

const TELAS = {
  vivo: telaVivo, nova: telaNova, motoqueiros: telaMotoqueiros, passageiros: telaPassageiros, corridas: telaCorridas, acertos: telaAcertos,
  relatorios: telaRelatorios, personalizar: telaPersonalizar, config: telaConfig,
};
