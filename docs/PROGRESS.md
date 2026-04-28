# Progresso do Projeto — Almox

> **Última atualização:** 2026-04-28 (SDD-006 health real + bootstrap admin definido)
> **Responsável técnico:** Auralynne / Rodoviária de Pelotas
> **Documento de referência:** [CLAUDE.md](../CLAUDE.md), [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md)

---

## 1. Snapshot Executivo

| Métrica | Valor |
|---------|-------|
| SDDs concluídos | **5 de 6** (SDD-001 + SDD-002 + SDD-003 + SDD-004 + SDD-005; SDD-001-FIX concluido como adendo) |
| SDDs pendentes | 1 (SDD-006 com deploy/health real validado; smoke autenticado, logs e backup pendentes) |
| Testes totais | **298/298 passando** (236 backend + 62 frontend apiClient) |
| Arquivos de teste | 50 (49 backend + 1 frontend) |
| Testes `skip`/`todo` | 0 |
| Tempo de execucao da suite | ~48s (backend 46.41s + frontend 1.14s) |
| TypeScript `tsc --noEmit` | ✅ limpo |
| Débitos técnicos de código | **ZERO** |
| Débitos de feature gap | **ZERO** (CA-A4, CA-I2 e CA-I3 fechados em 2026-04-18) |

---

## 2. Status por SDD

| SDD | Escopo | Status | Testes | Evidência |
|-----|--------|--------|--------|-----------|
| **SDD-001** | Bootstrap backend: Fastify + TS + Prisma + PostgreSQL, Auth, Users CRUD, AuditLog, rate limit, error handler, Pino redact | ✅ **CONCLUÍDO** | 40 | `backend/src/**`, `prisma/schema.prisma` |
| **SDD-001-FIX** | Correção DV1/DV3/DV4/DV5/DV7 + clean-code zero-débito (Bloco E: paginação de users) | ✅ **CONCLUÍDO** | 46 (cumulativo) | `RELATORIO-TESTES-SPEC-001.md` Blocos A-E |
| **SDD-002** | Employees + Settings (Funcionários, Setores, Categorias, Depósitos) | ✅ **CONCLUÍDO** | 78 (cumulativo, +32) | `docs/SDD-002-employees-settings.md`, Bloco F |
| **SDD-003** | Inventory + Stock Movements (Itens, Entradas, Saídas, ajustes auditados) | ✅ **CONCLUÍDO** | 160 (cumulativo, +27) | `docs/SDD-003-Inv-Stock.md`, `docs/SDD-003-DESIGN-Inv-Stock.md`, Bloco H |
| **SDD-004** | Integracao Frontend ↔ Backend (substituir localStorage por fetch API) | ✅ **CONCLUIDO** (PR-1 ao PR-9 + Addendum A Acessos) | 180 backend + 62 frontend | `apiClient.js`, `front/js/auth.js`, `front/js/pages/dashboard.js`, `front/js/pages/pages.js`, `front/js/modals.js`, `front/js/utils.js`, `backend/scripts/import-legacy.ts`, `backend/test/import-legacy.test.ts`, `e2e/tests/08-usuarios.spec.ts`, `e2e/tests/09-relatorios.spec.ts` |
| **SDD-005** | Reports + Audit endpoints | ✅ **CONCLUÍDO** | 213 backend (cumulativo, +33) | `docs/SDD-005-reports-audit.md`, `backend/src/modules/reports/**`, `backend/src/modules/audit/**`, `backend/test/reports.test.ts`, `backend/test/audit-query.test.ts` |
| **SDD-006** | Deploy + Observabilidade | **DEPLOY/HEALTH REAL VALIDADO PARCIALMENTE** | 236 backend (cumulativo, +23) | `backend/src/config/env.ts`, `backend/src/infra/healthcheck.ts`, `backend/src/infra/security-headers.ts`, `backend/src/infra/logger-options.ts`, `backend/src/infra/shutdown.ts`, `backend/scripts/bootstrap-admin.ts`, Railway `https://almoxarif-production.up.railway.app`, commit `c6575e5`, `/health/live` 200, `/health/ready` 200 com `database=connected` |

---

## 3. Backend — Estado Atual

