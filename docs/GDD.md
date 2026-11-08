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

## Estado atual

Verificado em Chromium headless, sem erros de console:
- sete zonas com decorações, trilhas e transições;
- batalhas com intenção, fase 2 e vitória, incluindo chefe e loot;
- reparos com cruzamentos e fusíveis, cronômetro e pontuação;
- portais, incluindo o bloqueio com motivo;
- loja (compra), bancada (criação) e árvore de habilidades (gasto de pontos);
- final da paz, com as flags esperadas;
- ajustes de texto e contraste aplicados ao corpo da página;
- migração de save v1, save corrompido e layout em 360 px.

## Lacunas conhecidas

- **Áudio não ouvido.** Os sons foram testados para execução sem erros, mas o equilíbrio de volume e o timbre precisam de escuta real.
- **Modelos simples.** Personagens são montagens de primitivas; não há animação facial nem texturas de personagem.
- **Final da guerra** não foi testado de ponta a ponta, só o da paz.
- **Balanceamento** ainda é estimado. Não houve playtest completo, e os números de dano foram ajustados pelo teste automatizado.
- **Sem dificuldade configurável**, sem lojas por zona e sem crafting de equipamentos mais avançados.
- **Vibração** depende do navegador; no PC não tem efeito.
