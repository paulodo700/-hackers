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
