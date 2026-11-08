// Conteúdo dos baús por camada. Cada baú usa um perfil; o perfil sorteia uma entrada pelo peso
// (com o rng determinístico do jogo) e uma quantia de ciclos entre min e max.

export const LOOT = {
  dissipador: [
    { ciclos: [3, 8], itens: [{ item: 'liga_ferrugem', qtd: 2, peso: 4 }, { item: 'fio_cobre', qtd: 2, peso: 4 }, { item: 'pasta_termica', qtd: 1, peso: 2 }] },
    { ciclos: [5, 10], itens: [{ item: 'kit_reparo', qtd: 1, peso: 3 }, { item: 'cristal_silicio', qtd: 1, peso: 3 }, { item: 'capacitor_reserva', qtd: 1, peso: 1 }] },
  ],
  metal_m1: [
    { ciclos: [5, 10], itens: [{ item: 'liga_ferrugem', qtd: 2, peso: 4 }, { item: 'fio_cobre', qtd: 2, peso: 4 }, { item: 'kit_reparo', qtd: 1, peso: 2 }] },
    { ciclos: [6, 12], itens: [{ item: 'pasta_termica', qtd: 2, peso: 3 }, { item: 'injecao_energia', qtd: 1, peso: 2 }, { item: 'antena_mk1', qtd: 1, peso: 1 }] },
  ],
  cache_l3: [
    { ciclos: [8, 14], itens: [{ item: 'cristal_silicio', qtd: 2, peso: 4 }, { item: 'fio_cobre', qtd: 2, peso: 3 }, { item: 'pulso_reset', qtd: 1, peso: 2 }] },
    { ciclos: [10, 16], itens: [{ item: 'injecao_energia', qtd: 2, peso: 3 }, { item: 'capacitor_reserva', qtd: 1, peso: 3 }, { item: 'placa_base', qtd: 1, peso: 1 }] },
    { ciclos: [12, 20], itens: [{ item: 'modulo_foco', qtd: 1, peso: 1 }, { item: 'kit_reparo', qtd: 2, peso: 4 }] },
  ],
  nucleos: [
    { ciclos: [10, 18], itens: [{ item: 'polimero_termico', qtd: 1, peso: 3 }, { item: 'refrigerante', qtd: 1, peso: 2 }, { item: 'fio_cobre', qtd: 3, peso: 4 }] },
    { ciclos: [12, 20], itens: [{ item: 'placa_base', qtd: 1, peso: 2 }, { item: 'patch_impulso', qtd: 1, peso: 2 }, { item: 'kit_reparo', qtd: 2, peso: 3 }] },
  ],
  controlador_memoria: [
    { ciclos: [12, 22], itens: [{ item: 'placa_base', qtd: 1, peso: 3 }, { item: 'cristal_silicio', qtd: 2, peso: 3 }, { item: 'pulso_reset', qtd: 1, peso: 2 }] },
    { ciclos: [15, 25], itens: [{ item: 'injecao_energia', qtd: 2, peso: 3 }, { item: 'capacitor_reserva', qtd: 2, peso: 3 }, { item: 'dissipador_mk2', qtd: 1, peso: 1 }] },
  ],
  energia: [
    { ciclos: [15, 25], itens: [{ item: 'cristal_silicio', qtd: 3, peso: 4 }, { item: 'injecao_energia', qtd: 2, peso: 3 }, { item: 'patch_impulso', qtd: 1, peso: 2 }] },
    { ciclos: [18, 30], itens: [{ item: 'polimero_termico', qtd: 2, peso: 3 }, { item: 'refrigerante', qtd: 1, peso: 3 }, { item: 'modulo_sinal', qtd: 1, peso: 1 }] },
    { ciclos: [20, 32], itens: [{ item: 'placa_base', qtd: 2, peso: 3 }, { item: 'kit_reparo', qtd: 3, peso: 3 }] },
  ],
  interposer: [
    { ciclos: [20, 32], itens: [{ item: 'placa_base', qtd: 2, peso: 3 }, { item: 'fio_cobre', qtd: 3, peso: 3 }, { item: 'refrigerante', qtd: 1, peso: 2 }] },
    { ciclos: [22, 36], itens: [{ item: 'fragmento_escuro', qtd: 1, peso: 2 }, { item: 'capacitor_reserva', qtd: 2, peso: 3 }, { item: 'antena_mk2', qtd: 1, peso: 1 }] },
  ],
  substrato: [
    { ciclos: [25, 40], itens: [{ item: 'fragmento_escuro', qtd: 1, peso: 3 }, { item: 'kit_reparo', qtd: 3, peso: 3 }, { item: 'pulso_reset', qtd: 2, peso: 2 }] },
    { ciclos: [30, 45], itens: [{ item: 'refrigerante', qtd: 2, peso: 3 }, { item: 'patch_impulso', qtd: 2, peso: 3 }, { item: 'modulo_termico', qtd: 1, peso: 1 }] },
  ],
};
