// Habilidades de Bit (três ramos) e ataques das falhas e chefes.
// Dano: fator multiplica o poder de ataque (atk efetivo). status: ids de src/data/status.js.
// Nos ATAQUES, o alvo é o jogador, salvo quando o efeito diz alvo: 'proprio'.

const hab = (id, ramo, dados) => ({ id, ramo, sprite: `ramo_${ramo}`, ...dados });

export const HABILIDADES = {
  // ================================================================ Ramo fusão (ataque)
  descarga: hab('descarga', 'fusao', {
    nome: 'Descarga', custo_ep: 2, nivel: 1, pontos: 1, elemento: 'corrente',
    efeitos: [{ tipo: 'dano', fator: 1.2 }],
    descricao: 'Solta a carga acumulada num estalo só. Simples, barato e honesto.',
  }),
  chama_termica: hab('chama_termica', 'fusao', {
    nome: 'Chama térmica', custo_ep: 3, nivel: 2, pontos: 1, elemento: 'calor',
    efeitos: [{ tipo: 'dano', fator: 1.1 }, { tipo: 'status', status: 'queimadura', chance: 0.6, alvo: 'inimigo' }, { tipo: 'calor', valor: 5 }],
    descricao: 'Joga o próprio calor no inimigo. Pode queimar, mas esquenta você também.',
  }),
  pulso_sinal: hab('pulso_sinal', 'fusao', {
    nome: 'Pulso de sinal', custo_ep: 3, nivel: 3, pontos: 1, elemento: 'sinal',
    efeitos: [{ tipo: 'dano', fator: 1.2 }, { tipo: 'status', status: 'curto', chance: 0.3, alvo: 'inimigo' }],
    descricao: 'Um pulso fora de fase que confunde o alvo. Chance de curto-circuito.',
  }),
  arco_voltaico: hab('arco_voltaico', 'fusao', {
    nome: 'Arco voltaico', custo_ep: 5, nivel: 5, pontos: 2, elemento: 'corrente',
    efeitos: [{ tipo: 'dano', fator: 1.8 }, { tipo: 'status', status: 'corrosao', chance: 0.5, alvo: 'inimigo' }],
    descricao: 'Um arco de plasma que derrete a carcaça do alvo. Pode corroer a defesa.',
  }),
  onda_de_choque: hab('onda_de_choque', 'fusao', {
    nome: 'Onda de choque', custo_ep: 7, nivel: 8, pontos: 2, elemento: 'neutro',
    efeitos: [{ tipo: 'dano', fator: 2.2 }],
    descricao: 'Esvazia todos os capacitores de uma vez. O chão treme, o inimigo também.',
  }),

  // ================================================================ Ramo reparo (suporte)
  pasta_de_reparo: hab('pasta_de_reparo', 'reparo', {
    nome: 'Pasta de reparo', custo_ep: 2, nivel: 1, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'cura', valor: 8 }],
    descricao: 'Tapa as rachaduras da carcaça. Recupera 8 de vida.',
  }),
  ponte_de_reparo: hab('ponte_de_reparo', 'reparo', {
    nome: 'Ponte de reparo', custo_ep: 4, nivel: 3, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'cura', valor: 6 }, { tipo: 'escudo', valor: 4 }],
    descricao: 'Solda um desvio nas trilhas internas. Cura 6 e cria um escudo de 4.',
  }),
  limpeza: hab('limpeza', 'reparo', {
    nome: 'Limpeza', custo_ep: 3, nivel: 2, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'remover', classe: 'negativo' }],
    descricao: 'Passa um pano nos registradores. Remove todos os estados negativos.',
  }),
  regeneracao: hab('regeneracao', 'reparo', {
    nome: 'Regeneração', custo_ep: 4, nivel: 4, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'status', status: 'regeneracao', duracao: 3, chance: 1, alvo: 'proprio' }],
    descricao: 'Ativa nanorreparos que trabalham sozinhos por três turnos.',
  }),
  sincronia: hab('sincronia', 'reparo', {
    nome: 'Sincronia', custo_ep: 6, nivel: 7, pontos: 2, elemento: null,
    efeitos: [{ tipo: 'buff', status: 'foco', duracao: 3 }, { tipo: 'buff', status: 'impulso', duracao: 3 }],
    descricao: 'Alinha todos os relógios internos. Ganha foco e impulso por três turnos.',
  }),

  // ================================================================ Ramo dissipação (defesa e frio)
  dissipador_ativo: hab('dissipador_ativo', 'dissipacao', {
    nome: 'Dissipador ativo', custo_ep: 2, nivel: 1, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'escudo', valor: 6 }, { tipo: 'calor', valor: -10 }],
    descricao: 'Liga as ventoinhas no máximo. Escudo de 6 e calor −10.',
  }),
  congelar: hab('congelar', 'dissipacao', {
    nome: 'Congelar', custo_ep: 3, nivel: 2, pontos: 1, elemento: 'frio',
    efeitos: [{ tipo: 'dano', fator: 1.2 }, { tipo: 'status', status: 'lentidao', chance: 0.7, alvo: 'inimigo' }],
    descricao: 'Um jato de refrigerante direto no alvo. Costuma deixá-lo lento.',
  }),
  resfriamento: hab('resfriamento', 'dissipacao', {
    nome: 'Resfriamento', custo_ep: 3, nivel: 3, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'calor', valor: -30 }, { tipo: 'cura', valor: 4 }],
    descricao: 'Respira fundo pelas aletas. Calor −30 e recupera 4 de vida.',
  }),
  contramedida: hab('contramedida', 'dissipacao', {
    nome: 'Contramedida', custo_ep: 4, nivel: 5, pontos: 1, elemento: null,
    efeitos: [{ tipo: 'status', status: 'fraqueza', chance: 0.7, alvo: 'inimigo' }, { tipo: 'escudo', valor: 4 }],
    descricao: 'Desvia a energia do golpe inimigo. Pode enfraquecê-lo e cria escudo de 4.',
  }),
  bloqueio_termico: hab('bloqueio_termico', 'dissipacao', {
    nome: 'Bloqueio térmico', custo_ep: 5, nivel: 6, pontos: 2, elemento: null,
    efeitos: [{ tipo: 'buff', status: 'bloqueio', duracao: 1 }, { tipo: 'calor', valor: -10 }],
    descricao: 'Fecha a carcaça numa camada isolante. Recebe metade do dano até seu próximo turno.',
  }),
};

