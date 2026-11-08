// Lojas: uma por camada com mercador. estoque: null = ilimitado. preco: opcional; sem ele, a
// compra custa o dobro do valor do item. compra: tipos de item que o mercador aceita comprar.

export const LOJAS = {
  loja_dissipador: {
    id: 'loja_dissipador', nome: 'Ventoinhas da Aleta', camada: 'dissipador', mercador: 'aleta',
    estoque: [
      { item: 'pasta_termica', estoque: null },
      { item: 'kit_reparo', estoque: null },
      { item: 'injecao_energia', estoque: 5 },
      { item: 'liga_ferrugem', estoque: null },
      { item: 'fio_cobre', estoque: null },
      { item: 'dissipador_mk1', estoque: 1 },
      { item: 'antena_mk1', estoque: 1 },
    ],
    compra: ['material', 'consumivel', 'equipamento'],
  },
  loja_cache_l3: {
    id: 'loja_cache_l3', nome: 'Bloco da Lira', camada: 'cache_l3', mercador: 'lira',
    estoque: [
      { item: 'kit_reparo', estoque: null },
      { item: 'refrigerante', estoque: null },
      { item: 'pulso_reset', estoque: 5 },
      { item: 'capacitor_reserva', estoque: 3 },
      { item: 'cristal_silicio', estoque: null },
      { item: 'modulo_foco', estoque: 1, preco: 40 },
    ],
    compra: ['material', 'consumivel', 'equipamento'],
  },
  loja_energia: {
    id: 'loja_energia', nome: 'Faíscas do Volt', camada: 'energia', mercador: 'volt',
    estoque: [
      { item: 'kit_reparo', estoque: null },
      { item: 'injecao_energia', estoque: null },
      { item: 'patch_impulso', estoque: 5 },
      { item: 'capacitor_reserva', estoque: 5 },
      { item: 'placa_base', estoque: 4 },
      { item: 'polimero_termico', estoque: 4 },
      { item: 'modulo_sinal', estoque: 1 },
      { item: 'modulo_termico', estoque: 1 },
    ],
    compra: ['material', 'equipamento'],
  },
  loja_substrato: {
    id: 'loja_substrato', nome: 'Sombras da Umbra', camada: 'substrato', mercador: 'umbra',
    estoque: [
      { item: 'kit_reparo', estoque: null },
      { item: 'refrigerante', estoque: null },
      { item: 'pulso_reset', estoque: null },
      { item: 'patch_impulso', estoque: null },
      { item: 'capacitor_reserva', estoque: null },
      { item: 'fragmento_escuro', estoque: 2, preco: 30 },
      { item: 'modulo_ressonante', estoque: 1, preco: 90 },
    ],
    compra: ['material', 'consumivel', 'equipamento'],
  },
};
