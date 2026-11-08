// Dados do jogo: materiais, ferramentas, receitas e falhas do circuito.
export const MATERIAL_NOMES = {
  liga_ferrugem: 'Liga de ferrugem',
  fio_cobre: 'Fio de cobre',
  cristal_silicio: 'Cristal de silício',
};

export const TOOL_NOMES = {
  reparo_trilha: 'Reparo de trilha',
  ajuste_energia: 'Ajuste de energia',
  reforco_nucleo: 'Reforço do núcleo',
};

// Custo de cada ferramenta em materiais.
export const RECIPES = {
  reparo_trilha: { liga_ferrugem: 2, fio_cobre: 1 },
  ajuste_energia: { cristal_silicio: 2, fio_cobre: 1 },
  reforco_nucleo: { fio_cobre: 3, liga_ferrugem: 1 },
};

// Falhas do circuito. drop: chance de cair um material ao vencer.
export const FOES = {
  pulga_corrente: { nome: 'Pulga de corrente', hp: 6, atk: 2, def: 0, drop: { fio_cobre: 0.5 } },
  rasgo_trilha: { nome: 'Rasgo de trilha', hp: 9, atk: 3, def: 1, drop: { liga_ferrugem: 0.6 } },
  ruido_termico: { nome: 'Ruído térmico', hp: 12, atk: 4, def: 1, drop: { cristal_silicio: 0.5 } },
  // Corrente que escapa pela porta: rápida e resistente. Aparece na rede de energia.
  vazamento_corrente: { nome: 'Vazamento de corrente', hp: 8, atk: 3, def: 2, drop: { cristal_silicio: 0.6 } },
};

export const REINFORCE_HP = 8;   // vida máxima ganha com cada reforço do núcleo
export const RESPAWN_RATIO = 0.5; // fração da vida máxima ao renascer