### 3.1 Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js v22.11.0 |
| Framework | Fastify 4.x |
| Linguagem | TypeScript (strict) |
| ORM | Prisma |
| Banco | PostgreSQL |
| Validação | Zod com `.strip()` |
| Hash de senha | bcryptjs (salt 12 prod, 10 test) |
| Logger | Pino com redact de senha/cookie/authorization |
| Rate limit | `@fastify/rate-limit` global + por rota |
| Sessão | Server-side em DB, cookie `almox_sid` (UUID), sliding expiration 8h |
| Testes | Vitest 1.6.1 (sequencial, `fileParallelism: false`) |

### 3.2 Módulos implementados

```
backend/src/modules/
├── auth/              ✅ SDD-001 — login, logout, /auth/me, rate limit, audit
├── users/             ✅ SDD-001 — CRUD, regras (último admin, auto-ação), paginação, guards
├── funcionarios/      ✅ SDD-002 — CRUD, guards (setor usable), paginação, audit
├── inventory/         ✅ SDD-003 — items CRUD, regras de saldo, paginação, auditoria
├── stock-movements/   ✅ SDD-003 — entradas, saídas, ajustes, transações e concorrência
├── acessos/           ✅ SDD-004 Addendum A — controle de acessos fisicos
├── reports/           ✅ SDD-005 — métricas, movimentações, por setor, snapshot de estoque
├── audit/             ✅ SDD-005 — consulta paginada e filtrada de AuditLog
└── settings/
    ├── setores/       ✅ SDD-002 — CRUD, normalização, guard de vínculos ativos
    ├── categorias/    ✅ SDD-002 — CRUD, normalização
    └── depositos/     ✅ SDD-002 — CRUD, normalização
```

### 3.3 Endpoints ativos

| Método | Rota | Auth | Role | Módulo |
|--------|------|------|------|--------|
| POST | `/api/v1/auth/login` | público | — | auth |
| POST | `/api/v1/auth/logout` | cookie | qualquer | auth |
| GET | `/api/v1/auth/me` | cookie | qualquer | auth |
| GET | `/api/v1/users` | cookie | admin | users |
| GET | `/api/v1/users/:id` | cookie | admin | users |
| POST | `/api/v1/users` | cookie | admin | users |
| PUT | `/api/v1/users/:id` | cookie | admin | users |
| PATCH | `/api/v1/users/:id/password` | cookie | admin | users |
| DELETE | `/api/v1/users/:id` | cookie | admin | users |
| GET | `/api/v1/funcionarios` | cookie | qualquer | funcionarios |
| GET | `/api/v1/funcionarios/:id` | cookie | qualquer | funcionarios |
| POST | `/api/v1/funcionarios` | cookie | admin | funcionarios |
| PUT | `/api/v1/funcionarios/:id` | cookie | admin | funcionarios |
| DELETE | `/api/v1/funcionarios/:id` | cookie | admin | funcionarios |
| GET | `/api/v1/settings/setores` | cookie | qualquer | setores |
| GET | `/api/v1/settings/setores/:id` | cookie | qualquer | setores |
| POST | `/api/v1/settings/setores` | cookie | admin | setores |
| PUT | `/api/v1/settings/setores/:id` | cookie | admin | setores |
| DELETE | `/api/v1/settings/setores/:id` | cookie | admin | setores |
| GET | `/api/v1/settings/categorias` | cookie | qualquer | categorias |
| GET | `/api/v1/settings/categorias/:id` | cookie | qualquer | categorias |
| POST | `/api/v1/settings/categorias` | cookie | admin | categorias |
| PUT | `/api/v1/settings/categorias/:id` | cookie | admin | categorias |
| DELETE | `/api/v1/settings/categorias/:id` | cookie | admin | categorias |
| GET | `/api/v1/settings/depositos` | cookie | qualquer | depositos |
| GET | `/api/v1/settings/depositos/:id` | cookie | qualquer | depositos |
| POST | `/api/v1/settings/depositos` | cookie | admin | depositos |
| PUT | `/api/v1/settings/depositos/:id` | cookie | admin | depositos |
| DELETE | `/api/v1/settings/depositos/:id` | cookie | admin | depositos |
| GET | `/api/v1/acessos` | cookie | admin | acessos |
| POST | `/api/v1/acessos` | cookie | admin | acessos |
| GET | `/api/v1/reports/metricas` | cookie | qualquer | reports |
| GET | `/api/v1/reports/movimentacoes` | cookie | qualquer | reports |
| GET | `/api/v1/reports/por-setor` | cookie | qualquer | reports |
| GET | `/api/v1/reports/estoque` | cookie | qualquer | reports |
| GET | `/api/v1/audit` | cookie | admin | audit |
| GET | `/health/live` | público | — | infra |
| GET | `/health/ready` | público | — | infra |
| GET | `/health` | público | — | infra |

