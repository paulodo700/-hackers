# Prompt para a próxima rodada de melhorias — Anel Zero (rodada 5)

Copie o bloco abaixo para a próxima sessão. A rodada 4 foi concluída (54 testes no total; 32 de ponta a ponta). Este prompt parte das lacunas registradas em `docs/GDD.md`, seção "Lacunas conhecidas".

---

Você é o desenvolvedor principal de **Anel Zero — Dentro do Processador**, um RPG 3D original em Three.js, sem build, para PC e celular.

Leia antes de mudar qualquer coisa: `README.md`, `docs/GDD.md` (inclusive "Balanceamento" e "Lacunas conhecidas") e `src/data/content.js`. Rode `npm test` antes de começar e registre a contagem de partida.

**Objetivo desta rodada:** levar o jogo de "verificado por máquina" para "validado com pessoas", e fechar as lacunas de dificuldade e de conteúdo.

Prioridades, em ordem:

1. **Playtest com pessoas.** Criar um roteiro de playtest (`docs/PLAYTEST.md`) com tarefas (encontrar o reparo da Cache, vencer a Sobrecarga, entrar no Núcleo) e um formulário de observação. Registrar pelo menos cinco sessões reais antes de mudar números. Se não houver pessoas disponíveis, dizer isso explicitamente e não alterar o balanceamento com base em suposições.
2. **Dificuldade das batalhas.** Hoje a dificuldade só existe no reparo. Adicionar uma escolha de dificuldade para batalhas (fácil, normal, difícil) que altere o dano do inimigo e a taxa de drops, com testes no simulador para cada modo. Os modos não podem mudar a fase 2 dos chefes nem as metas do modo normal.
3. **Habilidades no simulador.** O simulador ainda não usa habilidades (Rajada, Reparo Rápido, Curto-Circuito). Incluí-las no jogador simulado e registrar o efeito na tabela do GDD.
4. **Expressões do rosto.** Acrescentar uma expressão de cansaço (quando o HP está abaixo de 30%) no visor do Bit, com teste unitário da regra de escolha.
5. **Conteúdo de zona.** Cada zona tem um inimigo e uma missão extra. Adicionar um segundo tipo de inimigo a cada zona que ainda tenha só um, e um teste que confira que todo inimigo aparece em pelo menos uma zona.
6. **Som com timbre validado.** Depois do playtest, comparar a percepção do áudio com as medições do `AnalyserNode`. Ajustar apenas os volumes padrão, nunca a trilha, sem uma sessão que o justifique.

**Regras do projeto**

- Tudo original: nomes, arte, sons e textos. Nada de marcas, personagens ou assets de terceiros.
- Sem build: ES modules puros; Three.js continua vendorizado em `vendor/three/`.
- Salvamento: o formato atual é a versão 3. Se o formato mudar, adicionar migração a partir da versão 3, com teste unitário.
- Console limpo: nenhum erro e nenhum aviso novo nos testes.
- Nenhum teste deve depender de sorte: números aleatórios com semente fixa, e esperas por condição em vez de tempo fixo.
- Balanceamento só muda com número registrado: rode o simulador antes e depois, e registre a tabela no GDD.
- Nada declarado pronto sem ter sido rodado. Se algo não puder ser verificado no ambiente, dizer isso no relatório.
- Não criar pull request sem pedido explícito.

**Entregáveis**

- Commits pequenos, com mensagens descritivas, no branch `claude/processor-rpg-game-yid5oh`.
- `docs/GDD.md` atualizado: tabela de balanceamento, decisões tomadas e seção "Estado atual" com o número exato de testes passando.
- `docs/PLAYTEST.md` com o roteiro e os resultados das sessões (ou a declaração de que nenhuma sessão foi feita).
- Uma lista honesta do que não foi verificado.
- Ao final, um novo prompt igual a este, para a rodada seguinte.
