# Finance App (React + CSV Export)

- `finance_app.html`: versão standalone (abre no navegador, sem build).
- `FinanceApp.jsx`: componente principal para usar em projetos React.

## Rodar
- Standalone: abra `finance_app.html` (usa CDNs de React/Tailwind).
- Projeto React (Vite/CRA): importe `FinanceApp.jsx` e renderize em `App.jsx`.

## Observações
- Persistência em `localStorage`.
- Exportação CSV com `;` e BOM para Power BI.
- Alíquota default 6% (editável).

## Backend (Docker)
- Configure `backend/.env` com `DATABASE_URL` usando o formato SRV do MongoDB Atlas (com TLS).
- Após qualquer alteração rode `docker compose build --no-cache backend worker && docker compose up -d`.
- Para validar a conexão execute `docker compose exec backend npm run health:db`.

### Fechamento de cartões e faturas (billing)
- Cada origem do tipo **Cartão** possui agora `closingDay` (1..31) e `billingRolloverPolicy` (`NEXT_BUSINESS_DAY` ou `PREVIOUS_BUSINESS_DAY`). Sem esses dados não é possível lançar novas despesas nesse cartão (o backend responde 422).
- Despesas de cartão recebem automaticamente o campo `billingMonth` (`YYYY-MM`) calculado a partir da data do lançamento e da política do cartão. Basta enviar `mode=billing&month=YYYY-MM` em `GET /api/expenses` para obter as faturas. O modo padrão continua sendo `calendar` (baseado na data do lançamento).
- Para recalcular o campo em dados antigos execute `cd backend && npm run billing:backfill`. O script percorre cartões com `billingMonth` vazio, recalcula e invalida o cache Redis das faturas impactadas.

### Paginação + edição em massa
- `GET /api/expenses` aceita `page` e `limit` (padrão 20) e responde `{ data, pagination }`. O cache Redis é chaveado por mês/mode/página (`finance:expenses:<mode>:<user>:<YYYY-MM>:pX:lY`).
- `POST /api/expenses/bulkUpdate` agenda atualizações em lote publicando na fila `bulk-jobs`. O backend responde `{ jobId, status: "queued" }` imediatamente e o worker `bulk-worker` aplica as alterações usando `prisma.expense.updateMany`.
