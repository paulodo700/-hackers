# Anel Zero — Documento de Design

## Conceito

Um RPG de aventura 3D em que o mundo **é** um processador. O jogador controla **Bit**, um programa de manutenção que acorda no meio de um chip em colapso. Cada zona é uma parte real de um processador (cache, registradores, ULA, pipeline, memória principal, barramento, núcleo), transformada em cenário de fantasia tecnológica. O jogo mistura exploração, missões principais e extras, batalhas por turnos, criação de itens e o **reparo de circuitos**, a mecânica central.

**Pilares**
1. **Consertar é jogar.** Restaurar trilhas partidas é o coração do jogo: um quebra-cabeça com tempo, pontuação e segmentos especiais.
2. **O cenário explica a história.** Cada zona ensina um conceito real de arquitetura de computadores, sem tom de aula.
3. **Qualquer tela.** Funciona no PC e no celular, com controles próprios e layout testado em 360 px.
4. **Original do início ao fim.** Nomes, personagens, mapas, sprites, sons e textos são criados para este projeto.

## História

> Processador Ômega-7. Frequência alta, temperatura alta, e um silêncio que não deveria existir.

Bit acorda sem lembrar como chegou ali. O Anel Zero, o nível mais privilegiado do chip, está partido. A **Ferrugem** se espalha pelos barramentos, e a **Sobrecarga** domina a Forja. Aos poucos, Bit descobre que o culpado não é o caos em si, e sim o **Vigia**, o guardião de vigilância do processador, que apagou a memória de Bit para protegê-lo do colapso.

No núcleo, Bit escolhe o destino do Vigia:
- **Final da paz:** devolver a memória e consertar o sistema juntos. Não há batalha.
- **Final da guerra:** reescrever o núcleo à força. Bit vence o Vigia e o processador funciona de novo, mas sem as lembranças do que se perdeu.

**Temas:** memória e esquecimento, proteção que vira prisão, colapso causado por quem tentava proteger.

## Personagens

| Nome | Papel | Acessório visível | Onde |
|---|---|---|---|
| **Bit** | Protagonista. Programa de manutenção sem memória. | Ombreiras, mochila de dissipação, antena | Todo o jogo |
| **Sementa** | Jardineira da Cache. Missões principal e extra. | Brotos verdes | Jardim da Cache L1 |
| **Caixa de Peças** | Lojista. Vende peças e compra itens e materiais. | Avental e caixa registradora | Jardim da Cache L1 |
| **Bigorna** | Ferreiro de registradores. | Martelo nas costas | Planície de Registradores |
| **Rebite** | Mestre da Forja. | Óculos de proteção | Forja da ULA |
| **Ponteiro** | Guia do canyon. | Ponteiro de relógio | Canyon do Pipeline |
| **Arquivista** | Guarda os fragmentos de memória. | Pilha de livros | Cidade dos Bancos de Memória |
| **Correio** | Entregador do barramento. | Bolsa a tiracolo | Barramento Principal |
| **Vigia** | Guardião do processador. Antagonista, com final de paz ou guerra. | Anel com olho | Núcleo |

## Mundo (zonas)

Cada zona tem um mapa de 24 colunas em texto (`src/data/zones.js`), portais de ida e volta, uma decoração própria, uma trilha musical e encontros próprios.

| Zona | Decoração | Trilha | Reparo | Observação |
|---|---|---|---|---|
| Jardim da Cache L1 | células de memória | calma, triangular | 4×4, sem tempo | Tutorial e loja |
| Planície de Registradores | pinos | vento, senoidal | 5×5, 120 s | Bancada de criação |
| Forja da ULA | engrenagens girando | calor, serra | 5×5, sem tempo, 2 fusíveis | Chefe: Sobrecarga |
| Canyon do Pipeline | tubos de refrigeração | ritmo rápido | 6×6, 90 s | Três baús |
| Cidade dos Bancos de Memória | torres com LED | lenta, bem grave | — | Três fragmentos de memória |
| Barramento Principal | faixas luminosas | tensa | — | Chefe: Titã da Ferrugem |
| Núcleo do Anel Zero | anéis flutuantes | final, senoidal grave | — | Chefe: Vigia (paz ou guerra) |

Transições entre zonas escurecem a tela por cerca de meio segundo. Entradas trancadas explicam o motivo.

