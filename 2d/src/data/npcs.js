// Personagens que Bit encontra nas camadas. Em cada camada com loja, o mercador vem primeiro.
// tipo: tecnico (dá o capítulo), mercador (abre a loja), guardiao (vigia), narrador (conta a história).

const npc = (id, camada, tipo, sprite, nome, descricao) => ({ id, nome, camada, tipo, sprite, descricao });

export const NPCS = {
  // ---------------------------------------------------------------- Dissipador
  aleta: npc('aleta', 'dissipador', 'mercador', 'mercador_a', 'Aleta',
    'Comerciante de ventoinhas usadas. Vende frio a preço de ouro e jura que é promoção.'),
  lumen: npc('lumen', 'dissipador', 'tecnico', 'tecnico_a', 'Lúmen',
    'Técnica-chefe do dissipador. Mede a temperatura até do próprio humor.'),
  sentinela_ventoinha: npc('sentinela_ventoinha', 'dissipador', 'guardiao', 'guardiao_a', 'Sentinela da Ventoinha',
    'Vigia uma ventoinha que parou de girar. Não sai de perto, por precaução.'),

  // ---------------------------------------------------------------- Metal M1
  solda: npc('solda', 'metal_m1', 'tecnico', 'tecnico_b', 'Solda',
    'Reparadora de trilhas com mãos firmes e paciência curta.'),
  ferrim: npc('ferrim', 'metal_m1', 'tecnico', 'tecnico_a', 'Ferrim',
    'Aprendiz de Solda. Coleciona lascas de cobre e conselhos que não pediu.'),

  // ---------------------------------------------------------------- Cache L3
  lira: npc('lira', 'cache_l3', 'mercador', 'mercador_a', 'Lira',
    'Negociante do cache. Lembra de cada cliente e de cada dívida.'),
  indice: npc('indice', 'cache_l3', 'tecnico', 'tecnico_b', 'Índice',
    'Organiza as linhas do cache em ordem quase perfeita. Quase.'),
  guarda_linha: npc('guarda_linha', 'cache_l3', 'guardiao', 'guardiao_a', 'Guarda-Linha',
    'Protege uma linha de memória que ninguém lê há anos. Leva o trabalho a sério.'),

  // ---------------------------------------------------------------- Núcleos
  pulsar: npc('pulsar', 'nucleos', 'tecnico', 'tecnico_a', 'Pulsar',
    'Técnico dos núcleos. Fala no ritmo do clock e se irrita com atrasos.'),
  termostato: npc('termostato', 'nucleos', 'guardiao', 'guardiao_a', 'Termostato',
    'Vigia veterano. Desliga tudo quando a sala passa do ponto, inclusive conversas.'),

  // ---------------------------------------------------------------- Controlador de memória
  banca: npc('banca', 'controlador_memoria', 'tecnico', 'tecnico_b', 'Banca',
    'Despachante dos bancos de memória. Atende pedidos desde antes de você ser montado.'),
  latencia: npc('latencia', 'controlador_memoria', 'guardiao', 'guardiao_a', 'Latência',
    'Guardiã lenta e precisa. Responde sempre, mas nunca na hora.'),

  // ---------------------------------------------------------------- Rede de energia
  volt: npc('volt', 'energia', 'mercador', 'mercador_a', 'Volt',
    'Mercador eletrizado. Fala rápido, cobra rápido e não dá troco.'),
  amperia: npc('amperia', 'energia', 'tecnico', 'tecnico_a', 'Ampéria',
    'Engenheira da rede. Conhece cada fusível pelo nome e pelo temperamento.'),
  disjuntor: npc('disjuntor', 'energia', 'guardiao', 'guardiao_a', 'Disjuntor',
    'Guarda da subestação. Desarma ao menor sinal de problema, às vezes sem problema.'),

  // ---------------------------------------------------------------- Interposer
  ponteira: npc('ponteira', 'interposer', 'tecnico', 'tecnico_b', 'Ponteira',
    'Cartógrafa das pontes entre blocos. Desenha mapas mais rápido do que eles mudam.'),
  via: npc('via', 'interposer', 'tecnico', 'tecnico_a', 'Via',
    'Mantém as passagens verticais abertas. Sabe tudo sobre atalhos, pouco sobre paciência.'),

  // ---------------------------------------------------------------- Substrato
  umbra: npc('umbra', 'substrato', 'mercador', 'mercador_a', 'Umbra',
    'Vende no escuro o que sobrou do chip. Ninguém sabe como chegou aqui.'),
  raiz: npc('raiz', 'substrato', 'tecnico', 'tecnico_a', 'Raiz',
    'Último técnico do fundo. Viu a Corrupção nascer e ainda tem esperança.'),
  eco: npc('eco', 'substrato', 'narrador', 'narrador_a', 'Eco',
    'Voz antiga do substrato. Lembra de quando o chip foi ligado pela primeira vez.'),
};
