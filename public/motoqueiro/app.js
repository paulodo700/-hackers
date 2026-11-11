// App do motoqueiro: ficar online, receber ofertas, conduzir a corrida e ver os ganhos.
import { createClient } from '/shared/api.js';
import {
  h, mount, brl, km, toast, run, confirmBox, authScreen, registerSW, dateTime, phoneMask, PAYMENT_PT, beep, unlockSound,
  icone, botaoTema, carregarMarca, nomeDaMarca, esqueleto, contatoCentral,
} from '/shared/ui.js';
import { criarMapa, criarCamada, criarRota, enquadrar, distanciaKm, minutosAte } from '/shared/mapa.js';

const client = createClient('motoqueiro');
const root = document.getElementById('root');

let map, camada, rota, painel, pagina, mapaEl, btnAba;
let tempoEl = null; // texto do tempo estimado na corrida
let desenhado = null; // resumo do que está na tela, para não redesenhar (e reanimar) sem mudança
const st = {
  aba: 'inicio',
  driver: null,
  ride: null,
  offer: null,
  resumo: null,
  pos: null, // última posição do GPS
  gpsErro: false,
  final: null, // corrida recém-finalizada (mostra quanto receber)
};
let watchId = null;
let ultimoEnvio = 0;
let batimento = null;
let ofertaEl = null;
let ofertaTimer = null;
let wakeLock = null;

registerSW();
client.onLogout = iniciar;
document.addEventListener('pointerdown', unlockSound, { once: true });
document.title = `${nomeDaMarca()} · Motoqueiro`;
// Nome e cor da marca vêm do servidor; se mudaram, a tela de entrada é redesenhada.
const nomeAntes = nomeDaMarca();
const configPronta = carregarMarca(client).then((cfg) => {
  document.title = `${nomeDaMarca()} · Motoqueiro`;
  // Só redesenha a entrada se o nome mudou (para não apagar o que a pessoa já digitou).
  if (!client.user && nomeDaMarca() !== nomeAntes) iniciar();
  return cfg;
});
iniciar();

