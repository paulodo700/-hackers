// Receitas de criação. produz/qtd: o que sai; custo: materiais e itens gastos; ciclos: moeda gasta.
// Melhorias gastam o equipamento anterior (ex.: dissipador_mk1 → dissipador_mk2).
export const RECEITAS = {
  reparo_trilha: { nome: 'Reparo de trilha', produz: 'reparo_trilha', qtd: 1, custo: { liga_ferrugem: 2, fio_cobre: 1 }, ciclos: 0 },
  ajuste_energia: { nome: 'Ajuste de energia', produz: 'ajuste_energia', qtd: 1, custo: { cristal_silicio: 2, fio_cobre: 1 }, ciclos: 0 },
  reforco_nucleo: { nome: 'Reforço do núcleo', produz: 'reforco_nucleo', qtd: 1, custo: { fio_cobre: 3, liga_ferrugem: 1 }, ciclos: 0 },
  chave_nucleo: { nome: 'Chave do núcleo', produz: 'chave_nucleo', qtd: 1, custo: { cristal_silicio: 1, placa_base: 1 }, ciclos: 10 },

  pasta_termica: { nome: 'Pasta térmica', produz: 'pasta_termica', qtd: 1, custo: { polimero_termico: 1, fio_cobre: 1 }, ciclos: 0 },
  refrigerante: { nome: 'Refrigerante', produz: 'refrigerante', qtd: 1, custo: { polimero_termico: 2, cristal_silicio: 1 }, ciclos: 5 },
  pulso_reset: { nome: 'Pulso de reset', produz: 'pulso_reset', qtd: 1, custo: { cristal_silicio: 1, placa_base: 1 }, ciclos: 5 },
  injecao_energia: { nome: 'Injeção de energia', produz: 'injecao_energia', qtd: 1, custo: { cristal_silicio: 2 }, ciclos: 0 },
  patch_impulso: { nome: 'Patch de impulso', produz: 'patch_impulso', qtd: 1, custo: { cristal_silicio: 1, liga_ferrugem: 1 }, ciclos: 5 },
  kit_reparo: { nome: 'Kit de reparo', produz: 'kit_reparo', qtd: 1, custo: { liga_ferrugem: 2, placa_base: 1 }, ciclos: 10 },

  dissipador_mk1: { nome: 'Dissipador Mk1', produz: 'dissipador_mk1', qtd: 1, custo: { liga_ferrugem: 3, fio_cobre: 2 }, ciclos: 20 },
  antena_mk1: { nome: 'Antena Mk1', produz: 'antena_mk1', qtd: 1, custo: { fio_cobre: 3, cristal_silicio: 1 }, ciclos: 20 },
  modulo_sinal: { nome: 'Módulo de sinal', produz: 'modulo_sinal', qtd: 1, custo: { cristal_silicio: 2, fio_cobre: 2 }, ciclos: 30 },
  modulo_termico: { nome: 'Módulo térmico', produz: 'modulo_termico', qtd: 1, custo: { polimero_termico: 2, fio_cobre: 2 }, ciclos: 30 },
  dissipador_mk2: { nome: 'Dissipador Mk2 (melhoria)', produz: 'dissipador_mk2', qtd: 1, custo: { dissipador_mk1: 1, placa_base: 1, polimero_termico: 1 }, ciclos: 60 },
  dissipador_mk3: { nome: 'Dissipador Mk3 (melhoria)', produz: 'dissipador_mk3', qtd: 1, custo: { dissipador_mk2: 1, fragmento_escuro: 1, placa_base: 2 }, ciclos: 150 },
  antena_mk2: { nome: 'Antena Mk2 (melhoria)', produz: 'antena_mk2', qtd: 1, custo: { antena_mk1: 1, cristal_silicio: 2, placa_base: 1 }, ciclos: 60 },
  antena_mk3: { nome: 'Antena Mk3 (melhoria)', produz: 'antena_mk3', qtd: 1, custo: { antena_mk2: 1, fragmento_escuro: 1, cristal_silicio: 3 }, ciclos: 150 },
};