**Total:** 53 endpoints ativos.

### 3.4 Modelo de dados (Prisma)

| Modelo | Campos-chave | Relações |
|--------|--------------|----------|
| `User` | id UUID, email único, senha hash, role, ativo | → Session, AuditLog |
| `Session` | id UUID (cookie), userId FK, expiresAt, ipAddress, userAgent | User CASCADE |
| `AuditLog` | id, userId, action, target, details, ipAddress | User |
| `Setor` | id UUID, nome único, ativo | → Funcionario |
| `Categoria` | id UUID, nome único, ativo | — |
| `Deposito` | id UUID, nome único, ativo | — |
| `Funcionario` | id UUID, nome, cargo, setorId, ativo | Setor `onDelete: Restrict` |
| `Item` | id UUID, codigo único, saldo, mínimo, valor atual, ativo | Categoria, Deposito |
| `Entrada` | id UUID, itemId, qtd, valorUnit, data, responsavelUserId | Item, User |
| `Saida` | id UUID, itemId, funcionarioId, qtd, valorUnit, snapshot setor | Item, Funcionario, Setor, User |
| `Ajuste` | id UUID, itemId, qtdAnterior, qtdNova, motivo, responsavelUserId | Item, User |
| `Acesso` | id UUID, nome, tipo, hora, data, responsavelUserId | User |

### 3.5 Invariantes garantidas pelo backend

1. ✅ Senhas nunca em texto puro (bcrypt salt 12)
2. ✅ Autenticação server-side obrigatória (cookie httpOnly)
3. ✅ Autorização server-side via `requireAuth` + `requireRole`
4. ✅ Soft delete (`ativo=false`) — nunca exclusão física em User/Funcionário/Setor/Categoria/Depósito
5. ✅ Último admin ativo não pode ser desativado/demovido/excluído
6. ✅ Usuário não pode se auto-desativar nem remover seu próprio admin
7. ✅ Setor com funcionários ativos não pode ser desativado (FK Restrict + guard de contagem)
8. ✅ Nomes de setor/categoria/depósito únicos case-insensitive (normalização trim+lowercase)
9. ✅ Funcionário só pode ser criado em setor existente e ativo
10. ✅ Toda ação sensível emite AuditLog persistente
11. ✅ Sessão com sliding expiration, invalidada em desativação/senha/role change
12. ✅ IDs UUID (nunca sequenciais)
13. ✅ Erros no formato `{ error: { code, message, details } }` com 7 códigos canônicos

### 3.6 Seed inicial

| Entidade | Registros seedados |
|----------|-------------------|
| User | `admin@rodoviariapel.com` / `admin2026` (admin), `op@rodoviariapel.com` / `operador2026` (operador) |
| Setor | `almoxarifado` |
| Categoria | `geral` |
| Deposito | `principal` |

Ativado via `SEED_ENABLED=true`.

### 3.7 Infra SDD-006 implementada parcialmente

