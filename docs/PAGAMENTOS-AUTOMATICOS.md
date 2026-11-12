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

## Asaas (escolhido) — como ligar

1. Criar a conta da empresa no Asaas (sandbox.asaas.com para testes) e gerar a chave de API de sandbox.
2. No `.env` do servidor: `ASAAS_API_KEY`, `ASAAS_ENV=sandbox`, e um `ASAAS_WEBHOOK_TOKEN` escolhido por você.
3. No painel do Asaas, criar o webhook para `https://SEU-ENDERECO/api/payments/asaas`, evento de pagamento,
   com o mesmo token no campo de autenticação.
4. Cada motorista precisa de uma subconta Asaas (CPF, e-mail, telefone, renda, endereço). A central cadastra o
   código da subconta (walletId) pela API `PUT /api/admin/drivers/:id/asaas-wallet`.
5. Testar no sandbox até uma corrida inteira: cobrança, QR Code, pagamento simulado e divisão.
6. Só então trocar para `ASAAS_ENV=production` e a chave de produção.

Com o Asaas ligado, o saque interno é desligado: o Asaas já paga a subconta do motorista.
