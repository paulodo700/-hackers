# Anel Zero 2D — Dentro do Processador

Versão 2D do jogo. O personagem atravessa as oito camadas reais de um chip, do dissipador de calor
ao substrato, consertando trilhas, abrindo portas de energia e reforçando o núcleo, até chegar ao anel zero.

## Como jogar

O jogo é um conjunto de módulos ES; por isso precisa de um servidor local (abrir o `index.html` direto
do disco não funciona nos navegadores por causa dos módulos).

```
cd 2d
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador (Chrome, Edge ou Firefox, no PC ou no celular na mesma rede).

| Tecla | Ação |
|---|---|
| Setas ou W A S D | Mover |
| E | Falar com o técnico na frente |
| R | Usar a ferramenta certa na célula da frente (trilha rompida, porta de energia, encaixe do núcleo) |
| C | Abrir a criação de ferramentas; depois 1, 2 ou 3 para criar |
| 1 / 2 / 3 (em combate) | Atacar / Defender / Fugir |
| F3 ou ` | Modo depuração: grade com coordenadas, névoa e células visitadas |

Semente: `?seed=123` na URL muda a partida (combates e drops).

## Estrutura

| Pasta/arquivo | Papel |
|---|---|
| `src/grid.js` | Legenda das células e tipos de bloqueio. Sem DOM. |
| `src/mapgen.js` | Gera o labirinto de cada camada a partir de uma semente, validando que o jogo continua solúvel. |
| `src/layers.js` | As oito camadas: nome, bloqueios, materiais, falhas, técnicos. |
| `src/content.js` | Materiais, ferramentas, receitas e falhas. |
| `src/game.js` | Regras: movimento e colisão, troca de camada, combate, reparo, criação, depuração. Sem DOM. |
| `src/render.js` | Desenho em canvas. Só lê o estado do jogo. |
| `src/main.js` | Teclado e laço de tela. |
| `test/` | Testes automatizados, uma pasta de regras por arquivo. |

A lógica (`game.js`, `mapgen.js`, `grid.js`) não importa nada de navegador, então roda igual no navegador
e nos testes. A renderização fica isolada em `render.js`.

## Testes

```
cd 2d
node --test test/*.test.mjs
```

| Arquivo | Regras cobertas |
|---|---|
| `collision.test.mjs` | Paredes, trilha rompida, porta, encaixe e técnico bloqueiam; trilha metálica passa; falha inicia combate; coleta; combate trava o movimento |
| `repair.test.mjs` | Falta de ferramenta; receita sem material não gasta nada; criação consome a receita; reparo, ajuste e reforço abrem a célula certa; cada ferramenta vale uma vez |
| `combat.test.mjs` | Dano e vitória; drop; defender reduz o dano; fugir com e sem sucesso; derrota renasce no início com metade da vida |
| `layers.test.mjs` | Entrada e saída de cada camada; troca de camada nos dois sentidos; mapas determinísticos; saída alcançável; materiais acumulados cobrem os bloqueios; anel dá a vitória |
| `debug.test.mjs` | Névoa e células visitadas no modo depuração |

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
