# Ambiente de Desenvolvimento

Este guia resume como subir o ambiente local completo (API, frontend e workers) utilizando Docker Compose com MongoDB em replica set, RabbitMQ e Redis saudáveis.

## Subir os serviços

```bash
docker compose up -d --build
```

Serviços incluídos:
- **mongo**: MongoDB 7 rodando como replica set de 1 nó (`rs0`).
- **mongo-init-replica**: job auxiliar que inicializa o replica set (encerra após executar).
- **rabbitmq**: broker com painel em http://localhost:15672.
- **redis**: cache TCP padrão na porta 6379.
- **backend**: API Express/Prisma com healthcheck em `/api/status`.
- **worker** e **bulk-worker**: consumidores RabbitMQ para jobs recorrentes e operações em lote.
- **frontend**: React/Vite na porta 5173.

Os serviços `backend`, `worker` e `bulk-worker` só iniciam após Mongo, RabbitMQ e Redis estarem saudáveis; Mongo depende do init do replica set.

## Variáveis de ambiente principais

No `backend/.env.example` estão os valores de referência. Principais chaves para desenvolvimento local:

- `DATABASE_URL` = `mongodb://mongo:27017/finance_app_db?replicaSet=rs0` (use `localhost` se rodar a API fora do Docker).
- `RABBIT_URL` = `amqp://rabbitmq:5672` (use `localhost:5672` fora do Docker).
- `REDIS_URL` = `redis://redis:6379` (use `localhost:6379` fora do Docker).
- `ENABLE_DEV_SEED` = `true` apenas quando quiser popular dados de desenvolvimento.

Google OAuth e demais segredos continuam obrigatórios conforme `.env.example`.

## Seed de desenvolvimento

Para popular um usuário padrão de desenvolvimento (somente em ambientes locais):

```bash
cd backend
ENABLE_DEV_SEED=true npm run seed
```

O seed é bloqueado em produção e encerra silenciosamente se `ENABLE_DEV_SEED` não estiver definido como `true`.

## Troubleshooting rápido

- **Erro `P2031` no Prisma**: certifique-se de que o replica set subiu (veja o container `mongo-init-replica` finalizado com status 0) e que `DATABASE_URL` contém `replicaSet=rs0`.
- **Timeout em RabbitMQ/Redis**: confira se os serviços estão `Up` via `docker compose ps` e se as URLs nas variáveis de ambiente apontam para `rabbitmq` e `redis` respectivamente.
- **Workers parando ao subir**: eles aguardam as dependências ficarem saudáveis; verifique os logs de RabbitMQ/Redis/Mongo antes de reiniciar.
