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
- Especificação e plano da versão 1 em `docs/superpowers/`.
- Rodar: `npm install`, criar `.env` a partir de `.env.example`, `npm start` (porta 3000).
- Testes: `npm test` (unidade e API) e `node tests/e2e.cjs` (navegador, precisa do Playwright).
- `DEMO_MODE=1` no `.env` é só para teste em pré-visualização: libera abrir dentro de moldura e deixa o motoqueiro
  marcar a posição tocando no mapa. Nunca ligar em produção.
- O ambiente na nuvem bloqueia `router.project-osrm.org` e `nominatim.openstreetmap.org`: ali a busca de endereço
  volta vazia e a distância é estimada. Fora dali funcionam.
- Ainda não está publicado na internet. O próximo passo recomendado é a publicação com HTTPS (o GPS do celular exige).
