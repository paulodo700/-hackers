# Prompt para a próxima rodada de melhorias — Anel Zero

Copie o bloco abaixo para a próxima sessão. Ele assume o estado descrito em `docs/GDD.md` e `README.md`.

---

Você é o desenvolvedor principal de **Anel Zero — Dentro do Processador**, um RPG 3D original que se passa dentro de um processador, feito em Three.js, sem build, rodando no PC e no celular.

Leia antes de qualquer mudança: `README.md`, `docs/GDD.md` e `src/data/content.js`.

**Objetivo desta rodada:** tornar o jogo mais bonito, mais profundo e mais viciante, mantendo-o original e jogável no celular.

Prioridades, em ordem:

1. **Visual 3D de personagens.** Substituir as primitivas do Bit e dos NPCs por modelos low-poly com mais detalhes (cabeça com expressão no visor, ombros, cabos, pequenas placas). Animações de idle, caminhada, ataque e vitória com `AnimationMixer` ou interpolação procedural. Manter o orçamento de desempenho para celulares de médio porte (até ~150 draw calls por zona).
2. **Arte de zona.** Cada zona deve ter identidade própria: iluminação, névoa, partículas, decorações (capacitores, pinos, dissipadores, rastros de solda), e uma textura de piso que mude de estilo. Adicione um efeito de transição entre zonas.
3. **Áudio.** Trilha procedural por zona e efeitos de passos, reparo, golpe, baú e vitória, usando Web Audio (sem arquivos externos). Respeitar mudo e pausa.
4. **Sistemas de RPG.** Lojas com moedas (créditos), crafting com materiais dos inimigos, árvore de habilidades com pontos por nível, e pelo menos duas novas missões secundárias por zona. Balancear dano, HP e drops com uma tabela simples em `content.js`.
5. **Batalha.** Efeitos visuais de golpe (partículas e tremor de câmera), indicador de intenção do inimigo, e um chefe com segunda fase em cada boss.
6. **Reparo de circuito.** Novos tipos de segmento (cruzamento, fusível, resistor que exige rotação extra), modo de tempo limitado e pontuação por número de giros.
7. **Narrativa.** Escrever os diálogos do Arquivista e do Vigia com escolhas que mudem o final (um final "consertar com o Vigia" e um "reescrever o núcleo"). Registrar as escolhas em `state.flags`.
8. **Acessibilidade e celular.** Tamanho de texto ajustável, modo de alto contraste, vibração (`navigator.vibrate`) em golpes, e revisão do layout em retrato com 360 px de largura.

**Regras do projeto**

- Tudo original: nomes, arte, sons e textos. Nada de marcas, personagens ou assets de terceiros.
- Sem build: ES modules puros; Three.js continua vendorizado em `vendor/three/`.
- Salvamento sempre dentro de try/catch e compatível com o formato atual de `state.js`. Se mudar o formato, adicione migração.
- A cada mudança, rode os testes headless (smoke, batalha, reparo, portais) e confira erros de console.
- Não adicione dependências de rede em tempo de execução.

**Entregáveis**

- Código e dados atualizados, com commits pequenos e mensagens descritivas.
- `docs/GDD.md` atualizado com as decisões tomadas e a seção "Estado atual" revisada.
- Ao final, um novo prompt igual a este, com as próximas prioridades, para a rodada seguinte.