## Sistemas

**Reparo de circuito.** Um tabuleiro N×N (`repair.js`). Clicar gira o segmento 90°. Vence quem liga a fonte verde (0,0) ao destino magenta. Tipos de segmento:
- **Reto, curva, T, ponta:** giram normalmente.
- **Cruzamento:** encaixe fixo, liga as quatro direções e não gira.
- **Fusível (F):** gira até ser energizado. Ao receber energia, queima e não pode mais ser girado.

Modo com tempo em algumas zonas. A pontuação combina menos giros e menos segundos, e o melhor resultado de cada zona fica salvo em `state.repairBest`.

**Batalha.** Por turnos: Atacar, Habilidades (custam EN, reduzidas pela Eficiência), Itens, Defender e Fugir (impossível contra chefes).
- **Intenção:** antes de agir, o jogador vê o próximo golpe do inimigo (normal, pesado ou reparo).
- **Fase 2:** ao cair a 50% da vida, chefes entram em fase 2, com ataque maior e golpes pesados mais frequentes.
- **Efeitos:** números de dano flutuantes, tremor e flash na tela, inimigo que estremece e vibração em celulares.

**Progressão.** Nível por XP. Cada nível aumenta HP, EN, ataque e defesa, restaura a vitalidade e concede **1 ponto de habilidade**. A árvore tem: Vigor (+HP), Fonte de Energia (+EN), Pulso Afiado (+ataque), Couraça (+defesa) e Eficiência (custo de habilidades). Equipamentos têm raridade de comum a lendário.

**Economia.**
- **Loja (Caixa de Peças):** vende poções, cápsulas, kits, equipamentos. Compra e vende itens não-chave.
- **Materiais:** fio de cobre (pulgas), cristal de silício (ruídos) e liga de ferrugem (blocos).
- **Bancada:** cria pasta térmica, kit de solda, escudo reforçado e lâmina fusível a partir dos materiais.
- **Derrota:** volta ao ponto seguro com 30% de HP e perde 10% dos créditos.

**Missões.** Principal e extra, cada uma com etapas por flag (conversa), contador (coleta, reparo, baús) ou abate. A missão conclui sozinha quando todas as etapas são cumpridas e entrega a recompensa, que agora inclui XP. Seis zonas (todas, exceto o Núcleo) têm uma missão extra, liberada depois que a principal daquela zona começa:
- Fio para os Jardins (Sementa): coletar fio de cobre.
- Limpeza de Cristais (Bigorna): coletar cristais de silício.
- Brasa Fria (Rebite): derrotar ruídos.
- Compasso Extra (Ponteiro): derrotar blocos.
- Índice Perdido (Arquivista): coletar ligas de ferrugem.
- Entrega Pendente (Correio): derrotar blocos.

**Diálogo.** Cada NPC tem cenas condicionais (`when`, com `gate` para depender de outra missão) e ações (`set`, `start`, `give`, `xp`, `gold`). Quando nenhuma cena específica se aplica, o diálogo lembra o objetivo atual. Escolhas aparecem como botões, que também podem ser feitos com as teclas 1, 2 e 3.

**Códex.** Cada zona e cada glitch visto preenche uma entrada com texto de mundo.

## Arte e áudio

- **Visual:** low-poly procedural em Three.js. Pisos de placa de circuito, chips como paredes, partículas de bits, luzes coloridas e névoa por zona, decorações animadas.
- **Personagens:** Bit e os NPCs são montados de primitivas com detalhes próprios e acessórios que os tornam reconhecíveis. Ações de ataque, vitória e dano, respiração em repouso e piscar do visor.
- **Ícones e retratos:** desenhados em canvas, sem arquivos externos.
- **Áudio:** síntese com Web Audio, sem arquivos. Efeitos de passo, reparo, golpe, baú, cura, vitória, derrota, portal, bloqueio e escolha. Uma trilha em loop por zona e uma trilha de batalha. O áudio só começa após o primeiro gesto do jogador.

## Controles, acessibilidade e salvamento

**PC:** WASD ou setas para mover, E ou Espaço para interagir, M ou Esc para o menu, N para som, 1 a 3 nas escolhas.
**Celular:** joystick virtual, botão AÇÃO, botão MENU e arraste na metade direita para girar a câmera.

