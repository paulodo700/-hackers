# Rodar o Mototáxi no seu computador com Windows

Neste modo o app inteiro (as três telas e o banco de dados) fica dentro do seu computador.
Não tem mensalidade de hospedagem. Em troca, **o computador precisa ficar ligado e com internet**:
se ele desligar, o app sai do ar para todo mundo.

São duas etapas: primeiro fazer funcionar no computador (Parte 1), depois abrir para a internet (Parte 2).

---

## Parte 1 — Instalar e ligar

### Passo 1 — Instalar o Node.js (só uma vez)

1. Abra o site **nodejs.org**.
2. Clique no botão da versão **LTS** para baixar.
3. Abra o arquivo baixado e clique em **Avançar** até o fim.

### Passo 2 — Baixar o Mototáxi

1. Abra a página do projeto no GitHub.
2. Clique no botão verde **Code** e depois em **Download ZIP**.
3. Clique com o botão direito no arquivo baixado → **Extrair tudo**.
4. Mova a pasta extraída para um lugar fixo, por exemplo `C:\mototaxi`.
   Evite a Área de Trabalho e a pasta Downloads, para ninguém apagar sem querer.

### Passo 3 — Instalar

1. Abra a pasta `C:\mototaxi` e entre na pasta **windows**.
2. Dê dois cliques em **1-instalar.bat**.
   - Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações** → **Executar assim mesmo**.
3. Espere a instalação (alguns minutos).
4. Quando perguntar, digite o **telefone da central** (com DDD) e uma **senha**. Anote os dois.

### Passo 4 — Ligar

1. Dê dois cliques em **2-iniciar.bat**.
2. Uma janela preta abre e mostra `Mototaxi rodando em http://localhost:3000`. **Essa janela é o servidor: não feche.**
   - Se o Windows perguntar sobre o Firewall, pode clicar em **Permitir**.

### Passo 5 — Testar no próprio computador

Cada público tem o seu endereço. Nenhuma tela mostra o link das outras:

| Tela | Endereço no seu computador |
|---|---|
| Passageiro | `localhost:3000` (ou `localhost:3000/passageiro/`) |
| Motoqueiro | `localhost:3000/motoqueiro/` |
| Central | `localhost:3000/central/` |

1. Abra o navegador (Chrome ou Edge) e digite: `localhost:3000/central/`
2. Deve aparecer a tela de entrada da Central.
3. Entre com o telefone e a senha do Passo 3.
4. Vá em **Configurações**, escreva o nome da cidade, clique no mapa no centro da cidade e em **Salvar configurações**.
5. Abra outra aba em `localhost:3000/motoqueiro/`, clique em **Não tem conta? Criar agora** e crie a conta.
6. Volte à aba da **Central** → **Motoqueiros** → **Aprovar**.
7. Na aba do motoqueiro, permita a localização quando o navegador pedir e clique em **Ficar online**.
8. Abra uma terceira aba em `localhost:3000`, clique em **Não tem conta? Criar agora**, crie a conta, marque o destino no mapa e clique em **Pedir mototáxi**.
9. A aba do motoqueiro mostra a corrida. Aceite e siga os botões até **Finalizar**.

Se tudo isso funcionou, o sistema está certo. Falta só abrir para os celulares.

---

## Parte 2 — Abrir para a internet (com HTTPS)

O celular só libera o GPS em endereço com cadeado (HTTPS). Para isso usamos um **túnel**: um programa
gratuito da Cloudflare que liga o seu computador à internet com segurança, sem mexer no roteador.

### Opção A — Link de teste (grátis, sem cadastro)

Serve para testar com alguns celulares. **O link muda toda vez que você fecha a janela.**

