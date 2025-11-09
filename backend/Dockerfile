# ============================
# Stage 1: Builder
# ============================
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

RUN npx prisma generate

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ============================
# Stage 2: Runtime
# ============================
FROM node:20-slim

WORKDIR /app

# Instalar dependências do sistema necessárias para produção
# - ca-certificates: Certificados SSL para HTTPS
# - openssl: Requerido pelo Prisma
# - curl: Para healthchecks do Docker Compose
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl curl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
EXPOSE 4000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./

CMD ["node", "dist/index.js"]
