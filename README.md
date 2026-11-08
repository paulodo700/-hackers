# -hackers
So os de verdade

# Anel Zero — Dentro do Processador

RPG de aventura 3D jogado **dentro de um processador**. Você é **Bit**, um programa de manutenção que acorda num chip em colapso e precisa consertar os circuitos, reconstruir o Anel Zero e descobrir quem apagou a memória do sistema.

Feito em **Three.js**, roda no **PC e no celular** (navegador moderno), sem build e sem assets externos: todo o visual é procedural e original.

## Como rodar

Módulos ES exigem um servidor HTTP (não funciona abrindo o arquivo direto):

```bash
python3 -m http.server 8080
# depois abra http://localhost:8080 no navegador
```

No celular, use o IP da sua máquina na mesma rede, ou publique a pasta em qualquer hospedagem estática (GitHub Pages, Netlify, etc.).

## Controles

| Ação | PC | Celular |
|---|---|---|
| Mover | WASD / setas | Joystick (metade esquerda) |
| Interagir / atacar / avançar diálogo | E, Espaço ou Enter | Botão AÇÃO |
| Girar câmera | Arrastar com botão direito/meio | Arrastar na metade direita da tela |
| Zoom | Roda do mouse | — |
| Menu (status, inventário, missões, códex, salvar) | M ou Esc | Botão MENU |
| Reparo de trilha | Clicar nos segmentos para girá-los | Tocar nos segmentos |

## O que tem no jogo

- **Mecânica central: reparo de circuito.** Cada trilha partida é um quebra-cabeça de rotação: gire os segmentos até ligar a fonte verde ao destino magenta. Os puzzles crescem de 4×4 a 6×6.
- **Batalha por turnos:** Atacar, Habilidades (Golpe de Solda, Rajada de Pulso, Reparo Rápido, Curto-Circuito), Itens, Defender e Fugir.
- **Glitches que perseguem:** inimigos vagam pelo mapa e avançam ao ver você.
- **Sete zonas** dentro do processador: Jardim da Cache L1, Planície de Registradores, Forja da ULA, Canyon do Pipeline, Cidade dos Bancos de Memória, Barramento Principal e Núcleo do Anel Zero.
- **Chefes:** Sobrecarga, Titã da Ferrugem e o Vigia.
- **Missões** com etapas, NPCs com diálogos que mudam conforme seu progresso, baús, equipamentos com raridade e um códex que se preenche sozinho.
- **Salvamento automático** no navegador (`localStorage`), com "Continuar" na tela inicial.

## Estrutura

```
index.html          interface (HUD, diálogos, menus, batalha, reparo)
styles.css          estilos (inclui layout para celular)
vendor/three/       Three.js 0.160.0 (MIT, incluído localmente)
src/
  main.js           laço principal, câmera, zonas, interações, portais
  state.js          atributos, inventário, flags, contadores, missões, salvamento
  world.js          constrói cada zona 3D a partir do mapa em texto
  entities.js       NPCs, baús, nós de reparo, chefes, glitches
  player.js         modelo e movimento do Bit
  battle.js         batalha por turnos
  repair.js         minijogo de reparo de trilha
  ui.js             HUD, diálogos com escolhas, menus, loja e bancada
  audio.js          som e trilha procedurais (Web Audio)
  settings.js       ajustes: som, vibração, tamanho do texto, alto contraste
  input.js          teclado, mouse e toque
  textures.js       arte procedural (pisos, ícones, retratos de inimigos)
  loot.js           saques de baús e textos de requisitos
  data/zones.js     mapas das zonas, marcadores, portais
  data/content.js   itens, inimigos, habilidades, missões, diálogos, códex, final
docs/
  GDD.md            documento de design (história, sistemas, roteiro)
  PROMPT_MELHORIAS.md  prompt para a próxima rodada de melhorias
```

## Testes

Não há build. Para testar em navegador headless, o jogo expõe `window.__anelZero` (estado, zona, jogador, `loadZone`, `beginBattle`, `interact`, `repairDebug`). Esse gancho serve para testes automatizados e pode ser removido numa versão final.
