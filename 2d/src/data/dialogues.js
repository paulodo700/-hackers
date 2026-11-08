// Diálogos. O jogo escolhe, para cada NPC, o PRIMEIRO diálogo (na ordem deste arquivo) cujas condições valem.
// Por isso, em cada NPC, os diálogos mais específicos vêm antes e o padrão (sem condições) vem por último.

// ---------------------------------------------------------------- Atalhos
const dlg = (id, npc, condicoes, nos, inicio = 'n0') => ({ id, npc, condicoes, inicio, nos });
const quest = (id, estado, etapa) => (etapa ? { tipo: 'quest', id, estado, etapa } : { tipo: 'quest', id, estado });
const naoIniciada = (id) => quest(id, 'nao_iniciada');
const ativa = (id) => quest(id, 'ativa');
const etapa = (id, et) => quest(id, 'etapa', et);
const iniciar = (id) => ({ tipo: 'quest_iniciar', id });
const concluir = (id) => ({ tipo: 'quest_concluir', id });
const dar = (id, qtd = 1) => ({ tipo: 'item', id, qtd, acao: 'dar' });
const anotar = (texto) => ({ tipo: 'anotar', texto });
const loja = (id) => ({ tipo: 'loja', id });
// Uma fala simples, sem escolhas.
const fala = (texto, efeitos) => ({ n0: { fala: texto, ...(efeitos ? { efeitos } : {}) } });
// Uma oferta de missão: aceitar inicia (com efeitos extras), recusar encerra.
const oferta = (pedido, aceite, efeitos, extra = {}) => ({
  n0: { fala: pedido, opcoes: [{ texto: 'Pode contar comigo.', ir: 'sim' }, { texto: 'Agora não.', ir: null }] },
  sim: { fala: aceite, efeitos },
  ...extra,
});
// Capítulo: apresentação em dois nós, depois a oferta.
const capitulo = (abertura, pedido, aceite, efeitos) => ({
  n0: { fala: abertura, ir: 'n1' },
  n1: { fala: pedido, opcoes: [{ texto: 'Vou resolver isso.', ir: 'sim' }, { texto: 'Preciso me preparar.', ir: null }] },
  sim: { fala: aceite, efeitos },
});
// Mercador: saudação com opção de abrir a loja.
const balcao = (saudacao, idLoja, despedida) => ({
  n0: { fala: saudacao, opcoes: [{ texto: 'Mostre o estoque.', ir: 'loja' }, { texto: 'Só olhando.', ir: null }] },
  loja: { fala: despedida, efeitos: [loja(idLoja)] },
});