// ==================================================================== Ataques das falhas e chefes
const atq = (id, nome, elemento, efeitos, descricao, telegrafo) =>
  ({ id, nome, elemento, efeitos, descricao, ...(telegrafo ? { telegrafo } : {}) });
const dano = (fator) => ({ tipo: 'dano', fator });
const st = (status, chance) => ({ tipo: 'status', status, chance });

export const ATAQUES = {
  // ---------------------------------------------------------------- Falhas regulares
  picada_eletrica: atq('picada_eletrica', 'Picada elétrica', 'corrente', [dano(1.0)],
    'Uma ferroada de elétron. Dói mais do que o tamanho sugere.'),
  salto_estatico: atq('salto_estatico', 'Salto estático', 'corrente', [dano(0.8), st('lentidao', 0.3)],
    'Pula na carcaça e deixa tudo arrepiado e lento.'),
  rasgar: atq('rasgar', 'Rasgar', 'neutro', [dano(1.0)],
    'Abre a carcaça como se fosse uma trilha velha.'),
  lasca_de_cobre: atq('lasca_de_cobre', 'Lasca de cobre', 'neutro', [dano(0.7), st('corrosao', 0.35)],
    'Arremessa lascas oxidadas que corroem a defesa.'),
  chiado_quente: atq('chiado_quente', 'Chiado quente', 'calor', [dano(1.0)],
    'Um chiado agudo que esquenta o ar entre vocês.'),
  bafo_termico: atq('bafo_termico', 'Bafo térmico', 'calor', [dano(0.8), st('queimadura', 0.4), { tipo: 'calor', valor: 5 }],
    'Sopro abafado que queima e esquenta o chip.'),
  fuga_de_carga: atq('fuga_de_carga', 'Fuga de carga', 'corrente', [dano(1.1)],
    'Escapa em alta velocidade e atravessa você no caminho.'),
  centelha_rasteira: atq('centelha_rasteira', 'Centelha rasteira', 'corrente', [dano(0.9), st('curto', 0.2)],
    'Faísca pelo chão que pode causar curto-circuito.'),
  erosao_atomica: atq('erosao_atomica', 'Erosão atômica', 'corrente', [dano(0.9), st('corrosao', 0.5)],
    'Arranca átomos da sua carcaça, um por um.'),
  vazio_de_metal: atq('vazio_de_metal', 'Vazio de metal', 'neutro', [{ tipo: 'escudo', valor: 4, alvo: 'proprio' }],
    'Se encolhe e endurece. Ganha escudo de 4.'),
  surto: atq('surto', 'Surto', 'corrente', [dano(1.3)],
    'Uma pancada de voltagem pura, sem aviso nem desculpa.'),
  estalo: atq('estalo', 'Estalo', 'corrente', [dano(0.8), st('curto', 0.3)],
    'Estalo seco que pode travar sua próxima ação.'),
  acerto_falso: atq('acerto_falso', 'Acerto falso', 'sinal', [dano(1.0), st('fraqueza', 0.3)],
    'Entrega um dado errado com toda a confiança. Enfraquece.'),
  sumir_da_linha: atq('sumir_da_linha', 'Sumir da linha', 'sinal', [dano(0.6), st('lentidao', 0.4)],
    'Some e reaparece atrás de você. Desorienta.'),
  fornalha: atq('fornalha', 'Fornalha', 'calor', [dano(1.2), { tipo: 'calor', valor: 8 }],
    'Abre o peito e libera uma onda de calor.'),
  derreter: atq('derreter', 'Derreter', 'calor', [dano(0.9), st('queimadura', 0.5)],
    'Gruda e derrete o que encontrar. Pode queimar.'),
  inversao: atq('inversao', 'Inversão', 'sinal', [dano(1.1), st('fraqueza', 0.4)],
    'Troca seus uns por zeros. Seus golpes ficam fracos.'),
  paridade_quebrada: atq('paridade_quebrada', 'Paridade quebrada', 'sinal', [dano(0.8), st('curto', 0.25)],
    'Um erro que ninguém detecta. Pode causar curto.'),
  bolha_no_pipeline: atq('bolha_no_pipeline', 'Bolha no pipeline', 'sinal', [dano(1.0), st('lentidao', 0.5)],
    'Enfia um ciclo vazio na sua rotina. Você fica lento.'),
  execucao_fora_de_ordem: atq('execucao_fora_de_ordem', 'Execução fora de ordem', 'sinal', [dano(1.4)],
    'Acerta o golpe antes de decidir dar o golpe.'),

  // ---------------------------------------------------------------- Bolha Térmica
  borbulhar: atq('borbulhar', 'Borbulhar', 'calor', [dano(1.0), { tipo: 'calor', valor: 5 }],
    'Bolhas ferventes estouram na sua cara.'),
  estouro_de_vapor: atq('estouro_de_vapor', 'Estouro de vapor', 'calor', [dano(1.8), st('queimadura', 0.5)],
    'A bolha estoura num jato de vapor escaldante.', 'A Bolha incha e treme. Algo vai estourar!'),
  ebulicao: atq('ebulicao', 'Ebulição', 'calor', [dano(1.2), st('queimadura', 0.4)],
    'Ferve inteira de raiva. Tudo em volta queima.'),

  // ---------------------------------------------------------------- Varredor de Trilhas
  varredura: atq('varredura', 'Varredura', 'corrente', [dano(1.0)],
    'Passa a vassoura elétrica de lado a lado.'),
  corte_em_linha: atq('corte_em_linha', 'Corte em linha', 'corrente', [dano(1.9)],
    'Uma lâmina de corrente que corta a trilha inteira.', 'O Varredor alinha as escovas com a sua trilha.'),
  arrastao: atq('arrastao', 'Arrastão', 'corrente', [dano(0.9), st('lentidao', 0.5)],
    'Puxa você junto com o entulho. Fica difícil se mexer.'),

  // ---------------------------------------------------------------- Guardião do Cache
  invalidar_linha: atq('invalidar_linha', 'Invalidar linha', 'sinal', [dano(1.0), st('fraqueza', 0.4)],
    'Marca você como dado vencido. Seus golpes perdem força.'),
  despejo_total: atq('despejo_total', 'Despejo total', 'sinal', [dano(2.0)],
    'Esvazia o bloco inteiro de uma vez, com você dentro.', 'O Guardião abre todas as linhas do bloco.'),
  reescrita: atq('reescrita', 'Reescrita', 'sinal', [{ tipo: 'cura', valor: 8, alvo: 'proprio' }],
    'Sobrescreve os próprios danos com uma cópia limpa. Recupera 8.'),

  // ---------------------------------------------------------------- Núcleo Instável
  pulso_de_clock: atq('pulso_de_clock', 'Pulso de clock', 'calor', [dano(1.1)],
    'Um pulso fora do compasso que atinge em cheio.'),
  fusao_do_nucleo: atq('fusao_do_nucleo', 'Fusão do núcleo', 'calor', [dano(2.1), st('queimadura', 0.6)],
    'O núcleo derrete por um instante e despeja tudo em você.', 'O Núcleo brilha branco. A temperatura dispara!'),
  overclock: atq('overclock', 'Overclock', 'calor', [{ tipo: 'buff', status: 'impulso', alvo: 'proprio' }, { tipo: 'calor', valor: 10 }],
    'Acelera além do limite. Ganha impulso e esquenta a sala.'),

  // ---------------------------------------------------------------- Fila Infinita
  enfileirar: atq('enfileirar', 'Enfileirar', 'sinal', [dano(0.8), st('lentidao', 0.6)],
    'Coloca você no fim da fila. Tudo demora mais.'),
  estouro_de_fila: atq('estouro_de_fila', 'Estouro de fila', 'sinal', [dano(2.0), st('curto', 0.3)],
    'Todos os pedidos pendentes chegam de uma vez.', 'A Fila para de andar. Os pedidos se acumulam...'),
  espera_eterna: atq('espera_eterna', 'Espera eterna', 'sinal', [dano(1.2), st('fraqueza', 0.4)],
    'Sua solicitação será atendida em breve. Não será.'),

  // ---------------------------------------------------------------- Colapso de Tensão
  queda_de_tensao: atq('queda_de_tensao', 'Queda de tensão', 'corrente', [dano(1.0), st('fraqueza', 0.3)],
    'Suga a voltagem ao redor. Você se sente fraco.'),
  arco_de_colapso: atq('arco_de_colapso', 'Arco de colapso', 'corrente', [dano(2.2), st('curto', 0.4)],
    'A rede inteira descarrega num arco gigante.', 'Faíscas convergem para o Colapso. Proteja-se!'),
  sobretensao: atq('sobretensao', 'Sobretensão', 'corrente', [dano(1.3), { tipo: 'escudo', valor: 6, alvo: 'proprio' }],
    'Ataca e guarda o excedente como escudo.'),

  // ---------------------------------------------------------------- Ponte Partida
  geada_na_via: atq('geada_na_via', 'Geada na via', 'frio', [dano(1.0), st('lentidao', 0.5)],
    'Cobre a via de gelo. Cada passo custa o dobro.'),
  ruptura_da_ponte: atq('ruptura_da_ponte', 'Ruptura da ponte', 'frio', [dano(2.1)],
    'A ponte se parte sob seus pés.', 'A ponte range e se curva. Vai ceder!'),
  estalo_gelado: atq('estalo_gelado', 'Estalo gelado', 'frio', [dano(1.2), st('corrosao', 0.4)],
    'Gelo que racha a carcaça. A defesa cede.'),

  // ---------------------------------------------------------------- Anel Escuro
  sombra_do_anel: atq('sombra_do_anel', 'Sombra do anel', 'neutro', [dano(1.1), st('corrosao', 0.4)],
    'Uma sombra gira em volta de você e corrói.'),
  eclipse_de_dados: atq('eclipse_de_dados', 'Eclipse de dados', 'neutro', [dano(2.4), st('fraqueza', 0.5)],
    'Apaga a luz de todos os bits ao redor.', 'O Anel escurece. Os bits ao redor se apagam um a um.'),
  vazio_absoluto: atq('vazio_absoluto', 'Vazio absoluto', 'neutro', [dano(1.5), st('curto', 0.3), { tipo: 'cura', valor: 6, alvo: 'proprio' }],
    'Engole um pedaço de você e se alimenta dele.'),
};
