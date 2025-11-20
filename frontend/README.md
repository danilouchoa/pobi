# Frontend · Finance App (F0-02)

## Tabela de Conteúdos
- [1. Overview](#1-overview)
- [2. Stack](#2-stack)
- [3. Scripts](#3-scripts)
- [4. Estrutura de Pastas](#4-estrutura-de-pastas)
- [5. Convenções de UI e Estado](#5-convenções-de-ui-e-estado)
- [6. Autenticação](#6-autenticação)
- [7. Consumo da API](#7-consumo-da-api)
- [8. Navegação Mensal e Billing](#8-navegação-mensal-e-billing)
- [9. Testes](#9-testes)
- [10. Troubleshooting](#10-troubleshooting)
- [11. Roadmap](#11-roadmap)

## 1. Overview
Frontend em React 18 + Vite com design system MUI, controle de estado remoto via TanStack Query e autenticação segura baseada em access token em memória e refresh token em cookie httpOnly. O projeto segue organização por feature, com services REST tipados, interceptors Axios e toasts globais pelo notistack. Storybook cobre componentes de UI e a suíte de testes roda em Vitest + React Testing Library.

## 2. Stack
- **React 18 + Vite**: build rápido, HMR e bundling otimizado.
- **MUI Design System**: componentes padronizados com tema unificado.
- **TanStack Query**: cache e sincronização de dados por chave (`queryKeys` centralizado).
- **Autenticação httpOnly**: access token mantido em memória; refresh token persistido em cookie httpOnly.
- **Axios + interceptors**: injeção automática de headers, renovação de token e tratamento uniforme de erros.
- **notistack**: toasts globais com `SnackbarProvider` e helpers de feedback.
- **Storybook**: catálogo interativo de componentes e variações de estado.
- **Testes**: Vitest + React Testing Library com cobertura de hooks e componentes.

## 3. Scripts
- `npm run dev`: inicia Vite com HMR.
- `npm run build`: gera build de produção.
- `npm run preview`: serve o build gerado para validação.
- `npm run test:unit`: executa testes unitários (Vitest).
- `npm run coverage`: executa testes com cobertura.
- `npm run lint`: analisa linting com ESLint.
- `npm run storybook`: sobe Storybook em desenvolvimento.
- `npm run build-storybook`: gera Storybook estático para publicação.

## 4. Estrutura de Pastas
Organização feature-based, mantendo isolamento de UI, hooks e serviços. Pastas principais:
- `src/pages/`: páginas de alto nível por feature.
- `src/components/`: componentes compartilhados (ex.: `components/ui`, `components/feedback`).
- `src/hooks/`: hooks reutilizáveis por domínio (ex.: auth, expenses, billing).
- `src/services/`: clientes REST tipados por feature (expenses, catalogs, salary, auth).
- `src/context/`: providers de sessão e cache.
- `src/lib/` e `src/utils/`: helpers de datas, billing e formatação.
- `src/ui/`: átomos e padrões de feedback.
- `src/types/`: DTOs e contratos de API.
- `src/stories/`: Storybook organizado por componente/feature.

## 5. Convenções de UI e Estado
- **Organização por features**: páginas e serviços seguem o mesmo domínio para facilitar descoberta.
- **`components/` e `hooks/`**: UI reutilizável fica em `components/`; lógica de dados/efeitos em `hooks/` para testabilidade.
- **`queryKeys` centralizado**: arquivo único define chaves de cache; todas as queries/mutações reutilizam o prefixo para garantir invalidação consistente.
- **UX de exclusão de parcelas**:
  - **Bulk**: só permitido quando todas as parcelas selecionadas compartilham o mesmo `installment_group_id`; modal informa quantidade e confirma ação agrupada.
  - **Single**: ação direta na linha, mantendo o restante do grupo intacto; toasts refletem sucesso/erro e instruem recarregar cache quando necessário.
- **Feedback**: notistack padrão para sucesso/erro/info com mensagens legíveis vindas do backend.

## 6. Autenticação
- Login retorna access token (mantido em memória) e refresh token em cookie httpOnly (SameSite/secure conforme ambiente).
- Interceptor Axios injeta o access token nas chamadas autenticadas; em `401`, tenta refresh via cookie e repete a requisição original.
- Logout limpa tokens em memória e invalida o refresh cookie no backend; queries sensíveis são invalidadas após logout.

## 7. Consumo da API
- **Services REST tipados**: cada domínio expõe funções de fetch/mutation com DTOs em `src/services/*`.
- **Interceptors**: tratam baseURL, headers de auth, serialização de erros e mapeamento para mensagens de UI.
- **TanStack Query**: queries usam `queryKeys` e `select` para normalizar; mutações invocam `invalidateQueries` por `billingMonth` após alterações.

## 8. Navegação Mensal e Billing
- **MonthNavigator**: componente controla navegação temporal (NEXT/PREVIOUS) e sincroniza `billingMonth` global.
- **billingMonth**: propagado para hooks (`useExpenses`, `useCatalogs`, etc.) como chave de cache e parâmetro de API; mudanças disparam refetch e sincronizam withCredentials.

## 9. Testes
- Instale dependências e execute:
  ```bash
  npm ci
  npm run lint
  npm run coverage
  ```
- Testes cobrem componentes, hooks (incluindo fluxos de seleção/exclusão de parcelas) e serviços tipados.

## 10. Troubleshooting
- **Erro 401 recorrente**: verifique se o domínio do cookie permite `withCredentials`; rode login novamente para renovar refresh.
- **Cache desatualizado após deleção**: confirme que o `installment_group_id` das parcelas selecionadas é único e que a mutação invalidou o `queryKey` do `billingMonth` corrente.
- **Storybook não inicia**: cheque porta 6006 livre e execute `npm run storybook` após `npm ci`.
- **Build falha em CI**: execute `npm run lint` localmente; garanta variáveis `VITE_API_URL` e `VITE_AUTH_ORIGIN` configuradas.

## 11. Roadmap
- Ampliar cobertura de testes para fluxos de deleção agrupada e seleção parcial.
- Documentar exemplos avançados no Storybook (estados de erro e loading das tabelas de despesas).
- Adicionar monitoramento de performance com Web Vitals e traços de navegação por mês.
- Consolidar guia de migração para React 19 e futuras versões do MUI.
