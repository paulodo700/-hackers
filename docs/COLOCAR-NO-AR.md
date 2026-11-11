# Como colocar o Mototáxi na internet

Este guia usa a **Railway** (railway.com). Ela foi escolhida porque faz tudo pelo site, sem instalar nada,
já entrega o endereço com **HTTPS** e tem **disco que não apaga** para o banco de dados.

**Custo:** plano Hobby, US$ 5 por mês (com US$ 5 de uso incluídos, o que costuma cobrir um app deste tamanho).
Precisa de cartão de crédito internacional. Confira o preço atual em railway.com/pricing antes de assinar.

> Os nomes dos botões no site da Railway mudam de vez em quando. Se algum não estiver igual ao descrito aqui,
> procure pelo nome mais parecido.

## Antes de começar

O código precisa estar no branch principal (`main`) do GitHub. Se ainda estiver só no branch de trabalho,
peça ao Claude: `Abra um pull request com o app do mototáxi` e aprove-o no GitHub (botão verde **Merge**).

## Passo 1 — Criar a conta

1. Abra **railway.com** e clique em **Login**.
2. Escolha **Login with GitHub** e entre com a mesma conta do GitHub onde está o projeto.
3. Quando pedir, escolha o plano **Hobby** e cadastre o cartão.

## Passo 2 — Criar o projeto a partir do GitHub

1. Clique em **New Project**.
2. Escolha **Deploy from GitHub repo**.
3. Se pedir permissão, clique em **Configure GitHub App** e libere o repositório `-hackers`.
4. Selecione o repositório `-hackers`.
5. A Railway começa a montar o app sozinha. **A primeira tentativa pode falhar ou subir sem acesso da central:
   é normal**, porque ainda faltam os passos 3 e 4.

## Passo 3 — Criar o disco do banco de dados (o mais importante)

Sem este passo, **todos os cadastros e corridas somem a cada atualização**.

1. Na tela do projeto, clique com o botão direito no quadro do serviço (ou no botão **+ Create** / **New**)
   e escolha **Volume**.
2. Ligue o volume ao serviço do mototáxi (**Attach to service**).
3. Em **Mount path**, digite exatamente: `/data`
4. Confirme.

## Passo 4 — Definir o acesso da central

1. Clique no quadro do serviço e abra a aba **Variables**.
2. Adicione estas duas variáveis (**New Variable**):

   | Nome | Valor |
   |---|---|
   | `ADMIN_PHONE` | o telefone da central com DDD, só números (ex.: `63999990000`) |
   | `ADMIN_PASSWORD` | uma senha forte, com pelo menos 6 caracteres |

3. Clique em **Deploy** (ou **Apply changes**) para o serviço reiniciar com as variáveis.

Não crie as variáveis `DEMO_MODE`, `PORT` nem `DB_PATH`: elas já estão certas.

## Passo 5 — Gerar o endereço com HTTPS

1. No serviço, abra a aba **Settings**.
2. Procure a parte **Networking** → **Public Networking**.
3. Clique em **Generate Domain**. Se perguntar a porta, deixe a que ele sugerir (ou digite `3000`).
4. Vai aparecer um endereço parecido com `https://hackers-production-xxxx.up.railway.app`. **Esse é o link do seu app.**

## Passo 6 — Conferir se deu certo

1. Abra a aba **Deployments** e veja se o último está como **Active** / **Success** (verde).
2. Clique em **View logs**. Devem aparecer estas linhas:
   - `Acesso da central criado para o telefone ...`
   - `Banco de dados em /data/mototaxi.db`  ← se o caminho for outro, o Passo 3 não foi feito direito.
3. Abra o link do Passo 5 no navegador. Deve aparecer a tela do passageiro com um **cadeado** ao lado do endereço.

## Passo 7 — Testar no celular

Cada público tem o seu endereço, e nenhuma tela mostra o link das outras: o link puro é do **passageiro**;
com `/motoqueiro/` no fim é do **motoqueiro**; com `/central/` no fim é da **central**.

1. Abra o link com `/central/` no fim. Entre com o telefone e a senha do Passo 4.
2. Vá em **Configurações**: escreva o nome da cidade, toque em **Usar minha localização**
   (ou toque no mapa no centro da cidade) e em **Salvar configurações**.
3. Em outro celular (ou em outra aba), abra o link com `/motoqueiro/` no fim e toque em **Não tem conta? Criar agora**.
   Preencha e crie. Vai aparecer "Cadastro em análise".
4. Volte à **Central** → **Motoqueiros** → **Aprovar**.
5. No celular do motoqueiro, permita o uso da **localização** quando o navegador pedir e toque em **Ficar online**.
6. Em outro celular, abra o link puro, toque em **Não tem conta? Criar agora**, crie a conta, permita a localização,
   digite o destino (ou toque no mapa) e toque em **Pedir mototáxi**.
7. O celular do motoqueiro toca e mostra a corrida. Aceite e siga os botões até **Finalizar**.

**Teste do disco:** depois de fazer um cadastro, vá em **Deployments** → menu do último deploy → **Redeploy**.
Quando voltar, entre de novo com a mesma conta. Se entrar, o banco está salvo de verdade.

## Instalar como aplicativo

- **Android (Chrome):** abra o link → menu ⋮ → **Adicionar à tela inicial** / **Instalar app**.
- **iPhone (Safari):** abra o link → botão de compartilhar → **Adicionar à Tela de Início**.

Divulgue para os passageiros o link puro. Mande o link terminando em `/motoqueiro/` só para os motoqueiros,
e guarde o link terminando em `/central/` só para você e os atendentes.

## Atualizações

Cada mudança aprovada no branch `main` do GitHub é publicada sozinha pela Railway em alguns minutos.
O app fica fora do ar por alguns segundos durante a troca.

## Cuidados

- **Guarde a senha da central.** Ainda não existe "esqueci minha senha".
- **Trocar `ADMIN_PASSWORD` depois não muda a senha**: ela só vale na primeira vez que o servidor liga.
- **Faça cópia do banco.** O volume guarda os dados, mas não é uma cópia de segurança. O próximo prompt
  recomendado cria o backup automático.
- **Motoqueiro precisa deixar a tela aberta** para receber corridas (limite do navegador). O prompt da
  notificação push resolve isso.

## Se quiser pagar menos

A **Fly.io** sai por volta de US$ 2 a 3 por mês para um app deste tamanho, mas tudo é feito por comandos
no terminal do computador. O arquivo `Dockerfile` deste projeto já serve para ela; peça ao Claude:
`Prepare a publicação na Fly.io e me guie pelos comandos`.