| Item | Status | Evidência |
|------|--------|-----------|
| Validação de env produtiva | ✅ implementado | `backend/src/config/env.ts` |
| Bloqueio de `CORS_ORIGIN=*` em produção | ✅ implementado | `backend/test/production-env.test.ts` |
| Bloqueio de `SEED_ENABLED=true` em produção | ✅ implementado | `backend/test/production-env.test.ts` |
| Exigência de PostgreSQL em produção | ✅ implementado | `backend/test/production-env.test.ts` |
| Health liveness/readiness | ✅ implementado | `backend/src/infra/healthcheck.ts`, `backend/test/health-readiness.test.ts` |
| Security headers mínimos | ✅ implementado | `backend/src/infra/security-headers.ts`, `backend/test/security-headers.test.ts` |
| Cookies `Secure` em produção | ✅ testado | `backend/test/production-cookies.test.ts` |
| Logger/redact operacional | ✅ implementado | `backend/src/infra/logger-options.ts`, `backend/test/logging-production.test.ts` |
| Graceful shutdown | ✅ implementado | `backend/src/infra/shutdown.ts`, `backend/test/graceful-shutdown.test.ts` |
| Scripts operacionais | ✅ implementado | `backend/package.json` |
| Bootstrap controlado de admin | ✅ implementado e testado | `backend/scripts/bootstrap-admin.ts`, `backend/test/bootstrap-admin.test.ts`, script `npm run bootstrap:admin` |
| `.env.example` de produção | ✅ atualizado | `backend/.env.example` |
| Baseline migration Prisma | ✅ criada e validada em banco limpo | `backend/prisma/migrations/00000000000000_baseline/migration.sql` |
| Runbooks operacionais | ✅ criados | `docs/runbooks/SDD-006-deploy.md`, `docs/runbooks/SDD-006-rollback.md`, `docs/runbooks/SDD-006-backup-restore.md`, `docs/runbooks/SDD-006-db-down.md`, `docs/runbooks/SDD-006-secret-rotation.md` |
| Revisão DoD contra SPEC/DESIGN | ✅ realizada | `docs/SDD-006-DOD-review.md` |
| Alvo operacional do deploy | ✅ definido | Railway Node service + PostgreSQL gerenciado |
| Deploy real Railway | ✅ health validado | Commit `c6575e5`; migration sem pendência; app ouvindo em `0.0.0.0:8080`; domínio `https://almoxarif-production.up.railway.app` |
| Smoke real de health | ✅ validado | `GET /health/live` -> 200; `GET /health/ready` -> 200 com `checks.database=connected`; `GET /health` -> 200 |
| Smoke autenticado/API real | ⚠️ bloqueado | `POST /api/v1/auth/login` com `admin@rodoviariapel.com/admin2026` -> 401; `op@rodoviariapel.com/operador2026` -> 401; banco produtivo sem usuário inicial confirmado por comportamento |

Pendências para fechamento do SDD-006:

- Executar bootstrap controlado de usuário inicial/admin no banco produtivo.
- Reexecutar smoke autenticado/API real após bootstrap.
- Validar logs reais do Railway sem exposição de secrets.
- Confirmar política de backup gerenciado/manual no Railway.
- Registrar riscos residuais finais antes de marcar o SDD como concluído.

---

## 4. Frontend — Estado Atual

**Status:** integrado ao backend no SDD-004 (PR-9).

Frontend consome backend via `apiClient` como fonte de verdade para auth, painel, estoque, entradas, saidas, funcionarios, configuracoes, usuarios e relatorios.

### Arquivos legados (raiz do repositório)

```
index.html, variables.css, components.css, layout.css, login.css
data.js, utils.js, auth.js, modals.js, app.js, dashboard.js, pages.js
```

As entidades de negocio nao usam mais `localStorage` como fonte de verdade. A exportacao JSON em `Utils.exportJSON()` agora busca dados do backend/cache de pagina.

### Riscos do frontend apos SDD-004

| # | Risco | Severidade | Mitigação planejada |
|---|-------|-----------|---------------------|
| S1-S7 | Senhas em texto puro, auth client-side, autorizacao por UI, dados no console | CRITICO | Encerrado no fluxo principal (backend + apiClient) |
| D1-D6 | Sem transacionalidade, sem UUID, dados desnormalizados | CRITICO | Encerrado com backend transacional + integracao frontend |
| A1-A4 | Sem auditoria | ALTO | Encerrado no backend; consulta paginada de AuditLog exposta no SDD-005 |
| P1-P4 | localStorage inadequado | ALTO | Encerrado (persistencia principal no backend) |

---

## 5. Testes — Inventário Canônico

**Regra de ouro:** nenhum SDD avança se qualquer teste existente falhar. O [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md) cobre o histórico acumulado até a implementação parcial do SDD-006.

| Bloco | Arquivos | Testes |
|-------|----------|--------|
| A — SDD-001 base | `auth`, `users-crud`, `edge-cases`, `error-format`, `rate-limit`, `healthcheck`, `env-validation` | 20 |
| B — SDD-001-FIX §5 | `users-rules`, `session-invalidation`, `authorization`, `audit`, `logger-redact` | 19 |
| E — clean-code pré SDD-002 | `users-pagination` | 6 |
| F — SDD-002 | `funcionarios-*` (3 arquivos), `settings-*` (5 arquivos) | 32 |
| G — SDD-TEST-002A (hardening) | `auth-hardening`, `session-hardening`, `infra-failure`, `validation-hardening`, `payload-abuse-*`, `audit-negative-paths` (7 arquivos) | 55 |
| H — SDD-003 | `items-*`, `entradas`, `saidas`, `ajustes`, `stock-*` (9 arquivos) | 27 |
| Reconciliação 2026-04-18 | `session-hardening` 7 → 8 + ajuste de soma em Bloco G | +2 |
| I — SDD-004 PR-1 (CSRF) | `csrf.test.ts` | 8 |
| J — SDD-004 Addendum A | `acessos.test.ts` | 5 |
| K — SDD-004 PR-9 (import legacy) | `import-legacy.test.ts` | 5 |
| L — SDD-005 Reports + Audit | `reports.test.ts`, `audit-query.test.ts` | 33 |
| M — SDD-006 Deploy + Observabilidade | `production-env`, `health-readiness`, `security-headers`, `production-cookies`, `logging-production`, `graceful-shutdown`, `bootstrap-admin` (7 arquivos) | 23 |
| **TOTAL BACKEND** | **49 arquivos** | **236** |
| Frontend apiClient | `test-frontend/apiClient.test.ts` | 62 |
| **TOTAL GERAL** | **50 arquivos** | **298** |

