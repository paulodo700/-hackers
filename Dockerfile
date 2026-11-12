# Imagem do servidor para hospedagem (Railway, Fly.io, VPS com Docker...).
FROM node:22-bookworm-slim

WORKDIR /app

# Só as dependências de produção.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public

# O banco de dados fica em /data, que deve ser um disco persistente (volume) da hospedagem.
ENV NODE_ENV=production \
    DB_PATH=/data/mototaxi.db \
    TRUST_PROXY=1 \
    PORT=3000

EXPOSE 3000
CMD ["node", "server/index.js"]
