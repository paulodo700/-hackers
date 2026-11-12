# Como transformar as três telas em aplicativos

O Mototáxi são **três aplicativos separados, ligados ao mesmo sistema**:

| Aplicativo | Endereço | Ícone | Para quem |
|---|---|---|---|
| **Passageiro** | `seu-link` | Amarelo | Todo mundo que pede corrida |
| **Motoqueiro** | `seu-link/motoqueiro/` | Preto, escrito MOTOQUEIRO | Só os motoqueiros |
| **Central** | `seu-link/central/` | Azul, escrito CENTRAL | Só você e os atendentes |

Cada um é instalado sozinho, aparece com o seu ícone na tela do celular e abre direto na sua parte.
O que acontece em um aparece na hora nos outros (pedido, aceite, posição no mapa, pagamento).

> **Importante:** para instalar no celular é preciso que o sistema esteja em um endereço com cadeado (HTTPS).
> Em `localhost` só dá para instalar no próprio computador. Veja `docs/SERVIDOR-WINDOWS.md` (Parte 2)
> ou `docs/COLOCAR-NO-AR.md`.

## Jeito 1 — Instalar direto do navegador (grátis, funciona hoje)

É o que recomendo para começar. Não precisa de loja, conta de desenvolvedor nem aprovação.

### No Android (Chrome)

1. Abra o endereço do aplicativo no **Chrome**.
2. Toque nos **três pontinhos** no canto de cima.
3. Toque em **Adicionar à tela inicial** (ou **Instalar aplicativo**).
4. Confirme em **Instalar**.
5. O ícone aparece na tela do celular. Daí em diante é só tocar nele: abre em tela cheia, sem barra de navegador.

### No iPhone (Safari)

1. Abra o endereço no **Safari** (no iPhone precisa ser o Safari).
2. Toque no botão de **compartilhar** (quadrado com uma seta para cima).
3. Role e toque em **Adicionar à Tela de Início**.
4. Toque em **Adicionar**.

### No computador (Chrome ou Edge)

1. Abra o endereço.
2. Na barra de endereço, clique no ícone de **instalar** (um monitor com uma seta) ou vá em menu → **Instalar**.
3. O aplicativo abre em janela própria e ganha atalho na área de trabalho. É o ideal para a **Central**.

### Como distribuir

- **Passageiros:** divulgue o link puro (cartaz, Instagram, WhatsApp, adesivo com QR Code na moto).
- **Motoqueiros:** mande o link terminado em `/motoqueiro/` só para eles. Depois de instalar, ele se cadastra,
  envia os documentos e a conta, e espera a sua aprovação.
- **Central:** instale só nos aparelhos de quem atende. Não divulgue esse link.

Depois de instalado, o aplicativo se atualiza sozinho sempre que você atualiza o servidor.

## Jeito 2 — Publicar na Play Store (Android)

Dá para colocar os três na loja do Google, como aplicativos de verdade. O aplicativo da loja é uma "casca" que
abre o seu sistema. O que você precisa:

1. **Link fixo com HTTPS e domínio próprio** (obrigatório; link de teste não serve).
2. **Conta de desenvolvedor no Google Play**: taxa única de US$ 25, paga uma vez.
3. **Política de privacidade publicada** (o app já tem a página `/termos.html`).
4. Gerar o arquivo do aplicativo (formato `.aab`) para cada um dos três e enviar pela Play Console.
   O Google analisa antes de liberar; costuma levar alguns dias.

Quando chegar nessa etapa, peça ao Claude:
`Prepare os três aplicativos Android (passageiro, motoqueiro e central) para publicar na Play Store e me guie passo a passo.`

A vantagem da loja: o aplicativo do **motoqueiro** pode ganhar GPS com a tela apagada e aviso de corrida com o
app fechado, o que o navegador não permite.

## Jeito 3 — App Store (iPhone)

É o mais caro e demorado: conta de desenvolvedor da Apple (US$ 99 por ano), um computador Mac para gerar o
aplicativo e análise mais rígida. Para uma cidade, o Jeito 1 no iPhone costuma bastar.

## Perguntas comuns

**Os três aplicativos precisam ficar no mesmo celular?** Não. Cada pessoa instala só o seu.

**Posso instalar os três no meu celular para testar?** Pode. Cada um guarda o seu login separado.

**O motoqueiro precisa deixar o aplicativo aberto?** No Jeito 1, sim: ele só recebe corrida com o aplicativo
aberto na tela. Isso muda com o aplicativo da loja (Jeito 2) ou com notificação push.

**Mudei o nome e a cor em Personalizar. O ícone muda?** O nome do aplicativo instalado muda (para quem instalar
depois). O desenho do ícone é fixo.