### Comando canônico

```bash
cd backend
npm test
```

**Resultado esperado:** `Test Files 49 passed (49) | Tests 236 passed (236)`.

Frontend:

```bash
npm run test:frontend
```

**Resultado esperado:** `Test Files 1 passed (1) | Tests 62 passed (62)`.

Observações:

- `pretest` carrega `backend/.env.test` via `backend/scripts/test-pretest.ts`; `backend/.env` não é necessário para a suite.
- Vitest backend roda em `pool: "threads"` com `singleThread: true`, pois a suíte usa banco compartilhado `almox_test`.

---

## 6. Débitos Técnicos

### 6.1 Débitos de código

**ZERO.** Política do projeto: nenhum SDD avança com débito técnico em aberto.

### 6.2 Débitos de feature gap

**ZERO em aberto.**

Fechados em 2026-04-18:

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| CA-A4 | Teste explícito de login com `ativo=false` | PASS | `backend/test/auth-hardening.test.ts` |
| CA-I2 | Resposta 503 quando DB cai | PASS | `backend/test/infra-failure.test.ts` |
| CA-I3 | Validação de boot quando `SESSION_SECRET` ausente | PASS | `backend/test/infra-failure.test.ts` |

Comando executado para validação do fechamento:

`npm --prefix backend run test -- test/auth-hardening.test.ts test/infra-failure.test.ts` -> `11/11` testes PASS.

---

## 7. Próximos Passos

### 7.1 Imediato — SDD-006 (Deploy + Observabilidade)

Escopo imediato:
- executar bootstrap controlado de usuário inicial/admin no Railway
- reexecutar smoke autenticado/API real no Railway após bootstrap
- validar logs reais do Railway sem secrets
- confirmar backup gerenciado ou runbook manual aplicável ao plano atual

### 7.2 Médio prazo

- Fechamento operacional do **SDD-006** no alvo aprovado após smoke autenticado, logs e backup.

---

## 8. Políticas vigentes (fixas)

1. **SDD rigoroso** — toda demanda passa por SPEC → aprovação → DESIGN → implementação (§11 do CLAUDE.md)
2. **Zero débito técnico** — nenhum SDD fecha com débito em aberto (diretriz do usuário em 2026-04-16)
3. **Regressao zero** — inventario de 236 testes backend + 62 frontend deve continuar passando integralmente
4. **Migracao incremental** — SDD-004 concluido; proximos modulos sem ruptura de contratos
5. **Sem framework frontend** — frontend puro mantido até decisão explícita em contrário
6. **Mensagens em português** — toda resposta de erro visível ao usuário final
7. **Logs sem segredos** — Pino redact obrigatório para senha, cookie, authorization

---

## 9. Histórico de marcos

