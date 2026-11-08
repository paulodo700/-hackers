// Catálogo pequeno para os testes das regras (não é o conteúdo do jogo).
import { STATUS } from '../src/data/status.js';
import { Game } from '../src/game.js';
import { LAYERS } from '../src/layers.js';
import { FOE_CHAR_BY_ID } from '../src/grid.js';

const item = (id, tipo, extra = {}) => ({ id, nome: id.replace(/_/g, ' '), tipo, raridade: 'comum', valor: 10, descricao: 'teste', sprite: id, ...extra });

export const FIXTURE_CATALOG = {
  status: STATUS,
  itens: {
    liga_ferrugem: item('liga_ferrugem', 'material'),
    fio_cobre: item('fio_cobre', 'material'),
    cristal_silicio: item('cristal_silicio', 'material'),
    placa_base: item('placa_base', 'material', { valor: 30 }),
    polimero_termico: item('polimero_termico', 'material'),
    fragmento_escuro: item('fragmento_escuro', 'material', { valor: 60 }),
    reparo_trilha: item('reparo_trilha', 'ferramenta', { alvo: ['x'] }),
    ajuste_energia: item('ajuste_energia', 'ferramenta', { alvo: ['g'] }),
    reforco_nucleo: item('reforco_nucleo', 'ferramenta', { alvo: ['o'] }),
    chave_nucleo: item('chave_nucleo', 'ferramenta', { alvo: ['D'] }),
    pasta_termica: item('pasta_termica', 'consumivel', { valor: 12, uso: { em: 'ambos', efeitos: [{ tipo: 'cura', valor: 8 }, { tipo: 'calor', valor: -25 }] } }),
    pulso_combate: item('pulso_combate', 'consumivel', { valor: 20, uso: { em: 'combate', efeitos: [{ tipo: 'remover', classe: 'negativo' }] } }),
    dissipador_mk1: item('dissipador_mk1', 'equipamento', { valor: 40, equipamento: { slot: 'dissipador', nivel: 1, mods: { def: 2, hp: 5 } } }),
    antena_mk1: item('antena_mk1', 'equipamento', { valor: 40, equipamento: { slot: 'antena', nivel: 1, mods: { atk: 2, crit: 5 } } }),
    missao_mapa: item('missao_mapa', 'missao'),
  },
  falhas: {
    pulga_corrente: { id: 'pulga_corrente', nome: 'Pulga de corrente', char: 'f', elemento: 'corrente', nivel: 1, hp: 6, atk: 2, def: 0, spd: 6, xp: 4, comportamento: 'patrulha', drops: [{ item: 'fio_cobre', chance: 0.5, qtd: 1 }], ataques: ['mordida'], sprite: 'pulga_corrente', descricao: 'Pulga elétrica.' },
    rasgo_trilha: { id: 'rasgo_trilha', nome: 'Rasgo de trilha', char: 'F', elemento: 'corrente', nivel: 2, hp: 9, atk: 3, def: 1, spd: 4, xp: 6, comportamento: 'perseguidor', drops: [{ item: 'liga_ferrugem', chance: 0.6, qtd: 1 }], ataques: ['arranhao'], sprite: 'rasgo_trilha', descricao: 'Corta trilhas.' },
    ruido_termico: { id: 'ruido_termico', nome: 'Ruído térmico', char: 'Q', elemento: 'calor', nivel: 2, hp: 12, atk: 4, def: 1, spd: 3, xp: 7, comportamento: 'estatico', drops: [], ataques: ['chiado'], sprite: 'ruido_termico', descricao: 'Chiado quente.' },
    bolha_termica: { id: 'bolha_termica', nome: 'Bolha térmica', char: 'B', elemento: 'calor', nivel: 2, hp: 30, atk: 6, def: 2, spd: 4, xp: 0, comportamento: 'estatico', drops: [], chefe: true, camada: 'dissipador', ataques: ['chama'], fases: [{ ate: 0.66, ataques: ['chama'] }, { ate: 0.33, ataques: ['chama', 'explosao'] }, { ate: 0, ataques: ['explosao'] }], recompensa: { xp: 30, ciclos: 25, item: 'placa_base' }, sprite: 'bolha_termica', descricao: 'Chefe do dissipador.' },
  },
  habilidades: {
    descarga: { id: 'descarga', nome: 'Descarga', ramo: 'fusao', custo_ep: 4, nivel: 1, pontos: 1, elemento: 'corrente', efeitos: [{ tipo: 'dano', fator: 1.6 }], descricao: 'Descarga elétrica.', sprite: 'ramo_fusao' },
    pasta_de_reparo: { id: 'pasta_de_reparo', nome: 'Pasta de reparo', ramo: 'reparo', custo_ep: 3, nivel: 1, pontos: 1, elemento: null, efeitos: [{ tipo: 'cura', valor: 12 }], descricao: 'Cura.', sprite: 'ramo_reparo' },
    congelar: { id: 'congelar', nome: 'Congelar', ramo: 'dissipacao', custo_ep: 4, nivel: 1, pontos: 1, elemento: 'frio', efeitos: [{ tipo: 'status', status: 'curto', chance: 1, alvo: 'inimigo' }], descricao: 'Atordoa.', sprite: 'ramo_dissipacao' },
  },
  ataques: {
    mordida: { id: 'mordida', nome: 'Mordida', elemento: 'corrente', efeitos: [{ tipo: 'dano', fator: 1 }], descricao: 'Mordida.' },
    arranhao: { id: 'arranhao', nome: 'Arranhão', elemento: 'corrente', efeitos: [{ tipo: 'dano', fator: 1.1 }], descricao: 'Arranhão.' },
    chiado: { id: 'chiado', nome: 'Chiado', elemento: 'calor', efeitos: [{ tipo: 'dano', fator: 1 }, { tipo: 'status', status: 'queimadura', chance: 0.5, duracao: 2 }], descricao: 'Chiado.' },
    chama: { id: 'chama', nome: 'Chama', elemento: 'calor', efeitos: [{ tipo: 'dano', fator: 1.4 }], telegrafo: 'O chefe aquece a placa!', descricao: 'Chama.' },
    explosao: { id: 'explosao', nome: 'Explosão', elemento: 'calor', efeitos: [{ tipo: 'dano', fator: 2 }], telegrafo: 'Uma explosão se prepara!', descricao: 'Explosão.' },
  },
  npcs: {
    tecnico_1: { id: 'tecnico_1', nome: 'Técnica Lia', camada: 'dissipador', tipo: 'tecnico', sprite: 'tecnico_a', descricao: 'Técnica.' },
    mercador_1: { id: 'mercador_1', nome: 'Mercador Ro', camada: 'dissipador', tipo: 'mercador', sprite: 'mercador_a', descricao: 'Mercador.' },
  },
  dialogos: {
    dialogo_lia_1: {
      id: 'dialogo_lia_1', npc: 'tecnico_1', inicio: 'n0',
      nos: {
        n0: { fala: 'Olá, Bit.', opcoes: [{ texto: 'Quero ajudar', ir: 'n1' }, { texto: 'Agora não', ir: null }] },
        n1: { fala: 'Ótimo. Derrote duas pulgas.', efeitos: [{ tipo: 'quest_iniciar', id: 'capitulo_dissipador' }], ir: 'n2' },
        n2: { fala: 'Até logo.' },
      },
    },
  },
  missoes: {
    capitulo_dissipador: {
      id: 'capitulo_dissipador', nome: 'Acalmar o calor', tipo: 'principal', camada: 'dissipador', descricao: 'Teste.',
      etapas: [
        { id: 'falar', tipo: 'falar', npc: 'tecnico_1', texto: 'Fale com a técnica' },
        { id: 'derrotar', tipo: 'derrotar', foe: 'pulga_corrente', qtd: 2, texto: 'Derrote duas pulgas' },
        { id: 'chefe', tipo: 'chefe', chefe: 'bolha_termica', texto: 'Derrote a bolha' },
      ],
      recompensa: { xp: 20, ciclos: 10, itens: [{ item: 'pasta_termica', qtd: 1 }], flags: ['dissipador_limpo'] },
    },
  },
  loot: {
    dissipador: [{ ciclos: [2, 5], itens: [{ item: 'fio_cobre', qtd: 1, peso: 3 }, { item: 'pasta_termica', qtd: 1, peso: 1 }] }],
  },
  lojas: {
    loja_dissipador: { id: 'loja_dissipador', nome: 'Loja do dissipador', camada: 'dissipador', mercador: 'mercador_1', estoque: [{ item: 'pasta_termica', estoque: null }, { item: 'pulso_combate', estoque: 1 }], compra: ['material', 'consumivel', 'equipamento'] },
  },
};

// Toda falha que as camadas usam precisa existir no catálogo: completa com uma falha-teste cada uma.
for (const camada of Object.values(LAYERS)) {
  for (const [foe] of camada.enemies) {
    if (FOE_CHARS_KNOWN(foe)) continue;
    FIXTURE_CATALOG.falhas[foe] = { id: foe, nome: foe.replace(/_/g, ' '), char: FOE_CHAR_BY_ID[foe] ?? '?', elemento: 'neutro', nivel: 1, hp: 6, atk: 2, def: 0, spd: 4, xp: 3, comportamento: 'estatico', drops: [], ataques: ['mordida'], sprite: foe, descricao: 'Falha de teste.' };
  }
}
function FOE_CHARS_KNOWN(foe) { return !!FIXTURE_CATALOG.falhas[foe]; }

export const novoJogo = (seed = 7) => new Game({ seed, catalog: FIXTURE_CATALOG });
