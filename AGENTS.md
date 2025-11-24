# Sheet1

|codex_memory| | | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|---|---|
|project|version|description|milestones| | | | |last_action|session_achievements|next_steps|commit_template|
| | | |id|tag|status|summary|notes| | | | |
|Finance App Project|v6.7.0 (Parcelas Agrupadas + UX de Exclusão Segura)|Aplicação fullstack de controle financeiro (React + Express + Prisma + MongoDB + RabbitMQ + Upstash Redis + httpOnly Cookies), com foco em modularização, segurança, resiliência, validação robusta, autenticação segura e agora com fluxo de parcelas agrupadas (installment_group_id) e exclusão segura no frontend.|0|[BUG] Fatura de Cartão (closingDay + dia útil + billingMonth)|🟢 Concluído (Backend)|Classificar despesas de cartão na fatura correta com base no dia de fechamento (ajustado para dia útil), gravando billingMonth automaticamente.|Schema Origin com closingDay e billingRolloverPolicy (NEXT"|PREVIOUS).|Sessões até 18/11/2025: consolidadas integrações de segurança/CI (Qodana, gestão de secrets, pipelines estáveis) e iniciada refatoração da UX de exclusão de parcelas com foco em agrupamento por installment_group_id. Identificado bug no backend onde parcelas parceladas ainda são persistidas com installment_group_id nulo, apesar da lógica de agrupamento planejada.|Refinada a memória do projeto para refletir v6.7.0 com foco em parcelas agrupadas e exclusão segura.|Corrigir o fluxo de criação de despesas parceladas no backend para gerar um único installment_group_id e reutilizá-lo em todas as parcelas do mesmo lançamento.|• [Feature/Refactor/Fix/Security] Descrição da mudança. • Relacionado ao(s) Milestone(s): #[ID] • Verificado por: Qodana/Snyk/Semgrep/ZAP|
| | | | | | | |Campo Expense.billingMonth (YYYY-MM) com índice por userId + billingMonth.| |Definida a UX de exclusão de parcelas: seleção múltipla, validação de agrupamento e confirmação via modal.|Conectar o frontend à API de deleção de parcelas por agrupamento, garantindo que apenas parcelas com o mesmo installment_group_id sejam enviadas.| |
| | | | | | | |Helpers deriveBillingMonth() e adjustToBusinessDay() implementados no backend.| |Conectado o fluxo de exclusão de parcelas à camada de toasts e feedback visual existente.|Implementar testes unitários e de integração para useSelectedInstallments/useDeleteInstallments e para o endpoint de deleção em massa.| |
| | | | | | | |POST/PUT /api/expenses calculam billingMonth automaticamente; GET com mode=billing funcional.| |Diagnosticado o problema de backend que persiste installment_group_id como null em lançamentos parcelados, direcionando o próximo passo para correção da lógica de criação.|Revalidar os impactos da exclusão de parcelas no billingMonth, cache Redis e relatórios mensais.| |
| | | | | | | |Script de backfill para preencher billingMonth retroativo.| | |Aprofundar a integração dos scanners Semgrep/Snyk/ZAP na pipeline de segurança, fechando o ciclo de v6.7.0.| |
| | | | | | | |Enum de policy migrado e documentado em MIGRATION_ENUM_BILLING.md.| | |Planejar o ajuste de versão futura (ex.: v6.8.0) focada na estabilização completa de billing e cartões.| |
| | | | | | | |Frontend atualizado para lidar com NEXT/PREVIOUS nas origens.| | | | |
| | | | | | | |Frontend para mode=billing e UI de agrupamento por fatura ainda em evolução.| | | | |
| | | |1|[BUG] Replicação e idempotência|🟢 Resolvido|Eliminar duplicações de lançamentos recorrentes garantindo idempotência.|Fingerprint único por recorrência com índice único no banco.| | | | |
| | | | | | | |Backfill idempotente executado sem criar duplicados.| | | | |
| | | | | | | |Critério de aceite: reprocessar fila sem gerar lançamentos repetidos.| | | | |
| | | |2|[DB] Float → String precision|🟢 Concluído|Evitar erros de arredondamento em valores monetários usando string ao invés de float.|Valores monetários persistidos como string ('0.00') com parsing centralizado.| | | | |
| | | | | | | |Helpers dedicados para conversão e comparação monetária determinística.| | | | |
| | | | | | | |Testes cobrindo casos de arredondamento e soma de múltiplas parcelas.| | | | |
| | | |3|[API] Security & Config ENV|🟢 Concluído|Endurecer configuração e headers de segurança na API.|Validação de ENVs críticos com Zod.| | | | |
| | | | | | | |Helmet configurado com headers de segurança padrão.| | | | |
| | | | | | | |CORS dinâmico com allowlist por ambiente.| | | | |
| | | | | | | |Boot da aplicação falha se ENVs obrigatórios estiverem ausentes.| | | | |
| | | |4|[Worker] RabbitMQ Robustness|🟢 Concluído|Resiliência no processamento assíncrono de jobs recorrentes.|Reconexão com backoff exponencial.| | | | |
| | | | | | | |Uso de ConfirmChannel e prefetch(10).| | | | |
| | | | | | | |Shutdown limpo dos workers.| | | | |
| | | | | | | |Critério de aceite: worker estável em cenários de queda do broker.| | | | |
| | | |5|[API] Índices e filtros UTC|🟢 Implementado|Normalizar consultas mensais por UTC para evitar desvios de timezone.|Índices criados por userId + date.| | | | |
| | | | | | | |Filtros mensais utilizando Date.UTC centralizado.| | | | |
| | | | | | | |Mesma query retorna os mesmos dados independentemente do timezone do host.| | | | |
| | | |6|[FE] MUI Only Theme|🟢 Implementado|Unificar o design system em MUI, removendo resíduos de Tailwind.|ThemeProvider central com paleta e tipografia padronizadas.| | | | |
| | | | | | | |Componentes migrados para MUI; classes Tailwind removidas.| | | | |
| | | | | | | |UI consistente nas principais telas (dashboard, lançamentos, cadastros).| | | | |
| | | |7|[FE] Hooks Tipados + Query Cache|🟢 Concluído|Refatorar useFinanceApp em hooks modulares com TanStack Query e serviços REST tipados.|Hooks criados: useExpenses, useCatalogs, useSalary, etc.| | | | |
| | | | | | | |Query keys centralizadas em queryKeys.ts.| | | | |
| | | | | | | |Axios com interceptors e tipagem forte de DTOs.| | | | |
| | | | | | | |Cache por mês com invalidação após mutações.| | | | |
| | | |8|[FE/BE] Navegação mensal + Cache Redis + Build Estabilizado|🟢 Concluído|Navegação temporal suave, cache distribuído em Redis e build Docker estável com Prisma.|MonthNavigator com animações (Framer Motion).| | | | |
| | | | | | | |Upstash Redis por usuário/mês com logs de [CACHE HIT/MISS].| | | | |
| | | | | | | |Docker multi-stage com prisma generate no builder e assets corretos no runtime.| | | | |
| | | | | | | |Todos os containers com healthcheck saudável.| | | | |
| | | |9|[FE] Toasts & Empty States|🟢 Concluído|Toasts consistentes e empty states padronizados em todas as telas CRUD.|notistack configurado globalmente com SnackbarProvider.| | | | |
| | | | | | | |Hook useToast() com helpers success/error/info/warning e debounce.| | | | |
| | | | | | | |Componente EmptyState reutilizável com título, descrição, CTA e ícone.| | | | |
| | | | | | | |Erros de backend traduzidos em mensagens legíveis com mapBackendError().| | | | |
| | | | | | | |Integrado em lançamentos, cadastros, salário e demais fluxos CRUD.| | | | |
| | | |10|[DX] Healthchecks e Docker Prod|🟢 Concluído|Observabilidade básica e robustez de execução em contêineres.|Endpoint /api/health checando Mongo, Redis e RabbitMQ com latência.| | | | |
| | | | | | | |Status HTTP 200/503 conforme saúde dos serviços.| | | | |
| | | | | | | |Healthchecks Docker configurados para backend, workers e Mongo.| | | | |
| | | | | | | |Depends_on com condition: service_healthy em docker-compose.| | | | |
| | | | | | | |Endpoint /ready preparado para futuramente servir como readiness probe em Kubernetes.| | | | |
| | | |11|[Security] Validação de Rota (Zod)|🟢 Concluído|Validação completa de entrada (body/query/params) usando Zod.|Schemas criados para expense, origin, auth, salary e catálogo.| | | | |
| | | | | | | |Middleware genérico validation.ts aceitando body/query/params.| | | | |
| | | | | | | |Feature flag VALIDATION_ENABLED para rollback rápido.| | | | |
| | | | | | | |Erros 400 com payload padronizado e sem stack-trace.| | | | |
| | | | | | | |Validações monetárias e de ObjectId centralizadas.| | | | |
| | | | | | | |Sistema estabilizado após correções v6.2.1 (queryExpenseSchema, req.query).| | | | |
| | | |13|[Security] Auth httpOnly Cookies|🟢 Concluído|Migração de localStorage para cookies httpOnly com tokens em memória e refresh automático.|Arquitetura de 2 tokens: access (memória, curto prazo) + refresh (cookie httpOnly, 7 dias).| | | | |
| | | | | | | |Endpoints de auth (login, register, refresh, logout) com bcrypt + JWT.| | | | |
| | | | | | | |CORS configurado com credentials: true; frontend usa withCredentials.| | | | |
| | | | | | | |Proteção contra XSS (httpOnly) e CSRF (sameSite strict).| | | | |
| | | | | | | |Documentação detalhada no README com fluxos e troubleshooting.| | | | |
| | | |14|[BE] Dead Letter Queue (DLQ)|🟢 Concluído|DLQ implementada no RabbitMQ com retry, backoff e endpoints administrativos.|dead-letter-exchange configurado para filas críticas.| | | | |
| | | | | | | |Retry automático com backoff exponencial antes de DLQ.| | | | |
| | | | | | | |Endpoints admin para stats, listagem, reprocessamento e purge.| | | | |
| | | | | | | |Proteção JWT nestes endpoints.| | | | |
| | | | | | | |Workers bulk/recurring integrados à DLQ.| | | | |
| | | |15|[Refactor] Service/Repository Layer|🟡 Planejado|Separar responsabilidades em rotas, services e repositories.|Rotas focadas em validação e orquestração.| | | | |
| | | | | | | |Services contendo regras de negócio sem dependência direta de Prisma.| | | | |
| | | | | | | |Repositories encapsulando acesso ao banco.| | | | |
| | | | | | | |Refactor dependente da suíte de testes (#16) para segurança.| | | | |
| | | |16|[DX] Testes Automatizados|🟢 Concluído (Base) / 🟡 Em expansão em parcelas|Testes automatizados backend/frontend com foco em estabilidade e confiança; suites específicas para fluxo de parcelas ainda em evolução.|Backend com Vitest + Supertest para rotas e serviços principais.| | | | |
| | | | | | | |Frontend com React Testing Library + Vitest para componentes e hooks centrais.| | | | |
| | | | | | | |Cobertura mínima de ~80% nas áreas críticas (auth, expenses, billing).| | | | |
| | | | | | | |Mocks centralizados, clock global e seeds fixos.| | | | |
| | | | | | | |Pendência: testes unitários e de integração específicos para useSelectedInstallments/useDeleteInstallments e exclusão agrupada de parcelas.| | | | |
| | | |18|[Security] Autenticação Avançada (MFA + Google Login)|🟡 Planejado|Adicionar MFA e login social com Google OAuth2 sobre a base de httpOnly cookies.|Botão 'Entrar com o Google' previsto na tela de login.| | | | |
| | | | | | | |Integração planejada com SDK oficial Google Sign-In.| | | | |
| | | | | | | |Endpoint /auth/google para validação de token/código no backend.| | | | |
| | | | | | | |MFA opcional via envio de OTP (ex.: Resend) planejado.| | | | |
| | | | | | | |Critério de aceite: fluxo end-to-end funcional com Google e MFA opcional.| | | | |
| | | |19|[DX] Atualização Automática de Dependências|🟢 Concluído|Dependabot diário com auto-label e auto-merge condicional.|dependabot.yml configurado para backend e frontend.| | | | |
| | | | | | | |Labels automáticas para PRs de dependência.| | | | |
| | | | | | | |Workflow de auto-merge condicionado a CI verde e checks de segurança.| | | | |
| | | | | | | |Objetivo: manter libs críticas sempre atualizadas.| | | | |
| | | |20|[DX] CI Pipeline (Backend & Frontend)|🟢 Concluído|Pipelines GitHub Actions para backend e frontend com lint, build, testes e proteção de branch.|Workflows separados para backend e frontend.| | | | |
| | | | | | | |Node 20 com cache de dependências.| | | | |
| | | | | | | |Execução de lint, build/tsc e testes com cobertura.| | | | |
| | | | | | | |Checks requeridos antes de merge em main e integração com Dependabot.| | | | |
| | | |21|[Security/DX] Qodana, Semgrep, Snyk e OWASP ZAP Integrados|🟡 Em progresso|Integração de ferramentas de análise estática e dinâmica de segurança (SAST/DAST) nos pipelines.|Qodana JS integrado em workflow dedicado com comentários em PR.| | | | |
| | | | | | | |Findings iniciais mapeados (lint, possíveis secrets e má práticas).| | | | |
| | | | | | | |Semgrep configurado para regras de injeção, SSRF, secrets e XSS (tuning em andamento).| | | | |
| | | | | | | |Snyk integrado para análise de vulnerabilidades em dependências.| | | | |
| | | | | | | |Planejada integração de ZAP para DAST em ambiente de staging.| | | | |
| | | | | | | |Falhas High/Critical tendem a bloquear merge após calibração.| | | | |
| | | | | | | |Documentação inicial em SECURITY_SCANNERS.md.| | | | |
| | | |22|[Security] Gestão de Secrets e ENVs|🟢 Concluído (Fase 1)|Centralização de segredos em GitHub Secrets e padronização de .env.|Tokens, keys e conexões migrados para GitHub Secrets.| | | | |
| | | | | | | |Workflows atualizados para consumir secrets em vez de valores hardcoded.| | | | |
| | | | | | | |Template .env.example revisado com placeholders claros.| | | | |
| | | | | | | |Logs de CI mascarando dados sensíveis.| | | | |
| | | | | | | |Próxima fase: integração direta de secrets em manifests Kubernetes.| | | | |
| | | |23|[CI/CD] Continuous Deployment no Kubernetes (OCI OKE)|🟡 Em Progresso|CD automatizado no cluster OKE com pipelines GitHub Actions.|Deploy via GitHub Actions com kubectl/Helm apontando para OKE.| | | | |
| | | | | | | |Imagens publicadas no OCIR com autenticação por secrets.| | | | |
| | | | | | | |Namespaces de staging e production definidos.| | | | |
| | | | | | | |Estratégia básica de rollback via Helm/kubectl rollout.| | | | |
| | | | | | | |GitOps pleno e Canary planejados para próxima fase.| | | | |
| | | |24|[Security] GitOps & Canary Strategy|🟡 Planejado|Adotar GitOps (ArgoCD/FluxCD) com Canary Deploy em produção.|Meta de ter configuração declarativa de ambientes.| | | | |
| | | | | | | |Canary deploy para promoções progressivas de versões.| | | | |
| | | | | | | |Rollback automatizado baseado em métricas de saúde.| | | | |
| | | | | | | |Integração futura com stack de observabilidade (Prometheus/Grafana/Loki).| | | | |
| | | |25|[DX/Security] Código Seguro e Ocultação de Variáveis|🟢 Concluído|Remoção de secrets hardcoded e padronização de uso de process.env.|Variáveis sensíveis removidas do código e substituídas por ENVs.| | | | |
| | | | | | | |Fixtures seguros para testes no lugar de credenciais de exemplo.| | | | |
| | | | | | | |Repositório higienizado (histórico crítico sanitizado).| | | | |
| | | | | | | |Guia SAFE_ENV_CODING_GUIDE.md documentando boas práticas.| | | | |
| | | |26|[FE/BE] Parcelas Agrupadas + Exclusão Segura (installment_group_id)|🟡 Em Progresso (Frontend avançado, Backend ajustando agrupamento)|Implementar fluxo de criação e exclusão de parcelas com agrupamento por installment_group_id, garantindo UX fluida e segurança na deleção em lote.|Frontend refatorado para permitir seleção de uma ou múltiplas parcelas via checkboxes.| | | | |
| | | | | | | |Botão de exclusão inteligente: adapta o rótulo para singular/plural conforme quantidade selecionada.| | | | |
| | | | | | | |Validação no frontend para garantir que apenas parcelas com o mesmo installment_group_id sejam excluídas em conjunto.| | | | |
| | | | | | | |Planejado modal de confirmação com resumo de quantidade de parcelas e agrupamento antes da deleção.| | | | |
| | | | | | | |UX com toasts de sucesso/erro aproveitando infraestrutura do Milestone #9.| | | | |
| | | | | | | |Bug identificado no backend: parcelas sendo criadas com installment_group_id = null; investigação focada no service de criação de despesas parceladas.| | | | |
| | | | | | | |Próximos passos: corrigir geração única do installment_group_id no backend e criar testes unitários para useSelectedInstallments e useDeleteInstallments.| | | | |
| | | | | | | |Objetivo final: exclusão em massa segura, coerente com billingMonth e sem riscos de apagar parcelas erradas.| | | | |
# Sheet2
g
|codex_memory| | | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|---|---|
|project|version|description|milestones| | | | |last_action|session_achievements|next_steps|commit_template|
| | | |id|tag|status|summary|notes| | | | |
|Finance App Project|v6.7.1 (Hotfix: Exclusão Unitária vs Agrupada)|Aplicação fullstack de controle financeiro (React + Express + Prisma + MongoDB + RabbitMQ + Upstash Redis + httpOnly Cookies), com foco em modularização, segurança, resiliência, validação robusta, autenticação segura e fluxo de parcelas agrupadas.|0|[BUG] Fatura de Cartão (closingDay + dia útil + billingMonth)|🟢 Concluído (Backend)|Classificar despesas de cartão na fatura correta com base no dia de fechamento (ajustado para dia útil), gravando billingMonth automaticamente.|Schema Origin com closingDay e billingRolloverPolicy (NEXT / PREVIOUS).|Sessões até 19/11/2025: iniciada correção completa do fluxo de exclusão de parcelas. Identificado bug crítico: mesmo escolhendo “Excluir só esta parcela”, o backend executava delete em cascata, removendo todo o grupo. Diagnosticado que rotas e services utilizavam exclusivamente `deleteExpenseCascade`. Mapeado plano de correção com separação backend: delete unitário (novo) vs delete por grupo. Frontend precisará ajustar rótulos, modal e lógica do botão de bulk delete.|Frontend já validado para abrir modal corretamente (ícone de lixeira). Backend pendente de ajuste do delete unitário. Planejada reescrita do fluxo de bulk delete garantindo consistência entre seleção parcial / seleção completa. Toggle de segurança (SECURITY_MODE) ainda pendente de implementação final.|Implementar `deleteSingleExpense()` no backend. Atualizar rota `DELETE /expenses/:id` para ação estritamente unitária. Manter `DELETE /expenses/group/:id` para exclusão integral. Reescrever `applyBulkDelete()` para interpretar corretamente grupos completos vs incompletos. Ajustar frontend para: (1) rótulo dinâmico, (2) modal correto, (3) diferenciação total/parcelada. Em seguida, validar Redis invalidation por item/grupo.|• [Feature/Refactor/Fix/Security] Descrição. • Relacionado ao(s) Milestone(s): #[ID] • Verificado por: Qodana/Snyk/Semgrep/ZAP|
| | | | | | | |Campo Expense.billingMonth (YYYY-MM) com índice por userId + billingMonth.| |UX de exclusão granular definida.|Criar testes automatizados específicos para exclusão unitária e exclusão em grupo.| |
| | | | | | | |Helpers deriveBillingMonth() e adjustToBusinessDay() implementados.| |Fluxo com toasts integrado; UX confirmada.|Revalidar impactos em billingMonth e no cache Redis após hotfix.| |
| | | | | | | |POST/PUT /api/expenses calculam billingMonth automaticamente; GET com mode=billing funcional.| |Investigação concluída: backend errava ao sempre cascatar.|Conferir consistência entre deleções parciais vs integrais.| |
| | | | | | | |Script de backfill para preencher billingMonth retroativo.| | |Aprimorar scanners Semgrep/Snyk/ZAP e incluir regras para cascatas indevidas.| |
| | | | | | | |Enum migrado e documentado em MIGRATION_ENUM_BILLING.md.| | |Planejar incremento v6.8 com foco em billing resiliente.| |
| | | | | | | |Frontend atualizado para NEXT/PREVIOUS.| | | | |
| | | | | | | |UI de agrupamento de fatura ainda em evolução.| | | | |
| | | |26|[FE/BE] Parcelas Agrupadas + Exclusão Segura (installment_group_id)|🟡 Em progresso (Frontend refinado / Backend corrigindo deleção)|Implementar fluxo de criação e exclusão de parcelas com agrupamento por installment_group_id, garantindo UX fluida e segurança na deleção.|Frontend implementou corretamente: modal para 1 parcela vs grupo, seleção múltipla com checkboxes, rótulo dinâmico em construção.| | | | |
| | | | | | | |Botão de exclusão inteligente: adapta para singular/plural.| |Bug detectado: backend sempre apagava o grupo.|Backend deverá criar delete unitário e reescrever bulk delete.| |
| | | | | | | |Validação para garantir que apenas parcelas do mesmo grupo sejam apagadas em conjunto.| |Fluxo real mapeado: granularidade por item, parcial, ou total.|Testar efeitos colaterais em billingMonth/Redis.| |
| | | | | | | |Modal com confirmação clara antes da deleção.| | | | |
| | | | | | | |Próximos passos: finalizar delete unitário e ruleset do bulk delete.| | | | |
| | | |27|[Security/DX] Toggle de Segurança Dev vs Prod|🟡 Em progresso|Introduzir flag SECURITY_MODE para alternar entre modo relaxado (dev) e estrito (prod).|Estrutura conceitual definida; Express 5 exige remoção total de rotas wildcard.| | | | |
| | | | | | | |Garantir CORS+helmet funcionais em modo relaxado sem quebrar build.| |Necessário aplicar CORS global sem app.options(*).|Implementar SECURITY_MODE="relaxed" (CORS aberto) e "strict" (CORS restrito + rate limiting).| |

## 2025-11-22 - Mongo replica set para Prisma
- MongoDB agora inicia como replica set rs0 (3 nós host: 27017/27018/27019) com serviço de init idempotente compartilhando o namespace da instância para rodar `rs.initiate`.
- `DATABASE_URL` aponta para `localhost:27017,localhost:27018,localhost:27019` com `replicaSet=rs0&retryWrites=true&w=majority`, habilitando transações do Prisma.
- Seed (`npm run seed`) validado para usuário padrão `danilo.uchoa@finance.app` / `finance123` em ambiente com rede de containers funcional, permitindo login.

## 2025-11-23 - Login estateless via frontend
- Corrigida configuração local do frontend: `VITE_API_URL` agora aponta para `http://localhost:4000` (antes estava `http://localhost:3000` e causava requisições para porta morta com status 0 no navegador).
- Login validado end-to-end no fluxo React → API usando usuário seed `danilo.uchoa@finance.app / finance123`.
- Tratamento de erro do login diferencia falha de conexão (backend fora do ar/CORS) de credenciais inválidas.
- Script `backend/scripts/debug-login.ts` documentado como utilitário de desenvolvimento para validar credenciais direto no banco usando mesma normalização/bcrypt do backend.

## 2025-11-23 - UX-02A Auth Design System Hardening
- Tokens de Auth centralizados em `frontend/src/ui/tokens.ts` e aplicados globalmente via `TokenProvider`/variáveis CSS `--finfy-*` para reutilização além do domínio de Auth.
- Componentes de Auth (`Button`, `TextField`, `FormField`, `Card`, `Alert`) alinhados ao guia `docs/ux/auth-benchmark-and-principles.md`, com foco em labels persistentes, estados de foco acessíveis e mensagens inline de erro/ajuda.
- Warnings conhecidos: aviso de chunk >500 kB em `npm run build`/`npm run build-storybook` e aviso do builder do Storybook sobre `@mui/icons-material` (pacote presente). Detalhes em `docs/ux/auth-design-system-notes.md`. `npm audit` sem vulnerabilidades altas registradas em `frontend/audit-report.json`.
