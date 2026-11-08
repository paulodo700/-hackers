// Falhas do circuito (inimigos comuns) e Guardiões (chefes, um por camada).
// Atributos: hp, atk, def, spd; xp ganho ao vencer. ataques: ids em ATAQUES (src/data/skills.js).
// O caractere `char` é o usado no mapa (FOE_CHARS em grid.js); todo chefe usa 'B'.

const falha = (id, dados) => ({ id, sprite: id, ...dados });
const chefe = (id, dados) => ({
  id,
  sprite: id,
  char: 'B',
  chefe: true,
  comportamento: 'estatico',
  ...dados,
  // Os ataques do chefe são a união dos ataques de todas as fases.
  ataques: [...new Set(dados.fases.flatMap((f) => f.ataques))],
});

export const FALHAS = {
  // ================================================================ Falhas regulares
  pulga_corrente: falha('pulga_corrente', {
    nome: 'Pulga de corrente', char: 'f', elemento: 'corrente', nivel: 1,
    hp: 6, atk: 2, def: 0, spd: 6, xp: 3, comportamento: 'patrulha',
    drops: [{ item: 'fio_cobre', chance: 0.5, qtd: 1 }],
    ataques: ['picada_eletrica', 'salto_estatico'],
    descricao: 'Elétron perdido que pula de trilha em trilha. Pequena, nervosa e pouco educada.',
  }),
  rasgo_trilha: falha('rasgo_trilha', {
    nome: 'Rasgo de trilha', char: 'F', elemento: 'neutro', nivel: 2,
    hp: 9, atk: 3, def: 1, spd: 4, xp: 5, comportamento: 'patrulha',
    drops: [{ item: 'liga_ferrugem', chance: 0.6, qtd: 1 }],
    ataques: ['rasgar', 'lasca_de_cobre'],
    descricao: 'Uma rachadura que criou vontade própria. Anda arrastando lascas de metal.',
  }),
  ruido_termico: falha('ruido_termico', {
    nome: 'Ruído térmico', char: 'Q', elemento: 'calor', nivel: 3,
    hp: 12, atk: 4, def: 1, spd: 5, xp: 6, comportamento: 'perseguidor',
    drops: [{ item: 'cristal_silicio', chance: 0.5, qtd: 1 }],
    ataques: ['chiado_quente', 'bafo_termico'],
    descricao: 'Chiado que esquenta tudo por onde passa. Persegue quem faz menos barulho que ele.',
  }),
  vazamento_corrente: falha('vazamento_corrente', {
    nome: 'Vazamento de corrente', char: 'V', elemento: 'corrente', nivel: 4,
    hp: 8, atk: 3, def: 2, spd: 8, xp: 4, comportamento: 'perseguidor',
    drops: [{ item: 'cristal_silicio', chance: 0.6, qtd: 1 }],
    ataques: ['fuga_de_carga', 'centelha_rasteira'],
    descricao: 'Corrente que escapou pela porta. Rápida, resistente e sem rumo.',
  }),
  eletromigracao: falha('eletromigracao', {
    nome: 'Eletromigração', char: 'E', elemento: 'corrente', nivel: 3,
    hp: 14, atk: 4, def: 2, spd: 3, xp: 7, comportamento: 'estatico',
    drops: [{ item: 'fio_cobre', chance: 0.5, qtd: 2 }, { item: 'placa_base', chance: 0.2, qtd: 1 }],
    ataques: ['erosao_atomica', 'vazio_de_metal'],
    descricao: 'Átomos de metal arrastados pela corrente até formar um monte rabugento. Não sai do lugar.',
  }),
  pico_de_tensao: falha('pico_de_tensao', {
    nome: 'Pico de tensão', char: 'J', elemento: 'corrente', nivel: 5,
    hp: 11, atk: 5, def: 1, spd: 9, xp: 6, comportamento: 'perseguidor',
    drops: [{ item: 'cristal_silicio', chance: 0.4, qtd: 1 }, { item: 'injecao_energia', chance: 0.15, qtd: 1 }],
    ataques: ['surto', 'estalo'],
    descricao: 'Um instante de voltagem a mais que se recusou a acabar. Chega antes de você piscar.',
  }),
  fantasma_de_cache: falha('fantasma_de_cache', {
    nome: 'Fantasma de cache', char: 'L', elemento: 'sinal', nivel: 3,
    hp: 10, atk: 3, def: 1, spd: 7, xp: 5, comportamento: 'patrulha',
    drops: [{ item: 'missao_indice_perdido', chance: 0.35, qtd: 1 }, { item: 'cristal_silicio', chance: 0.3, qtd: 1 }],
    ataques: ['acerto_falso', 'sumir_da_linha'],
    descricao: 'Dado velho que ninguém invalidou. Jura que ainda é a versão mais recente.',
  }),
  sobrecarga_termica: falha('sobrecarga_termica', {
    nome: 'Sobrecarga térmica', char: 'R', elemento: 'calor', nivel: 5,
    hp: 16, atk: 5, def: 2, spd: 4, xp: 8, comportamento: 'patrulha',
    drops: [{ item: 'polimero_termico', chance: 0.4, qtd: 1 }],
    ataques: ['fornalha', 'derreter'],
    descricao: 'Calor acumulado com cara de poucos amigos. Ficar perto dele já é castigo.',
  }),
  bit_corrompido: falha('bit_corrompido', {
    nome: 'Bit corrompido', char: 'G', elemento: 'sinal', nivel: 6,
    hp: 13, atk: 5, def: 3, spd: 6, xp: 7, comportamento: 'perseguidor',
    drops: [{ item: 'fragmento_escuro', chance: 0.2, qtd: 1 }, { item: 'placa_base', chance: 0.3, qtd: 1 }],
    ataques: ['inversao', 'paridade_quebrada'],
    descricao: 'Era um 0, virou 1, e agora odeia todo mundo. Primeiro sinal da Corrupção.',
  }),
  glitch_de_pipeline: falha('glitch_de_pipeline', {
    nome: 'Glitch de pipeline', char: 'T', elemento: 'sinal', nivel: 7,
    hp: 18, atk: 6, def: 2, spd: 7, xp: 9, comportamento: 'patrulha',
    drops: [{ item: 'fragmento_escuro', chance: 0.3, qtd: 1 }, { item: 'placa_base', chance: 0.3, qtd: 1 }],
    ataques: ['bolha_no_pipeline', 'execucao_fora_de_ordem'],
    descricao: 'Instruções que saíram da fila e se executam ao contrário. Às vezes acerta antes de mirar.',
  }),

  // ================================================================ Chefes (Guardiões)
  bolha_termica: chefe('bolha_termica', {
    nome: 'Bolha Térmica', camada: 'dissipador', elemento: 'calor', nivel: 2,
    hp: 60, atk: 6, def: 2, spd: 4, xp: 40,
    drops: [{ item: 'polimero_termico', chance: 1, qtd: 1 }],
    fases: [
      { ate: 0.66, ataques: ['borbulhar', 'chiado_quente'] },
      { ate: 0.33, ataques: ['borbulhar', 'estouro_de_vapor'] },
      { ate: 0, ataques: ['ebulicao', 'estouro_de_vapor'] },
    ],
    recompensa: { xp: 40, ciclos: 30, item: 'dissipador_mk1' },
    descricao: 'Ar quente preso sob o metal, inflado de rancor. Se estourar, leva o dissipador junto.',
  }),
  varredor_de_trilhas: chefe('varredor_de_trilhas', {
    nome: 'Varredor de Trilhas', camada: 'metal_m1', elemento: 'corrente', nivel: 2,
    hp: 66, atk: 7, def: 2, spd: 6, xp: 50,
    drops: [{ item: 'fio_cobre', chance: 1, qtd: 3 }],
    fases: [
      { ate: 0.66, ataques: ['varredura', 'picada_eletrica'] },
      { ate: 0.33, ataques: ['varredura', 'corte_em_linha'] },
      { ate: 0, ataques: ['arrastao', 'corte_em_linha'] },
    ],
    recompensa: { xp: 50, ciclos: 40, item: 'missao_bobina_varredor' },
    descricao: 'Robô de limpeza tomado pela Corrupção. Agora varre trilhas inteiras para fora do mapa.',
  }),
  guardiao_do_cache: chefe('guardiao_do_cache', {
    nome: 'Guardião do Cache', camada: 'cache_l3', elemento: 'sinal', nivel: 3,
    hp: 72, atk: 7, def: 3, spd: 5, xp: 60,
    drops: [{ item: 'cristal_silicio', chance: 1, qtd: 3 }],
    fases: [
      { ate: 0.66, ataques: ['invalidar_linha', 'acerto_falso'] },
      { ate: 0.33, ataques: ['invalidar_linha', 'despejo_total'] },
      { ate: 0, ataques: ['reescrita', 'despejo_total', 'invalidar_linha'] },
    ],
    recompensa: { xp: 60, ciclos: 50, item: 'antena_mk2' },
    descricao: 'Porteiro de blocos de memória. Decide o que fica e o que é esquecido. Você está na lista.',
  }),
  nucleo_instavel: chefe('nucleo_instavel', {
    nome: 'Núcleo Instável', camada: 'nucleos', elemento: 'calor', nivel: 4,
    hp: 80, atk: 8, def: 3, spd: 5, xp: 75,
    drops: [{ item: 'placa_base', chance: 1, qtd: 1 }],
    fases: [
      { ate: 0.66, ataques: ['pulso_de_clock', 'chiado_quente'] },
      { ate: 0.33, ataques: ['pulso_de_clock', 'fusao_do_nucleo'] },
      { ate: 0, ataques: ['overclock', 'fusao_do_nucleo', 'pulso_de_clock'] },
    ],
    recompensa: { xp: 75, ciclos: 60, item: 'missao_semente_clock' },
    descricao: 'Um núcleo que perdeu o ritmo e acelera sem freio. Cada pulso esquenta a sala inteira.',
  }),
  fila_infinita: chefe('fila_infinita', {
    nome: 'Fila Infinita', camada: 'controlador_memoria', elemento: 'sinal', nivel: 5,
    hp: 88, atk: 9, def: 4, spd: 6, xp: 90,
    drops: [{ item: 'placa_base', chance: 1, qtd: 2 }],
    fases: [
      { ate: 0.66, ataques: ['enfileirar', 'inversao'] },
      { ate: 0.33, ataques: ['enfileirar', 'estouro_de_fila'] },
      { ate: 0, ataques: ['espera_eterna', 'estouro_de_fila'] },
    ],
    recompensa: { xp: 90, ciclos: 75, item: 'dissipador_mk2' },
    descricao: 'Pedidos que nunca foram atendidos, enroscados num só corpo. Ela não tem pressa. Você tem.',
  }),
  colapso_de_tensao: chefe('colapso_de_tensao', {
    nome: 'Colapso de Tensão', camada: 'energia', elemento: 'corrente', nivel: 6,
    hp: 96, atk: 10, def: 5, spd: 8, xp: 110,
    drops: [{ item: 'cristal_silicio', chance: 1, qtd: 4 }],
    fases: [
      { ate: 0.66, ataques: ['queda_de_tensao', 'surto'] },
      { ate: 0.33, ataques: ['queda_de_tensao', 'arco_de_colapso'] },
      { ate: 0, ataques: ['sobretensao', 'arco_de_colapso'] },
    ],
    recompensa: { xp: 110, ciclos: 90, item: 'modulo_ressonante' },
    descricao: 'A rede de energia desabando sobre si mesma. Faíscas por todo lado e nenhum disjuntor.',
  }),
  ponte_partida: chefe('ponte_partida', {
    nome: 'Ponte Partida', camada: 'interposer', elemento: 'frio', nivel: 7,
    hp: 106, atk: 11, def: 5, spd: 5, xp: 130,
    drops: [{ item: 'fragmento_escuro', chance: 1, qtd: 1 }],
    fases: [
      { ate: 0.66, ataques: ['geada_na_via', 'estalo_gelado'] },
      { ate: 0.33, ataques: ['geada_na_via', 'ruptura_da_ponte'] },
      { ate: 0, ataques: ['estalo_gelado', 'ruptura_da_ponte', 'geada_na_via'] },
    ],
    recompensa: { xp: 130, ciclos: 110, item: 'antena_mk3' },
    descricao: 'Uma ponte entre blocos que congelou de medo e rachou ao meio. Agora derruba quem tenta cruzar.',
  }),
  anel_escuro: chefe('anel_escuro', {
    nome: 'Anel Escuro', camada: 'substrato', elemento: 'neutro', nivel: 8,
    hp: 120, atk: 12, def: 6, spd: 7, xp: 200,
    drops: [{ item: 'fragmento_escuro', chance: 1, qtd: 3 }],
    fases: [
      { ate: 0.66, ataques: ['sombra_do_anel', 'execucao_fora_de_ordem'] },
      { ate: 0.33, ataques: ['sombra_do_anel', 'eclipse_de_dados'] },
      { ate: 0, ataques: ['vazio_absoluto', 'eclipse_de_dados', 'sombra_do_anel'] },
    ],
    recompensa: { xp: 200, ciclos: 150, item: 'missao_eco_do_anel' },
    descricao: 'O coração da Corrupção, girando no fundo do chip. Tudo que se perdeu acaba aqui.',
  }),
};
