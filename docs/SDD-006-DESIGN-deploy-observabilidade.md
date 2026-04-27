# DESIGN - SDD-006: Deploy + Observabilidade

> Projeto: Almox - Sistema de Gestao de Almoxarifado
> Modulo: 006 - Deploy + Observabilidade
> Status: DESIGN APROVADO
> Versao: 1.0
> Data: 2026-04-24
> SPEC base: [SDD-006-deploy-observabilidade.md](./SDD-006-deploy-observabilidade.md)

---

## 1. Decisoes tecnicas assumidas

Estas decisoes implementam as recomendacoes da SPEC. Se alguma for rejeitada, o DESIGN deve ser ajustado antes de codigo.

| ID | Decisao | Valor |
|----|--------|-------|
| D1 | Alvo inicial | Railway Node service + PostgreSQL gerenciado |
| D2 | Deploy inicial | API + frontend estatico no mesmo dominio quando possivel; fallback temporario com origens exatas via `CORS_ORIGIN` |
| D3 | Migrations | Criar baseline Prisma migration e usar `prisma migrate deploy` em producao |
| D4 | Observabilidade | Health/live + health/ready + logs estruturados + runbooks, sem APM externo |
| D5 | Dependencias npm novas | Zero |
| D6 | Docker de producao | Fora do MVP; usar build nativo do provedor |
| D7 | CI/CD | Checklist manual documentado; automacao futura fora deste SDD |
| D8 | Backups | Backup gerenciado quando disponivel + runbook `pg_dump`/restore como contingencia |

---

## 2. Visao de arquitetura

```
Browser
  |
  | HTTPS
  v
Host/proxy de producao
  |
  | /              -> frontend estatico
  | /api/v1/*      -> backend Fastify
  | /health*       -> backend Fastify
  v
Fastify backend
  |
  | Prisma
  v
PostgreSQL gerenciado
```

Principios:

- O backend continua sendo a fonte de verdade.
- O frontend estatico nao tem build step obrigatorio.
- Cookies de sessao exigem HTTPS em producao.
- CORS deve ser restritivo; se o frontend e a API estiverem no mesmo dominio, CORS vira defesa secundaria.
- Observabilidade do MVP e baseada em health endpoints, logs e runbooks.

---

## 3. Mudancas de backend

### 3.1 `backend/src/config/env.ts`

Adicionar validacao contextual para producao.

Regras novas:

- `NODE_ENV=production` exige `CORS_ORIGIN` preenchido.
- `NODE_ENV=production` rejeita `CORS_ORIGIN=*`.
- `NODE_ENV=production` rejeita `SEED_ENABLED=true`.
- `NODE_ENV=production` exige `DATABASE_URL` com prefixo `postgresql://` ou `postgres://`.
- `SESSION_SECRET` mantem minimo de 32 caracteres.
- Mensagens de erro nao devem imprimir valores das variaveis.

Pseudocodigo:

```ts
const isProduction = env.NODE_ENV === "production";

if (isProduction) {
  require("CORS_ORIGIN");
  rejectIf("CORS_ORIGIN", "*");
  rejectIf("SEED_ENABLED", "true");
  requireDatabaseUrlPostgres();
}
```

### 3.2 `backend/src/infra/healthcheck.ts`

Substituir a rota unica por tres contratos:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

Design:

```ts
const serviceInfo = () => ({
  service: "almox-backend",
  version: process.env.npm_package_version || "1.0.0",
  timestamp: new Date().toISOString(),
  uptime: Math.floor((Date.now() - startedAt) / 1000),
});

app.get("/health/live", async () => ({
  status: "ok",
  ...serviceInfo(),
}));

app.get("/health/ready", readinessHandler);
app.get("/health", readinessHandler);
```

`readinessHandler` executa `prisma.$queryRaw\`SELECT 1\``.

Compatibilidade:

- `/health` preserva `status`, `version`, `timestamp`, `uptime`, `checks.database`.
- Teste atual de `healthcheck.test.ts` deve continuar passando.

### 3.3 `backend/src/infra/security-headers.ts`

Novo plugin sem dependencia externa.

Responsabilidade:

- Injetar headers minimos em toda resposta.
- Adicionar `Cache-Control: no-store` para rotas autenticadas quando houver `req.user`.
- Evitar alterar `Set-Cookie`.

Headers:

```ts
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};
```

CSP:

- API JSON: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'`.
- Frontend estatico: documentado em runbook, pois pode ser servido fora do Fastify.

### 3.4 `backend/src/infra/shutdown.ts`

Novo helper de graceful shutdown.

Responsabilidade:

- Fechar Fastify em `SIGINT` e `SIGTERM`.
- Desconectar Prisma.
- Logar inicio/fim sem secrets.
- Evitar double shutdown.

