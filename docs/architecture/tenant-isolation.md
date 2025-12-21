# Tenant Isolation (Multi-tenant)

## Objetivo
Garantir isolamento total de dados entre usuários (LGPD/GDPR), com **userId sempre derivado no servidor** e comportamento consistente:
- **401** quando não autenticado.
- **404** quando o recurso não pertence ao usuário autenticado (evita enumeração de IDs).

## Fonte da verdade (server-derived userId)
- Nunca confiar em `userId` vindo do cliente.
- Usar o valor derivado do servidor (`req.auth.userId`).
- Rotas devem usar utilitários centralizados para extração/validação.

**Helper padrão**
- `backend/src/utils/tenantScope.ts`
  - `getAuthUserId(req)`
  - `requireAuthUserId(req, res)`
  - `tenantWhere(userId)`
  - `notFound(res)`

## Padrões de rota (backend)

### LIST (findMany / aggregate / groupBy)
Sempre adicionar escopo:
```ts
const userId = requireAuthUserId(req, res);
const items = await prisma.expense.findMany({
  where: { ...tenantWhere(userId), ...filters },
});
```

### GET por ID
Nunca usar `findUnique({ where: { id } })` sem escopo.
```ts
const item = await prisma.expense.findFirst({ where: { id, userId } });
if (!item) return notFound(res);
```

### CREATE
Ignorar `userId` do payload e forçar no servidor:
```ts
const { userId: _ignored, ...payload } = req.body;
await prisma.expense.create({ data: { ...payload, userId } });
```

### UPDATE / DELETE (ownership atômico)
```ts
const updated = await prisma.expense.updateMany({
  where: { id, userId },
  data,
});
if (updated.count === 0) return notFound(res);
```

### Catálogos vinculados (origins/debtors)
Sempre validar ownership ao referenciar `originId`/`debtorId` em expenses.
Se não pertencer ao usuário, responder **404**.

## Seed/demo (dev/test only)
- Seed permitido somente em `development`/`test` ou com `SEED_DEMO=true`.
- Dados seed devem pertencer ao usuário demo: `demo@finfy.app`.
- Produção bloqueada por padrão.

## Frontend (React Query)
### Query keys escopadas por usuário
Todos os domínios sensíveis devem incluir `userId` nas keys:
- `expensesKeys.list({ userId, ... })`
- `catalogKeys.origins(userId)`
- `salaryKeys.allForUser(userId)`

### Logout e troca de sessão
Ao fazer logout:
1. `authBff.logout()`
2. `queryClient.clear()`
3. limpar estado local
4. redirecionar para `/auth/login`

## Testes obrigatórios
### Backend (Supertest)
- `/api/*` retorna **401** sem auth.
- Cross-tenant retorna **404** (GET/PUT/DELETE).
- Listas retornam vazio quando usuário não possui dados.
- `userId` no body é ignorado e sobrescrito pelo servidor.

### Frontend (Vitest)
- Login A -> dados A
- Logout -> cache limpo
- Login B -> dados B (sem “flash” de A)

---
**Regra de ouro:** toda query deve carregar `userId` do servidor e tudo que é sensível precisa ser escopado.