| Data | Marco |
|------|-------|
| 2026-04-16 | SDD-001 + SDD-001-FIX concluídos. 46 testes passando. |
| 2026-04-16 | Clean-code review zero-débito (Bloco E). |
| 2026-04-17 | SDD-002 concluido. 78 testes passando. 30 endpoints ativos. |
| 2026-04-17 | SDD-TEST-002A concluido. Baseline atualizado para 133/133 em 28 arquivos. |
| 2026-04-17 | SDD-003 concluido. Baseline atualizado para 160/160 em 37 arquivos. 44 endpoints ativos. |
| 2026-04-18 | Reconciliação de contagem: baseline real é 162/162 em 37 arquivos (Bloco G somou +2). |
| 2026-04-18 | SDD-004 Addendum A aprovado e implementado: modulo de acessos antecipado (backend + frontend). |
| 2026-04-20 | SDD-004 encerrado com PR-9 (Usuarios + Relatorios + importacao legacy). |
| 2026-04-20 | Baseline de testes atualizada: backend 40/180 e suite total 242/242 (inclui frontend 62/62). |
| 2026-04-24 | SDD-005 transplantado do worktree para o principal. Baseline backend 42/213 e suite total 275/275. |
| 2026-04-24 | SPEC e DESIGN do SDD-006 aprovados no principal. |
| 2026-04-26 | SDD-006 parcialmente implementado e validado: env produtiva, health live/ready, security headers, cookies Secure em produção, logging redact, graceful shutdown e baseline migration. Backend 48/232, frontend 1/62 e build backend passando. |
| 2026-04-26 | Runbooks operacionais do SDD-006 criados: deploy, rollback, backup/restore, banco indisponível e rotação de secret. |
| 2026-04-26 | Baseline migration validada com `prisma migrate deploy` em banco PostgreSQL temporário limpo; migration `00000000000000_baseline` aplicada com sucesso e banco temporário removido. |
| 2026-04-26 | `RELATORIO-TESTES-SPEC-001.md` atualizado com Bloco M do SDD-006, inventário canônico 48/232 backend, validações complementares e riscos residuais. |
| 2026-04-26 | DoD do SDD-006 revisado contra SPEC/DESIGN em `docs/SDD-006-DOD-review.md`; DoD técnico/documental local PASS, fechamento operacional pendente de smoke/deploy real. |
| 2026-04-26 | Alvo operacional definido como Railway; DESIGN, SPEC, runbook de deploy, PROGRESS e DoD atualizados para Railway Node service + PostgreSQL gerenciado. |
| 2026-04-28 | Deploy real no Railway validado parcialmente: commit `c6575e5`, `prisma migrate deploy` sem pendências, app ouvindo em `0.0.0.0:8080`, `/health/live`, `/health/ready` e `/health` retornando 200; readiness com `database=connected`. |
| 2026-04-28 | Smoke autenticado/API real tentado no Railway; login com admin e operador padrão retornou 401. Evidência indica banco produtivo sem usuário inicial porque `SEED_ENABLED=false` é obrigatório em produção. Fechamento segue bloqueado até bootstrap controlado. |
| 2026-04-28 | Bootstrap controlado de admin definido em `backend/scripts/bootstrap-admin.ts`, com confirmação explícita, no-op quando já existe admin ativo, audit log `ADMIN_BOOTSTRAPPED` e 4 testes. Baseline backend atualizado para 49/236. |

---

## 10. Referências rápidas

- **Contexto técnico:** [`CLAUDE.md`](../CLAUDE.md)
- **SPEC SDD-001:** [`docs/SDD-001-bootstrap-auth-users.md`](./SDD-001-bootstrap-auth-users.md)
- **SPEC SDD-001-FIX:** [`docs/SDD-001-FIX-correcao-desvios.md`](./SDD-001-FIX-correcao-desvios.md)
- **SPEC SDD-001 Addendum (CA-A4/CA-I2/CA-I3):** [`docs/SDD-001-ADDENDUM-ca-a4-i2-i3.md`](./SDD-001-ADDENDUM-ca-a4-i2-i3.md)
- **SPEC SDD-002:** [`docs/SDD-002-employees-settings.md`](./SDD-002-employees-settings.md)
- **SPEC SDD-004 Addendum A:** [`docs/SDD-004-ADDENDUM-acessos.md`](./SDD-004-ADDENDUM-acessos.md)
- **SPEC SDD-005:** [`docs/SDD-005-reports-audit.md`](./SDD-005-reports-audit.md)
- **SPEC SDD-006:** [`docs/SDD-006-deploy-observabilidade.md`](./SDD-006-deploy-observabilidade.md)
- **DESIGN SDD-006:** [`docs/SDD-006-DESIGN-deploy-observabilidade.md`](./SDD-006-DESIGN-deploy-observabilidade.md)
- **DoD SDD-006:** [`docs/SDD-006-DOD-review.md`](./SDD-006-DOD-review.md)
- **Relatório de testes:** [`docs/RELATORIO-TESTES-SPEC-001.md`](./RELATORIO-TESTES-SPEC-001.md)
- **Schema Prisma:** [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)
- **Seed:** [`backend/prisma/seed.ts`](../backend/prisma/seed.ts)