Design:

```ts
export function registerShutdown(app: FastifyInstance) {
  let closing = false;
  async function shutdown(signal: NodeJS.Signals) {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "shutdown iniciado");
    await app.close();
    await prisma.$disconnect();
    app.log.info({ signal }, "shutdown concluido");
    process.exit(0);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
```

Teste:

- Nao enviar sinal real ao processo de teste.
- Testar idempotencia do helper por injecao de funcoes quando necessario.
- Se o teste ficar artificial demais, cobrir por build + smoke local e registrar risco residual.

### 3.5 `backend/src/app/server.ts`

Alteracoes:

- Registrar `securityHeaders` antes das rotas.
- Registrar shutdown apenas no bloco `if (require.main === module)`.
- Manter CORS multi-origem atual.
- Em producao, `validateEnv()` deve garantir que `CORS_ORIGIN` existe e nao e wildcard.
- Manter porta local default `3001`, mas documentar que producao usa `PORT` do provedor.

Ordem:

```ts
validateEnv();
const app = Fastify(...);
await app.register(securityHeaders);
await app.register(cors, ...);
await app.register(cookie);
await app.register(rateLimit, ...);
...
```

### 3.6 `backend/package.json`

Adicionar scripts operacionais:

```json
{
  "scripts": {
    "predeploy": "npm test && npm run build",
    "migrate:deploy": "prisma migrate deploy",
    "deploy:check": "npm run prisma:generate && npm run build"
  }
}
```

Nao alterar `start`.

### 3.7 `backend/.env.example`

Atualizar para separar dev/producao.

Campos:

```env
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@localhost:5432/almox
SESSION_SECRET=change-me-minimum-32-characters
SESSION_TTL_HOURS=8
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOG_LEVEL=info
SEED_ENABLED=false
```

Notas:

- Em producao, `SESSION_SECRET` deve ser gerado fora do repo.
- Em producao, `CORS_ORIGIN` deve ser origem HTTPS real.
- Em producao, `SEED_ENABLED=true` bloqueia boot.

---

## 4. Prisma baseline migration

### 4.1 Problema

O schema Prisma atual esta funcional via `db push`, mas producao nao deve usar `db push --accept-data-loss`. O SDD-006 cria baseline migration para permitir `prisma migrate deploy`.

### 4.2 Estrategia

Como nao ha producao real declarada, o baseline sera criado a partir do schema atual.

Comando planejado:

```bash
cd backend
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/00000000000000_baseline/migration.sql
```

Tambem criar:

```text
backend/prisma/migrations/00000000000000_baseline/
└── migration.sql
```

Validacao local:

```bash
cd backend
npx prisma migrate reset --force
npx prisma migrate deploy
npm test
```

Restricao:

- Nao rodar `migrate reset` em producao.
- Se existir banco produtivo com tabelas ja criadas fora de migrations, usar `prisma migrate resolve --applied 00000000000000_baseline` somente apos backup e verificacao manual.

---

## 5. Runbooks

Criar diretório:

```text
docs/runbooks/
├── SDD-006-deploy.md
├── SDD-006-rollback.md
├── SDD-006-backup-restore.md
├── SDD-006-db-down.md
└── SDD-006-secret-rotation.md
```

### 5.1 Deploy

Conteudo minimo:

- pre-check local;
- envs obrigatorias;
- aplicar migrations;
- iniciar app;
- verificar `/health/live`;
- verificar `/health/ready`;
- smoke login;
- validar logs.

### 5.2 Rollback

Conteudo minimo:

- rollback de codigo no provedor;
- regra de rollback de schema forward-only;
- quando bloquear rollback;
- quando restaurar backup;
- evidencias obrigatorias antes/depois.

### 5.3 Backup/restore

Conteudo minimo:

- backup gerenciado do provedor quando disponivel;
- comando manual com `pg_dump` sem senha hardcoded;
- restore em ambiente de teste antes de producao;
- retencao minima recomendada;
- risco residual se estiver em plano sem backup automatico.

### 5.4 DB down

Conteudo minimo:

- sintomas;
- `/health/live` vs `/health/ready`;
- verificar `DATABASE_URL`;
- verificar provedor PostgreSQL;
- comportamento esperado do app;
- comunicacao operacional.

### 5.5 Secret rotation

Conteudo minimo:

- gerar novo `SESSION_SECRET`;
- efeito esperado: sessoes antigas podem invalidar;
- janela recomendada;
- smoke test apos troca;
- nunca versionar secret.

---

## 6. Testes

### 6.1 `backend/test/production-env.test.ts`

Casos:

