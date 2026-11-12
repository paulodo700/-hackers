# Mototáxi da Cidade — Especificação (v1)

Data: 2026-11-11

## Objetivo

Um serviço de mototáxi para uma cidade, no estilo dos apps de corrida, simples
de usar e barato de manter. O passageiro pede pelo app ou ligando/mandando
WhatsApp para a central; a central acompanha e controla tudo; o motoqueiro
recebe e executa as corridas pelo celular.

Sucesso da v1: uma corrida completa funciona de ponta a ponta nas três telas,
em tempo real, tanto pedida pelo passageiro quanto lançada pela central.

## Decisões já tomadas com o dono do projeto

- Pedido pelos dois jeitos: app do passageiro e lançamento pela central.
- Preço por distância: taxa inicial + valor por km, com valor mínimo.
- Um único sistema web com três telas, instalável no celular (PWA).
- Pagamento direto ao motoqueiro (dinheiro ou Pix); o app só registra a forma.

## Arquitetura

Um servidor Node.js serve a API, o tempo real e as três telas.

```
server/
  index.js          inicia HTTP + Socket.IO
  app.js            monta o Express (rotas, arquivos estáticos)
  db.js             abre o SQLite e cria as tabelas
  config.js         variáveis de ambiente (porta, segredo JWT, cidade)
  auth.js           senha (bcrypt), token (JWT), middleware por papel
  pricing.js        cálculo do preço (função pura)
  geo.js            haversine, rota (OSRM), busca de endereço (Nominatim)
  dispatch.js       escolha do motoqueiro e fila de ofertas
  rides.js          ciclo de vida da corrida (máquina de estados)
  realtime.js       salas e eventos do Socket.IO
  routes/           auth, rides, drivers, admin, geo
public/
  index.html        página inicial (escolha: passageiro / motoqueiro / central)
  passageiro/       app do passageiro
  motoqueiro/       app do motoqueiro
  central/          painel da central
  shared/           api.js, mapa.js, estilos, ícones, manifest, service worker
tests/              node:test
```

Dependências: express, socket.io, better-sqlite3, bcryptjs, jsonwebtoken.
Telas em HTML/CSS/JavaScript puro com Leaflet (sem etapa de build).

## Dados (SQLite)

- `users`: id, role (`passenger` | `driver` | `admin`), name, phone (único),
  password_hash, created_at.
- `drivers`: user_id, plate, moto_model, status (`pending` | `approved` |
  `blocked`), online, lat, lng, last_seen.
- `rides`: id, passenger_id (nulo se lançada pela central), passenger_name,
  passenger_phone, driver_id, origem (texto, lat, lng), destino (texto, lat,
  lng), distance_km, price, payment (`cash` | `pix`), status, source (`app` |
  `central`), notes, rating, timestamps de cada etapa, cancel_reason,
  cancelled_by.
- `ride_offers`: ride_id, driver_id, status (`pending` | `accepted` |
  `declined` | `expired`), created_at.
- `settings`: chave/valor — base_fare, per_km, min_fare, commission_percent,
  city_name, city_lat, city_lng, offer_timeout_s.

Login por telefone + senha. Um admin inicial é criado na primeira execução a
partir de variáveis de ambiente (`ADMIN_PHONE`, `ADMIN_PASSWORD`).

## Preço

`preço = max(min_fare, base_fare + per_km × distance_km)`, arredondado para
múltiplos de R$ 0,50. Padrões: base 3,00; km 2,00; mínimo 6,00. A distância
vem da rota (OSRM); se o serviço falhar, usa linha reta × 1,3. O preço é
calculado no servidor e gravado na corrida ao ser criada.

## Ciclo da corrida

```
searching → accepted → arrived → in_progress → completed
    │           │          │
    └───────────┴──────────┴──→ cancelled
searching → no_drivers (ninguém aceitou)
```

- Somente o servidor muda o status; cada transição valida o estado anterior e
  quem está pedindo.
- Cancelamento: passageiro e central até `arrived`; motoqueiro até `arrived`
  (a corrida volta para `searching` e é oferecida a outro); central sempre.
- Um passageiro só tem uma corrida ativa por vez; um motoqueiro também.

## Distribuição (dispatch)

1. Candidatos: motoqueiros aprovados, online, sem corrida ativa, com posição
   atualizada nos últimos 2 minutos, que ainda não recusaram esta corrida.
2. Ordena por distância até a origem e oferece ao mais próximo.
3. Oferta expira em `offer_timeout_s` (padrão 20 s) → próximo candidato.
4. Sem candidatos → `no_drivers`; a central pode reenviar ou atribuir à mão.
5. A central pode atribuir diretamente a um motoqueiro (oferta só para ele).

## Tempo real (Socket.IO, autenticado por token)

- Salas: `user:<id>`, `admins`.
- Motoqueiro envia `driver:location` a cada poucos segundos quando online.
- Servidor envia: `ride:offer`, `ride:offer_expired`, `ride:update`,
  `driver:location` (para o passageiro da corrida e para a central),
  `drivers:update` (central).

## Telas

**Passageiro:** cadastro/login; mapa com origem (GPS ou toque) e destino
(busca de endereço ou toque); preço estimado; forma de pagamento; observação;
acompanhamento com posição do motoqueiro, nome, moto e placa; botão ligar;
cancelar; avaliar de 1 a 5; histórico.

**Motoqueiro:** cadastro (fica pendente até a central aprovar); botão
online/offline; oferta em tela cheia com som, vibração e contagem regressiva;
aceitar/recusar; botões cheguei / iniciar / finalizar; abrir rota no app de
mapas; ligar para o passageiro; ganhos do dia e histórico.

**Central:** mapa ao vivo dos motoqueiros e corridas; lista de corridas ativas;
nova corrida (nome, telefone, origem, destino, automático ou motoqueiro
escolhido); cancelar/reatribuir; motoqueiros (aprovar, bloquear, ver dados);
relatórios (corridas, faturamento e comissão por período e por motoqueiro);
configurações de preço e da cidade.

## Erros e segurança

- API responde JSON `{ error }` com código HTTP adequado; as telas mostram a
  mensagem em português.
- Senhas com bcrypt; JWT com validade de 30 dias; rotas protegidas por papel.
- Validação de entrada no servidor (coordenadas, telefone, campos obrigatórios).
- Limite simples de tentativas de login por IP.
- Reconexão automática do tempo real; ao reconectar a tela recarrega o estado.
- Motoqueiro que some por mais de 2 minutos deixa de receber ofertas.

## Testes

`node:test` com banco em memória:
- preço (mínimo, arredondamento, valores configurados);
- dispatch (mais próximo, recusa, expiração, sem candidatos, atribuição manual);
- ciclo da corrida (transições válidas e inválidas, permissões, cancelamentos);
- API (cadastro, login, papéis, fluxo completo de uma corrida).

Verificação final no navegador com as três telas rodando uma corrida completa.

## Fora da v1

Pagamento dentro do app, notificação push com o app fechado, publicação nas
lojas, corrida agendada, entregas, cupons, chat interno, vários atendentes com
permissões diferentes.
