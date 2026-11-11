// Painel da central: mapa ao vivo, lançar corridas, motoqueiros, relatórios e configurações.
import { createClient } from '/shared/api.js';
import {
  h, mount, brl, km, toast, run, confirmBox, authScreen, registerSW, dateTime, phoneMask, STATUS_PT, PAYMENT_PT,
  icone, botaoTema, carregarMarca, aplicarMarca, nomeDaMarca, esqueleto,
} from '/shared/ui.js';
import { criarMapa, criarCamada, criarRota, enquadrar, campoEndereco, ondeEstou, removerMapa } from '/shared/mapa.js';

const client = createClient('central');
const root = document.getElementById('root');

const ABAS = [
  ['vivo', 'aovivo', 'Ao vivo'],
  ['nova', 'mais', 'Nova corrida'],
  ['motoqueiros', 'moto', 'Motoqueiros'],
  ['corridas', 'lista', 'Corridas'],
  ['relatorios', 'grafico', 'Relatórios'],
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
  map.on('click', (e) => definir(f.alvo, { lat: e.latlng.lat, lng: e.latlng.lng, text: '' }));

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
      let label = null;
      try {
        label = (await client.api(`/geo/reverse?lat=${ponto.lat}&lng=${ponto.lng}`)).label;
      } catch {
        label = null;
      }
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
        h('thead', {}, h('tr', {}, ['Nome', 'Telefone', 'Moto', 'Situação', 'Agora', ''].map((t) => h('th', {}, t)))),
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
              h('td', {}, h('span', { class: `tag ${SITUACAO[d.status][1]}` }, SITUACAO[d.status][0])),
              h('td', {}, d.status !== 'approved' ? '—' : d.busy ? h('span', { class: 'tag warn' }, 'Em corrida') : d.online ? h('span', { class: 'tag ok' }, d.fresh ? 'Online' : 'Online, sem sinal') : h('span', { class: 'tag' }, 'Offline')),
              h(
                'td',
                {},
                h(
                  'div',
                  { class: 'acoes-linha', style: 'margin:0' },
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

const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const diasAtras = (n) => new Date(Date.now() - n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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
  campos.brand_name = h('input', { maxlength: 30, required: true });
  campos.support_phone = h('input', { type: 'tel', placeholder: '(00) 00000-0000' });
  // A cor é mostrada na hora; só vale para todos depois de salvar.
  const previa = () => aplicarMarca({ brand_name: campos.brand_name.value, brand_color: campos.brand_color.value });
  campos.brand_color = h('input', { type: 'color', 'aria-label': 'Cor da marca', oninput: previa });
  const paleta = h(
    'div',
    { class: 'cores' },
    ['#ffc107', '#ff6b00', '#e53935', '#0a7cff', '#12a150', '#7b3ff2', '#151515'].map((c) =>
      h('button', { type: 'button', style: `background:${c}`, 'aria-label': `Usar a cor ${c}`, onclick: () => ((campos.brand_color.value = c), previa()) })
    )
  );
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
          const body = {
            city_name: campos.city_name.value, city_lat: centro.lat, city_lng: centro.lng,
            brand_name: campos.brand_name.value, brand_color: campos.brand_color.value,
            support_phone: campos.support_phone.value,
          };
          for (const k of ['base_fare', 'per_km', 'min_fare', 'commission_percent', 'offer_timeout_s']) body[k] = Number(campos[k].value);
          const { settings } = await client.api('/admin/settings', { method: 'PUT', body });
          st.centro = { lat: settings.city_lat, lng: settings.city_lng };
          st.cidade = settings.city_name;
          aplicarMarca(settings);
          document.title = `${nomeDaMarca()} · Central`;
          toast('Configurações salvas.', 'ok');
        });
      },
    },
    h('h3', { class: 'bloco-titulo', style: 'margin-top:0' }, 'Sua marca'),
    h('label', { class: 'field' }, h('span', {}, 'Nome do serviço (aparece para passageiros e motoqueiros)'), campos.brand_name),
    h('div', { class: 'field' }, h('span', {}, 'Cor da marca'), h('div', { class: 'cor' }, campos.brand_color, paleta)),
    h('label', { class: 'field' }, h('span', {}, 'Telefone/WhatsApp da central (aparece para quem precisa de ajuda)'), campos.support_phone),
    h('h3', { class: 'bloco-titulo' }, 'Preço da corrida'),
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
    h('div', { class: 'config' }, h('div', { class: 'pilha' }, form, cartaoRedefinir(), cartaoMinhaSenha()), h('div', { class: 'pilha' }, h('p', { class: 'muted' }, 'Clique no mapa para marcar o centro da cidade. É onde o mapa abre e onde a busca de endereços procura.'), mapaEl, gps))
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

  // Saindo sem salvar, volta a cor que está valendo de verdade.
  return {
    sair: () => {
      removerMapa(map);
      carregarMarca(client);
    },
  };
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

const TELAS = { vivo: telaVivo, nova: telaNova, motoqueiros: telaMotoqueiros, corridas: telaCorridas, relatorios: telaRelatorios, config: telaConfig };