1. Abra: `github.com/cloudflare/cloudflared/releases/latest`
2. Baixe o arquivo **cloudflared-windows-amd64.exe**.
3. Mude o nome dele para **cloudflared.exe** e coloque dentro da pasta `C:\mototaxi\windows`.
4. Com o **2-iniciar.bat** aberto, dê dois cliques em **3-link-da-internet.bat**.
5. Depois de alguns segundos aparece um endereço parecido com `https://alguma-coisa.trycloudflare.com`.
6. Abra esse endereço no celular. Deve aparecer a tela do passageiro com o cadeado.
   Para o motoqueiro, acrescente `/motoqueiro/` no fim do endereço; para a central, `/central/`.
7. Repita o teste da Parte 1 usando celulares de verdade: um como motoqueiro, outro como passageiro.

### Opção B — Link fixo (para uso de verdade)

Para os motoqueiros e passageiros usarem todo dia, o endereço não pode mudar. Para isso é preciso:

1. **Um domínio**, por exemplo `mototaxidacidade.com.br` (cerca de R$ 40 por ano no registro.br).
2. **Uma conta gratuita na Cloudflare**, com esse domínio cadastrado nela.
3. **Um túnel com nome** criado no painel da Cloudflare (área *Zero Trust* → *Tunnels*), apontando para
   `http://localhost:3000`. O painel mostra um comando para instalar o túnel no Windows como serviço,
   e a partir daí ele liga sozinho junto com o computador.

Essa parte tem várias telas no site da Cloudflare. Quando chegar nela, peça ao Claude:
`Me guie para criar o link fixo do mototáxi com meu domínio na Cloudflare.`

---

## Deixar o computador pronto para ficar ligado

1. **Ligar junto com o Windows:** dê dois cliques em **4-ligar-junto-com-o-windows.bat**.
   O servidor passa a abrir sozinho quando você entra no Windows.
2. **Não deixar o computador dormir:** Configurações → Sistema → Energia → em **Suspender**, escolha **Nunca**.
3. **Atualizações do Windows** reiniciam o computador de vez em quando. Depois de reiniciar, é preciso
   entrar no Windows para o servidor voltar.
4. Se a luz ou a internet caírem, o app fica fora do ar até voltarem. Um nobreak ajuda.

## Cópia de segurança

- O servidor faz **uma cópia por dia, sozinho**, na pasta `C:\mototaxi\data\backups`, e guarda as 30 últimas.
- Para fazer uma cópia na hora: dois cliques em **backup-agora.bat** (ela vai para `C:\mototaxi\backups`).
- **Importante:** cópia no mesmo computador não protege se o disco estragar. De vez em quando, copie a pasta
  de backups para um pendrive ou para o Google Drive.
  Dá para automatizar: abra o arquivo `.env` com o Bloco de Notas e acrescente uma linha com a pasta do
  Google Drive no computador, por exemplo `BACKUP_DIR=G:\Meu Drive\mototaxi-backups`.

**Para recuperar uma cópia:** feche a janela do servidor, apague os arquivos de `C:\mototaxi\data` que começam com
`mototaxi.db`, copie a cópia escolhida para essa pasta, mude o nome dela para `mototaxi.db` e ligue o servidor de novo.

## Atualizar o app

1. Feche a janela do servidor.
2. Baixe o ZIP novo do GitHub e extraia.
3. Copie o conteúdo novo **por cima** da pasta `C:\mototaxi`, escolhendo **substituir os arquivos**.
   As pastas `data` (banco de dados) e o arquivo `.env` (senha) não vêm no ZIP, então continuam os seus.
4. Dê dois cliques em **1-instalar.bat** (quando perguntar se quer refazer a configuração, responda `n`).
5. Dê dois cliques em **2-iniciar.bat**.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Node.js nao esta instalado" | Faça o Passo 1 e abra o instalador de novo |
| A janela preta fecha sozinha | Abra de novo; se repetir, tire foto do erro e mande para o Claude |
| `localhost:3000` não abre | Confira se a janela do **2-iniciar.bat** está aberta |
| No celular não aparece o mapa do GPS | O endereço precisa começar com `https://`; use o link do túnel, não o `localhost` |
| "Telefone ou senha incorretos" na central | Use o telefone e a senha digitados no Passo 3. Refazer a configuração **não** troca a senha de um banco que já existe |