- `NODE_ENV=production` sem `CORS_ORIGIN` falha.
- `NODE_ENV=production` com `CORS_ORIGIN=*` falha.
- `NODE_ENV=production` com `SEED_ENABLED=true` falha.
- `NODE_ENV=production` com `DATABASE_URL=file:...` falha.
- env produtiva valida passa.

### 6.2 `backend/test/health-readiness.test.ts`

Casos:

- `GET /health/live` retorna 200 sem depender de DB.
- `GET /health/ready` retorna 200 com DB conectado.
- `GET /health` continua compativel.
- DB indisponivel retorna 503 em readiness.

### 6.3 `backend/test/security-headers.test.ts`

Casos:

- rota publica inclui headers minimos.
- rota autenticada inclui `Cache-Control: no-store`.
- headers nao removem `Set-Cookie` do login.

### 6.4 `backend/test/production-cookies.test.ts`

Casos:

- com `NODE_ENV=production`, login emite `almox_sid` com `Secure`.
- com `NODE_ENV=production`, login emite `almox_csrf` com `Secure`.
- sem producao, dev/test nao exige `Secure`.

### 6.5 `backend/test/logging-production.test.ts`

Casos:

- logger config contem redact de cookie, authorization, senha, password e novaSenha.
- erro de env nao inclui valor de `SESSION_SECRET` nem `DATABASE_URL`.

Contagem estimada:

- `production-env`: 5
- `health-readiness`: 4
- `security-headers`: 3
- `production-cookies`: 3
- `logging-production`: 2
- Total novo estimado: 17 testes

Baseline esperado apos SDD-006:

- Backend: `213 + ~17 = ~230`
- Frontend: `62`
- Total: `~292`

---

## 7. Ordem de implementacao

1. Atualizar `env.ts`.
   - Verificar: `production-env.test.ts`.
2. Estender `healthcheck.ts`.
   - Verificar: `health-readiness.test.ts` + teste legado.
3. Adicionar `security-headers.ts` e registrar em `server.ts`.
   - Verificar: `security-headers.test.ts`.
4. Validar cookies em modo producao.
   - Verificar: `production-cookies.test.ts`.
5. Adicionar graceful shutdown.
   - Verificar: build + teste se nao ficar artificial.
6. Criar baseline migration.
   - Verificar: `prisma migrate deploy` em banco limpo de teste.
7. Atualizar `.env.example`, scripts e runbooks.
   - Verificar: revisão documental.
8. Rodar suite completa.
   - Verificar: backend, frontend e build.

---

## 8. Comandos de validacao

Backend:

```bash
cmd /c "npm --prefix backend test"
cmd /c "npm --prefix backend run build"
```

Frontend:

```bash
npm run test:frontend
```

Migration local controlada:

```bash
cd backend
npx prisma migrate deploy
```

Observacao:

- `migrate reset` so pode ser usado contra banco descartavel de desenvolvimento/teste.
- `prisma db push --accept-data-loss` segue permitido apenas no runner local de testes via `scripts/test-pretest.ts`.

---

## 9. Riscos residuais

| # | Risco | Mitigacao |
|---|-------|-----------|
| R1 | Documentacao Railway pode mudar | Antes do deploy real, conferir painel/comandos atuais do provedor |
| R2 | Baseline migration em banco ja populado exigir `migrate resolve` | Exigir backup e confirmacao manual do estado do banco |
| R3 | CSP quebrar Google Fonts | Testar frontend real; se quebrar, ajustar CSP ou remover dependencia externa em SDD separado |
| R4 | Security headers aplicados a todas as rotas afetarem assets se Fastify servir frontend no futuro | Separar politica API vs frontend nos runbooks |
| R5 | Teste de graceful shutdown ficar artificial | Cobrir helper minimamente e validar por smoke manual documentado |

---

## 10. Definition of Done do DESIGN

- [ ] DESIGN aprovado.
- [ ] Implementacao segue a ordem do §7.
- [ ] Nenhuma dependencia npm nova introduzida.
- [ ] Baseline migration criada.
- [ ] Health/live e health/ready testados.
- [ ] Env produtiva insegura bloqueada.
- [ ] Security headers testados.
- [ ] Cookies `Secure` em producao testados.
- [ ] Runbooks criados.
- [ ] Backend test suite passa.
- [ ] Frontend test suite passa.
- [ ] Build backend passa.
- [ ] `PROGRESS.md`, `RELATORIO-TESTES-SPEC-001.md`, `CLAUDE.md` e `AGENTS.md` atualizados.

---

## 11. Gate

DESIGN aprovado pela diretriz "Aprovada o SDD" em 2026-04-24.

Implementacao autorizada conforme a ordem tecnica definida neste documento.
