# ============================
# Fase 1: Build da Aplicação
# ============================
FROM node:20-slim AS builder

WORKDIR /app

# Instala dependências de build do Prisma e certificados
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências
COPY package*.json ./
RUN npm ci

# Copia o schema do Prisma e gera o client
COPY prisma ./prisma/
RUN npx prisma generate

# Copia o restante do código e compila TypeScript
COPY . .
RUN npm run build

# ============================
# Fase 2: Produção
# ============================
FROM node:20-slim

WORKDIR /app

# Instala runtime necessário para Prisma e certificados TLS
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copia artefatos da build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

CMD ["node", "dist/index.js"]