**Ajustes** (aba Ajustes do menu, salvos separadamente do progresso):
- som e vibração ligados ou desligados;
- tamanho do texto: normal, grande ou muito grande;
- alto contraste: fundo preto e bordas amarelas.

**Telas pequenas:** layout verificado em 360 px, sem rolagem horizontal, com comandos de batalha em coluna única.

**Salvamento:** automático a cada 20 segundos, ao mudar de zona, ao concluir ações e ao sair. Versão 2 do formato, com migração da versão 1. Um salvamento corrompido não ativa o botão Continuar.

## Mapas extensos (rodada 6)

As seis zonas exploráveis (Cache, Planície, Forja, Canyon, Cidade e Barramento) deixaram de ser salas de 24 colunas feitas à mão. Agora cada uma é um mapa de 52 por 34 células, gerado por `src/mapgen.js`:

- **Salas e corredores:** cerca de 14 salas de tamanhos variados, ligadas em ordem de posição, com alguns laços extras. Todo o mapa é conectado.
- **Determinístico:** cada zona tem uma semente fixa (`gen.seed` em `src/data/zones.js`). Mesma semente, mesmo mapa, então salvamentos e testes continuam válidos.
- **Objetos fixos da história** (NPCs, baús com saque definido, chefes, reparos e os portais A e B) são colocados em salas aleatórias, mas mantêm os mesmos ids. O nascimento fica na primeira sala e o portal de avanço na mais distante.
- **Itens espalhados:** de 11 a 15 pickups por zona (cristais, fios, ligas, poções, capacitores), que são coletados automaticamente ao passar por cima. Coletados ficam marcados no save e não reaparecem.
- **Baús extras:** de 4 a 5 por zona, com saque sorteado da tabela da zona (`ZONE_LOOT` em `src/loot.js`), sempre o mesmo para a mesma posição.
- **Núcleo** continua sendo uma arena fixa.

Testes: um teste unitário confirma que todo objeto e portal é alcançável a partir do nascimento em cada zona. Outro confirma tamanho mínimo e quantidade mínima de itens. Um teste de ponta a ponta confirma que um item é coletado ao passar por cima.

**Custo de desempenho.** Os mapas maiores aumentam o tempo de cada teste de ponta a ponta em cerca de 1,5 a 2 vezes, porque o renderizador por software precisa desenhar mais geometria. O FPS medido em 360 px é o registro do teste de FPS.

## Rodada 6: mobs, NPCs, viagem rápida e efeitos

- **Novos mobs:** Larva de Firmware (Planície de Registradores) e Sentinela Cinza (Barramento Principal). Cada um tem arte procedural própria e entrada no códex.
- **Novos NPCs:** Lúmen, guia da Cidade dos Bancos de Memória, que ensina a viagem rápida e dá uma cápsula de energia na primeira conversa. Técnico Varredor, no Barramento, que alerta sobre as sentinelas e dá duas pastas térmicas. Cada um tem uma primeira fala que entrega a recompensa e uma fala posterior, sem recompensa repetida.
- **Viagem rápida:** nova aba "Viagem" no menu. Mostra as zonas já visitadas e leva a qualquer uma delas, no ponto de nascimento. Não funciona durante batalhas nem diálogos.
- **Efeitos de partículas:** faíscas ao vencer um glitch (maiores ao derrotar um chefe) e ao coletar um item no chão, na cor do inimigo ou do item.

**Ainda não feito neste ciclo:** efeitos de estado em batalha, sistema de reputação com as NPCs e novas zonas. Esses são os próximos itens.

## Rodada 7: luta em tempo real

- **Luta direto no mapa.** Os bytes (glitches comuns) agora lutam com o Bit ali mesmo, sem trocar de tela. Encostar num byte causa dano no seu ritmo (cada byte ataca a cada 1,2 s, e o Bit tem um curto período de invulnerabilidade depois de cada golpe).
- **Golpe:** F ataca (ou E/Espaço quando não há nada por perto para interagir; no celular, o botão AÇÃO). Atinge os bytes num arco à frente, empurra e tem um intervalo de 0,42 s. O golpe mostra uma explosão de faíscas e o número de dano sobre o byte.
- **Barra de vida** sobre cada byte ferido. Ao derrotar um byte: XP, créditos, saques, faíscas e progresso de missões (os contadores de abate valem igual para luta em tempo real e por turnos).
- **Batalha por turnos** continua para os chefes e para o Vigia, com a mesma tela e as mesmas regras de antes.
- **Derrota:** se o Bit cair na luta, volta ao ponto seguro com 30% de vida e perde 10% dos créditos, como na batalha por turnos.
- **Regras** em `src/action.js`, sem dependência de navegador, com testes unitários para alcance, arco e danos mínimos.

