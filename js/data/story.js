// Roteiro original de Vaelmor. Cada fala: { who, face, text }. Sem "who" = narração.
(() => {
  const V = (window.V = window.V || {});
  V.Data = V.Data || {};

  const N = (text) => ({ who: null, face: null, text });
  const S = (who, face, text) => ({ who, face, text });

  V.Data.story = {
    prologue: [
      N('Muito antes das torres, o céu de Vaelmor tinha uma lua que nunca falhava.'),
      N('Então veio a noite em que o Eclipse a engoliu. Desde então, a escuridão escorre pelas frestas do mundo e transforma tudo que toca.'),
      S('Ysa', 'ysa', 'Eu vi a aldeia de Brisafria virar cinzas. Minha avó morreu com este arco nas mãos.'),
      S('Ysa', 'ysa', 'O arco guarda um pedaço da lua. Se a escuridão quer o céu, vai ter que me pegar antes.'),
      N('Ysa segue para o Bosque Sussurrante, onde as primeiras sombras nasceram.'),
    ],

    chapters: [
      {
        name: 'Bosque Sussurrante',
        intro: [
          S('Mestra Iolen', 'iolen', 'Você tem o olhar da sua avó, criança. Os bichos do bosque estão diferentes, e as árvores sussurram nomes que não deveriam conhecer.'),
          S('Mestra Iolen', 'iolen', 'Tudo começa na raiz do Ancião. Ele bebe a seiva da floresta e espalha o sussurro que enlouquece os animais.'),
          S('Ysa', 'ysa', 'Então vou cortar essa raiz.'),
        ],
        bossIntro: [
          S('Ancião Raiz', 'treant', 'Pequena arqueira... sua luz é só mais uma flor para mim.'),
          S('Ysa', 'ysa', 'Flores também queimam, velho.'),
        ],
        outro: [
          N('O Ancião tomba em um estrondo de galhos. Da madeira partida escapa um fragmento de luz pálida.'),
          S('Mestra Iolen', 'iolen', 'Um fragmento da lua... Ainda faltam dois, Ysa. Os sussurros virão das minas e das torres.'),
        ],
      },
      {
        name: 'Minas de Cinza',
        intro: [
          N('As trilhas da floresta levam às minas abandonadas, onde o ar tem cheiro de cinza e ferro quente.'),
          S('Gorm', 'gorm', 'Ei, arqueira! Tenho armas, poções e pouca paciência para quem não paga. Olhe antes de morrer.'),
          S('Ysa', 'ysa', 'Vou lembrar disso quando estiver ferida.'),
        ],
        bossIntro: [
          S('Rei Obsidiana', 'king', 'Flechas não ferem pedra. Nada que é feito de terra conhece medo.'),
          S('Ysa', 'ysa', 'Você nunca foi feito de terra. Você foi feito de roubo.'),
        ],
        outro: [
          N('O Rei Obsidiana racha em mil pedaços. Entre os cacos brilha um segundo fragmento, quente como brasa.'),
          S('Gorm', 'gorm', 'Esse brilho aí vale mais que minha loja inteira. Não conta pra ninguém.'),
        ],
      },
      {
        name: 'Torre do Crepúsculo',
        intro: [
          N('No topo de uma torre sem janelas, uma voz conhecida espera sem pressa.'),
          S('Mirra', 'mirra', 'Eu também já fui arqueira. Atirei na lua, e a lua atirou de volta.'),
          S('Ysa', 'ysa', 'Você está do lado do Eclipse?'),
          S('Mirra', 'mirra', 'Estou do lado de quem sobrevive. Suba. Ele já percebeu que você veio.'),
        ],
        bossIntro: [
          S('Senhor do Eclipse', 'eclipse', 'Eu sou o que sobra quando a luz se vai. Por que lutar contra o que já é seu?'),
          S('Ysa', 'ysa', 'Porque a noite sempre acaba quando alguém teima em atirar.'),
        ],
        outro: [
          N('O Eclipse se parte como vidro. A lua volta ao céu com um brilho que cega e aquece.'),
          S('Mirra', 'mirra', 'Você conseguiu, Ysa. Brisafria pode, enfim, esquecer o fogo.'),
          S('Ysa', 'ysa', 'Ela não vai esquecer. Mas vai reconstruir.'),
        ],
      },
    ],

    ending: [
      N('Com a lua de volta, as sombras recuam para os cantos esquecidos do mundo.'),
      N('Em Brisafria, as primeiras casas voltam a ser erguidas, e o arco de Ysa é pendurado acima da lareira.'),
      S('Ysa', 'ysa', 'Vovó, a luz voltou. Agora é a nossa vez de guardá-la.'),
      N('FIM DO PRIMEIRO CICLO. Obrigado por jogar Vaelmor.'),
    ],

    defeat: [
      'A escuridão fecha sobre a arqueira. Mas o arco, guardado pela lua, pulsa uma última vez.',
      'Brisafria ainda espera. Ysa levanta, respira e volta à trilha.',
      'Nem toda flecha acerta. A próxima, porém, pode ser a que muda o destino.',
    ],

    nodeFlavor: {
      combat: ['Uma patrulha de monstros bloqueia o caminho.', 'Sussurros se aproximam pelas sombras.', 'Você ouve passos pesados vindo da escuridão.'],
      elite: ['Uma presença maior rosna por trás das árvores. Um campeão das sombras.'],
      treasure: ['Um baú esquecido repousa sobre uma pedra, com três bênçãos gravadas.'],
      rest: ['Uma fogueira mansa crepita, por enquanto.'],
      shop: ['Um mercador de capa surrada oferece mercadorias sob a luz de uma lanterna.'],
      boss: ['O ar pesa. O chefe deste capítulo está perto.'],
    },
  };
})();
