# Anel Zero — Dentro do Processador: documento de design (RPG 2D)

Este documento é o contrato do projeto. Ele fixa mecânicas, números de balanceamento, IDs e interfaces
entre os módulos, para que o trabalho paralelo se encaixe. Os formatos dos dados estão em `src/data/schema.js`,
que é a fonte da verdade para validação.

## 1. Visão

Bit é um robô de manutenção que desce pelas oito camadas de um processador para conter a Corrupção, uma
infecção que nasce no substrato e se espalha pelas trilhas. O jogador explora labirintos, repara trilhas
rompidas, enfrenta falhas do circuito em combate por turnos, monta equipamentos, aprende habilidades,
conversa com técnicos, cumpre missões e derrota um Guardião em cada camada até chegar ao Anel Escuro.

Pilares: (1) exploração com obstáculos que exigem ferramentas de verdade; (2) combate tático com elementos,
estados e fases de chefe; (3) mundo que reage: calor, inimigos que patrulham e perseguem; (4) progressão
com escolhas (ramos de habilidade, equipamentos, receitas); (5) tudo original: nomes, personagens, texto
e arte do projeto.

## 2. Camadas

| Ordem | id | Nome | Tema | Bloqueio (ferramenta) | Guardião (chefe) |
|---|---|---|---|---|---|
| 1 | dissipador | Dissipador de calor | metal frio e largo | — | bolha_termica (calor) |
| 2 | metal_m1 | Metal M1 | trilhas de cobre | trilha rompida (reparo_trilha) | varredor_de_trilhas (corrente) |
| 3 | cache_l3 | Cache L3 | blocos de memória rápida | porta de energia (ajuste_energia) | guardiao_do_cache (sinal) |
| 4 | nucleos | Núcleos de CPU | pulsos e calor | encaixe do núcleo (reforco_nucleo) | nucleo_instavel (calor) |
| 5 | controlador_memoria | Controlador de memória | filas de bancos | trilha rompida (reparo_trilha) | fila_infinita (sinal) |
| 6 | energia | Rede de energia | corrente alta, faíscas | porta de energia (ajuste_energia) | colapso_de_tensao (corrente) |
| 7 | interposer | Interposer | pontes entre blocos | trilha rompida (reparo_trilha) | ponte_partida (frio) |
| 8 | substrato | Substrato | escuro, anel | — | anel_escuro (neutro, final) |

Cada camada tem: um labirinto gerado por semente; bloqueios que são **obrigatórios** (a saída fica fora de
alcance sem a ferramenta, garantido pelo gerador); materiais alcançáveis sem ferramenta; uma sala do chefe
fechada por uma porta `D` (abre com `chave_nucleo`) que contém a saída `>` (ou o anel `A`, na última camada).

## 3. Personagem

Base de Bit: vida 24, energia (EP) 10, ataque 4, defesa 1, velocidade 5, crítico 5%.
Ao subir de nível (máximo 15): vida +5, EP +1; ataque +1 a cada 2 níveis; defesa +1 a cada 3; velocidade +1
a cada 4; +1 ponto de habilidade.
XP para o próximo nível: `12 + 8·n + n²` (n = nível atual).

Equipamento: 3 slots (`dissipador` = defesa e vida; `antena` = ataque e crítico; `modulo` = efeitos
especiais). Equipamentos são itens únicos no inventário; equipar move o item para o slot.
Moeda: **ciclos**. Ganha em combate, baús, missões e vendas.

## 4. Combate

Menu: 1 Atacar, 2 Habilidade (submenu com as aprendidas), 3 Item (submenu com consumíveis), 4 Defender,
5 Fugir. O jogador age primeiro em cada rodada; a falha age depois, salvo se estiver em `curto`.

Fórmulas (todas com `rng` determinístico do jogo):
- Ataque efetivo = atk do personagem + mods de equipamento + mods de estado; defesa efetiva análogo (corrosão −30%).
- Dano base = `max(1, atk − def·0,5) · fator_da_habilidade`.
- Elemento: se o atacante tem vantagem sobre o alvo (tabela `VANTAGEM`), ×1,5; se o alvo tem vantagem, ×0,75; senão ×1.
- Variação: ×(0,9 + 0,2·rng). Crítico (chance = crit%, com foco +20): ×1,5.
- Bloqueio térmico: recebido ×0,5. Escudo absorve antes da vida.
- Esquiva: `clamp((spd_alvo − spd_atacante)·0,02, 0, 0,25)`. Esquivar anula o dano.
- Defender: recebido ×0,5 até o próximo turno do jogador.
- Fugir: 50% de chance. Chefes não permitem fuga.
- Derrota: renasce no `S` da camada com metade da vida. Falhas vencidas continuam vencidas.
- Vitória: XP, ciclos, quedas (`drops`), bestiário atualizado, missões avançadas, energia +2.