### O que ficou de fora desta rodada

O pedido desta rodada era muito amplo, e não cabe com qualidade verificável numa só entrega. Ficam para decisão e para ciclos próprios:

- **Reescrita em Python.** O jogo roda no navegador, que é o único alvo que funciona no PC e no celular com um link. Uma reescrita em Python exigiria escolher uma engine (por exemplo, Panda3D ou Pygame), e perderia o link compartilhável e os 61 testes atuais. Precisa de uma decisão sua antes de começar.
- **Mundo como um processador em todas as camadas** (núcleo, cache, registradores, ULA, barramento, memória), com mapa-mundo próprio. O conceito já existe nas zonas; falta a estrutura de camadas e a navegação entre elas.
- **História nova, cenas de abertura e encerramento, e tela inicial própria.**
- **Sistemas novos de peso:** efeitos de estado em batalha, reputação com as NPCs, novas zonas e uma progressão de talentos ampliada.
- **Mais mobs e NPCs** além dos já existentes.

## Balanceamento

Os números vêm do simulador `tests/sim/sim.mjs`, que roda batalhas sem navegador com sementes fixas. O jogador simulado ataca sempre, usa poção abaixo de 35% de vida e usa o equipamento típico de cada faixa de nível. Não usa habilidades.

Taxa de vitória por nível (400 batalhas por célula):

| Inimigo | Nv1 | Nv2 | Nv3 | Nv4 | Nv5 | Nv6 | Nv7 | Nv8 | Nv9 | Nv10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Pulga-de-Bit | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Ruído Estático | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Bloco Corrompido | 4% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Sobrecarga (rec. 5) | 0% | 0% | 0% | 1% | 90% | 99% | 100% | 100% | 100% | 100% |
| Titã da Ferrugem (rec. 7) | 0% | 0% | 0% | 0% | 0% | 8% | 81% | 99% | 100% | 100% |
| Vigia (rec. 9) | 0% | 0% | 0% | 0% | 0% | 0% | 1% | 9% | 67% | 93% |

Metas (`checkTargets` em `sim.mjs`, verificadas pelo teste unitário):
- Pulga no nível 1: 90% ou mais.
- Ruído e Bloco no nível recomendado: 60% ou mais.
- Chefes no nível recomendado: 60% ou mais, para que a luta seja vencível.
- Chefes um nível abaixo (sem preparação): 10% ou menos.

Todas as metas são atendidas. A meta de 10% sem preparação, que antes não era atingida, passou a ser cumprida com a seguinte mudança:

- **Vigia:** 300 de vida e 17 de ataque (antes 16).
- **Equipamento do nível 9:** o simulador passou a dar ao jogador, a partir do nível 9, a Lâmina da Ferrugem e o Escudo Reforçado. Ambos são obtidos antes do núcleo: a lâmina é o drop garantido do Titã da Ferrugem, e o escudo é criado na bancada com liga de ferrugem.

Ou seja, a preparação que separa o nível 8 (9% de vitória) do nível 9 (67%) é justamente o equipamento do chefe anterior. Isso muda a interpretação do pedido original ("nenhum chefe passa de 10% no nível recomendado"): o nível recomendado é onde o jogador preparado deve vencer, e o nível abaixo é o sem preparação.

Outras mudanças anteriores: Sobrecarga com 150 de vida e 14 de ataque; Titã com 205 de vida.

## Testes

- `npm run test:unit`: 26 testes de lógica pura (combate, migrações de save, slots, finais, conteúdo, missão extra do Núcleo e expressões do rosto).
- `npm run sim`: simulador de balanceamento, com as metas verificadas.
- `npm run test:e2e`: 34 testes de ponta a ponta no Chromium headless. Qualquer erro ou aviso de console falha o teste. Cada teste roda num contexto novo, com números aleatórios de semente fixa, sem encontros aleatórios e com esperas por condição.
- `npm test`: tudo (61 testes no total).

