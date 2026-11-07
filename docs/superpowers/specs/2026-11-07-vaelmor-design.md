# Vaelmor: O Arqueiro do Eclipse — Design

## Objetivo

Um RPG de arqueiro roguelite original, jogável no navegador (desktop e celular), no
estilo de jogos de tiro-automático em salas (Archero-like). Tudo é próprio: nomes,
história, monstros, chefes, sprites (desenhados por código), música e efeitos
(sintetizados com Web Audio). Nenhum asset de terceiros.

Sucesso = o jogador entende o loop em 1 minuto, completa 3 capítulos com progressão
clara, sente que cada run muda (upgrades, escolhas de mapa), e a progressão entre
runs (Relíquias) dá motivo para continuar.

## Decisões autônomas (o autor pediu para não perguntar)

| Tema | Decisão |
|---|---|
| Plataforma | HTML5 Canvas 2D, JavaScript puro, sem dependências, sem build obrigatório |
| Formato | Retrato 360×640 lógico, escalado para caber na tela (letterbox) |
| Arquivos | `index.html` abre direto (scripts clássicos, funciona em `file://`) |
| Distribuição | `scripts/build.js` gera `dist/vaelmor.html` (arquivo único) |
| Controles | Teclado (WASD/setas, P/Esc pausa), arrastar em qualquer lugar (touch/mouse) |
| Mira | Automática: o arco dispara no inimigo mais próximo enquanto o jogador se move |
| Capítulos | 3 capítulos, cada um com 8 nós de mapa e um chefe no fim |
| Escolhas | Em cada passo do mapa, 2 caminhos (Combate, Elite, Tesouro, Descanso, Mercador) |
| Progressão na run | XP → subida de nível → 1 de 3 cartas de upgrade |
| Progressão entre runs | Relíquias (ganhas ao morrer/vencer) compram melhorias permanentes no Altar |
| Economia | Ouro (moedas da run) gasta no Mercador; Relíquias persistem |
| Salvamento | `localStorage` dentro de try/catch (progresso, relíquias, configurações) |
| Áudio | Efeitos e música procedurais; liga/desliga no menu; começa após gesto do usuário |
| Arte | Sprites procedurais em offscreen canvas, em cache; paleta própria por capítulo |

## Estrutura

```
index.html
css/style.css
js/core/util.js        RNG semeado, vetores, easing, texto, storage seguro
js/core/input.js       teclado, ponteiro/touch, mapeamento para coordenadas lógicas
js/core/audio.js       SFX e música procedurais (Web Audio)
js/core/sprites.js     desenho procedural de todos os sprites (cache)
js/core/ui.js          botões, painéis, barras, texto com quebra de linha
js/data/story.js       texto dos capítulos e falas
js/data/monsters.js    definições de monstros e chefes
js/data/upgrades.js    cartas de upgrade e melhorias permanentes (Altar)
js/data/chapters.js    capítulos, paletas, pools de monstros, nós de mapa
js/game/entities.js    Player, Enemy, Projectile, Pickup, Particle, FloatText
js/game/ai.js          comportamentos de inimigos e chefes
js/game/arena.js       geração de sala (obstáculos, ondas)
js/game/run.js         estado da run (capítulo, nó, ouro, XP, upgrades)
js/game/meta.js        progresso persistente (relíquias, melhorias, recorde)
js/scenes/*.js         title, story, map, gameplay, event, altar, gameover, credits
js/game.js             gerenciador de cenas, loop, letterbox
js/main.js             boot
tests/smoke.js         teste de fumaça com Playwright (sem dependências no jogo)
scripts/build.js       gera dist/vaelmor.html
```

Cada cena implementa: `enter(data)`, `exit()`, `update(dt)`, `draw(g)`,
`onPointer(type, x, y)`, `onKey(key, down)`. A cena pede troca com
`Game.go(nome, dados)`.

## Mecânica

**Jogador:** HP, dano, cadência de tiro, velocidade, multitiro, perfuração, ricochete,
chance crítica, multiplicador crítico, roubo de vida, armadura, esquiva.

**Inimigos (comportamentos):** `chase` (persegue), `wander-hop` (slime com pulos e
divisão), `flutter` (morcego errático), `kite-shoot` (esqueleto arqueiro: mantém
distância e atira), `charge` (lobo: telegrafa e avança), `summoner-buff` (xamã: cura
aliados e lança orbes lentos), `golem-slam` (lança rochas em área), `web-spider`
(aranha: teia que reduz velocidade), `blink` (espectro: teleporta perto do jogador),
`caster-homing` (mago: orbe teleguiado).

**Chefes (3, um por capítulo):**
- **Ancião Raiz** (Capítulo 1, Bosque Sussurrante): raízes que brotam do chão,
  pólen em leque, abalo sísmico; fica mais agressivo em 50% de HP.
- **Rei Obsidiana** (Capítulo 2, Minas de Cinza): investidas com rastro de brasas,
  chuva de estilhaços, invoca golems menores em 50% de HP.
- **Senhor do Eclipse** (Capítulo 3, Torre do Crepúsculo): orbita lâminas de sombra,
  teleporta, duas fases; a 35% libera uma tempestade de flechas espelhadas.

**Nós do mapa:** Combate (ondas normais), Elite (mais inimigos, recompensa melhor),
Tesouro (escolha de 1 de 3 cartas sem custo), Descanso (recupera 35% do HP),
Mercador (3 ofertas por ouro), Chefe (último nó de cada capítulo).

**Recompensas:** cada inimigo solta XP (orbes) e ouro (moedas); chefes soltam
Relíquias ao vencer (e parte delas ao morrer, pela fase alcançada).

## Testes e verificação

- `tests/smoke.js`: carrega o jogo em Chromium headless (Playwright pré-instalado),
  checa erros de console, percorre título → história → mapa → combate por alguns
  segundos, tira capturas e confirma que o loop segue rodando.
- Verificação manual: capturas de cada cena em desktop e celular.

## Fora de escopo

Multiplayer, contas online, monetização, editor de fases, localização além do
português.

## Revisão deste spec (autoverificação)

- Placeholders: nenhum; os chefes e nós têm efeitos definidos.
- Consistência: três capítulos × oito nós; Relíquias persistem, ouro não.
- Ambiguidade resolvida: "Relíquias ao morrer" = 1 Relíquia a cada 2 fases de
  capítulo alcançadas + 1 a cada chefe vencido.
