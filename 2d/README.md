# Anel Zero — Dentro do Processador

RPG 2D original. Bit, um robô de manutenção, desce pelas oito camadas de um processador (do dissipador de calor
ao substrato) para conter a Corrupção que se espalha pelas trilhas. A visão é de cima: a câmera segue Bit pelos
mapas de 31 por 21 células.

## Como rodar

O jogo usa módulos ES, então precisa de um servidor local:

```
cd 2d
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador, no PC ou no celular na mesma rede.

## Controles

| Tecla | Ação |
|---|---|
| Setas ou W A S D | Andar (segure para andar seguido); em menus, navegar |
| E ou Enter | Falar, abrir baú ou loja, confirmar |
| R | Usar a ferramenta certa na célula da frente (trilha rompida, porta de energia, encaixe, porta do chefe) |
| Z | Esperar: a vida volta aos poucos e o calor cai (mais na zona fria) |
| C | Menu de criação |
| I / K / J / B | Inventário / habilidades / diário / bestiário |
| Tab | Menu geral (status, equipamento, criar, mapa, novo jogo) |
| M | Mapa do chip (oito camadas com o progresso de cada uma) |
| 1 a 9 | Escolher no combate (1 atacar, 2 habilidade, 3 item, 4 defender, 5 fugir) ou num menu |
| Esc ou Backspace | Voltar e fechar |
| F3 ou ` | Depuração: grade com coordenadas e névoa |
| N | Novo jogo (pede confirmação e apaga o progresso salvo) |

No celular, o painel de botões aparece abaixo do jogo e manda os mesmos comandos do teclado. Segurar o
direcional repete os passos.

## Como o jogo funciona

- **Mundo.** Cada camada é um labirinto gerado por semente. Uma sala do chefe, trancada por uma porta, contém a
  saída. Bloqueios (trilha rompida, porta de energia, encaixe) exigem ferramentas, e o gerador garante que cada um é
  obrigatório. Materiais, a chave da porta, baús, técnicos e mercadores estão ao alcance sem ferramentas.
- **Calor.** O chip esquenta devagar em terreno comum, depressa numa trilha quente, e esfria na zona fria ou ao
  esperar. Calor alto causa dano a cada passo.
- **Combate por turnos.** Atacar, habilidades (quinze, em três ramos), itens, defender e fugir. Elementos com
  vantagem (calor > frio > corrente > sinal > calor), estados (queimadura, curto-circuito, lentidão e outros) e
  chefes com três fases e ataques telegrafados.
- **Progressão.** XP e níveis, pontos de habilidade, equipamento em três slots (dissipador, antena, módulo), criação
  e melhorias, lojas dos mercadores.
- **Missões e diálogos.** Uma missão principal por camada e duas secundárias. Diálogos com condições e efeitos.
- **Falhas.** Patrulham, perseguem ou ficam paradas. Reaparecem devagar em cada camada.

## Salvamento

O progresso fica no `localStorage` do navegador e é gravado a cada ação. Há uma chave para a partida e uma por
camada, com formato e versão. Se uma camada não bater com o mapa atual ou o dado estiver corrompido, só essa parte
é descartada. Sem armazenamento (modo privado, por exemplo), o jogo avisa e roda só na memória.

## Estrutura

| Pasta/arquivo | Papel |
|---|---|
| `src/game.js` | Fachada: estado, mundo e entrada de comandos. Sem DOM. |
| `src/systems/` | Regras: combate, mundo, progressão, itens, habilidades, missões, diálogos, lojas, criação, bestiário. Sem DOM. |
| `src/mapgen.js`, `src/layers.js`, `src/grid.js` | Geração dos mapas, configuração das camadas e legenda das células. |
| `src/data/` | Conteúdo: itens, falhas, habilidades, ataques, técnicos, diálogos, missões, baús, lojas, estados e receitas. |
| `src/art/` | Sprites em pixel (sem arquivos de imagem). |
| `src/audio/` | Sons e trilhas sintetizados em código (sem arquivos de áudio). |
| `src/commands.js`, `src/menus.js` | Comandos (teclado e toque) e telas com lista. |
| `src/save.js`, `src/progress.js` | Salvamento por camada e progresso do chip. |
| `src/render.js`, `src/main.js` | Desenho em canvas (câmera, painel, faixa, menus, combate) e ligação com o navegador. |
| `tools/robo-jogador.mjs` | Robô que joga pela mesma API, para checar travamentos e equilíbrio. |
| `test/` | Testes com `node:test`, uma área por arquivo. |

## Testes e robô

```
cd 2d
node --test test/*.test.mjs          # regras, geração, dados, arte, áudio e salvamento
node tools/robo-jogador.mjs 1 2 3    # partidas de teste (sementes 1, 2 e 3)
```

O robô é uma ferramenta de checagem, não um jogador de referência: ele já confirmou que o primeiro chefe é vencível
depois de subir de nível, e mostrou travamentos de equilíbrio nas camadas seguintes (ver `docs/GDD.md`).
