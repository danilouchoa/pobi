# Fase 1: Build da Aplicação (se for TypeScript)
FROM node:20-alpine AS builder

WORKDIR /app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm ci

# Copia o schema do Prisma
COPY prisma ./prisma/

# Gera o Prisma Client
RUN npx prisma generate

# Copia o restante do código-fonte e compila
COPY . .
RUN npm run build

# Fase 2: Imagem de Produção
FROM node:20-alpine

WORKDIR /app

# Copia as dependências instaladas
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copia o código compilado (dist)
COPY --from=builder /app/dist ./dist

# Copia o schema do Prisma e o client gerado
COPY --from=builder /app/prisma ./prisma
COPY --from/builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

# Comando para rodar a aplicação compilada
CMD ["node", "dist/index.js"]