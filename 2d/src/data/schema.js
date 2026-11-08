// Contratos dos dados do jogo. Os arquivos de src/data/ seguem estes formatos.
// Os validadores devolvem uma lista de erros (vazia = válido). Não usam DOM: rodam nos testes.

export const ELEMENTOS = ['neutro', 'calor', 'frio', 'corrente', 'sinal'];
// Quem vence quem: o elemento da chave causa 1,5x no elemento do valor, e recebe 0,75x do elemento do valor.
// Ex.: calor > frio > corrente > sinal > calor. O neutro não tem vantagem nem desvantagem.
export const VANTAGEM = { calor: 'frio', frio: 'corrente', corrente: 'sinal', sinal: 'calor' };

export const RAMOS = ['fusao', 'reparo', 'dissipacao'];
export const SLOTS = ['dissipador', 'antena', 'modulo'];
export const TIPOS_ITEM = ['material', 'consumivel', 'equipamento', 'ferramenta', 'chave', 'missao'];
export const RARIDADES = ['comum', 'raro', 'epico'];
export const COMPORTAMENTOS = ['patrulha', 'perseguidor', 'estatico'];
export const EFEITOS_USO = ['cura', 'calor', 'ep', 'remover', 'buff', 'escudo'];
export const EFEITOS_HABILIDADE = ['dano', 'cura', 'escudo', 'status', 'remover', 'buff', 'calor'];
export const EFEITOS_DIALOGO = ['flag', 'item', 'ciclos', 'xp', 'quest_iniciar', 'quest_concluir', 'curar', 'loja', 'anotar'];
export const CONDICOES_DIALOGO = ['flag', 'quest', 'item', 'nivel', 'chefe', 'ciclos'];
export const TIPOS_ETAPA = ['falar', 'coletar', 'entregar', 'derrotar', 'chefe', 'reparar', 'chegar', 'escanear'];
export const TIPOS_NPC = ['tecnico', 'mercador', 'guardiao', 'narrador'];
export const CELULAS_FERRAMENTA = ['x', 'g', 'o', 'D'];
export const STATUS_IDS = ['queimadura', 'curto', 'lentidao', 'corrosao', 'regeneracao', 'escudo', 'foco', 'fraqueza', 'impulso', 'bloqueio'];

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const chance = (v) => isNum(v) && v >= 0 && v <= 1;

export function validarFalha(f, { chefe = false } = {}) {
  const e = [];
  if (!isStr(f?.id)) e.push('id ausente');
  if (!isStr(f?.nome)) e.push('nome ausente');
  if (!isStr(f?.char) || f.char.length !== 1) e.push('char deve ser um caractere');
  if (!ELEMENTOS.includes(f?.elemento)) e.push(`elemento inválido: ${f?.elemento}`);
  for (const k of ['hp', 'atk', 'def', 'spd', 'xp']) if (!isNum(f?.[k]) || f[k] < 0) e.push(`${k} inválido`);
  if (!isInt(f?.nivel) || f.nivel < 1) e.push('nivel inválido');
  if (!COMPORTAMENTOS.includes(f?.comportamento)) e.push(`comportamento inválido: ${f?.comportamento}`);
  if (!Array.isArray(f?.drops)) e.push('drops deve ser uma lista');
  else for (const d of f.drops) {
    if (!isStr(d?.item) || !chance(d?.chance)) e.push('drop mal formado');
  }
  if (!Array.isArray(f?.ataques) || f.ataques.length === 0) e.push('ataques deve ter ao menos um id');
  if (!isStr(f?.sprite)) e.push('sprite ausente');
  if (!isStr(f?.descricao)) e.push('descricao ausente');
  if (chefe) {
    if (f?.chefe !== true) e.push('chefe deve ser true');
    if (!isStr(f?.camada)) e.push('camada do chefe ausente');
    if (!Array.isArray(f?.fases) || f.fases.length === 0) e.push('fases ausentes');
    else for (const fase of f.fases) {
      if (!chance(fase?.ate) || !Array.isArray(fase?.ataques) || fase.ataques.length === 0) e.push('fase mal formada');
    }
    if (!isNum(f?.recompensa?.xp) || !isNum(f?.recompensa?.ciclos)) e.push('recompensa do chefe mal formada');
  }
  return e;
}

