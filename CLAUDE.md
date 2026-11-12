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
- Versão 2 (11/11/2026): modo escuro, ícones SVG (`public/shared/icones.js`, sem emojis), rota e tempo estimado,
  menu lateral (`public/shared/menu.js`), aba **Personalizar** e aba **Passageiros** na central. Quase tudo que
  aparece para passageiro/motoqueiro vem de `GET /api/public/config` (`publicSettings` em `server/db.js`); ao criar
  um ajuste novo, inclua em `DEFAULTS`, `TEXTS`/`FLAGS` e `PUBLIC_KEYS`.
- Os Termos (`public/termos.html`) são um modelo genérico; o dono foi avisado de que precisa de revisão profissional.
- Ele quer o app "pronto para publicar e lucrar": priorize confiabilidade e clareza para usuário leigo.
- Versão 3 (12/11/2026): Pix da corrida direto na chave do motoqueiro (`server/pix.js`, `server/finance.js`),
  cadastro do motoqueiro com documentos (`server/docs.js`, arquivos em `data/docs/`, nunca na pasta pública) e conta
  bancária, aba **Acertos** (comissão gravada em `rides.commission`), conta da central em Configurações, registro de
  atividades (`server/audit.js`), três PWAs com ícone e `scope` próprios. Guia: `docs/VIRAR-APLICATIVO.md`.
- **Limites que o dono já sabe:** o sistema não movimenta dinheiro (só gera o Pix copia e cola e controla a
  comissão; a central confirma o recebimento à mão) e não faz biometria facial automática (conferência manual).
  Automatizar exige contratar gateway de pagamento / serviço de verificação; não simular essas funções.
- O código Pix foi validado por testes de estrutura e CRC, mas **não foi lido por um app de banco real**:
  ele precisa fazer um Pix de teste de R$ 0,01.
- A versão 3 acrescentou a dependência `qrcode`: ao atualizar no Windows é preciso rodar `1-instalar.bat` de novo.
- Versão 4 (12/11/2026): endereços com número (`server/places.js`, `searchAddress` em `server/geo.js`). Busca
  aproximada marca `approx`; posição só vira "exata" (`precise`) por toque no mapa, GPS, endereço exato ou local
  conhecido. Locais aprendem com corridas concluídas. Serviço de mapa liberado no ambiente "mototaxi" (hosts
  nominatim/OSRM/photon). Falta: tela de locais na central.
- Versão 5 (12/11/2026): carteira interna (`server/wallet.js`): divisão automática da corrida paga (motorista + comissão
  da central), saques com senha e confirmação da central, webhook de pagamento com segredo (`/api/payments/webhook`).
  O sistema NÃO movimenta dinheiro sozinho: divisão real exige gateway licenciado (ver `docs/PAGAMENTOS-AUTOMATICOS.md`).
  Os acertos antigos de comissão foram removidos; a aba da central agora é **Carteira**.
- Versão 6 (12/11/2026): integração com o **Asaas** (`server/asaas.js`, `server/asaas-charge.js`). Cobrança Pix com
  split para a subconta do motorista (`drivers.asaas_wallet_id`), cliente com CPF do passageiro (`users.cpf`), webhook
  `/api/payments/asaas` (cabeçalho `asaas-access-token`). Ambiente sandbox: https://api-sandbox.asaas.com/v3; produção:
  https://api.asaas.com/v3. Cabeçalho da chave: `access_token`. Com o Asaas ligado, o saque interno é bloqueado.
  Chave de sandbox salva como segredo do ambiente "mototaxi", mas a API ainda respondeu 401 (cabeçalho não enviado pelo
  proxy): conferir o cadastro do segredo (cabeçalho `access_token`, sem prefixo) antes do teste real.