Status (definições em `src/data/status.js`): queimadura, curto, lentidão, corrosão, fraqueza, regeneração,
escudo, foco, impulso, bloqueio térmico. Status negativos são removidos por `limpeza`, `pulso_reset`.

Chefes: 3 fases com limites de vida 66% e 33%; cada fase tem seu conjunto de ataques. Ataques com
`telegrafo` avisam no turno anterior: o jogador pode defender. Fase nova mostra texto e tremor.

## 5. Mundo vivo

- **Calor (0–100).** +1 por passo; +4 em trilha quente (`h`); −6 em zona fria (`~`); −1 a cada 5 passos parado
  em lugar neutro. Limiares: ≥60 falhas causam +15% de dano; ≥85 perde 1 de vida por passo; 100 perde 3 por
  passo. Pasta térmica (−25) e refrigerante (−40) reduzem.
- **Inimigos com IA.** Comportamentos: `patrulha` (anda ao acaso num raio de 3 células), `perseguidor` (se o
  jogador estiver a até 4 células, anda na direção dele; senão fica parado), `estatico`. Movem-se a cada passo
  do jogador. Colisão ou adjacência inicia combate. Após fuga, o inimigo ignora o jogador por 3 passos.
- **Baús** (`b`): abrir com E ao lado. Conteúdo sorteado da tabela da camada (`src/data/loot.js`), uma vez.
- **Técnicos** (`N`) e **mercadores** (`M`): E abre diálogo; mercadores também abrem a loja.
- **Portas** (`D`): abrem com `chave_nucleo` usada com R (ou com a missão). **Bloqueios** (`x`, `g`, `o`)
  pedem a ferramenta com R.

## 6. Missões, diálogos e progresso

Missões (`src/data/quests.js`): principal (uma por camada, capítulo) e secundárias (duas por camada).
Etapas são sequenciais. Tipos de etapa: `falar` (npc), `coletar` (item, qtd, conta o inventário),
`entregar` (npc, item, qtd: consome), `derrotar` (foe, qtd), `chefe` (chefe), `reparar` (qtd, na camada),
`chegar` (camada), `escanear` (foe: entrar no bestiário). Recompensa: xp, ciclos, itens, flags.

Diálogos (`src/data/dialogues.js`): um diálogo por condição, escolhido pela primeira cujas condições valem.
Nós com `fala`, `opcoes` (cada uma com `texto`, `ir`, `condicoes` opcionais) ou `ir` direto, e `efeitos`.
Condições: `flag`, `quest`, `item`, `nivel`, `chefe`, `ciclos`. Efeitos: `flag`, `item`, `ciclos`, `xp`,
`quest_iniciar`, `quest_concluir`, `curar`, `loja`, `anotar`.

Bestiário: registra cada falha vista e vencida, e mostra fraquezas e ataques depois de vencer uma vez ou
escanear. Diário: missões ativas, concluídas e anotações.

## 7. Criação

Receitas em `src/crafting.js` (dados em `src/data/recipes.js`): ferramentas (reparo_trilha, ajuste_energia,
reforco_nucleo, chave_nucleo), consumíveis (pasta_termica, refrigerante, pulso_reset, injecao_energia,
kit_reparo) e equipamentos (dissipador_mk1..3, antena_mk1..3, módulos). Aprimoramento: um equipamento Mk1
vira Mk2 com materiais e ciclos; Mk2 vira Mk3.

## 8. Salvamento (versão 2)

Uma chave por camada e uma para a partida, como na versão 1, mais: inventário, equipamento, habilidades,
pontos, XP, calor, passos, missões, flags, bestiário, chefes derrotados, baús abertos, falhas vivas com
posição e comportamento, e o estado do sorteio. Status de combate e diálogo aberto **não** são salvos.
Versões anteriores são descartadas com aviso.

## 9. Áudio e arte: eventos

