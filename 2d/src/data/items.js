// Itens do jogo: materiais, ferramentas, consumíveis, equipamentos e itens de missão.
// valor = preço de venda em ciclos (a compra custa o dobro). sprite = id do item.

const item = (id, dados) => ({ id, sprite: id, ...dados });

export const ITENS = {
  // ---------------------------------------------------------------- Materiais
  liga_ferrugem: item('liga_ferrugem', {
    nome: 'Liga de ferrugem', tipo: 'material', raridade: 'comum', valor: 2,
    descricao: 'Metal velho e teimoso. Enferrujado por fora, útil por dentro.',
  }),
  fio_cobre: item('fio_cobre', {
    nome: 'Fio de cobre', tipo: 'material', raridade: 'comum', valor: 2,
    descricao: 'Conduz quase tudo, inclusive a sua esperança de sair daqui.',
  }),
  cristal_silicio: item('cristal_silicio', {
    nome: 'Cristal de silício', tipo: 'material', raridade: 'comum', valor: 3,
    descricao: 'Lascado do próprio chip. Brilha quando alguém fala em lógica.',
  }),
  placa_base: item('placa_base', {
    nome: 'Placa-base', tipo: 'material', raridade: 'raro', valor: 6,
    descricao: 'Um pedaço de chão de fábrica com furos no lugar certo.',
  }),
  polimero_termico: item('polimero_termico', {
    nome: 'Polímero térmico', tipo: 'material', raridade: 'raro', valor: 5,
    descricao: 'Gosma isolante. Segura o calor como quem segura um segredo.',
  }),
  fragmento_escuro: item('fragmento_escuro', {
    nome: 'Fragmento escuro', tipo: 'material', raridade: 'epico', valor: 12,
    descricao: 'Lasca da Corrupção. Frio ao toque e estranhamente pesado.',
  }),

  // ---------------------------------------------------------------- Ferramentas
  reparo_trilha: item('reparo_trilha', {
    nome: 'Reparo de trilha', tipo: 'ferramenta', raridade: 'comum', valor: 6, alvo: ['x'],
    descricao: 'Solda uma trilha rompida (x). Vire para ela e aperte R.',
  }),
  ajuste_energia: item('ajuste_energia', {
    nome: 'Ajuste de energia', tipo: 'ferramenta', raridade: 'comum', valor: 8, alvo: ['g'],
    descricao: 'Equaliza a tensão de uma porta de energia (g) até ela ceder.',
  }),
  reforco_nucleo: item('reforco_nucleo', {
    nome: 'Reforço do núcleo', tipo: 'ferramenta', raridade: 'raro', valor: 8, alvo: ['o'],
    descricao: 'Preenche um encaixe vazio (o). O chip agradece em vida máxima.',
  }),
  chave_nucleo: item('chave_nucleo', {
    nome: 'Chave do núcleo', tipo: 'ferramenta', raridade: 'raro', valor: 10, alvo: ['D'],
    descricao: 'Abre a porta do Guardião (D). Depois disso, não há volta fácil.',
  }),

  // ---------------------------------------------------------------- Consumíveis
  pasta_termica: item('pasta_termica', {
    nome: 'Pasta térmica', tipo: 'consumivel', raridade: 'comum', valor: 3,
    uso: { em: 'ambos', efeitos: [{ tipo: 'calor', valor: -25 }] },
    descricao: 'Espalhe nas juntas e respire. Reduz o calor em 25.',
  }),
  refrigerante: item('refrigerante', {
    nome: 'Refrigerante', tipo: 'consumivel', raridade: 'raro', valor: 6,
    uso: { em: 'ambos', efeitos: [{ tipo: 'calor', valor: -40 }] },
    descricao: 'Fluido gelado de circuito fechado. Reduz o calor em 40.',
  }),
  pulso_reset: item('pulso_reset', {
    nome: 'Pulso de reset', tipo: 'consumivel', raridade: 'raro', valor: 5,
    uso: { em: 'combate', efeitos: [{ tipo: 'remover', classe: 'negativo' }] },
    descricao: 'Reinicia seus registradores e apaga todos os estados negativos.',
  }),
  injecao_energia: item('injecao_energia', {
    nome: 'Injeção de energia', tipo: 'consumivel', raridade: 'comum', valor: 4,
    uso: { em: 'ambos', efeitos: [{ tipo: 'ep', valor: 5 }] },
    descricao: 'Uma dose concentrada de elétrons. Recupera 5 de EP.',
  }),
  patch_impulso: item('patch_impulso', {
    nome: 'Patch de impulso', tipo: 'consumivel', raridade: 'raro', valor: 5,
    uso: { em: 'combate', efeitos: [{ tipo: 'buff', status: 'impulso' }] },
    descricao: 'Correção de última hora no firmware. Ataque +3 por três turnos.',
  }),
  capacitor_reserva: item('capacitor_reserva', {
    nome: 'Capacitor de reserva', tipo: 'consumivel', raridade: 'comum', valor: 4,
    uso: { em: 'combate', efeitos: [{ tipo: 'escudo', valor: 8 }] },
    descricao: 'Carga guardada para dias ruins. Cria um escudo de 8.',
  }),
  kit_reparo: item('kit_reparo', {
    nome: 'Kit de reparo', tipo: 'consumivel', raridade: 'comum', valor: 4,
    uso: { em: 'ambos', efeitos: [{ tipo: 'cura', valor: 12 }] },
    descricao: 'Fita, solda e otimismo. Recupera 12 de vida.',
  }),

  // ---------------------------------------------------------------- Equipamentos: dissipador
  dissipador_mk1: item('dissipador_mk1', {
    nome: 'Dissipador Mk1', tipo: 'equipamento', raridade: 'comum', valor: 10,
    equipamento: { slot: 'dissipador', nivel: 1, mods: { def: 1, hp: 4 }, evolui_para: 'dissipador_mk2' },
    descricao: 'Aletas de alumínio presas com fé. Defesa +1, vida +4.',
  }),
  dissipador_mk2: item('dissipador_mk2', {
    nome: 'Dissipador Mk2', tipo: 'equipamento', raridade: 'raro', valor: 22,
    equipamento: { slot: 'dissipador', nivel: 2, mods: { def: 2, hp: 8 }, evolui_para: 'dissipador_mk3' },
    descricao: 'Aletas mais densas e um tubo de calor. Defesa +2, vida +8.',
  }),
  dissipador_mk3: item('dissipador_mk3', {
    nome: 'Dissipador Mk3', tipo: 'equipamento', raridade: 'epico', valor: 45,
    equipamento: { slot: 'dissipador', nivel: 3, mods: { def: 4, hp: 14 } },
    descricao: 'Câmara de vapor de bolso. Defesa +4, vida +14.',
  }),

  // ---------------------------------------------------------------- Equipamentos: antena
  antena_mk1: item('antena_mk1', {
    nome: 'Antena Mk1', tipo: 'equipamento', raridade: 'comum', valor: 10,
    equipamento: { slot: 'antena', nivel: 1, mods: { atk: 1, crit: 3 }, evolui_para: 'antena_mk2' },
    descricao: 'Um fio esticado que mira melhor que parece. Ataque +1, crítico +3%.',
  }),
  antena_mk2: item('antena_mk2', {
    nome: 'Antena Mk2', tipo: 'equipamento', raridade: 'raro', valor: 22,
    equipamento: { slot: 'antena', nivel: 2, mods: { atk: 2, crit: 6 }, evolui_para: 'antena_mk3' },
    descricao: 'Bobina dupla, sinal limpo. Ataque +2, crítico +6%.',
  }),
  antena_mk3: item('antena_mk3', {
    nome: 'Antena Mk3', tipo: 'equipamento', raridade: 'epico', valor: 45,
    equipamento: { slot: 'antena', nivel: 3, mods: { atk: 4, crit: 10 } },
    descricao: 'Matriz de fase que acha o ponto fraco sozinha. Ataque +4, crítico +10%.',
  }),

  // ---------------------------------------------------------------- Equipamentos: módulos
  modulo_sinal: item('modulo_sinal', {
    nome: 'Módulo de sinal', tipo: 'equipamento', raridade: 'raro', valor: 18,
    equipamento: { slot: 'modulo', nivel: 2, mods: { spd: 2 }, elemento: 'sinal' },
    descricao: 'Modula seus golpes em sinal puro. Velocidade +2.',
  }),
  modulo_termico: item('modulo_termico', {
    nome: 'Módulo térmico', tipo: 'equipamento', raridade: 'raro', valor: 18,
    equipamento: { slot: 'modulo', nivel: 2, mods: { atk: 1 }, elemento: 'calor' },
    descricao: 'Aproveita o calor que sobra e devolve em golpes. Ataque +1, elemento calor.',
  }),
  modulo_foco: item('modulo_foco', {
    nome: 'Módulo de foco', tipo: 'equipamento', raridade: 'raro', valor: 18,
    equipamento: { slot: 'modulo', nivel: 2, mods: { crit: 10 } },
    descricao: 'Desliga as distrações do barramento. Crítico +10%.',
  }),
  modulo_ressonante: item('modulo_ressonante', {
    nome: 'Módulo ressonante', tipo: 'equipamento', raridade: 'epico', valor: 40,
    equipamento: { slot: 'modulo', nivel: 3, mods: { ep: 4, atk: 1, spd: 1 }, elemento: 'corrente' },
    descricao: 'Vibra na frequência do chip inteiro. EP +4, ataque +1, velocidade +1.',
  }),

  // ---------------------------------------------------------------- Itens de missão
  missao_registro_termico: item('missao_registro_termico', {
    nome: 'Registro térmico', tipo: 'missao', raridade: 'comum', valor: 0,
    descricao: 'Fita com as temperaturas do dissipador. Prova que a Corrupção subiu.',
  }),
  missao_bobina_varredor: item('missao_bobina_varredor', {
    nome: 'Bobina do varredor', tipo: 'missao', raridade: 'raro', valor: 0,
    descricao: 'Peça que o Varredor arrancou da trilha. Solda quer de volta.',
  }),
  missao_indice_perdido: item('missao_indice_perdido', {
    nome: 'Índice perdido', tipo: 'missao', raridade: 'comum', valor: 0,
    descricao: 'Endereço de uma linha de cache que esqueceu de onde veio.',
  }),
  missao_semente_clock: item('missao_semente_clock', {
    nome: 'Semente de clock', tipo: 'missao', raridade: 'raro', valor: 0,
    descricao: 'Cristal que marca o ritmo do núcleo. Sem ele, tudo pulsa fora de hora.',
  }),
  missao_ficha_de_fila: item('missao_ficha_de_fila', {
    nome: 'Ficha de fila', tipo: 'missao', raridade: 'comum', valor: 0,
    descricao: 'Senha número 4.294.967.295. Alguém precisa ser atendido primeiro.',
  }),
  missao_fusivel_mestre: item('missao_fusivel_mestre', {
    nome: 'Fusível mestre', tipo: 'missao', raridade: 'raro', valor: 0,
    descricao: 'Protege a rede inteira de um surto. Amperia guardou o último.',
  }),
  missao_mapa_da_ponte: item('missao_mapa_da_ponte', {
    nome: 'Mapa da ponte', tipo: 'missao', raridade: 'comum', valor: 0,
    descricao: 'Planta das vias do interposer, rabiscada por Ponteira. Via precisa dela.',
  }),
  missao_eco_do_anel: item('missao_eco_do_anel', {
    nome: 'Eco do anel', tipo: 'missao', raridade: 'epico', valor: 0,
    descricao: 'O último sinal do Anel Escuro. Prova de que o chip voltou a respirar.',
  }),
};