function iniciar() {
  pararGps();
  fecharOferta();
  if (!client.user) {
    mount(
      root,
      authScreen({
        client,
        title: 'Motoqueiro',
        subtitle: `Receba corridas do ${nomeDaMarca()}`,
        extraFields: [
          { name: 'moto_model', label: 'Modelo da moto', attrs: { placeholder: 'Ex.: CG 160', maxlength: 40 } },
          { name: 'plate', label: 'Placa', attrs: { placeholder: 'ABC1D23', maxlength: 10, autocapitalize: 'characters' } },
        ],
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
  btnAba = h('button', { class: 'btn', onclick: () => trocarAba(st.aba === 'inicio' ? 'ganhos' : 'inicio') });
  mount(btnAba, icone('carteira'), 'Ganhos');
  desenhado = null;
  mount(
    root,
    h(
      'div',
      { class: 'app' },
      h('header', { class: 'topo' }, h('h1', {}, client.user.name), btnAba, botaoTema(), h('button', { class: 'btn so-icone', onclick: sair, 'aria-label': 'Sair', title: 'Sair' }, icone('sair'))),
      mapaEl,
      painel,
      pagina
    )
  );

  const cfg = (await configPronta) || { city_lat: -15.78, city_lng: -47.93 };
  if (!client.user) return;
  map = criarMapa(mapaEl, { lat: cfg.city_lat, lng: cfg.city_lng }, 14);
  camada = criarCamada(map);
  rota = criarRota(map);
  // Modo de teste (servidor com DEMO_MODE): sem GPS, um toque no mapa define a posição do motoqueiro.
  st.demo = !!cfg.demo;
  st.central = cfg.support_phone || '';
  if (st.demo) {
    map.on('click', (e) => {
      if (!st.gpsErro && st.pos && !st.posManual) return;
      st.posManual = true;
      st.gpsErro = false;
      st.pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      camada.set('eu', st.ride ? 'moto' : 'eu', st.pos);
      enviarPosicao(true);
      desenhar();
    });
  }

  const socket = client.connect({
    onReconnect: () => {
      enviarPosicao(true);
      recarregar();
    },
  });
  socket.on('ride:offer', (offer) => {
    st.offer = offer;
    abrirOferta();
  });
  socket.on('ride:offer_closed', (info) => {
    if (st.offer && st.offer.offerId === info.offerId) {
      st.offer = null;
      fecharOferta();
    }
  });
  socket.on('ride:update', (ride) => {
    if (ride.driver_id === client.user.id) {
      if (['accepted', 'arrived', 'in_progress'].includes(ride.status)) st.ride = ride;
      else if (st.ride && st.ride.id === ride.id) {
        if (ride.status === 'cancelled') toast('A corrida foi cancelada.', 'error');
        st.ride = null;
      }
    } else if (st.ride && st.ride.id === ride.id) {
      st.ride = null; // saiu desta corrida
    }
    desenhar();
  });
  socket.on('driver:status', recarregar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recarregar();
      manterTelaLigada();
    }
  });
  // Rede de segurança: confere a situação de tempos em tempos, caso algum aviso se perca.
  setInterval(() => client.user && document.visibilityState === 'visible' && recarregar(), 15000);

  iniciarGps();
  await recarregar();
}

async function sair() {
  if (st.ride) return toast('Finalize a corrida antes de sair.', 'error');
  if (st.driver && st.driver.online) {
    try {
      await client.api('/driver/online', { body: { online: false } });
    } catch {
      /* sai mesmo assim */
    }
  }
  client.logout();
}

async function recarregar() {
  if (!client.user) return;
  try {
    aplicar(await client.api('/driver/state'));
  } catch (err) {
    if (client.user && err.status !== 401) toast(err.message, 'error');
  }
}

function aplicar(estado) {
  st.driver = estado.driver;
  st.ride = estado.ride;
  const tinha = st.offer && st.offer.offerId;
  st.offer = estado.offer;
  if (st.offer && st.offer.offerId !== tinha) abrirOferta();
  if (!st.offer) fecharOferta();
  manterTelaLigada();
  desenhar();
  if (st.driver && st.driver.status === 'approved') carregarResumo();
}

async function carregarResumo() {
  try {
    st.resumo = await client.api('/driver/summary');
    if (st.aba === 'inicio' && !st.ride) desenhar();
  } catch {
    /* mantém o último */
  }
}

function trocarAba(aba) {
  st.aba = aba;
  const ganhos = aba === 'ganhos';
  mapaEl.hidden = ganhos;
  painel.hidden = ganhos;
  pagina.hidden = !ganhos;
  mount(btnAba, icone(ganhos ? 'voltar' : 'carteira'), ganhos ? 'Voltar' : 'Ganhos');
  desenhado = null;
  if (ganhos) desenharGanhos();
  else {
    map.invalidateSize();
    desenhar();
  }
}

/* ---------- GPS ---------- */

function iniciarGps() {
  if (!navigator.geolocation) {
    st.gpsErro = true;
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      st.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      const primeiro = st.gpsErro || !camada.has('eu');
      st.gpsErro = false;
      camada.set('eu', st.ride ? 'moto' : 'eu', st.pos);
      if (primeiro) {
        if (!st.ride) map.setView([st.pos.lat, st.pos.lng], 16);
        desenhar();
      }
      atualizarTempo();
      enviarPosicao(false);
    },
    () => {
      if (st.posManual) return;
      st.gpsErro = true;
      desenhar();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  // Parado, o GPS não avisa nada: reenvia a posição a cada 30 s para a central saber que segue ativo.
  batimento = setInterval(() => enviarPosicao(true), 30000);
}

function pararGps() {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  clearInterval(batimento);
}

function enviarPosicao(forcar) {
  if (!st.pos || !st.driver || !st.driver.online || !client.socket) return;
  const agora = Date.now();
  if (!forcar && agora - ultimoEnvio < 5000) return;
  ultimoEnvio = agora;
  client.socket.emit('driver:location', st.pos);
}

async function manterTelaLigada() {
  const precisa = st.driver && st.driver.online && document.visibilityState === 'visible';
  try {
    if (precisa && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!precisa && wakeLock) {
      await wakeLock.release();
    }
  } catch {
    /* sem suporte: segue normalmente */
  }
}

/* ---------- Oferta de corrida ---------- */

function abrirOferta() {
  fecharOferta();
  const o = st.offer;
  if (!o) return;
  const r = o.ride;
  const ateLa = distanciaKm(st.pos, r.origin);
  const barra = h('i');
  const segundos = h('span', { class: 'num' });
  const aceitar = h('button', { class: 'btn go big block', onclick: () => responder(aceitar, 'accept') }, 'Aceitar corrida');
  const recusar = h('button', { class: 'btn ghost block', onclick: () => responder(recusar, 'decline') }, 'Recusar');
  ofertaEl = h(
    'div',
    { class: 'oferta', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Nova corrida' },
    h(
      'div',
      { class: 'conteudo' },
      h('h2', {}, 'Nova corrida'),
      h('div', { class: 'valor' }, brl(r.price)),
      h('p', { class: 'detalhes' }, `${PAYMENT_PT[r.payment]} · corrida de ${km(r.distance_km)}${r.duration_min ? ` (${r.duration_min} min)` : ''}${ateLa !== null ? ` · ${km(ateLa)} até o passageiro` : ''}`),
      h(
        'div',
        { class: 'trajeto' },
        h('div', {}, h('i'), h('span', {}, h('b', {}, 'Buscar em'), r.origin.text || 'Local marcado no mapa')),
        h('div', {}, h('i'), h('span', {}, h('b', {}, 'Levar até'), r.dest.text || 'Local marcado no mapa'))
      ),
      r.notes && h('p', { class: 'obs' }, `Obs.: ${r.notes}`)
    ),
    h('div', { class: 'acoes' }, h('div', { class: 'contagem', 'aria-hidden': 'true' }, barra), h('p', { class: 'detalhes' }, 'Responda em ', segundos), aceitar, recusar)
  );
  document.body.append(ofertaEl);
  aceitar.focus();

  let ultimoBip = 0;
  const total = o.timeoutS * 1000;
  // O prazo é contado a partir da hora do servidor: funciona mesmo se o relógio do celular estiver errado.
  if (!o.fimLocal) o.fimLocal = Date.now() + Math.min(total, o.expiresAt - (o.serverNow || Date.now()));
  const tick = () => {
    const resta = Math.max(0, o.fimLocal - Date.now());
    barra.style.transform = `scaleX(${Math.min(1, resta / total)})`;
    segundos.textContent = `${Math.ceil(resta / 1000)} s`;
    if (Date.now() - ultimoBip > 2500) {
      ultimoBip = Date.now();
      beep();
    }
    if (resta <= 0) {
      // O servidor avisa o encerramento; isto cobre o caso de o aviso se perder.
      st.offer = null;
      fecharOferta();
      toast('O tempo para aceitar acabou.');
      recarregar();
    }
  };
  tick();
  ofertaTimer = setInterval(tick, 250);
}

function fecharOferta() {
  clearInterval(ofertaTimer);
  ofertaTimer = null;
  if (ofertaEl) ofertaEl.remove();
  ofertaEl = null;
}

async function responder(botao, resposta) {
  const o = st.offer;
  if (!o || botao.disabled) return;
  botao.disabled = true;
  try {
    aplicar(await client.api(`/driver/offers/${o.offerId}/${resposta}`, { body: {} }));
    if (resposta === 'accept') toast('Corrida aceita. Vá buscar o passageiro.', 'ok');
  } catch (err) {
    toast(err.message, 'error');
    st.offer = null;
    fecharOferta();
    recarregar();
  }
}

/* ---------- Telas ---------- */

function desenhar() {
  if (!painel || st.aba !== 'inicio') return;
  const d = st.driver;
  if (!d) return mount(painel, esqueleto(2));

  const r = st.ride;
  // Só redesenha quando algo que aparece na tela mudou (o estado é conferido a cada 15 s).
  const resumo = JSON.stringify([
    d.status, d.online, st.gpsErro, !!st.pos, r && [r.id, r.status], st.final && st.final.id,
    st.resumo && [st.resumo.today.total, st.resumo.today.rides, st.resumo.week.total],
  ]);
  if (resumo === desenhado) return;
  desenhado = resumo;
  rota.set(r ? r.route : null);
  if (r) {
    camada.set('origem', 'origem', r.origin, 'Passageiro');
    camada.set('destino', 'destino', r.dest, 'Destino');
    if (st.pos) camada.set('eu', 'moto', st.pos);
    // Só reposiciona o mapa quando a etapa muda (para não "pular" enquanto o motoqueiro olha).
    const quadro = `${r.id}:${r.status}`;
    if (quadro !== st.quadro) {
      st.quadro = quadro;
      enquadrar(map, r.status === 'in_progress' ? [st.pos, r.dest] : [st.pos, r.origin]);
    }
    mount(painel, telaCorrida(r));
    return atualizarTempo();
  }
  st.quadro = null;
  camada.remove('origem');
  camada.remove('destino');
  if (st.pos) camada.set('eu', 'eu', st.pos);

  if (st.final) return mount(painel, telaFinal(st.final));
  if (d.status === 'pending') return mount(painel, telaEspera('relogio', 'Cadastro em análise', 'A central precisa aprovar seu cadastro. Assim que aprovar, esta tela libera sozinha.'));
  if (d.status === 'blocked') return mount(painel, telaEspera('bloqueio', 'Cadastro bloqueado', 'Fale com a central para saber o motivo.'));
  mount(painel, telaInicio(d));
}

const telaEspera = (nomeIcone, titulo, texto) =>
  h('div', { class: 'pilha' }, h('h2', { class: 'linha-status' }, icone(nomeIcone), titulo), h('p', { class: 'sub' }, texto), h('button', { class: 'btn block', onclick: (e) => run(e.currentTarget, recarregar) }, 'Atualizar'), contatoCentral(st.central, 'Olá! Sou motoqueiro e preciso de ajuda com meu cadastro.'));

function telaInicio(d) {
  const alternar = h(
    'button',
    {
      class: `btn big block ${d.online ? 'dark' : 'go'}`,
      onclick: () =>
        run(alternar, async () => {
          unlockSound();
          if (!d.online && !st.pos) throw new Error('Aguardando o GPS. Ative a localização e permita o acesso.');
          aplicar(await client.api('/driver/online', { body: { online: !d.online, ...(st.pos || {}) } }));
          enviarPosicao(true);
        }),
    },
    d.online ? 'Ficar offline' : 'Ficar online'
  );
  const s = st.resumo;
  return h(
    'div',
    { class: 'pilha' },
    h(
      'div',
      { class: 'estado-online' },
      h('span', { class: `bolinha ${d.online ? 'on' : ''}` }),
      h('div', {}, h('h2', {}, d.online ? 'Você está online' : 'Você está offline'), h('p', { class: 'sub' }, d.online ? 'Aguardando corridas. Deixe esta tela aberta.' : 'Fique online para receber corridas.'))
    ),
    st.gpsErro && h('p', { class: 'tag bad' }, st.demo ? 'Sem GPS aqui. Modo de teste: toque no mapa para marcar onde você está.' : 'GPS desligado ou sem permissão. Ative a localização.'),
    s &&
      h(
        'div',
        { class: 'ganhos' },
        h('div', {}, h('b', {}, 'Hoje'), h('strong', {}, brl(s.today.total)), h('br'), h('small', {}, `${s.today.rides} corrida${s.today.rides === 1 ? '' : 's'}`)),
        h('div', {}, h('b', {}, '7 dias'), h('strong', {}, brl(s.week.total)), h('br'), h('small', {}, `${s.week.rides} corrida${s.week.rides === 1 ? '' : 's'}`))
      ),
    alternar
  );
}

function telaCorrida(r) {
  const passo = {
    accepted: { titulo: 'Vá buscar o passageiro', acao: 'arrive', rotulo: 'Cheguei ao local', alvo: r.origin },
    arrived: { titulo: 'Aguardando o passageiro', acao: 'start', rotulo: 'Iniciar corrida', alvo: r.origin },
    in_progress: { titulo: 'Em viagem', acao: 'complete', rotulo: 'Finalizar corrida', alvo: r.dest },
  }[r.status];
  const principal = h(
    'button',
    {
      class: 'btn go big block',
      onclick: async () => {
        if (passo.acao === 'complete' && !(await confirmBox(`Finalizar a corrida e receber ${brl(r.price)}?`, 'Finalizar'))) return;
        run(principal, async () => {
          const estado = await client.api(`/driver/rides/${r.id}/${passo.acao}`, { body: {} });
          if (passo.acao === 'complete') st.final = estado.last;
          aplicar(estado);
        });
      },
    },
    passo.rotulo
  );
  const desistir =
    r.status !== 'in_progress' &&
    h(
      'button',
      {
        class: 'btn link',
        onclick: async (e) => {
          const b = e.currentTarget;
          if (!(await confirmBox('Desistir desta corrida? Ela será passada para outro motoqueiro.', 'Desistir'))) return;
          run(b, async () => aplicar(await client.api(`/driver/rides/${r.id}/cancel`, { body: {} })));
        },
      },
      'Desistir da corrida'
    );
  const linkRota = `https://www.google.com/maps/dir/?api=1&destination=${passo.alvo.lat},${passo.alvo.lng}&travelmode=driving`;
  tempoEl = r.status === 'arrived' ? null : h('span');
  return h(
    'div',
    { class: 'pilha' },
    h('div', {}, h('h2', {}, passo.titulo), h('p', { class: 'sub' }, `${brl(r.price)} · ${PAYMENT_PT[r.payment]} · ${km(r.distance_km)}`)),
    tempoEl && h('p', { class: 'tempo' }, icone('relogio'), tempoEl),
    h(
      'div',
      { class: 'pessoa' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, icone('usuario')),
      h('div', {}, h('strong', {}, r.passenger_name), h('span', { class: 'muted' }, r.passenger_phone ? phoneMask(r.passenger_phone) : 'Sem telefone')),
      r.passenger_phone && h('a', { class: 'btn small', href: `tel:${r.passenger_phone}` }, icone('telefone'), 'Ligar')
    ),
    h(
      'div',
      { class: 'trajeto' },
      h('div', {}, h('i'), h('span', {}, h('b', {}, 'Buscar em'), r.origin.text || 'Local marcado no mapa')),
      h('div', {}, h('i'), h('span', {}, h('b', {}, 'Levar até'), r.dest.text || 'Local marcado no mapa'))
    ),
    r.notes && h('p', { class: 'tag warn' }, `Obs.: ${r.notes}`),
    h('a', { class: 'btn block', href: linkRota, target: '_blank', rel: 'noopener' }, icone('rota'), 'Abrir rota no mapa'),
    principal,
    desistir
  );
}

// Tempo estimado até o passageiro (indo buscar) ou até o destino (em viagem).
function atualizarTempo() {
  const r = st.ride;
  if (!tempoEl || !r) return;
  const indo = r.status === 'accepted';
  const m = minutosAte(st.pos, indo ? r.origin : r.dest);
  tempoEl.textContent = m ? `Cerca de ${m} min até ${indo ? 'o passageiro' : 'o destino'}` : indo ? 'Indo buscar' : 'Em viagem';
}

function telaFinal(r) {
  return h(
    'div',
    { class: 'pilha' },
    h('h2', {}, 'Corrida finalizada'),
    h('div', { class: 'preco' }, h('div', {}, h('b', {}, 'Receba do passageiro'), h('br'), h('span', { class: 'muted' }, PAYMENT_PT[r.payment])), h('strong', {}, brl(r.price))),
    h('button', { class: 'btn primary big block', onclick: () => ((st.final = null), desenhar(), carregarResumo()) }, icone('certo'), 'Pronto')
  );
}

async function desenharGanhos() {
  mount(pagina, h('h2', {}, 'Meus ganhos'), esqueleto(3));
  let s, rides;
  try {
    [s, { rides }] = await Promise.all([client.api('/driver/summary'), client.api('/driver/history')]);
  } catch (err) {
    return mount(pagina, h('h2', {}, 'Meus ganhos'), h('p', { class: 'vazio-lista' }, err.message));
  }
  const bloco = (titulo, v) =>
    h('div', {}, h('b', {}, titulo), h('strong', {}, brl(v.total)), h('br'), h('small', {}, `${v.rides} corrida${v.rides === 1 ? '' : 's'} · comissão ${brl(v.commission)}`));
  mount(
    pagina,
    h('h2', {}, 'Meus ganhos'),
    h('div', { class: 'ganhos' }, bloco('Hoje', s.today), bloco('7 dias', s.week)),
    h('p', { class: 'muted', style: 'margin:10px 0 18px' }, `Comissão da central: ${s.commission_percent}% do valor das corridas.`),
    h('h2', {}, 'Últimas corridas'),
    rides.length
      ? h(
          'div',
          { class: 'lista' },
          rides.map((r) =>
            h(
              'article',
              { class: 'item' },
              h('div', { class: 'cab' }, h('span', { class: 'muted' }, dateTime(r.completed_at)), h('strong', {}, brl(r.price))),
              h('p', {}, `${r.origin.text || 'Partida'} → ${r.dest.text || 'Destino'}`),
              h('div', { class: 'acoes-linha' }, h('span', { class: 'tag' }, PAYMENT_PT[r.payment]), h('span', { class: 'tag' }, km(r.distance_km)), r.rating && h('span', { class: 'tag' }, '★'.repeat(r.rating)))
            )
          )
        )
      : h('p', { class: 'vazio-lista' }, 'Nenhuma corrida concluída ainda.')
  );
}