O núcleo nunca toca som nem desenha. Ele publica `game.events`, uma lista de objetos:
- `{tipo:'sfx', id}` — id em `SFX_IDS` (src/audio).
- `{tipo:'musica', id}` — id em `MUSIC_IDS`.
- `{tipo:'dano', alvo:'jogador'|'inimigo', valor, critico, c, r}`, `{tipo:'cura', alvo, valor, c, r}`.
- `{tipo:'texto', texto, c, r, cor}` (número flutuante).
- `{tipo:'fx', fx, c, r}` — fx em `FX_IDS` (src/art).
- `{tipo:'tremor', forca}`, `{tipo:'flash', cor, duracao}`, `{tipo:'camada', camada}`.
`main.js` consome os eventos, toca os sons e dispara as animações.

## 10. Controles

Teclado: setas/WASD mover; E falar/abrir baú/loja; R usar ferramenta; C criar; M mapa do chip;
I inventário; K habilidades; J diário; B bestiário; Tab menu geral; Esc fecha; Enter confirma; Backspace
volta; 1–5 escolhem no combate e nos menus; F3 depuração; N novo jogo.
Toque: painel de botões com os mesmos comandos; menus com lista rolável e botões Confirmar/Voltar.
Mouse: clique nos itens de menu e no mapa do chip.

## 11. Contratos dos dados (IDs obrigatórios)

- **Falhas regulares (10):** pulga_corrente (f), rasgo_trilha (F), ruido_termico (Q), vazamento_corrente (V),
  eletromigracao (E), pico_de_tensao (J), fantasma_de_cache (L), sobrecarga_termica (R), bit_corrompido (G),
  glitch_de_pipeline (T). Caractere entre parênteses (usado no mapa).
- **Chefes (8):** bolha_termica, varredor_de_trilhas, guardiao_do_cache, nucleo_instavel, fila_infinita,
  colapso_de_tensao, ponte_partida, anel_escuro. Um por camada, `chefe: true`, `camada`, `fases`, `recompensa`.
- **Materiais:** liga_ferrugem, fio_cobre, cristal_silicio, placa_base, polimero_termico, fragmento_escuro.
- **Ferramentas:** reparo_trilha, ajuste_energia, reforco_nucleo, chave_nucleo.
- **Consumíveis:** pasta_termica, refrigerante, pulso_reset, injecao_energia, patch_impulso, capacitor_reserva,
  kit_reparo.
- **Equipamentos:** dissipador_mk1, dissipador_mk2, dissipador_mk3, antena_mk1, antena_mk2, antena_mk3,
  modulo_sinal, modulo_termico, modulo_foco, modulo_ressonante.
- **Itens de missão:** definidos pela área de conteúdo (ids com prefixo `missao_`).
- **Habilidades (15):** fusao: descarga, chama_termica, pulso_sinal, arco_voltaico, onda_de_choque;
  reparo: pasta_de_reparo, ponte_de_reparo, limpeza, regeneracao, sincronia;
  dissipacao: dissipador_ativo, congelar, resfriamento, contramedida, bloqueio_termico.
- **Ataques de falhas e chefes:** definidos pela área de conteúdo em `src/data/skills.js` (`ATAQUES`).
- **NPCs:** 2 a 3 por camada, com `camada`, `tipo` (ver `TIPOS_NPC`) e `sprite` entre tecnico_a, tecnico_b,
  mercador_a, guardiao_a, narrador_a.
- **Missões:** capitulo_<camada> (principal, uma por camada) e duas secundárias por camada.
- **Lojas:** dissipador, cache_l3, energia, substrato (cada uma com um mercador).

## 12. Interfaces de arte e áudio

