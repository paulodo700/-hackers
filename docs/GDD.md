# Anel Zero — Documento de Design

## Conceito

Um RPG de aventura 3D em que o mundo **é** um processador. O jogador controla **Bit**, um programa de manutenção que acorda no meio de um chip em colapso. Cada zona é uma parte real de um processador (cache, registradores, ULA, pipeline, memória principal, barramento, núcleo), transformada em cenário de fantasia tecnológica. O jogo mistura exploração, missões, batalhas por turnos e o **reparo de circuitos**, a mecânica central.

**Pilares**
1. **Consertar é jogar.** Restaurar trilhas partidas é o coração do jogo: é um quebra-cabeça, uma recompensa e uma forma de avançar.
2. **O cenário explica a história.** Cada zona ensina um conceito real de arquitetura de computadores, sem tom de aula.
3. **Qualquer tela.** Funciona no PC e no celular, com controles próprios para cada um.
4. **Original do início ao fim.** Nomes, personagens, mapas, sprites e sons são criados para este projeto.

## História

> Processador Ômega-7. Frequência alta, temperatura alta, e um silêncio que não deveria existir.

Bit acorda sem lembrar como chegou ali. O Anel Zero, o nível mais privilegiado do chip, está partido. A **Ferrugem** se espalha pelos barramentos, e a **Sobrecarga** domina a Forja. Aos poucos, Bit descobre que o culpado não é o caos em si, e sim o **Vigia**, o guardião de vigilância do processador, que apagou a memória de Bit para protegê-lo do colapso. Ao final, o Vigia hesita, e Bit escolhe restaurar o que foi apagado, consertando o sistema junto com ele.

**Temas:** memória e esquecimento, proteção que vira prisão, colapso causado por quem tentava proteger.

## Personagens

| Nome | Papel | Onde |
|---|---|---|
| **Bit** | Protagonista. Programa de manutenção sem memória. | Todo o jogo |
| **Sementa** | Jardineira da Cache. Dá a primeira missão. | Jardim da Cache L1 |
| **Bigorna** | Ferreiro de registradores. Pede capacitores. | Planície de Registradores |
| **Rebite** | Mestre da Forja. Revela a Sobrecarga. | Forja da ULA |
| **Ponteiro** | Guia do canyon. Ensina o ritmo do pipeline. | Canyon do Pipeline |
| **Arquivista** | Guarda os fragmentos de memória e revela a verdade. | Cidade dos Bancos de Memória |
| **Correio** | Entregador do barramento. Aponta a Ferrugem. | Barramento Principal |
| **Vigia** | Guardião do processador. Antagonista e, depois, aliado. | Núcleo |

## Mundo (zonas)

Cada zona tem um mapa de 24 colunas em texto (`src/data/zones.js`), portais de ida e volta e encontros próprios.

1. **Jardim da Cache L1.** Tutorial. Trilhas cortadas, pulgas-de-bit. Primeiro reparo.
2. **Planície de Registradores.** Chão instável, poços de tensão. Capacitores de filtro.
3. **Forja da ULA.** Calor e bobinas. Chefe: Sobrecarga. Libera a chave da forja.
4. **Canyon do Pipeline.** Abismos e pontes. Três baús para o ritmo do pipeline.
5. **Cidade dos Bancos de Memória.** Três fragmentos de memória contam a verdade.
6. **Barramento Principal.** Ponte da Ferrugem. Chefe: Titã da Ferrugem. Libera a Trilha Mestra.
7. **Núcleo do Anel Zero.** Chefe final: o Vigia. Epílogo com escolha narrativa.

## Sistemas

**Reparo de circuito.** Um tabuleiro de N×N segmentos (`repair.js`). Clicar gira o segmento 90°. Vence quem liga a fonte verde (0,0) ao destino magenta. O puzzle é gerado por um caminho aleatório auto-evitante e depois embaralhado, então sempre tem solução.

**Batalha.** Por turnos. Atacar, Habilidades (custam EN), Itens, Defender (reduz o próximo golpe e recupera EN) e Fugir (impossível contra chefes).

**Progressão.** Nível por XP. Cada nível aumenta HP, EN, ataque e defesa, e restaura a vitalidade. Equipamentos têm raridade (comum a lendário) e modificadores.

**Missões.** Etapas que se completam por flag (conversa), contador (coleta, reparo, baús) ou abate. A missão conclui sozinha quando todas as etapas são cumpridas e entrega a recompensa.

**Diálogo.** Cada NPC tem cenas condicionais (`when`) e ações (`set`, `start`, `give`, `xp`, `gold`). Quando nenhuma cena específica se aplica, o diálogo lembra o objetivo atual.

**Derrota.** Volta ao ponto seguro da zona com 30% de HP e perde 10% dos créditos. Sem punição de progresso.

**Códex.** Cada zona e cada glitch visto preenche uma entrada com texto de mundo.

## Arte e áudio

- **Visual:** low-poly procedural em Three.js. Pisos de placa de circuito com trilhas que brilham, chips como paredes, partículas de bits, luzes coloridas por zona e névoa.
- **Personagens:** Bit e os NPCs são montados de primitivas (cápsulas, caixas, esferas) com visor e detalhes em emissivo.
- **Ícones e retratos:** desenhados em canvas, sem arquivos externos.
- **Áudio:** previsto para a próxima rodada (síntese com Web Audio, sem arquivos externos).

## Controles e plataformas

PC: teclado e mouse. Celular: joystick virtual, botões AÇÃO e MENU, e arraste para girar a câmera. A interface se adapta a telas pequenas e em retrato.

## Estado atual

- Sete zonas jogáveis, três tipos de NPC com diálogos condicionais, sete missões, batalhas com três chefes e glitches que perseguem.
- Reparo de circuito funcional, com verificação automatizada de solução nas zonas de cache, registradores e pipeline.
- Salvamento automático e manual; "Continuar" restaura zona, posição, progresso e inventário.
- Testado em Chromium headless: sem erros de script, batalhas, reparo, portais e missões verificados; layout de celular verificado.

## Lacunas conhecidas

- Os modelos ainda são simples (primitivas). Não há animação facial, texturas de personagem nem sprites detalhados.
- Sem áudio.
- Sem lojas, crafting e habilidades por árvore de talentos.
- Balanceamento por playtest ainda não feito.
