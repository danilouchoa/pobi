# UX-02A — Auth Design System Hardening Notes

- **Tokens e tema compartilhável**: novos tokens semânticos (cores, tipografia, raio, sombras e espaçamentos) vivem em `frontend/src/ui/tokens.ts` e podem ser aplicados via `TokenProvider`/`applyTokensToRoot` para expor as variáveis CSS `--finfy-*` globalmente.
- **Componentes alinhados ao guia**: `Button`, `TextField`, `FormField`, `Card` e `Alert` foram ajustados para labels persistentes, mensagens inline, estados de foco/erro acessíveis e feedback de loading, mantendo a API estável.
- **Storybook/Build**: os builds concluem com aviso de chunks grandes (>500 kB) e um warning de resolução do `@mui/icons-material` emitido pelo build do Storybook, apesar do pacote existir em `node_modules`. Mantido como ruído conhecido sem impacto funcional; monitorar caso o tooling atualize a resolução de pacotes.
- **npm audit**: `npm audit --json` (arquivo `frontend/audit-report.json`) não reportou vulnerabilidades de severidade alta ou crítica.
