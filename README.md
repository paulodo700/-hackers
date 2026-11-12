# Mototáxi da Cidade

Sistema de mototáxi para uma cidade, no estilo dos apps de corrida. São três telas no mesmo sistema:

| Tela | Endereço | Quem usa |
|---|---|---|
| **Passageiro** | `/` ou `/passageiro/` | Pede a moto, vê o preço antes, acompanha no mapa, avalia |
| **Motoqueiro** | `/motoqueiro/` | Fica online, recebe a corrida com som, aceita e conduz |
| **Central** | `/central/` | Mapa ao vivo, lança corrida de quem ligou, aprova motoqueiros, relatórios, preços |

Cada público só vê a própria tela: o endereço principal abre o passageiro, e as telas do motoqueiro e da central
não têm link em lugar nenhum (só entra quem recebe o endereço e tem conta).

Funciona no navegador do celular e pode ser instalado como aplicativo ("Adicionar à tela inicial").

## Como rodar no computador

Precisa do [Node.js](https://nodejs.org) versão 20 ou mais nova.

```bash
npm install
cp .env.example .env      # depois abra o .env e troque o telefone e a senha da central
npm start
```

Abra `http://localhost:3000/central/`. O primeiro acesso da central é o telefone e a senha que você colocou no `.env`
(`ADMIN_PHONE` e `ADMIN_PASSWORD`).

### Primeiros passos

1. Entre na **Central** → **Configurações**: coloque o nome da cidade, marque o centro no mapa e ajuste os preços.
2. Cada motoqueiro se cadastra em `/motoqueiro/`. Ele aparece na Central → **Motoqueiros** para você **aprovar**.
3. O motoqueiro aprovado toca em **Ficar online** (precisa do GPS ligado e da tela aberta).
4. O passageiro pede em `/passageiro/`, ou liga para a central e o atendente usa **Nova corrida**.

## Como funciona

- **Preço:** taxa inicial + valor por km, com valor mínimo, arredondado para R$ 0,50. Tudo ajustável na central.
- **Distribuição:** a corrida vai para o motoqueiro livre mais próximo. Se ele recusar ou não responder no tempo
  (20 s por padrão), passa para o próximo. Sem ninguém livre, a central é avisada e pode reenviar ou escolher alguém.
- **Pagamento:** direto com o motoqueiro, em dinheiro ou Pix. O sistema registra o valor e calcula a comissão da central.
- **Mapa:** OpenStreetMap, gratuito e sem chave. A rota usa o serviço público OSRM; se ele falhar, o sistema estima a
  distância e a corrida não trava.

## Colocar na internet

**O passo a passo completo está em [`docs/COLOCAR-NO-AR.md`](docs/COLOCAR-NO-AR.md)** (hospedagem Railway, cerca de US$ 5 por mês).

**Prefere rodar no seu próprio computador com Windows?** Veja [`docs/SERVIDOR-WINDOWS.md`](docs/SERVIDOR-WINDOWS.md):
instalação com dois cliques, túnel gratuito com HTTPS e cópia de segurança diária automática.

O que qualquer hospedagem precisa ter:

- **HTTPS** (endereço com cadeado). Sem isso o celular **não libera o GPS**.
- **Node.js** rodando sem parar e com suporte a WebSocket. O `Dockerfile` do projeto já monta tudo.
- **Disco que não apaga** montado em `/data`, porque o banco de dados é o arquivo `/data/mototaxi.db`.

Variáveis de ambiente (as mesmas do `.env`):

| Variável | Para quê |
|---|---|
| `ADMIN_PHONE`, `ADMIN_PASSWORD` | Primeiro acesso da central (usado só na primeira vez) |
| `PORT` | Porta do servidor (padrão 3000) |
| `DB_PATH` | Onde salvar o banco de dados |
| `JWT_SECRET` | Opcional. Se ficar vazio, o sistema cria um segredo e guarda em `data/.jwt-secret` |
| `TRUST_PROXY` | Coloque `1` se a hospedagem fica na frente do servidor repassando o IP |

Os serviços gratuitos de mapa (OpenStreetMap, Nominatim e OSRM) têm limite de uso justo. Para uma cidade pequena
atendem bem; se o movimento crescer muito, troque por um serviço pago ou próprio (`OSRM_URL`, `NOMINATIM_URL`).

## Testes

```bash
npm test                 # 80 testes: preço, corrida, distribuição, login, segurança, Pix, comissão, API e tempo real
node tests/e2e.cjs       # navegador de verdade com passageiro, motoqueiro e central (precisa do Playwright)
```

## Organização do código

```
server/
  index.js      liga tudo e sobe o servidor
  app.js        rotas HTTP e arquivos das telas
  db.js         banco de dados (SQLite) e configurações
  auth.js       senha, login e permissões
  pricing.js    cálculo do preço
  geo.js        distância, rota e busca de endereço
  rides.js      ciclo da corrida (quem pode fazer o quê, e quando)
  drivers.js    motoqueiros: online, posição, aprovação
  dispatch.js   escolhe o motoqueiro e controla as ofertas
  realtime.js   avisos em tempo real para as telas
  routes/       uma pasta de rotas por público (auth, rides, drivers, admin, geo)
public/
  passageiro/ motoqueiro/ central/   as três telas
  shared/                            peças comuns (estilo, mapa, comunicação)
docs/superpowers/                    especificação e plano da versão 1
```

## O que a versão 2 trouxe

- **Visual profissional:** modo escuro, ícones, rota desenhada no mapa, tempo estimado, animações e telas de carregamento.
- **Menu lateral** no passageiro e no motoqueiro: perfil (trocar nome e senha), histórico/ganhos, falar com a central, termos.
- **Personalizar (na central):** nome do serviço, cor, frase de apresentação, tema padrão, avisos no topo das telas,
  telefone/WhatsApp da central, formas de pagamento aceitas, chave Pix e quais itens aparecem em cada menu.
- **Passageiros (na central):** lista com busca, corridas, gasto e bloqueio.
- **Motoqueiros (na central):** corridas, faturamento e nota média de cada um.
- **Senhas:** cada pessoa troca a sua; a central redefine a de quem esqueceu. Trocar a senha derruba os logins antigos.
- **Proteções:** limite de tentativas e de pedidos por endereço, preço confirmado igual ao estimado, contagem da oferta
  correta mesmo com o relógio do celular errado, página de Termos e Privacidade.

## Asaas (versão 6)

- Cobrança Pix por corrida com divisão automática: a parte do motorista vai para a subconta dele no Asaas.
- Passageiro informa o CPF em "Meu perfil" (usado só para gerar o Pix).
- Webhook `POST /api/payments/asaas` confirma o pagamento e repete sem pagar duas vezes.
- Configuração e passo a passo em `docs/PAGAMENTOS-AUTOMATICOS.md`.

## Carteira e divisão automática (versão 5)

- **Divisão sozinha:** quando a corrida termina e o pagamento está confirmado, o valor é dividido na hora: a parte do
  motorista vai para a carteira dele e a comissão para a carteira da central. Ninguém paga comissão à mão.
- **Saque:** o motorista saca o saldo para a conta dele (senha + valor, mínimo R$ 10). A central confirma o Pix enviado
  na aba **Carteira**. Recusar devolve o valor.
- **Confirmação do pagamento:** pelo gateway (webhook `POST /api/payments/webhook`, com o segredo `PAYMENT_WEBHOOK_TOKEN`)
  ou, enquanto não houver gateway, pela central em "Pix recebido".
- Corridas concluídas antes da versão 5 entram como pagas, sem divisão de novo.

**Importante:** para o dinheiro sair do passageiro e cair nas contas certas *automaticamente*, o pagamento precisa passar
por um gateway licenciado com divisão (split) ou carteiras por usuário. Sem isso, o dinheiro chega numa conta só e a
central faria a transferência à mão. Ver `docs/PAGAMENTOS-AUTOMATICOS.md`.

## Endereços com número (versão 4)

- A busca entende **rua + número** (ex.: "rua 13 de maio 500") e mostra "Número aproximado: ajuste o pino" quando o
  mapa só conhece a rua. Nesse caso, a pessoa ajusta o pino tocando no lugar certo.
- **Locais conhecidos:** endereços com número cuja posição foi confirmada numa corrida que aconteceu passam a ser
  encontrados com exatidão nas próximas vezes. A central também pode cadastrar locais (API `/api/admin/places`;
  a tela para isso ainda não existe).
- Cache de buscas por 24 horas e fila de pedidos ao serviço de mapa (respeita o limite de 1 pedido por segundo).
- A aba **Corridas** e os relatórios contam "hoje" no fuso da cidade, não no relógio do navegador.

## O que a versão 3 trouxe (dinheiro e cadastro seguro)

- **Pix direto na conta do motoqueiro:** na corrida paga em Pix, passageiro e motoqueiro veem um QR Code com o
  valor exato e a chave do motoqueiro. O dinheiro não passa pela central.
- **Cadastro do motoqueiro com documentos:** foto da CNH, do documento da moto e selfie segurando a CNH, mais a
  conta para receber (titular, CPF/CNPJ e chave Pix). A central confere tudo na **ficha do motoqueiro** antes de aprovar.
- **Acertos de comissão:** o app guarda a comissão de cada corrida, mostra quanto cada motoqueiro deve, gera para
  ele o Pix para a conta da central e a central confirma o recebimento.
- **Conta da central:** cadastrada em Configurações → *Minha conta para receber*.
- **Segurança:** mudar conta bancária exige a senha; fotos de documentos só abrem com o login da central;
  registro de atividades com tudo que mexe em dinheiro, senha e cadastro.
- **Três aplicativos separados**, cada um com seu ícone. Veja [`docs/VIRAR-APLICATIVO.md`](docs/VIRAR-APLICATIVO.md).

**O que o sistema não faz (e por quê):**

- **Não movimenta dinheiro sozinho.** Ele gera o código Pix e controla quem deve quanto. Quem transfere é o
  aplicativo do banco de cada pessoa. A confirmação do recebimento é feita por você, olhando o extrato.
  Depósito e confirmação automáticos exigem contratar um serviço de pagamentos (com CPF/CNPJ, contrato e taxa por transação).
- **Não faz reconhecimento facial automático.** A selfie e os documentos são conferidos por uma pessoa da central.
  Conferência automática exige contratar um serviço de verificação de identidade.
- **Antes de usar com dinheiro de verdade, faça um Pix de teste de R$ 0,01** em cada conta cadastrada e confira
  o nome que aparece no banco.

> **Sobre os Termos de uso (`/termos.html`):** o texto é um modelo genérico. Antes de operar comercialmente, peça a um
> advogado ou contador para revisar, principalmente por causa da LGPD e das regras de mototáxi do seu município.

## O que ainda não tem

Pagamento dentro do app, aviso com o app fechado (push), publicação nas lojas, corrida agendada, entregas, cupons,
chat e vários atendentes com permissões diferentes.

## Prompts para as próximas melhorias

Copie um de cada vez em uma nova conversa. Estão na ordem em que eu recomendo fazer.

**Para colocar no ar**

1. ~~Colocar na internet com HTTPS~~ — arquivos prontos; siga `docs/COLOCAR-NO-AR.md`.
2. `Adicione na central um botão para baixar a cópia de segurança do banco de dados.` (a cópia diária automática já existe)
3. ~~Adicione "esqueci minha senha": a central consegue gerar uma senha nova para um passageiro ou motoqueiro.~~ — feito.

**Para o motoqueiro não perder corrida**

4. `Adicione notificação push (Web Push) para o motoqueiro receber a corrida mesmo com o app fechado ou a tela bloqueada.`
5. `Transforme o app do motoqueiro em um aplicativo Android instalável (APK) com GPS em segundo plano, usando Capacitor.`
6. `Na central, permita cadastrar o motoqueiro direto pelo painel (nome, telefone, placa, foto) sem ele precisar se cadastrar sozinho.`

**Para o passageiro**

7. `Adicione endereços favoritos (Casa, Trabalho) e os últimos destinos no app do passageiro.`
8. ~~Mostre o tempo estimado de chegada do motoqueiro e desenhe a rota no mapa.~~ — feito.
9. `Adicione um botão de WhatsApp para o passageiro falar com o motoqueiro e com a central.`
10. `Permita agendar corrida para um horário futuro.`

**Para o dinheiro**

11. `Adicione pagamento por Pix dentro do app, com QR Code e confirmação automática.`
12. `Crie o acerto semanal de comissão: a central vê quanto cada motoqueiro deve, marca como pago e guarda o histórico.`
13. `Adicione tabela de preço por horário (tarifa noturna, domingo e feriado) e taxa extra para bairros distantes.`
14. `Adicione cupons de desconto e a primeira corrida grátis.`

**Para a central**

15. `Crie contas de atendente com permissão limitada (só lança e acompanha corridas, não vê relatórios nem configurações).`
16. `Adicione exportação dos relatórios para Excel e PDF.`
17. ~~Mostre a nota média de cada motoqueiro e a lista de avaliações ruins na central.~~ — feito.
18. `Cadastre os bairros e pontos conhecidos da cidade (rodoviária, hospital, praça) para a busca de endereço ficar instantânea.`

**Para crescer**

19. `Adicione o serviço de entrega (moto-entrega): o cliente pede a retirada de um pacote, com preço e fluxo próprios.`
20. `Adicione botão de emergência e compartilhamento da viagem em tempo real com um contato.`
21. `Faça uma revisão de segurança completa do sistema e corrija o que encontrar.`
