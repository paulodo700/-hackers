// Catálogo padrão: junta os dados de src/data/ num único objeto, passado ao Game.
import { ITENS } from './data/items.js';
import { FALHAS } from './data/foes.js';
import { HABILIDADES, ATAQUES } from './data/skills.js';
import { NPCS } from './data/npcs.js';
import { DIALOGOS } from './data/dialogues.js';
import { MISSOES } from './data/quests.js';
import { LOOT } from './data/loot.js';
import { LOJAS } from './data/shops.js';
import { STATUS } from './data/status.js';

export const CATALOGO = {
  itens: ITENS,
  falhas: FALHAS,
  habilidades: HABILIDADES,
  ataques: ATAQUES,
  npcs: NPCS,
  dialogos: DIALOGOS,
  missoes: MISSOES,
  loot: LOOT,
  lojas: LOJAS,
  status: STATUS,
};