Arte (`src/art/index.js`): `ART_SPRITES` (id → {w, h, frames, palette}), `ART_IDS`, `spriteInfo(id)`,
`drawSprite(ctx, id, x, y, {scale, frame, flip})` (sem efeito fora do navegador), `wallVariant(mask)` para
os 16 blocos de parede (bits: norte 1, leste 2, sul 4, oeste 8). `FX_IDS`.
Sprites exigidos: `bit` (8 quadros: baixo0, baixo1, cima0, cima1, esq0, esq1, dir0, dir1), uma sprite por falha
e chefe (id igual ao da falha; chefes maiores), uma por item (id igual), `ramo_fusao`, `ramo_reparo`,
`ramo_dissipacao`, `status_<id>` (10), `tecnico_a`, `tecnico_b`, `mercador_a`, `guardiao_a`, `narrador_a`,
tiles `chao_a`, `chao_b`, `chao_c`, `trilha`, `trilha_rompida`, `porta_energia`, `encaixe`, `porta_chefe`,
`bau_fechado`, `bau_aberto`, `zona_quente`, `zona_fria`, `saida`, `anel`, `parede_0`..`parede_15`, e os
ícones de interface `icone_coracao`, `icone_energia`, `icone_ciclo`, `icone_calor`, `icone_seta`.
Efeitos (`FX_IDS`): faisca, fumaca, anel, gelo, fogo.

Áudio (`src/audio/index.js`): `SFX_IDS` (mover, selecionar, voltar, erro, dano, critico, cura, status, passo,
coleta, bau, reparo, porta, chefe_surge, vitoria, derrota, subir_nivel, missao, dialogo, compra, venda, fuga,
esquiva, escudo, sobreaquecer, fogo), `MUSIC_IDS` (titulo, uma por camada pelo id da camada, batalha, chefe,
vitoria_musica), `buildSfx(id, sampleRate)` e `buildMusic(id, sampleRate, segundos)` puros (Float32Array),
`AudioEngine` (WebAudio, inicialização preguiçosa após gesto, nunca lança erro sem áudio).

## 13. Marcos

M1 Dados e regras base (este documento, schema, mapgen com bloqueios obrigatórios). **Feito parcialmente.**
M2 Combate tático (menus, elementos, estados, habilidades, chefes com fases).
M3 Mundo vivo (calor, IA, baús, portas, chefes na sala).
M4 Progressão (XP, níveis, equipamento, criação, lojas).
M5 Missões e diálogos (condições, efeitos, diário, bestiário).
M6 Apresentação (arte pixel, parede por vizinhança, partículas, tremor, transições, menus com mouse).
M7 Áudio (efeitos e trilhas por camada, mudo e volume).
M8 Qualidade (robô de partidas aleatórias para achar travamentos, balanceamento, salvamento v2).

Critério de aceitação do projeto: uma partida completa (das oito camadas ao anel) é possível sem travar, com
salvamento e carregamento no meio; todas as regras têm teste; os textos e a arte são originais.

## 14. Estado atual (implementado)

- **Mapas:** 31 por 21 células, com labirinto em árvore e atalhos. Cada camada tem sala do chefe, porta, chave,
  técnicos, baús, materiais, falhas e zonas quentes e frias. O gerador garante que cada bloqueio é obrigatório.
- **Visão:** de cima, com câmera que segue Bit suavemente. Painel lateral (retrato, vida, energia, calor, nível, XP,
  ciclos, estados e minimapa), faixa inferior (registro, inventário com ícones e atalhos) e topo (camada e missão).
- **Calor:** +1 a cada 4 passos em terreno comum; trilha quente +3; zona fria −6. Esperar (Z) resfria −2 em terreno
  comum e −8 na zona fria, e devolve vida (+2). Calor 85 ou mais causa 1 de dano por passo; 100 causa 3.
- **Falhas:** reaparecem a cada 120 passos, longe de Bit, até um limite de falhas vivas por camada (4 na primeira,
  5 na segunda e assim por diante).
- **Combate:** falhas comuns dão o dobro do XP do conteúdo. O escalonamento de vida e ataque por camada é de 0,2 por
  camada. O primeiro chefe tem vida 36, ataque 4 e defesa 1.
- **Personagem:** cada nível dá 5 de vida, 1 de energia e um ponto de habilidade; ataque sobe nos níveis pares e
  defesa nos múltiplos de três.

### Medição do robô (tools/robo-jogador.mjs)

- Com o equilíbrio atual, a semente 1 vence o primeiro chefe e chega à quinta camada num orçamento de centenas de
  milhares de tiques. Não há partida completa verificada.
- O equilíbrio das camadas seguintes ainda precisa de ajuste: o chefe da quinta camada é muito forte para o
  personagem no nível máximo com o equipamento que o robô obtém.
- Ajustes que pioraram o robô (e foram revertidos): mais vida e ataque por nível junto com escalonamento mais suave.
  Próximo passo sugerido: medir cada chefe com o robô e ajustar por camada, sem mexer no crescimento geral.
