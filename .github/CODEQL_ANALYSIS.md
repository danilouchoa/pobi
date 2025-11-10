# CodeQL Security Analysis - POBI Project

## 📋 Visão Geral

CodeQL analisa automaticamente o código TypeScript/JavaScript do backend e frontend para identificar vulnerabilidades de segurança.

## 🎯 O que é Analisado

### Backend (`backend/src`)
- **Express.js APIs** - Vulnerabilidades em rotas e middlewares
- **Prisma queries** - SQL injection, query performance
- **Authentication** - JWT, bcrypt, session management
- **Redis operations** - Cache poisoning, data leaks
- **RabbitMQ** - Message injection, deserialization
- **Environment variables** - Secrets exposure

### Frontend (`frontend/src`)
- **React components** - XSS, unsafe rendering
- **API calls** - CSRF, improper authentication
- **State management** - Data exposure
- **Form handling** - Input validation
- **Material-UI** - Component security

## 🔍 Vulnerabilidades Detectadas

### High Severity
- ❌ **SQL Injection** - Queries não parametrizadas
- ❌ **Command Injection** - Execução de comandos não sanitizados
- ❌ **Path Traversal** - Acesso a arquivos fora do escopo
- ❌ **Hardcoded Secrets** - Senhas, tokens, API keys no código
- ❌ **Prototype Pollution** - Manipulação de prototypes JavaScript
- ❌ **XXE (XML External Entity)** - Parse inseguro de XML
- ❌ **Deserialization** - Unmarshalling não seguro

### Medium Severity
- ⚠️ **XSS (Cross-Site Scripting)** - Injeção de HTML/JS
- ⚠️ **CSRF (Cross-Site Request Forgery)** - Requisições não autorizadas
- ⚠️ **Open Redirect** - Redirecionamentos não validados
- ⚠️ **Information Disclosure** - Vazamento de dados sensíveis
- ⚠️ **Weak Cryptography** - Algoritmos fracos (MD5, SHA1)
- ⚠️ **Insecure Randomness** - Math.random() para segurança
- ⚠️ **RegEx DoS** - Regex patterns vulneráveis

### Low Severity
- ℹ️ **Code Quality** - Anti-patterns, código duplicado
- ℹ️ **Performance** - Loops ineficientes, memory leaks
- ℹ️ **Maintainability** - Complexidade ciclomática alta

## 📊 Queries Executadas

### Security Extended
- CWE-078: OS Command Injection
- CWE-079: Cross-site Scripting (XSS)
- CWE-089: SQL Injection
- CWE-200: Information Exposure
- CWE-311: Missing Encryption
- CWE-327: Broken Cryptography
- CWE-352: CSRF
- CWE-400: Resource Exhaustion
- CWE-502: Deserialization
- CWE-798: Hardcoded Credentials

### Security and Quality
- Todas as queries acima +
- Code quality metrics
- Performance anti-patterns
- Maintainability issues

## 🚀 Como Funciona

### Triggers
1. **Push para `main`** - Escaneia código alterado
2. **Pull Request** - Valida antes do merge
3. **Schedule** - Toda semana (domingos 21:33 UTC)

### Workflow
```yaml
1. Checkout código
2. Setup Node.js 20
3. Install dependencies (backend/frontend)
4. Initialize CodeQL
5. Analyze código
6. Upload resultados para GitHub Security
```

## 📈 Visualizando Resultados

### GitHub Security Tab
1. Acesse: `https://github.com/danilouchoa/pobi/security/code-scanning`
2. Veja alertas por severidade
3. Filtre por branch, tipo, CWE
4. Marque como "falso positivo" se necessário

### Pull Request Checks
- ✅ **Pass** - Nenhuma nova vulnerabilidade
- ❌ **Fail** - Vulnerabilidades críticas encontradas
- ⚠️ **Warning** - Vulnerabilidades médias encontradas

## 🛠️ Configuração

### Arquivo Principal
`.github/workflows/codeql.yml`
- Define triggers (push, PR, schedule)
- Configura matrix (backend/frontend)
- Setup Node.js e dependências
- Executa análise separada por projeto

### Arquivo de Config
`.github/codeql/codeql-config.yml`
- Define queries customizadas
- Paths incluídos/excluídos
- Filtros de severidade
- Timeout e configurações avançadas

## 🔧 Manutenção

### Atualizar Queries
```yaml
queries:
  - uses: security-extended
  - uses: security-and-quality
  - uses: custom-queries  # Adicionar custom
```

### Excluir Falsos Positivos
No arquivo `codeql-config.yml`:
```yaml
query-filters:
  - exclude:
      id: js/sql-injection
      paths:
        - backend/src/specific-file.ts
```

### Ajustar Severidade
```yaml
query-filters:
  - include:
      severity:
        - critical
        - high
        - medium
```

## 📚 Recursos

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [JavaScript Queries](https://codeql.github.com/codeql-query-help/javascript/)
- [TypeScript Support](https://codeql.github.com/docs/codeql-language-guides/codeql-for-javascript/)
- [CWE Database](https://cwe.mitre.org/)

## ⚡ Performance

- **Análise Backend**: ~2-3 minutos
- **Análise Frontend**: ~2-3 minutos
- **Total**: ~5-6 minutos
- **Cache**: Node.js dependencies são cacheados

## 🎯 Próximos Passos

- [ ] Adicionar custom queries específicas do projeto
- [ ] Configurar notificações Slack/Discord
- [ ] Integrar com SonarQube
- [ ] Adicionar análise de dependências (Dependabot)
- [ ] Configurar SAST adicional (Semgrep, ESLint Security)
