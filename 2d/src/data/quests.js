// Missões: um capítulo principal por camada e duas secundárias. Etapas são sequenciais.
// Tipos de etapa: falar, coletar, entregar, derrotar, chefe, reparar, chegar, escanear.

const missao = (id, tipo, camada, nome, descricao, etapas, recompensa) =>
  ({ id, nome, tipo, camada, descricao, etapas, recompensa });

export const MISSOES = {
  // ================================================================ Capítulos (principal)
  capitulo_dissipador: missao('capitulo_dissipador', 'principal', 'dissipador', 'Capítulo 1: Calor no topo',
    'Lúmen detectou calor subindo do fundo do chip. Desça pelo dissipador e cale a Bolha Térmica.',
    [
      { id: 'pulgas', tipo: 'derrotar', foe: 'pulga_corrente', qtd: 2, texto: 'Derrote 2 pulgas de corrente.' },
      { id: 'liga', tipo: 'coletar', item: 'liga_ferrugem', qtd: 2, texto: 'Junte 2 ligas de ferrugem.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'bolha_termica', texto: 'Estoure a Bolha Térmica.' },
      { id: 'descer', tipo: 'chegar', camada: 'metal_m1', texto: 'Desça até o Metal M1.' },
    ],
    { xp: 20, ciclos: 15, itens: [{ item: 'kit_reparo', qtd: 2 }], flags: ['capitulo_1_ok'] }),

  capitulo_metal_m1: missao('capitulo_metal_m1', 'principal', 'metal_m1', 'Capítulo 2: Trilhas partidas',
    'O Varredor de Trilhas está arrancando o cobre do chão. Solda precisa das trilhas inteiras.',
    [
      { id: 'reparar', tipo: 'reparar', qtd: 1, camada: 'metal_m1', texto: 'Repare uma trilha rompida.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'varredor_de_trilhas', texto: 'Desligue o Varredor de Trilhas.' },
      { id: 'descer', tipo: 'chegar', camada: 'cache_l3', texto: 'Desça até o Cache L3.' },
    ],
    { xp: 30, ciclos: 20, itens: [{ item: 'reparo_trilha', qtd: 1 }], flags: ['capitulo_2_ok'] }),

  capitulo_cache_l3: missao('capitulo_cache_l3', 'principal', 'cache_l3', 'Capítulo 3: Memória curta',
    'O cache está esquecendo o que importa. Descubra o que são os fantasmas e enfrente o Guardião.',
    [
      { id: 'escanear', tipo: 'escanear', foe: 'fantasma_de_cache', texto: 'Registre um fantasma de cache no bestiário.' },
      { id: 'porta', tipo: 'reparar', qtd: 1, camada: 'cache_l3', texto: 'Destrave uma porta de energia.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'guardiao_do_cache', texto: 'Vença o Guardião do Cache.' },
      { id: 'descer', tipo: 'chegar', camada: 'nucleos', texto: 'Desça até os Núcleos.' },
    ],
    { xp: 40, ciclos: 30, itens: [{ item: 'refrigerante', qtd: 1 }], flags: ['capitulo_3_ok'] }),

  capitulo_nucleos: missao('capitulo_nucleos', 'principal', 'nucleos', 'Capítulo 4: Fora do compasso',
    'Um núcleo perdeu o ritmo e aquece a camada inteira. Pulsar quer o clock de volta.',
    [
      { id: 'ruidos', tipo: 'derrotar', foe: 'ruido_termico', qtd: 2, texto: 'Silencie 2 ruídos térmicos.' },
      { id: 'encaixe', tipo: 'reparar', qtd: 1, camada: 'nucleos', texto: 'Reforce um encaixe do núcleo.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'nucleo_instavel', texto: 'Estabilize o Núcleo Instável.' },
      { id: 'descer', tipo: 'chegar', camada: 'controlador_memoria', texto: 'Desça até o Controlador de memória.' },
    ],
    { xp: 55, ciclos: 40, itens: [{ item: 'injecao_energia', qtd: 2 }], flags: ['capitulo_4_ok'] }),

  capitulo_controlador_memoria: missao('capitulo_controlador_memoria', 'principal', 'controlador_memoria', 'Capítulo 5: A fila que não anda',
    'Os pedidos de memória pararam. Banca suspeita de algo enorme travando a fila.',
    [
      { id: 'latencia', tipo: 'falar', npc: 'latencia', texto: 'Pergunte a Latência o que trava a fila.' },
      { id: 'reparar', tipo: 'reparar', qtd: 1, camada: 'controlador_memoria', texto: 'Repare a trilha dos bancos.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'fila_infinita', texto: 'Desfaça a Fila Infinita.' },
      { id: 'descer', tipo: 'chegar', camada: 'energia', texto: 'Desça até a Rede de energia.' },
    ],
    { xp: 70, ciclos: 50, itens: [{ item: 'capacitor_reserva', qtd: 2 }], flags: ['capitulo_5_ok'] }),

  capitulo_energia: missao('capitulo_energia', 'principal', 'energia', 'Capítulo 6: Curto na rede',
    'A rede de energia está desabando. Ampéria precisa que alguém segure a tensão.',
    [
      { id: 'vazamentos', tipo: 'derrotar', foe: 'vazamento_corrente', qtd: 2, texto: 'Contenha 2 vazamentos de corrente.' },
      { id: 'porta', tipo: 'reparar', qtd: 1, camada: 'energia', texto: 'Ajuste uma porta de energia.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'colapso_de_tensao', texto: 'Contenha o Colapso de Tensão.' },
      { id: 'descer', tipo: 'chegar', camada: 'interposer', texto: 'Desça até o Interposer.' },
    ],
    { xp: 85, ciclos: 60, itens: [{ item: 'patch_impulso', qtd: 2 }], flags: ['capitulo_6_ok'] }),

  capitulo_interposer: missao('capitulo_interposer', 'principal', 'interposer', 'Capítulo 7: A ponte partida',
    'As pontes entre blocos estão caindo. Leve o mapa de Ponteira até Via e atravesse.',
    [
      { id: 'mapa', tipo: 'entregar', npc: 'via', item: 'missao_mapa_da_ponte', qtd: 1, texto: 'Entregue o mapa da ponte a Via.' },
      { id: 'reparar', tipo: 'reparar', qtd: 1, camada: 'interposer', texto: 'Repare uma via rompida.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'ponte_partida', texto: 'Derrube a Ponte Partida.' },
      { id: 'descer', tipo: 'chegar', camada: 'substrato', texto: 'Desça até o Substrato.' },
    ],
    { xp: 100, ciclos: 70, itens: [{ item: 'refrigerante', qtd: 2 }], flags: ['capitulo_7_ok'] }),

  capitulo_substrato: missao('capitulo_substrato', 'principal', 'substrato', 'Capítulo 8: O Anel Escuro',
    'No fundo do chip gira a origem da Corrupção. Ouça Eco e termine o que começou.',
    [
      { id: 'eco', tipo: 'falar', npc: 'eco', texto: 'Ouça a história de Eco.' },
      { id: 'glitches', tipo: 'derrotar', foe: 'glitch_de_pipeline', qtd: 2, texto: 'Derrote 2 glitches de pipeline.' },
      { id: 'chefe', tipo: 'chefe', chefe: 'anel_escuro', texto: 'Apague o Anel Escuro.' },
    ],
    { xp: 150, ciclos: 100, flags: ['capitulo_8_ok', 'jogo_concluido'] }),

  // ================================================================ Secundárias: Dissipador
  secundaria_dissipador_1: missao('secundaria_dissipador_1', 'secundaria', 'dissipador', 'Ventoinha muda',
    'A ventoinha da Sentinela parou. Com um pouco de cobre, ela volta a girar.',
    [
      { id: 'cobre', tipo: 'coletar', item: 'fio_cobre', qtd: 2, texto: 'Junte 2 fios de cobre.' },
      { id: 'entregar', tipo: 'entregar', npc: 'sentinela_ventoinha', item: 'fio_cobre', qtd: 2, texto: 'Entregue o cobre à Sentinela.' },
    ],
    { xp: 10, ciclos: 8, itens: [{ item: 'pasta_termica', qtd: 2 }] }),
  secundaria_dissipador_2: missao('secundaria_dissipador_2', 'secundaria', 'dissipador', 'Registro térmico',
    'Lúmen quer que Aleta veja as temperaturas. Mas antes, estude uma pulga de perto.',
    [
      { id: 'escanear', tipo: 'escanear', foe: 'pulga_corrente', texto: 'Registre uma pulga de corrente no bestiário.' },
      { id: 'entregar', tipo: 'entregar', npc: 'aleta', item: 'missao_registro_termico', qtd: 1, texto: 'Leve o registro térmico até Aleta.' },
    ],
    { xp: 12, ciclos: 12 }),

  // ================================================================ Secundárias: Metal M1
  secundaria_metal_m1_1: missao('secundaria_metal_m1_1', 'secundaria', 'metal_m1', 'Coleção de lascas',
    'Ferrim quer completar a coleção de rasgos de trilha. Ele promete não perguntar como.',
    [
      { id: 'rasgos', tipo: 'derrotar', foe: 'rasgo_trilha', qtd: 3, texto: 'Derrote 3 rasgos de trilha.' },
      { id: 'ferrim', tipo: 'falar', npc: 'ferrim', texto: 'Conte a Ferrim como foi.' },
    ],
    { xp: 15, ciclos: 12, itens: [{ item: 'liga_ferrugem', qtd: 3 }] }),
  secundaria_metal_m1_2: missao('secundaria_metal_m1_2', 'secundaria', 'metal_m1', 'A bobina roubada',
    'O Varredor levou a bobina favorita de Solda. Ela quer de volta, de preferência inteira.',
    [
      { id: 'chefe', tipo: 'chefe', chefe: 'varredor_de_trilhas', texto: 'Recupere a bobina do Varredor.' },
      { id: 'entregar', tipo: 'entregar', npc: 'solda', item: 'missao_bobina_varredor', qtd: 1, texto: 'Devolva a bobina a Solda.' },
    ],
    { xp: 20, ciclos: 15, itens: [{ item: 'antena_mk1', qtd: 1 }] }),

  // ================================================================ Secundárias: Cache L3
  secundaria_cache_l3_1: missao('secundaria_cache_l3_1', 'secundaria', 'cache_l3', 'Endereço esquecido',
    'Índice perdeu um endereço. Os fantasmas de cache costumam carregar essas coisas.',
    [
      { id: 'coletar', tipo: 'coletar', item: 'missao_indice_perdido', qtd: 1, texto: 'Recupere o índice perdido de um fantasma.' },
      { id: 'entregar', tipo: 'entregar', npc: 'indice', item: 'missao_indice_perdido', qtd: 1, texto: 'Devolva o índice a Índice.' },
    ],
    { xp: 22, ciclos: 18, itens: [{ item: 'pulso_reset', qtd: 1 }] }),
  secundaria_cache_l3_2: missao('secundaria_cache_l3_2', 'secundaria', 'cache_l3', 'Linha intocada',
    'Guarda-Linha jura que alguém mexeu na sua linha. Prove que foram os fantasmas.',
    [
      { id: 'fantasmas', tipo: 'derrotar', foe: 'fantasma_de_cache', qtd: 3, texto: 'Afaste 3 fantasmas de cache.' },
      { id: 'guarda', tipo: 'falar', npc: 'guarda_linha', texto: 'Avise o Guarda-Linha.' },
    ],
    { xp: 25, ciclos: 20, itens: [{ item: 'capacitor_reserva', qtd: 1 }] }),

  // ================================================================ Secundárias: Núcleos
  secundaria_nucleos_1: missao('secundaria_nucleos_1', 'secundaria', 'nucleos', 'Termômetro de bolso',
    'Termostato quer saber o que é essa tal sobrecarga térmica antes de desligar a sala.',
    [
      { id: 'escanear', tipo: 'escanear', foe: 'sobrecarga_termica', texto: 'Registre uma sobrecarga térmica.' },
      { id: 'polimero', tipo: 'entregar', npc: 'termostato', item: 'polimero_termico', qtd: 1, texto: 'Entregue um polímero térmico ao Termostato.' },
    ],
    { xp: 28, ciclos: 22, itens: [{ item: 'refrigerante', qtd: 1 }] }),
  secundaria_nucleos_2: missao('secundaria_nucleos_2', 'secundaria', 'nucleos', 'O ritmo de volta',
    'Sem a semente de clock, os núcleos nunca mais vão pulsar juntos. Pulsar conta com você.',
    [
      { id: 'chefe', tipo: 'chefe', chefe: 'nucleo_instavel', texto: 'Arranque a semente do Núcleo Instável.' },
      { id: 'entregar', tipo: 'entregar', npc: 'pulsar', item: 'missao_semente_clock', qtd: 1, texto: 'Entregue a semente de clock a Pulsar.' },
    ],
    { xp: 30, ciclos: 25, itens: [{ item: 'modulo_foco', qtd: 1 }] }),

  // ================================================================ Secundárias: Controlador de memória
  secundaria_controlador_memoria_1: missao('secundaria_controlador_memoria_1', 'secundaria', 'controlador_memoria', 'Senha da vez',
    'Banca tem uma ficha de fila antiquíssima. Latência precisa atendê-la, enfim.',
    [
      { id: 'entregar', tipo: 'entregar', npc: 'latencia', item: 'missao_ficha_de_fila', qtd: 1, texto: 'Leve a ficha de fila até Latência.' },
      { id: 'banca', tipo: 'falar', npc: 'banca', texto: 'Conte a Banca que a ficha foi atendida.' },
    ],
    { xp: 32, ciclos: 28, itens: [{ item: 'kit_reparo', qtd: 2 }] }),
  secundaria_controlador_memoria_2: missao('secundaria_controlador_memoria_2', 'secundaria', 'controlador_memoria', 'Bits rebeldes',
    'Bits corrompidos estão trocando endereços nos bancos. Latência quer silêncio.',
    [
      { id: 'bits', tipo: 'derrotar', foe: 'bit_corrompido', qtd: 3, texto: 'Derrote 3 bits corrompidos.' },
      { id: 'placa', tipo: 'coletar', item: 'placa_base', qtd: 1, texto: 'Recupere uma placa-base.' },
    ],
    { xp: 35, ciclos: 30, itens: [{ item: 'antena_mk2', qtd: 1 }] }),

  // ================================================================ Secundárias: Rede de energia
  secundaria_energia_1: missao('secundaria_energia_1', 'secundaria', 'energia', 'Picos indesejados',
    'Disjuntor desarma a cada pico de tensão. Ele quer dormir uma noite inteira.',
    [
      { id: 'escanear', tipo: 'escanear', foe: 'pico_de_tensao', texto: 'Registre um pico de tensão.' },
      { id: 'picos', tipo: 'derrotar', foe: 'pico_de_tensao', qtd: 3, texto: 'Derrote 3 picos de tensão.' },
    ],
    { xp: 38, ciclos: 32, itens: [{ item: 'injecao_energia', qtd: 2 }] }),
  secundaria_energia_2: missao('secundaria_energia_2', 'secundaria', 'energia', 'O fusível mestre',
    'Ampéria guardou o último fusível mestre. Instale as portas e leve-o ao Disjuntor.',
    [
      { id: 'reparar', tipo: 'reparar', qtd: 2, camada: 'energia', texto: 'Ajuste 2 portas de energia.' },
      { id: 'entregar', tipo: 'entregar', npc: 'disjuntor', item: 'missao_fusivel_mestre', qtd: 1, texto: 'Entregue o fusível mestre ao Disjuntor.' },
    ],
    { xp: 40, ciclos: 35, itens: [{ item: 'modulo_sinal', qtd: 1 }] }),

  // ================================================================ Secundárias: Interposer
  secundaria_interposer_1: missao('secundaria_interposer_1', 'secundaria', 'interposer', 'Pilares de cobre',
    'Via precisa de cobre e placas para escorar as passagens que ainda estão de pé.',
    [
      { id: 'cobre', tipo: 'coletar', item: 'fio_cobre', qtd: 3, texto: 'Junte 3 fios de cobre.' },
      { id: 'placa', tipo: 'entregar', npc: 'via', item: 'placa_base', qtd: 1, texto: 'Entregue uma placa-base a Via.' },
    ],
    { xp: 42, ciclos: 38, itens: [{ item: 'dissipador_mk2', qtd: 1 }] }),
  secundaria_interposer_2: missao('secundaria_interposer_2', 'secundaria', 'interposer', 'Atalho no pipeline',
    'Ponteira quer desenhar um glitch de pipeline. Ela jura que é para ciência.',
    [
      { id: 'escanear', tipo: 'escanear', foe: 'glitch_de_pipeline', texto: 'Registre um glitch de pipeline.' },
      { id: 'ponteira', tipo: 'falar', npc: 'ponteira', texto: 'Mostre o registro a Ponteira.' },
    ],
    { xp: 45, ciclos: 40, itens: [{ item: 'patch_impulso', qtd: 1 }] }),

  // ================================================================ Secundárias: Substrato
  secundaria_substrato_1: missao('secundaria_substrato_1', 'secundaria', 'substrato', 'Fragmentos no escuro',
    'Raiz estuda a Corrupção. Traga fragmentos escuros e ele descobre como ela se espalha.',
    [
      { id: 'coletar', tipo: 'coletar', item: 'fragmento_escuro', qtd: 2, texto: 'Junte 2 fragmentos escuros.' },
      { id: 'entregar', tipo: 'entregar', npc: 'raiz', item: 'fragmento_escuro', qtd: 2, texto: 'Entregue os fragmentos a Raiz.' },
    ],
    { xp: 50, ciclos: 45, itens: [{ item: 'dissipador_mk3', qtd: 1 }] }),
  secundaria_substrato_2: missao('secundaria_substrato_2', 'secundaria', 'substrato', 'O último eco',
    'Quando o Anel cair, sobrará um eco. Eco quer ouvi-lo antes de descansar.',
    [
      { id: 'chefe', tipo: 'chefe', chefe: 'anel_escuro', texto: 'Apague o Anel Escuro.' },
      { id: 'entregar', tipo: 'entregar', npc: 'eco', item: 'missao_eco_do_anel', qtd: 1, texto: 'Leve o eco do anel até Eco.' },
    ],
    { xp: 60, ciclos: 60, flags: ['epilogo_eco'] }),
};
