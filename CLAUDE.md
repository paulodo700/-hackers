# Mototáxi da Cidade — instruções para o Claude

## Como trabalhar com o dono do projeto

- Responda sempre em português do Brasil, com linguagem simples. Ele não é programador.
- **Depois de cada atualização, explique passo a passo como testar** o que mudou: onde clicar, o que digitar,
  o que deve aparecer na tela. Numere os passos. Não suponha que ele sabe usar terminal, git ou `npm`;
  se um passo exigir isso, explique o comando e onde digitá-lo. (Pedido dele em 11/11/2026.)
- No fim de cada conversa, sugira os próximos prompts de melhoria (a lista fica no `README.md`).
- Nas sessões na nuvem ele não conseguiu achar o botão de pré-visualização. Ao subir o servidor para ele testar,
  diga exatamente onde procurar e ofereça a alternativa (rodar no computador dele ou publicar na internet).

## Sobre o projeto

- Sistema web com três telas: `/passageiro/`, `/motoqueiro/`, `/central/`. Detalhes no `README.md`.
- A pedido do dono (11/11/2026), não existe página inicial com os três acessos: `/` abre o passageiro e nenhuma
  tela pode ter link ou texto que revele as outras. Manter assim.
- Especificação e plano da versão 1 em `docs/superpowers/`.
- Rodar: `npm install`, criar `.env` a partir de `.env.example`, `npm start` (porta 3000).
- Testes: `npm test` (unidade e API) e `node tests/e2e.cjs` (navegador, precisa do Playwright).
- `DEMO_MODE=1` no `.env` é só para teste em pré-visualização: libera abrir dentro de moldura e deixa o motoqueiro
  marcar a posição tocando no mapa. Nunca ligar em produção.
- O ambiente na nuvem bloqueia `router.project-osrm.org` e `nominatim.openstreetmap.org`: ali a busca de endereço
  volta vazia e a distância é estimada. Fora dali funcionam.
- Publicação: arquivos prontos para a Railway (`Dockerfile`, `railway.json`, guia em `docs/COLOCAR-NO-AR.md`).
  O dono ainda precisa fazer os passos no site da Railway. A imagem Docker não pôde ser construída na nuvem
  (sem Docker ativo); se o primeiro deploy falhar, peça o log do build a ele.
- O dono escolheu rodar em **computador próprio com Windows, em casa/escritório** (11/11/2026). Guia em
  `docs/SERVIDOR-WINDOWS.md`; arquivos `.bat` em `windows/`. Os `.bat` **não foram testados em Windows**
  (o ambiente na nuvem é Linux): se ele relatar erro, peça foto da janela. Link fixo com domínio na Cloudflare
  ainda não foi feito.
- Cópia de segurança diária automática já existe (`scripts/backup.js`, chamada por `server/index.js`).
