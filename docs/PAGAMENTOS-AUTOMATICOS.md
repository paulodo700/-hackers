# Pagamentos automáticos (divisão sozinha)

O sistema já tem a carteira, a divisão e os saques. O que falta para o dinheiro se mover sozinho é um **gateway de
pagamento licenciado** (Pix com divisão/split). Eu não consigo criar conta nem contratar isso por você.

## Por que não dá para o próprio app guardar o dinheiro

Receber dinheiro de passageiros e guardá-lo para pagar motoristas é atividade regulada: exige ser instituição de
pagamento autorizada pelo Banco Central. Por isso a divisão precisa acontecer **no gateway**, que já é autorizado.

## O que fazer (passo a passo, ao decidir)

1. **Escolher o gateway** com Pix, split e carteiras por usuário (ex.: Asaas, Pagar.me, Mercado Pago). Compare taxa por
   Pix, prazo de repasse, suporte a "subconta" para motoristas e a exigência de CNPJ.
2. **Abrir a conta** da empresa (CNPJ). Cada motorista é cadastrado como subconta com CPF/CNPJ, documentos e chave Pix.
   Os documentos já são coletados pelo app, mas o gateway também faz a checagem dele.
3. **Ligar o webhook:** no painel do gateway, configurar a notificação de pagamento para
   `https://SEU-ENDERECO/api/payments/webhook` e enviar o cabeçalho `x-payment-token`. No `.env` do servidor, colocar o
   mesmo valor em `PAYMENT_WEBHOOK_TOKEN`.
4. **Trocar a cobrança:** a cobrança Pix da corrida passa a ser criada no gateway com a divisão (motorista e central). Peça
   ao Claude: `Integre o gateway X: cobrança Pix com split para o motorista e a central, usando o webhook do app.`
5. **Testar com R$ 0,01** antes de cobrar de verdade.

Enquanto isso não estiver ligado, a central confirma os Pix na aba **Carteira** ("Pix recebido") e a divisão acontece
do mesmo jeito dentro do sistema.

## Integração com o Asaas (versão 6)

Gateway escolhido: **Asaas**. O código está em `server/asaas.js` e já é usado quando a chave está ligada.

- **Subconta por motoqueiro:** a central abre a subconta (`POST /api/admin/wallet/drivers/:id/subaccount`, com e-mail,
  celular, renda, endereço, bairro e CEP). Só o `walletId` é guardado; a chave da subconta não é usada nem gravada.
- **Cobrança Pix por corrida:** `POST /v3/payments` com `billingType: PIX`, `externalReference` = número da corrida e
  `split` com o `walletId` do motoqueiro e `fixedValue` = valor menos a comissão. A central fica com a comissão.
- **QR Code:** `GET /v3/payments/{id}/pixQrCode`. A corrida guarda o id da cobrança (não cria outra ao reabrir).
- **Confirmação:** `POST /api/payments/asaas/webhook`, com o token no cabeçalho `asaas-access-token` (confirmado na documentação). Eventos
  `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` chamam `markPaid`. Aviso repetido não conta duas vezes.
- **Central:** na aba Carteira, a seção "Pix automático (Asaas)" lista os motoristas e abre a subconta por formulário.
- **Sem subconta, sem Pix:** com o Asaas ligado, o app não cobra Pix direto na chave do motoqueiro (isso fugiria da comissão).

Configuração (no `.env` do servidor):

| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | chave da API (sandbox para testar). Nunca no código nem no Git |
| `ASAAS_ENV` | em branco = sandbox. `production` só com confirmação do dono |
| `ASAAS_WEBHOOK_TOKEN` | o mesmo texto que for colocado no webhook do painel Asaas |

Regras confirmadas na documentação do Asaas:

- **Cliente da cobrança:** o cadastro de cliente exige `cpfCnpj`. Como o app não coleta CPF do passageiro, o cliente das
  cobranças é a própria central (CPF/CNPJ em Configurações). Se quiser cobrar o passageiro em nome dele, é preciso
  coletar o CPF no cadastro dele (decisão de privacidade do dono).
- **Token do webhook:** 32 a 255 caracteres, sem espaços, e diferente da chave da API. O servidor recusa token fora dessas regras.
- **Dupla contagem resolvida:** em corrida paga pelo Asaas, a parte do motoqueiro não entra no saldo interno (ela já está
  na subconta dele). A carteira só registra a comissão da central. A confirmação manual fica bloqueada para essas corridas.

Pendências antes de cobrar de verdade:

1. Validar no **sandbox** (ainda não feito: a chave salva é recusada pelo Asaas com `invalid_access_token`):
   o cadastro de cliente com o CNPJ da central, a criação da subconta, a cobrança com split e o recebimento do webhook.
2. Teste com R$ 0,01 no sandbox antes de qualquer cobrança real.
3. Só então, com confirmação do dono, `ASAAS_ENV=production`.