export function validarItem(i) {
  const e = [];
  if (!isStr(i?.id)) e.push('id ausente');
  if (!isStr(i?.nome)) e.push('nome ausente');
  if (!TIPOS_ITEM.includes(i?.tipo)) e.push(`tipo inválido: ${i?.tipo}`);
  if (!RARIDADES.includes(i?.raridade)) e.push('raridade inválida');
  if (!isInt(i?.valor) || i.valor < 0) e.push('valor inválido');
  if (!isStr(i?.descricao)) e.push('descricao ausente');
  if (!isStr(i?.sprite)) e.push('sprite ausente');
  if (i?.tipo === 'equipamento') {
    if (!SLOTS.includes(i?.equipamento?.slot)) e.push('slot inválido');
    if (!i?.equipamento?.mods || typeof i.equipamento.mods !== 'object') e.push('mods ausentes');
    if (i?.equipamento?.elemento && !ELEMENTOS.includes(i.equipamento.elemento)) e.push('elemento do equipamento inválido');
  }
  if (i?.tipo === 'consumivel') {
    if (!Array.isArray(i?.uso?.efeitos) || i.uso.efeitos.length === 0) e.push('uso sem efeitos');
    else for (const ef of i.uso.efeitos) if (!EFEITOS_USO.includes(ef?.tipo)) e.push(`efeito de uso inválido: ${ef?.tipo}`);
  }
  if (i?.tipo === 'ferramenta') {
    if (!Array.isArray(i?.alvo) || i.alvo.length === 0 || i.alvo.some((c) => !CELULAS_FERRAMENTA.includes(c))) e.push('alvo da ferramenta inválido');
  }
  return e;
}

export function validarHabilidade(h) {
  const e = [];
  if (!isStr(h?.id)) e.push('id ausente');
  if (!isStr(h?.nome)) e.push('nome ausente');
  if (!RAMOS.includes(h?.ramo)) e.push('ramo inválido');
  if (!isInt(h?.custo_ep) || h.custo_ep < 0) e.push('custo_ep inválido');
  if (!isInt(h?.nivel) || h.nivel < 1) e.push('nivel inválido');
  if (!isInt(h?.pontos) || h.pontos < 1) e.push('pontos inválidos');
  if (h?.elemento !== null && h?.elemento !== undefined && !ELEMENTOS.includes(h.elemento)) e.push('elemento inválido');
  if (!Array.isArray(h?.efeitos) || h.efeitos.length === 0) e.push('efeitos ausentes');
  else for (const ef of h.efeitos) {
    if (!EFEITOS_HABILIDADE.includes(ef?.tipo)) e.push(`efeito inválido: ${ef?.tipo}`);
    if (ef?.tipo === 'status' && !STATUS_IDS.includes(ef.status)) e.push(`status inválido: ${ef.status}`);
  }
  if (!isStr(h?.descricao)) e.push('descricao ausente');
  return e;
}

export function validarMissao(q) {
  const e = [];
  if (!isStr(q?.id)) e.push('id ausente');
  if (!isStr(q?.nome)) e.push('nome ausente');
  if (!['principal', 'secundaria'].includes(q?.tipo)) e.push('tipo inválido');
  if (!Array.isArray(q?.etapas) || q.etapas.length === 0) e.push('etapas ausentes');
  else for (const et of q.etapas) {
    if (!isStr(et?.id)) e.push('etapa sem id');
    if (!TIPOS_ETAPA.includes(et?.tipo)) e.push(`tipo de etapa inválido: ${et?.tipo}`);
    if (!isStr(et?.texto)) e.push('texto da etapa ausente');
  }
  if (!isStr(q?.descricao)) e.push('descricao ausente');
  return e;
}

// Um diálogo é um grafo de nós. Cada nó tem fala, e opcoes (com 'ir') ou 'ir' direto.
export function validarDialogo(d) {
  const e = [];
  if (!isStr(d?.id)) e.push('id ausente');
  if (!isStr(d?.npc)) e.push('npc ausente');
  if (!d?.nos || typeof d.nos !== 'object') e.push('nos ausentes');
  else {
    if (!d.nos[d.inicio]) e.push('inicio inexistente');
    for (const [nome, no] of Object.entries(d.nos)) {
      if (!isStr(no?.fala)) e.push(`${nome}: fala ausente`);
      const alvos = [no?.ir, ...(no?.opcoes ?? []).map((o) => o?.ir)].filter((x) => x !== undefined && x !== null);
      for (const a of alvos) if (!d.nos[a]) e.push(`${nome}: destino inexistente ${a}`);
      for (const ef of no?.efeitos ?? []) if (!EFEITOS_DIALOGO.includes(ef?.tipo)) e.push(`${nome}: efeito inválido ${ef?.tipo}`);
      for (const o of no?.opcoes ?? []) {
        for (const c of o?.condicoes ?? []) if (!CONDICOES_DIALOGO.includes(c?.tipo)) e.push(`${nome}: condição inválida ${c?.tipo}`);
      }
    }
  }
  if (d?.condicoes) for (const c of d.condicoes) if (!CONDICOES_DIALOGO.includes(c?.tipo)) e.push(`condição inválida ${c?.tipo}`);
  return e;
}

export function validarNpc(n) {
  const e = [];
  if (!isStr(n?.id)) e.push('id ausente');
  if (!isStr(n?.nome)) e.push('nome ausente');
  if (!isStr(n?.camada)) e.push('camada ausente');
  if (!TIPOS_NPC.includes(n?.tipo)) e.push('tipo inválido');
  if (!isStr(n?.sprite)) e.push('sprite ausente');
  return e;
}
