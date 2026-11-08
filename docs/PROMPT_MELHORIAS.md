# Prompt para a próxima rodada de melhorias — Anel Zero (rodada 4)

Copie o bloco abaixo para a próxima sessão. A rodada 3 foi concluída (testes em `tests/`, 45 de 45 passando). Este prompt parte das lacunas registradas em `docs/GDD.md`, seção "Lacunas conhecidas".

---

Você é o desenvolvedor principal de **Anel Zero — Dentro do Processador**, um RPG 3D original em Three.js, sem build, para PC e celular.

Leia antes de mudar qualquer coisa: `README.md`, `docs/GDD.md` (inclusive "Balanceamento" e "Lacunas conhecidas") e `src/data/content.js`. Rode `npm test` antes de começar, para conhecer o estado de partida.

**Objetivo desta rodada:** fechar as lacunas de cobertura e de balanceamento, e validar o que hoje só foi testado por código.

Prioridades, em ordem:

1. **Cobrir os caminhos que faltam na suíte.** Adicionar testes ponta a ponta para: derrota em batalha (volta ao ponto seguro, perde 10% dos créditos), fuga em batalha, venda na loja, troca de dificuldade no reparo com o cronômetro ativo, e o reparo com fusível queimado (o segmento não pode mais ser girado). Cada teste deve falhar se houver erro ou aviso de console.
2. **Curva de progressão não linear para os chefes.** A meta de 10% no nível anterior ao recomendado não foi atingida com a curva atual (ver GDD, "Balanceamento"). Experimentar uma curva em que o ganho por nível diminui depois do nível 6, ou pontos de habilidade que valem mais, e reportar a tabela antes e depois. Não aceitar uma solução que só enfraqueça o chefe sem registrar o efeito nos níveis anteriores.
3. **Validar o áudio com medição, não só com execução.** Usar `AnalyserNode` num teste headless para confirmar que a trilha de cada zona e os efeitos produzem energia audível, que o limitador mantém o pico abaixo do teto, e que volume zero silencia a trilha. Se o timbre continuar sem escuta real, dizer isso no relatório.
4. **Texturas de parede por zona.** Hoje só o piso tem padrão próprio. Dar a cada zona um desenho de parede coerente com o piso (por exemplo, pinos para a planície, tubos para o pipeline) e um teste que confirme que o desenho muda entre zonas.
5. **Rostos com mais expressão.** Acrescentar pelo menos duas expressões de conversa (surpresa e dúvida) escolhidas pelo texto da fala, sem arquivos externos. Manter o desenho em canvas e o custo de CPU baixo.
6. **Dificuldade e acessibilidade de teclado no reparo.** Permitir escolher a dificuldade antes de começar, e garantir que o cronômetro possa ser pausado com a tecla P, para quem usa teclado ou leitor de tela.
7. **Ambiente reproduzível.** Declarar a dependência de Playwright no `package.json` com a versão exata do ambiente, e documentar como instalar o Chromium em outra máquina, sem alterar o comportamento dos testes.

**Regras do projeto**

- Tudo original: nomes, arte, sons e textos. Nada de marcas, personagens ou assets de terceiros.
- Sem build: ES modules puros; Three.js continua vendorizado em `vendor/three/`.
- Salvamento: os três slots estão no formato 3. Se o formato mudar, adicionar migração a partir da versão 3, com teste unitário.
- Console limpo: nenhum erro e nenhum aviso novo nos testes.
- Nenhum teste deve depender de sorte: números aleatórios com semente fixa, e esperas por condição em vez de tempo fixo.
- Nada declarado pronto sem ter sido rodado. Se algo não puder ser verificado no ambiente, dizer isso no relatório.
- Não criar pull request sem pedido explícito.

**Entregáveis**

- Commits pequenos, com mensagens descritivas, no branch `claude/processor-rpg-game-yid5oh`.
- `docs/GDD.md` atualizado: nova tabela de balanceamento, decisões tomadas e seção "Estado atual" revisada com o número exato de testes passando.
- Uma lista honesta do que não foi verificado.
- Ao final, um novo prompt igual a este, para a rodada seguinte.
