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
- **Confirmação:** `POST /api/payments/asaas/webhook`, com o token no cabeçalho `asaas-access-token`. Eventos
  `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` chamam `markPaid`. Aviso repetido não conta duas vezes.
- **Sem subconta, sem Pix:** com o Asaas ligado, o app não cobra Pix direto na chave do motoqueiro (isso fugiria da comissão).

Configuração (no `.env` do servidor):

| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | chave da API (sandbox para testar). Nunca no código nem no Git |
| `ASAAS_ENV` | em branco = sandbox. `production` só com confirmação do dono |
| `ASAAS_WEBHOOK_TOKEN` | o mesmo texto que for colocado no webhook do painel Asaas |

Pendências antes de cobrar de verdade:

1. **Saldo interno duplicado:** a divisão do Asaas já manda o dinheiro ao motoqueiro, mas a carteira interna também
   credita a parte dele, e o saque manual pagaria de novo. Decidir como tratar (ex.: não permitir saque de corridas
   pagas pelo Asaas) antes de ligar em produção.
2. Validar no sandbox: se o cadastro de cliente exige CPF, o cabeçalho do webhook, e o formato exato de `dueDate`.
3. Teste com R$ 0,01 no sandbox antes de qualquer cobrança real.