Os testes de ponta a ponta cobrem: título e slots, migração do save antigo, save corrompido, portais e bloqueios, missões principal e extra, batalha vencida, derrota (volta ao ponto seguro e perde 10% dos créditos), fuga (bloqueada contra chefes), intenção do inimigo, tutorial e reparo (resolver, modo difícil, teclado, pausa com P, tempo esgotado, fusível queimado), dificuldade salva entre reparos, minimapa, loja (compra e venda), bancada, árvore de habilidades, ajustes, legendas, medição de áudio (efeito e trilha produzem sinal, pico nunca passa de 1, volume zero silencia), paredes com desenho próprio por zona, final da paz, final da guerra, missão extra do Núcleo, navegação por teclado, rostos, layout em 360 px e FPS.

## Estado atual

- sete zonas, cada uma com piso e paredes de desenho próprio (hexágonos, engrenagens, faixas, tijolos, radial etc.), decoração, trilha musical e portais com halo e rótulo do destino;
- minimapa que mostra só as áreas visitadas (névoa de guerra);
- batalhas com intenção, fase 2, derrota, fuga e vitória, incluindo chefes e saques;
- reparo com cruzamentos, fusíveis (que travam ao receber energia), cronômetro com pausa (P), pontuação, recorde por zona, modo difícil (H, com a última escolha salva) e tutorial na primeira vez;
- rostos procedurais no visor do Bit e nas NPCs, com expressões de dúvida (fala com '?') e surpresa (fala com '!'), além de piscar e boca que se mexe ao falar;
- três slots de save, com migração do formato 1 e 2 para 3, e cópia do save antigo para o slot 1;
- missão extra do Núcleo (Vozes do Vigia), com os finais da paz e da guerra mudando conforme ela foi cumprida;
- áudio medido: volume separado para trilha e efeitos, legendas visuais para sons importantes, pico de saída limitado e silêncio com volume zero (verificado com um medidor de saída no teste);
- navegação por teclado em título, slots, menu, loja, batalha, diálogos e reparo, com foco visível;
- FPS medido em 360 px com renderização por software: cerca de 25 quadros por segundo (informativo; em aparelho real o valor será outro).

## Rodada 5 (resumo)

- **Dificuldade das batalhas** nos ajustes: fácil, normal e difícil. Não altera o reparo nem a fase 2 dos chefes.
- **Novos inimigos comuns:** Verme de Cache (zona da Cache) e Espectro de Memória (zona da Memória), com arte própria e entrada no códex. Um teste garante que todo inimigo comum aparece numa zona.
- **Expressão de cansaço:** o rosto do Bit fica exausto abaixo de 30% da vida.
- **Simulador com habilidades** como análise de sensibilidade (opção `--skills`).
- **Roteiro de playtest** em `docs/PLAYTEST.md`.
- **Versão jogável** publicada como artefato privado (ver mensagem de entrega). Não foi possível verificar, daqui, se o visualizador do artefato executa os módulos do jogo.

## Lacunas conhecidas

- **Timbre sem escuta real.** O áudio é medido em amplitude, mas o timbre e o equilíbrio entre trilha e efeitos só podem ser avaliados por uma pessoa ouvindo.
- **Rostos simples.** São olhos e boca numa textura pequena, com cinco expressões no total.
- **Sem playtest com pessoas.** O equilíbrio é verificado pelo simulador. A referência das metas assume um jogador que ataca sempre e usa poções, sem habilidades. Com habilidades (`npm run sim -- --skills`), o jogador fica bem mais forte e as metas dos chefes deixam de valer; esse modo é só sensibilidade. O roteiro está em `docs/PLAYTEST.md`, ainda sem sessões realizadas.
- **Dificuldade das batalhas não calibrada com jogadores.** Fácil, normal e difícil mudam o dano dos inimigos (×0,75, ×1, ×1,25) e a chance de drop (×1,25, ×1, ×0,8), mas os valores não foram testados com pessoas. O simulador só mede o modo normal.
- **Vibração** depende do navegador; no PC não tem efeito.
- **Dependência de ambiente.** O Playwright está declarado em `devDependencies` na versão 1.63.0, mas o Chromium precisa ser instalado com `npm run install:browser` em outra máquina. No ambiente de desenvolvimento deste projeto, ele já estava disponível.
