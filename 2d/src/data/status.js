// Efeitos de estado em combate. 'dano' e 'cura' são por turno; 'duracao' conta turnos do dono.
export const STATUS = {
  queimadura: { nome: 'Queimadura', classe: 'negativo', duracao: 3, dano: 2, descricao: 'Perde vida todo turno.' },
  curto: { nome: 'Curto-circuito', classe: 'negativo', duracao: 1, descricao: 'Perde a próxima ação.' },
  lentidao: { nome: 'Lentidão', classe: 'negativo', duracao: 3, spd: -3, descricao: 'Velocidade reduzida; esquiva menor.' },
  corrosao: { nome: 'Corrosão', classe: 'negativo', duracao: 3, defPct: -0.3, descricao: 'Defesa reduzida em 30%.' },
  fraqueza: { nome: 'Fraqueza', classe: 'negativo', duracao: 3, atkPct: -0.3, descricao: 'Ataque reduzido em 30%.' },
  regeneracao: { nome: 'Regeneração', classe: 'positivo', duracao: 3, cura: 3, descricao: 'Recupera vida todo turno.' },
  escudo: { nome: 'Escudo', classe: 'positivo', duracao: 3, descricao: 'Absorve dano até acabar (vale a quantidade do escudo).' },
  foco: { nome: 'Foco', classe: 'positivo', duracao: 3, crit: 20, descricao: 'Chance de crítico +20%.' },
  impulso: { nome: 'Impulso', classe: 'positivo', duracao: 3, atk: 3, descricao: 'Ataque +3.' },
  bloqueio: { nome: 'Bloqueio térmico', classe: 'positivo', duracao: 1, reducaoDano: 0.5, descricao: 'Recebe metade do dano até o próximo turno.' },
};
