# Vaelmor: O Arqueiro do Eclipse

RPG de arqueiro roguelite, original, feito em HTML5 Canvas e JavaScript puro, sem dependências.
Você controla uma arqueira que atira sozinha no inimigo mais próximo enquanto você se move pela sala.
Vença os monstros de cada sala, escolha caminhos no mapa, suba de nível para montar seu arco e derrote
três chefes para devolver a lua ao céu.

Todos os nomes, história, monstros, chefes, sprites, música e efeitos sonoros são criados neste projeto.
Os sprites são desenhados por código e a trilha e os efeitos são sintetizados com Web Audio.

## Como jogar

| Ação | Teclado | Celular / mouse |
|---|---|---|
| Mover | WASD ou setas | Arraste em qualquer lugar da tela |
| Atirar | Automático (mira no inimigo mais próximo) | Automático |
| Pausar | P ou Esc | Botão "Pausa" |

- Cada passo do mapa oferece **duas escolhas**: Combate, Campeão, Tesouro, Descanso ou Mercador.
- Ao subir de nível você escolhe **1 de 3 cartas** de aprimoramento (comuns, raras ou épicas).
- Ouro é gasto no Mercador. **Relíquias** são ganhas ao final de cada jornada e compram melhorias
  permanentes no **Altar das Relíquias**.
- A run pode ser **continuada** pelo menu (o progresso é salvo no navegador).

## Como executar

Opção 1 (mais simples): abra `dist/vaelmor.html` no navegador. É um único arquivo, sem servidor.

Opção 2 (desenvolvimento): abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

Para gerar novamente o arquivo único depois de alterar o código:

```bash
node scripts/build.js
```

## Testes

O teste de fumaça percorre o jogo inteiro em Chromium headless (título, história, mapa, combate,
subida de nível, pausa, eventos, chefe com fases, derrota, Altar e créditos) e roda um estresse com
todos os monstros, chefes e sprites. Ele tira capturas de tela na pasta indicada em `SHOTS`.

```bash
SHOTS=./dist/shots node tests/smoke.js
```

Requer `playwright` instalado (o Chromium já pode vir pré-instalado no ambiente).

## Estrutura

```
index.html              página de desenvolvimento (carrega os scripts em ordem)
css/style.css           estilo da página (canvas em tela cheia, sem rolagem)
js/core/                utilitários, entrada, áudio, sprites procedurais, componentes de UI
js/data/                roteiro, monstros e chefes, cartas e Altar, capítulos
js/game/                entidades, IA, geração de salas, estado da run, meta-progresso, mundo de combate
js/scenes/              título, história, mapa, combate, eventos, Altar, fim de jogo, créditos, HUD
js/game.js              gerenciador de cenas, escala responsiva (letterbox) e loop principal
js/main.js              inicialização
scripts/build.js        gera dist/vaelmor.html
tests/smoke.js          teste de fumaça com Playwright
docs/superpowers/specs/ decisões de design
```

## Conteúdo

- **3 capítulos** (Bosque Sussurrante, Minas de Cinza, Torre do Crepúsculo), cada um com 7 passos de mapa e um chefe.
- **10 monstros comuns**: gelatinosos (que se dividem), morcegos, esqueletos arqueiros, lobos que investem,
  xamãs que curam aliados, golems que esmagam o chão, aranhas com teia, espectros que teleportam e magos.
- **3 chefes com fases**: Ancião Raiz, Rei Obsidiana e Senhor do Eclipse.
- **15 cartas** de aprimoramento e **5 melhorias permanentes** no Altar.

Veja o spec completo em `docs/superpowers/specs/2026-11-07-vaelmor-design.md`.
