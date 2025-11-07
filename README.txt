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


