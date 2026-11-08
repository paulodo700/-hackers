# Prompt para a próxima rodada de melhorias — Anel Zero (rodada 3)

Copie o bloco abaixo para a próxima sessão. A rodada 2 foi concluída (commit `e1a3769`); este prompt parte das lacunas registradas em `docs/GDD.md`, seção "Lacunas conhecidas".

---

Você é o desenvolvedor principal de **Anel Zero — Dentro do Processador**, um RPG 3D original em Three.js, sem build, para PC e celular.

Leia antes de mudar qualquer coisa: `README.md`, `docs/GDD.md` (inclusive "Estado atual" e "Lacunas conhecidas") e `src/data/content.js`.

**Objetivo desta rodada:** fechar as lacunas de qualidade, transformar os testes soltos em uma suíte repetível e melhorar a experiência em celulares fracos.

Prioridades, em ordem:

1. **Suíte de testes repetível.** Transformar os scripts de teste headless em `tests/` com um runner único (Node + Playwright, usando o Chromium já instalado em `/opt/pw-browsers`, sem baixar nada). Cobrir: título e novo jogo, interação com NPC, batalha até a vitória, reparo nos três tamanhos, portais (inclusive o trancado), loja, bancada, árvore, ajustes, migração de save v1, save corrompido, layout em 360 px, o final da paz e o **final da guerra** (hoje não testado de ponta a ponta). Cada teste falha se houver qualquer erro de console ou de página. Documentar como rodar no README.
2. **Balanceamento com simulador.** Criar `tests/sim/` com um script que simula batalhas contra cada inimigo para níveis 1 a 10, com e sem itens, e reporta taxa de vitória e turnos médios. Ajustar HP, dano e drops até: nível 1 vence glitches comuns em 90% dos casos; chefes exigem pelo menos um nível de preparação; nenhum chefe passa de 10% de vitória no nível recomendado. Registrar os números antes e depois no GDD.
3. **Áudio verificável.** Os sons foram testados só para execução sem erros. Adicionar: controle de volume em ajustes (música e efeitos separados, com valores salvos em `settings.js`), um modo de "legenda visual" que mostra um ícone no canto quando um som importante toca (passo não, mas baú, vitória, bloqueio e chefe sim), e uma verificação do ganho de saída para nunca passar de 1.0 de amplitude. Não usar arquivos externos.
4. **Final da guerra e missões do núcleo.** Hoje o núcleo tem só um estágio de missão e nenhuma missão extra. Adicionar pelo menos uma missão extra ligada ao Vigia (por exemplo, recuperar uma peça de cada zona para a versão da paz, ou derrotar um guardião secundário para a versão da guerra), com estágios que alterem o texto do final.
5. **Personagens e rostos.** Os NPCs e Bit ainda são primitivas. Adicionar expressões procedurais no visor (olhos que piscam, sobrancelhas que mudam ao falar, boca por tipo de fala) controladas por `entities.js` e `player.js`. Manter pelo menos 60 FPS médios no teste de swiftshader em 360 px, medindo antes e depois.
6. **Zonas com identidade real.** Além da cor e da decoração, cada zona precisa de uma textura de piso e de parede diferente (não só cores trocadas) e de um portal com partículas. Criar um minimapa simples no canto, com as salas já visitadas.
7. **Reparo mais profundo.** Adicionar um modo difícil (tabuleiro 6×6 com dois cruzamentos e um fusível a mais), mostrar o recorde atual ao abrir o reparo da zona, e um tutorial na primeira vez que o reparo abre, com as regras dos segmentos.
8. **Save em slots.** Três slots de save na tela inicial, cada um com zona, nível e data. Migração do save atual (`anel-zero-save-v1`) para o slot 1, sem perder dados.
9. **Acessibilidade de teclado.** Todos os menus, lojas e escolhas devem ser navegáveis por Tab e Enter, com foco visível. O diálogo deve ter um botão para ouvir de novo a última fala (via `aria-live`).

**Regras do projeto**

- Tudo original: nomes, arte, sons e textos. Nada de marcas, personagens ou assets de terceiros.
- Sem build: ES modules puros; Three.js continua vendorizado em `vendor/three/`.
- Salvamento sempre dentro de try/catch. Se o formato mudar, adicione migração a partir da versão atual (2).
- Console limpo: nenhum erro e nenhum aviso novo nos testes. Warnings de GPU do swiftshader são aceitáveis, mas registre-os.
- A cada mudança, rode a suíte de testes e confira o console. Não declare pronto nada que não tenha sido rodado.
- Nenhum teste deve depender de sorte: se um resultado for aleatório, fixe a semente ou repita o teste o número de vezes necessário e reporte a taxa.
- Não criar pull request sem pedido explícito.

**Entregáveis**

- Commits pequenos, com mensagens descritivas, no branch `claude/processor-rpg-game-yid5oh`.
- `docs/GDD.md` atualizado: decisões tomadas, números do simulador, seção "Estado atual" revisada e "Lacunas conhecidas" reescrita com o que restou.
- Uma lista honesta do que não foi verificado (por exemplo, o áudio precisa de escuta real).
- Ao final, um novo prompt igual a este, para a rodada seguinte.
