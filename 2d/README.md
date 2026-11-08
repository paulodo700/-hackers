# Anel Zero 2D — Dentro do Processador

Um RPG 2D original. O personagem, Bit, é um robô de manutenção que desce pelas oito camadas de um processador,
do dissipador de calor ao substrato, para conter a corrupção que ameaça o chip inteiro.

## Como jogar

O jogo usa módulos ES, então precisa de um servidor local (abrir o `index.html` direto do disco não funciona):

```
cd 2d
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador, no PC ou no celular na mesma rede.

| Tecla | Ação |
|---|---|
| Setas ou W A S D | Mover (segure para andar seguidamente) |
| E | Falar com o técnico na frente |
| R | Usar a ferramenta certa na célula da frente |
| C | Abrir ou fechar o menu de criação; depois 1, 2 ou 3 cria a ferramenta |
| M | Abrir ou fechar o mapa do chip (oito camadas com o progresso de cada uma) |
| Esc | Fechar mapa, menu de criação e diálogo |
| 1 / 2 / 3 (em combate) | Atacar / Defender / Fugir |
| F3 ou ` | Modo depuração: grade com coordenadas, névoa e células visitadas |
| N | Novo jogo (pede confirmação e apaga o progresso salvo) |

No celular, o painel de botões aparece abaixo do jogo. Os botões mandam os mesmos comandos do teclado.

Semente: `?seed=123` na URL muda os combates e as quedas de material.

## Progresso salvo

O progresso fica no `localStorage` do navegador e é gravado a cada ação. Há uma chave para a partida
(posição, materiais, ferramentas, estado do sorteio) e uma chave por camada (trilhas reparadas, falhas vencidas,
materiais coletados, células visitadas, falas do técnico). Cada chave tem formato e versão. Se uma camada
não bater com o mapa atual, ou se o dado estiver corrompido, só essa parte é descartada e o jogo segue.
Sem armazenamento disponível (modo privado, por exemplo), o jogo avisa e roda só na memória.

## Estrutura

| Pasta/arquivo | Papel |
|---|---|
| `src/grid.js` | Legenda das células e tipos de bloqueio. Sem DOM. |
| `src/rng.js` | Gerador determinístico, com estado que pode ser salvo. |
| `src/mapgen.js` | Gera o labirinto de cada camada a partir de uma semente, validando que o jogo continua solúvel. |
| `src/layers.js` | As oito camadas: nome, bloqueios, materiais, falhas, técnicos. |
| `src/content.js` | Materiais, ferramentas, receitas e falhas. |
| `src/game.js` | Regras: movimento, colisão, troca de camada, combate, reparo, criação, mapa e depuração. Sem DOM. |
| `src/progress.js` | Progresso de cada camada e do chip inteiro. |
| `src/save.js` | Salvamento por camada, com validação e descarte seguro. |
| `src/commands.js` | Comandos do jogador. Teclado e toque usam os mesmos. |
| `src/render.js` | Desenho em canvas. Só lê o estado. |
| `src/main.js` | Teclado, toque, salvamento automático e novo jogo. |
| `test/` | Testes com `node:test`, um arquivo por regra. |
| `docs/SPRITES.md` | Proposta de sprites 2D a partir dos modelos 3D. |

## Testes

```
cd 2d
node --test test/*.test.mjs
```

Os testes cobrem colisão, reparo, combate, troca de camada, depuração, sorteio, salvamento (incluindo
corrupção, versão, mapa diferente, falha de leitura e de escrita), progresso, mapa do chip, controles
(teclado e toque) e a falha nova.

## Camadas

| # | Camada | Bloqueio | Ferramenta |
|---|---|---|---|
| 1 | Dissipador de calor | — | — |
| 2 | Metal M1 | trilha rompida | reparo de trilha |
| 3 | Cache L3 | porta de energia | ajuste de energia |
| 4 | Núcleos de CPU | encaixe do núcleo | reforço do núcleo |
| 5 | Controlador de memória | trilha rompida | reparo de trilha |
| 6 | Rede de energia | porta de energia | ajuste de energia |
| 7 | Interposer | trilha rompida | reparo de trilha |
| 8 | Substrato | — | anel zero (vitória) |

Falhas do circuito: pulga de corrente, rasgo de trilha, ruído térmico e vazamento de corrente.