export const DIALOGOS = {
  // ================================================================ Dissipador
  lumen_capitulo: dlg('lumen_capitulo', 'lumen', [naoIniciada('capitulo_dissipador')], {
    n0: { fala: 'Bit! Finalmente um robô que liga. O calor está subindo do fundo do chip, e não é o calor de sempre. Tem cheiro de Corrupção.', ir: 'n1' },
    n1: {
      fala: 'Uma Bolha Térmica se formou sob o metal. Limpe as pulgas, junte liga de ferrugem e estoure aquela coisa. Topa?',
      opcoes: [
        { texto: 'Pode deixar.', ir: 'sim' },
        { texto: 'O que é a Corrupção?', ir: 'corrupcao' },
      ],
    },
    corrupcao: { fala: 'Uma infecção que nasceu no substrato. Ela vira bits do avesso e transforma falhas em monstros. Começou lá embaixo e já chegou aqui.', ir: 'n1' },
    sim: {
      fala: 'Ótimo. A saída fica na sala do Guardião, atrás da porta D. Para abri-la, você vai precisar da chave do núcleo. Boa descida.',
      efeitos: [iniciar('capitulo_dissipador'), anotar('Lúmen: a Bolha Térmica guarda a saída do dissipador.')],
    },
  }),
  lumen_registro: dlg('lumen_registro', 'lumen', [ativa('capitulo_dissipador'), naoIniciada('secundaria_dissipador_2')], oferta(
    'Anotei as temperaturas da semana e ninguém acredita em mim. Aleta talvez acredite. Antes, estude uma pulga de perto, para ter argumento.',
    'Aqui está o registro. Não amasse: é a única prova que eu tenho.',
    [iniciar('secundaria_dissipador_2'), dar('missao_registro_termico')],
  )),
  lumen_vitoria: dlg('lumen_vitoria', 'lumen', [{ tipo: 'chefe', id: 'bolha_termica', estado: 'derrotado' }], fala(
    'A temperatura caiu três graus! A saída está aberta. Lá embaixo, Solda cuida das trilhas. Diga que eu mandei um oi... e cobre.',
  )),
  lumen_ativa: dlg('lumen_ativa', 'lumen', [ativa('capitulo_dissipador')], fala(
    'Pulgas, liga de ferrugem e a Bolha. Se esquentar demais, procure as zonas frias. Trilha quente só se for com pressa.',
  )),
  lumen_padrao: dlg('lumen_padrao', 'lumen', [], fala(
    'O metal aqui espalha o calor. Sem ele, o chip derrete em segundos. Sem você, também.',
  )),

  aleta_entrega: dlg('aleta_entrega', 'aleta', [etapa('secundaria_dissipador_2', 'entregar'), { tipo: 'item', id: 'missao_registro_termico', qtd: 1 }], fala(
    'Setenta e quatro graus numa terça? Lúmen tinha razão. Vou subir o preço da pasta térmica. Brincadeira. Talvez.',
  )),
  aleta_loja: dlg('aleta_loja', 'aleta', [], balcao(
    'Ventoinha usada, pasta fresca, aletas quase novas! Vai levar ou só vai esquentar o balcão?',
    'loja_dissipador',
    'Fique à vontade. Olhar é de graça; quebrar, não.',
  )),

  sentinela_pedido: dlg('sentinela_pedido', 'sentinela_ventoinha', [naoIniciada('secundaria_dissipador_1')], oferta(
    'A ventoinha parou. Desde então, eu vigio. Se alguém trouxer 2 fios de cobre, eu a faço girar de novo.',
    'Cobre é o que não falta nas trilhas. Procure pelo chão e pelas pulgas.',
    [iniciar('secundaria_dissipador_1')],
  )),
  sentinela_entrega: dlg('sentinela_entrega', 'sentinela_ventoinha', [etapa('secundaria_dissipador_1', 'entregar')], fala(
    'Cobre! A ventoinha já sente o cheiro. Deixe comigo.',
  )),
  sentinela_concluida: dlg('sentinela_concluida', 'sentinela_ventoinha', [quest('secundaria_dissipador_1', 'concluida')], fala(
    'Ouviu esse zumbido? É a ventoinha girando. Obrigada, Bit. Agora eu vigio por gosto.',
  )),
  sentinela_padrao: dlg('sentinela_padrao', 'sentinela_ventoinha', [], fala('Ventoinha parada não esfria ninguém.')),

  // ================================================================ Metal M1
  solda_capitulo: dlg('solda_capitulo', 'solda', [naoIniciada('capitulo_metal_m1')], capitulo(
    'Mais um da superfície. Lúmen te mandou? Então sabe usar uma solda. Espero.',
    'Um Varredor de Trilhas enlouqueceu e está arrancando o cobre do chão. Repare uma trilha e desligue ele antes que eu fique sem chão.',
    'Trilha rompida é o x no chão. Fique de frente, use o reparo de trilha com R. E não me faça repetir.',
    [iniciar('capitulo_metal_m1'), anotar('Solda: o Varredor de Trilhas arranca o cobre do Metal M1.')],
  )),
  solda_bobina: dlg('solda_bobina', 'solda', [ativa('capitulo_metal_m1'), naoIniciada('secundaria_metal_m1_2')], oferta(
    'Aquele Varredor levou minha bobina favorita. Trinta anos de solda nela. Se você derrubá-lo, traga de volta.',
    'Inteira, de preferência. Amassada, eu aceito. Derretida, conversamos.',
    [iniciar('secundaria_metal_m1_2')],
  )),
  solda_entrega: dlg('solda_entrega', 'solda', [etapa('secundaria_metal_m1_2', 'entregar')], fala(
    'Minha bobina! Um pouco amassada, como eu. Obrigada, Bit. Fique com esta antena; ela mira melhor que você.',
  )),
  solda_ativa: dlg('solda_ativa', 'solda', [ativa('capitulo_metal_m1')], fala(
    'Duas ligas de ferrugem e um fio de cobre fazem um reparo de trilha. A matemática é simples; a solda, nem tanto.',
  )),
  solda_padrao: dlg('solda_padrao', 'solda', [], fala('Trilha boa é trilha que ninguém percebe.')),

  ferrim_conclui: dlg('ferrim_conclui', 'ferrim', [etapa('secundaria_metal_m1_1', 'ferrim')], fala(
    'Três rasgos? Olha só essas lascas! Minha coleção está completa. Quase. Tome, pela ajuda.',
    [concluir('secundaria_metal_m1_1')],
  )),
  ferrim_pedido: dlg('ferrim_pedido', 'ferrim', [naoIniciada('secundaria_metal_m1_1')], oferta(
    'Sabia que cada rasgo de trilha deixa uma lasca diferente? Derrote três para mim. Eu juro que não é estranho.',
    'Eba! Depois me conte tudo. Com detalhes. Principalmente os das lascas.',
    [iniciar('secundaria_metal_m1_1')],
  )),
  ferrim_padrao: dlg('ferrim_padrao', 'ferrim', [], fala(
    'Dica de aprendiz: rasgos são lentos. Se a vida estiver baixa, apenas ande mais rápido que eles.',
  )),

  // ================================================================ Cache L3
  lira_rica: dlg('lira_rica', 'lira', [{ tipo: 'ciclos', min: 100 }], balcao(
    'Ora, ora, um cliente com ciclos de verdade! Hoje eu até sorrio. Vamos às compras?',
    'loja_cache_l3',
    'Tudo rápido, como o cache. Só o meu troco é lento.',
  )),
  lira_loja: dlg('lira_loja', 'lira', [], balcao(
    'Bem-vindo ao cache, onde tudo é rápido, menos o meu desconto. Vai comprar?',
    'loja_cache_l3',
    'Escolha com calma. Eu anoto tudo, inclusive quem só olha.',
  )),

  indice_capitulo: dlg('indice_capitulo', 'indice', [naoIniciada('capitulo_cache_l3')], capitulo(
    'Shh. Estou reordenando o cache. Ou estava, antes dos fantasmas aparecerem.',
    'Dados velhos andando por aí, fingindo ser recentes. Registre um, abra a porta de energia e enfrente o Guardião do Cache.',
    'Porta de energia é o g. Só abre com o ajuste de energia. Cristais de silício e cobre resolvem.',
    [iniciar('capitulo_cache_l3'), anotar('Índice: fantasmas de cache confundem o Cache L3. O Guardião está no fim.')],
  )),
  indice_endereco: dlg('indice_endereco', 'indice', [ativa('capitulo_cache_l3'), naoIniciada('secundaria_cache_l3_1')], oferta(
    'Perdi um endereço. Linha 3F... ou F3? Os fantasmas costumam carregar índices perdidos. Pode procurar?',
    'Obrigado! Fantasmas não devolvem nada por bem. Por mal, às vezes.',
    [iniciar('secundaria_cache_l3_1')],
  )),
  indice_entrega: dlg('indice_entrega', 'indice', [etapa('secundaria_cache_l3_1', 'entregar')], fala(
    'Linha 3F! Eu sabia. Você acaba de salvar meu fim de semana inteiro.',
  )),
  indice_ativa: dlg('indice_ativa', 'indice', [ativa('capitulo_cache_l3')], fala(
    'Para registrar um fantasma, vença um ou use um escaneamento. O bestiário mostra as fraquezas depois.',
  )),
  indice_padrao: dlg('indice_padrao', 'indice', [], fala('Um lugar para cada dado, e cada dado no seu lugar.')),

  guarda_conclui: dlg('guarda_conclui', 'guarda_linha', [etapa('secundaria_cache_l3_2', 'guarda')], fala(
    'Fantasmas! Eu sabia que não estava louco. Minha linha está segura. Por mais uns cem anos.',
    [concluir('secundaria_cache_l3_2')],
  )),
  guarda_pedido: dlg('guarda_pedido', 'guarda_linha', [naoIniciada('secundaria_cache_l3_2')], oferta(
    'Alguém mexeu na minha linha. Ninguém lê essa linha há anos, então foi alguém. Afaste três fantasmas e me avise.',
    'Eu fico aqui. Vigiando. Como sempre.',
    [iniciar('secundaria_cache_l3_2')],
  )),
  guarda_padrao: dlg('guarda_padrao', 'guarda_linha', [], fala('Linha protegida. Leitura negada. Nada pessoal.')),

  // ================================================================ Núcleos
  pulsar_capitulo: dlg('pulsar_capitulo', 'pulsar', [naoIniciada('capitulo_nucleos')], capitulo(
    'Tum. Tum. Tum... tum-tum. Ouviu? Um núcleo perdeu o compasso.',
    'O Núcleo Instável acelera sem freio. Silencie os ruídos térmicos, reforce um encaixe e traga ele de volta ao ritmo.',
    'Encaixe vazio é o o no mapa. Reforço do núcleo preenche e ainda aumenta sua vida máxima.',
    [iniciar('capitulo_nucleos'), anotar('Pulsar: o Núcleo Instável superaquece a camada dos núcleos.')],
  )),
  pulsar_semente: dlg('pulsar_semente', 'pulsar', [ativa('capitulo_nucleos'), naoIniciada('secundaria_nucleos_2')], oferta(
    'Dentro do Núcleo Instável há uma semente de clock. Se você a trouxer, os núcleos voltam a pulsar juntos.',
    'Cuidado: ela é quente. Muito quente. Use luvas. Você tem luvas?',
    [iniciar('secundaria_nucleos_2')],
  )),
  pulsar_entrega: dlg('pulsar_entrega', 'pulsar', [etapa('secundaria_nucleos_2', 'entregar')], fala(
    'Tum. Tum. Tum. Perfeito. Ouça isso, Bit: é o som de um chip que vai sobreviver.',
  )),
  pulsar_ativa: dlg('pulsar_ativa', 'pulsar', [ativa('capitulo_nucleos')], fala(
    'Quando o Núcleo brilhar branco, defenda. Esse aviso vale mais que qualquer armadura.',
  )),
  pulsar_padrao: dlg('pulsar_padrao', 'pulsar', [], fala('Um ciclo de cada vez. Sempre no tempo.')),

  termostato_pedido: dlg('termostato_pedido', 'termostato', [naoIniciada('secundaria_nucleos_1')], oferta(
    'Antes de desligar a sala, preciso entender essa tal sobrecarga térmica. Registre uma e me traga um polímero térmico.',
    'Rápido. A cada minuto, a sala sobe meio grau.',
    [iniciar('secundaria_nucleos_1')],
  )),
  termostato_entrega: dlg('termostato_entrega', 'termostato', [etapa('secundaria_nucleos_1', 'polimero')], fala(
    'Polímero de boa qualidade. A sala fica ligada mais um dia. Mais um.',
  )),
  termostato_veterano: dlg('termostato_veterano', 'termostato', [{ tipo: 'nivel', min: 6 }], fala(
    'Carcaça marcada, nível alto... você já viu muita coisa. Mesmo assim: aqui dentro, quem manda é a temperatura.',
  )),
  termostato_padrao: dlg('termostato_padrao', 'termostato', [], fala('Passou de 85 graus, eu desligo. Até você.')),

  // ================================================================ Controlador de memória
  banca_capitulo: dlg('banca_capitulo', 'banca', [naoIniciada('capitulo_controlador_memoria')], capitulo(
    'Senha? Ah, você não é um pedido. Melhor assim: os pedidos pararam de andar.',
    'Algo enorme trava a fila dos bancos. Latência sabe mais. Fale com ela, repare a trilha e desfaça o que estiver lá.',
    'Latência fica no fundo. Não grite com ela: ela responde mais devagar.',
    [iniciar('capitulo_controlador_memoria'), anotar('Banca: algo trava a fila do controlador. Latência sabe o quê.')],
  )),
  banca_conclui: dlg('banca_conclui', 'banca', [etapa('secundaria_controlador_memoria_1', 'banca')], fala(
    'Atendida? Depois de tanto tempo? Vou imprimir uma ficha nova só para comemorar.',
    [concluir('secundaria_controlador_memoria_1')],
  )),
  banca_ficha: dlg('banca_ficha', 'banca', [ativa('capitulo_controlador_memoria'), naoIniciada('secundaria_controlador_memoria_1')], oferta(
    'Tenho aqui a ficha mais antiga do controlador. Leve à Latência; ela atende. Um dia.',
    'Segure firme. Essa ficha esperou mais que muita trilha durou.',
    [iniciar('secundaria_controlador_memoria_1'), dar('missao_ficha_de_fila')],
  )),
  banca_ativa: dlg('banca_ativa', 'banca', [ativa('capitulo_controlador_memoria')], fala(
    'A fila continua parada. Cada segundo aqui é um pedido a mais esperando.',
  )),
  banca_padrao: dlg('banca_padrao', 'banca', [], fala('Próximo! ... Ninguém? Próximo!')),

  latencia_capitulo: dlg('latencia_capitulo', 'latencia', [etapa('capitulo_controlador_memoria', 'latencia')], {
    n0: { fala: 'Você... quer saber... o que trava a fila. É a Fila Infinita. Pedidos nunca atendidos que viraram um só corpo.', ir: 'n1' },
    n1: {
      fala: 'Ela está na sala do Guardião. Repare a trilha e passe pela porta. E seja rápido. Alguém aqui precisa ser.',
      efeitos: [anotar('Latência: a Fila Infinita é feita de pedidos nunca atendidos.')],
    },
  }),
  latencia_entrega: dlg('latencia_entrega', 'latencia', [etapa('secundaria_controlador_memoria_1', 'entregar')], fala(
    'Ficha... número... quatro bilhões... Atendida. Finalmente. Avise a Banca.',
  )),
  latencia_pedido: dlg('latencia_pedido', 'latencia', [naoIniciada('secundaria_controlador_memoria_2')], oferta(
    'Bits corrompidos... trocam endereços. Derrote três. E traga uma placa-base. Os bancos precisam de chão.',
    'Obrigada. Eu agradeceria mais rápido, mas... você sabe.',
    [iniciar('secundaria_controlador_memoria_2')],
  )),
  latencia_padrao: dlg('latencia_padrao', 'latencia', [], fala('Eu... respondo... sempre. Só que... depois.')),

  // ================================================================ Rede de energia
  volt_loja: dlg('volt_loja', 'volt', [], balcao(
    'Fala rápido que a corrente não espera! Capacitor, patch, módulo, tudo com faísca de brinde. Vai ou não vai?',
    'loja_energia',
    'Compra feita, compra paga, choque incluso. Próximo!',
  )),

  amperia_capitulo: dlg('amperia_capitulo', 'amperia', [naoIniciada('capitulo_energia')], capitulo(
    'Cuidado onde pisa: metade desta rede quer te dar choque. A outra metade já deu.',
    'O Colapso de Tensão está derrubando a rede. Contenha os vazamentos, ajuste uma porta e segure o Colapso antes do apagão.',
    'Vazamentos são rápidos: não tente fugir deles. Congelar ou pulso de sinal funcionam melhor.',
    [iniciar('capitulo_energia'), anotar('Ampéria: o Colapso de Tensão ameaça apagar a rede.')],
  )),
  amperia_fusivel: dlg('amperia_fusivel', 'amperia', [ativa('capitulo_energia'), naoIniciada('secundaria_energia_2')], oferta(
    'Guardei o último fusível mestre. Ajuste duas portas de energia e entregue ao Disjuntor. Ele vai fingir que não precisava.',
    'Não deixe cair. Ele tem nome: Fusível. Eu não sou criativa com nomes.',
    [iniciar('secundaria_energia_2'), dar('missao_fusivel_mestre')],
  )),
  amperia_ativa: dlg('amperia_ativa', 'amperia', [ativa('capitulo_energia')], fala(
    'Quando as faíscas convergirem para o Colapso, defenda. O arco dele derruba até técnico experiente.',
  )),
  amperia_padrao: dlg('amperia_padrao', 'amperia', [], fala('Cada fusível tem um nome. Aquele é o Zezinho. Não toque no Zezinho.')),

  disjuntor_pedido: dlg('disjuntor_pedido', 'disjuntor', [naoIniciada('secundaria_energia_1')], oferta(
    'Clac! Desarmei. De novo. São esses picos de tensão. Registre um e derrube três, por favor. Eu preciso dormir.',
    'Se eu desarmar enquanto você luta, não é pessoal. É reflexo.',
    [iniciar('secundaria_energia_1')],
  )),
  disjuntor_entrega: dlg('disjuntor_entrega', 'disjuntor', [etapa('secundaria_energia_2', 'entregar')], fala(
    'Um fusível mestre? Eu não precisava. Mas vou instalar. Só por educação.',
  )),
  disjuntor_padrao: dlg('disjuntor_padrao', 'disjuntor', [], fala(
    'Qualquer coisa estranha, eu desarmo. Você é estranho. Mas vou abrir uma exceção.',
  )),

  // ================================================================ Interposer
  ponteira_capitulo: dlg('ponteira_capitulo', 'ponteira', [naoIniciada('capitulo_interposer')], capitulo(
    'Pare! Não pise aí. Ou pise, essa ponte já caiu mesmo.',
    'A Ponte Partida está derrubando as passagens. Leve este mapa até Via, repare uma via e derrube aquela ponte de vez.',
    'O mapa mostra os atalhos que ainda existem. Via sabe ler meus rabiscos. Quase sempre.',
    [iniciar('capitulo_interposer'), dar('missao_mapa_da_ponte'), anotar('Ponteira: leve o mapa da ponte até Via.')],
  )),
  ponteira_conclui: dlg('ponteira_conclui', 'ponteira', [etapa('secundaria_interposer_2', 'ponteira')], fala(
    'Um glitch de pipeline! Olha essas instruções ao contrário. Vou desenhar até o fim do turno. Obrigada!',
    [concluir('secundaria_interposer_2')],
  )),
  ponteira_glitch: dlg('ponteira_glitch', 'ponteira', [ativa('capitulo_interposer'), naoIniciada('secundaria_interposer_2')], oferta(
    'Nunca desenhei um glitch de pipeline. Registre um para mim? É para ciência. E para a minha parede.',
    'Perfeito! Vou separar uma folha em branco. Talvez duas.',
    [iniciar('secundaria_interposer_2')],
  )),
  ponteira_ativa: dlg('ponteira_ativa', 'ponteira', [ativa('capitulo_interposer')], fala(
    'Via fica do outro lado. Quando a ponte ranger, defenda. Ela avisa antes de cair.',
  )),
  ponteira_padrao: dlg('ponteira_padrao', 'ponteira', [], fala(
    'Toda ponte é só um caminho que alguém teve coragem de esticar.',
  )),

  via_mapa: dlg('via_mapa', 'via', [etapa('capitulo_interposer', 'mapa'), { tipo: 'item', id: 'missao_mapa_da_ponte', qtd: 1 }], fala(
    'O mapa de Ponteira! Os rabiscos são horríveis, mas os atalhos são reais. Agora a ponte não te pega desprevenido.',
  )),
  via_entrega: dlg('via_entrega', 'via', [etapa('secundaria_interposer_1', 'placa')], fala(
    'Placa firme, cobre novo. Essa passagem aguenta mais umas mil travessias.',
  )),
  via_pedido: dlg('via_pedido', 'via', [naoIniciada('secundaria_interposer_1')], oferta(
    'As passagens que sobraram estão bambas. Junte três fios de cobre e uma placa-base, e eu escoro o que der.',
    'Ótimo. Enquanto isso, eu seguro esta aqui. Com as duas mãos.',
    [iniciar('secundaria_interposer_1')],
  )),
  via_padrao: dlg('via_padrao', 'via', [], fala('Para baixo é sempre mais rápido. Para cima é que é o problema.')),

  // ================================================================ Substrato
  umbra_loja: dlg('umbra_loja', 'umbra', [], balcao(
    'Psiu. Aqui embaixo, quem vende sou eu. Fragmentos, refrigerante, coisas que não deviam existir. Interessa?',
    'loja_substrato',
    'Não pergunte de onde veio. Eu também não sei.',
  )),

  raiz_fim: dlg('raiz_fim', 'raiz', [{ tipo: 'chefe', id: 'anel_escuro', estado: 'derrotado' }], {
    n0: {
      fala: 'Você conseguiu, Bit. O chip está respirando. Ouça: as ventoinhas lá em cima voltaram a girar.',
      efeitos: [{ tipo: 'curar' }, { tipo: 'flag', id: 'raiz_agradeceu', valor: true }],
    },
  }),
  raiz_capitulo: dlg('raiz_capitulo', 'raiz', [naoIniciada('capitulo_substrato')], capitulo(
    'Você chegou ao fundo, Bit. Aqui é onde tudo começou, e onde tudo pode acabar.',
    'O Anel Escuro gira na sala final. Antes, ouça Eco: ela sabe o que ele é. Depois, os glitches. Depois, o Anel.',
    'Vá. E volte. Nessa ordem.',
    [iniciar('capitulo_substrato'), { tipo: 'curar' }, anotar('Raiz: ouça Eco antes de enfrentar o Anel Escuro.')],
  )),
  raiz_entrega: dlg('raiz_entrega', 'raiz', [etapa('secundaria_substrato_1', 'entregar')], fala(
    'Frios... pesados... e pulsando. A Corrupção se alimenta de bits esquecidos. Isso explica muita coisa.',
  )),
  raiz_fragmentos: dlg('raiz_fragmentos', 'raiz', [naoIniciada('secundaria_substrato_1')], oferta(
    'Cada fragmento escuro é um pedaço da Corrupção. Traga dois e eu descubro como ela se espalha.',
    'Segure pelas bordas. Eles mordem. Metaforicamente. Acho.',
    [iniciar('secundaria_substrato_1')],
  )),
  raiz_padrao: dlg('raiz_padrao', 'raiz', [], fala('Aqui embaixo, o silêncio também é um sinal.')),

  eco_capitulo: dlg('eco_capitulo', 'eco', [etapa('capitulo_substrato', 'eco')], {
    n0: { fala: 'Eu me lembro da primeira vez que este chip foi ligado. Uma luz percorreu as trilhas, e cada bit sabia o seu lugar.', ir: 'n1' },
    n1: { fala: 'Com os anos, bits esquecidos se acumularam aqui no fundo. Ninguém os limpava. Eles se juntaram num anel... e escureceram.', ir: 'n2' },
    n2: {
      fala: 'O Anel Escuro não é mau, Bit. É só tudo aquilo que ninguém quis lembrar. Mas precisa ser apagado.',
      efeitos: [{ tipo: 'flag', id: 'ouviu_eco', valor: true }, anotar('Eco: o Anel Escuro é feito de bits esquecidos.')],
    },
  }),
  eco_entrega: dlg('eco_entrega', 'eco', [etapa('secundaria_substrato_2', 'entregar')], fala(
    'Escute... é só um zumbido. Um bit pedindo para ser lembrado. Pode descansar agora. Nós dois podemos.',
    [{ tipo: 'xp', valor: 20 }],
  )),
  eco_ultimo: dlg('eco_ultimo', 'eco', [ativa('capitulo_substrato'), naoIniciada('secundaria_substrato_2')], oferta(
    'Quando o Anel cair, sobrará um eco dele. Traga-o para mim. Quero ouvir o que ele tem a dizer.',
    'Obrigada. Já faz tempo que ninguém me traz nada.',
    [iniciar('secundaria_substrato_2')],
  )),
  eco_lembranca: dlg('eco_lembranca', 'eco', [{ tipo: 'flag', id: 'ouviu_eco', valor: true }], fala(
    'Lembre-se do que eu disse. Apagar não é esquecer. É deixar ir.',
  )),
  eco_padrao: dlg('eco_padrao', 'eco', [], fala('Toda memória volta ao substrato, cedo ou tarde.')),
};
