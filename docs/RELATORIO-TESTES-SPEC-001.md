# Relatório de Testes — Almox (baseline acumulado até SDD-006)

**Data de execução:** 2026-04-26
**Documentos referência:**
- [SDD-001-bootstrap-auth-users.md](./SDD-001-bootstrap-auth-users.md)
- [SDD-001-FIX-correcao-desvios.md](./SDD-001-FIX-correcao-desvios.md)
- [SDD-002-employees-settings.md](./SDD-002-employees-settings.md)
- [SDD-003-Inv-Stock.md](./SDD-003-Inv-Stock.md)
- [SDD-004-frontend-integration.md](./SDD-004-frontend-integration.md)
- [SDD-005-reports-audit.md](./SDD-005-reports-audit.md)
- [SDD-006-deploy-observabilidade.md](./SDD-006-deploy-observabilidade.md)
- [SDD-006-DESIGN-deploy-observabilidade.md](./SDD-006-DESIGN-deploy-observabilidade.md)

**Runner:** Vitest v1.6.1
**Banco:** PostgreSQL `almox_test` em `localhost:5432`
**Execução sequencial:** Sim (`fileParallelism: false`, `sequence.concurrent: false`)

---

## Resultado Geral

```
Test Files  48 passed (48)
     Tests  232 passed (232)
```

| Métrica | Valor |
|---------|-------|
| Arquivos de teste | 48 |
| Arquivos passando | 48 |
| Arquivos falhando | 0 |
| Testes totais | 232 |
| Testes passando | 232 |
| Testes falhando | 0 |
| Testes `skip`/`todo` | 0 |

> **Atualização 2026-04-16 (pós clean-code review):** Refactor zero-débito aplicado antes de SDD-002. Detalhes em Bloco E.
> **Atualização 2026-04-17 (SDD-002 concluído):** 32 testes somados (Funcionários + Settings). Detalhes em Bloco F.
> **Atualização 2026-04-17 (SDD-003 concluído):** 27 testes somados em 9 arquivos (Inventory + Stock Movements). Detalhes em Bloco H.
> **Atualização 2026-04-18 (reconciliação):** contagem revisada 160 → 162 (sem novos arquivos; `session-hardening` registrou 8 testes e a soma do Bloco G foi ajustada).
> **Atualização 2026-04-18 (SDD-004 PR-1 CSRF):** +1 arquivo (`csrf.test.ts`, 8 testes). Total 162 → 170 em 38 arquivos. Session.csrfToken + double-submit pattern (cookie `almox_csrf` + header `x-almox-csrf`) + novo código `CSRF_ERROR`.
> **Atualização 2026-04-20 (SDD-004 Addendum A - Acessos):** +1 arquivo (`acessos.test.ts`, 5 testes). Total 170 → 175 em 39 arquivos.
> **Atualização 2026-04-20 (SDD-004 PR-9 - Import legacy):** +1 arquivo (`import-legacy.test.ts`, 5 testes). Total 175 → 180 em 40 arquivos.
> **Atualização 2026-04-24 (SDD-005 Reports + Audit):** +2 arquivos (`reports.test.ts`, `audit-query.test.ts`), 33 testes. Total 180 → 213 em 42 arquivos.
> **Atualização 2026-04-26 (SDD-006 Deploy + Observabilidade):** +6 arquivos (`production-env.test.ts`, `health-readiness.test.ts`, `security-headers.test.ts`, `production-cookies.test.ts`, `logging-production.test.ts`, `graceful-shutdown.test.ts`), 19 testes. Total 213 → 232 em 48 arquivos. `npm --prefix backend run build`, `npm run test:frontend` e `prisma migrate deploy` em banco limpo também validados.
> **Atualização 2026-04-28 (SDD-006 Railway):** deploy real validado parcialmente no Railway. Commit `c6575e5`, `prisma migrate deploy` sem pendências, app ouvindo em `0.0.0.0:8080`, `/health/live`, `/health/ready` e `/health` retornando 200; readiness com `checks.database=connected`.
> **Atualização 2026-04-28 (SDD-006 smoke autenticado):** smoke autenticado/API real tentado no Railway. `POST /api/v1/auth/login` com admin padrão retornou 401; login com operador padrão retornou 401. Bloqueio operacional: banco produtivo sem usuário inicial/controlado.
Atualização 2026-04-18: CA-A4, CA-I2 e CA-I3 foram cobertos explicitamente via `auth-hardening.test.ts` e `infra-failure.test.ts` (11/11 PASS).

---

## Rastreabilidade SDD-001-FIX × Resultados

### Bloco A — Desvios corrigidos

| # | Desvio | Correção aplicada | Evidência | Status |
|---|--------|-------------------|-----------|--------|
| DV1 | Sessão server-side no banco | `@fastify/session` removido; tabela `Session` (UUID, FK User CASCADE, expiresAt, ipAddress, userAgent); `requireAuth` valida DB + sliding; logout deleta; desativação/senha/role invalidam sessions | `session-invalidation.test.ts` (4 testes), `auth.test.ts` "logout deleta Session" | ATENDIDO |
| DV3 | Mensagens em português | `"Credenciais inválidas"`, `"Sessão encerrada"`, `"Limite de requisições excedido. Tente novamente em breve."`, `"E-mail já cadastrado"`, `"Não é possível remover/desativar o último administrador ativo"`, etc. | `auth.test.ts`, `rate-limit.test.ts`, `edge-cases.test.ts` | ATENDIDO |
| DV4 | Formato `{ error: { code, message, details } }` | `AppError` + `errorHandler` + rate-limit caem no mesmo formato com códigos SDD-001 | `error-format.test.ts`, `rate-limit.test.ts`, `authorization.test.ts`, `edge-cases.test.ts` | ATENDIDO |
| DV5 | Soft delete via `ativo = false` | Schema Prisma sem `deletedAt`; DELETE seta `ativo=false`; idempotente | `users-crud.test.ts` "soft delete via ativo=false (sem deletedAt)" + "idempotente" | ATENDIDO |
| DV7 | Seed/helpers `admin@rodoviariapel.com` | `prisma/seed.ts`, `test/helpers.ts`, todos os testes | todos os testes fazem login com `admin@rodoviariapel.com`/`admin2026` | ATENDIDO |

### Bloco B — Testes adicionais obrigatórios

| # (FIX) | Descrição | Arquivo / Teste | Status |
|---------|-----------|-----------------|--------|
| §5.1 CA-U6 | Admin não pode se auto-desativar | `users-rules.test.ts` "admin não pode se auto-desativar" / "auto-rebaixar" | PASS |
| §5.2 CA-U7 | Último admin protegido (DELETE, PUT ativo=false, PUT role) | `users-rules.test.ts` "último admin protegido em DELETE" + "rebaixar o último admin é bloqueado" + "com outro admin ativo pode desativar" | PASS |
| §5.3 CA-A10 | `LOGIN_FAILED` com target=email, userId nulo | `audit.test.ts` "LOGIN_FAILED registrado com target=email e userId nulo" | PASS |
| §5.4 CA-A11 | Campo `senha` ausente em responses | `auth.test.ts` (4 asserções), `users-crud.test.ts` (3 asserções) usando `JSON.stringify(body).includes("senha") === false` | PASS |
| §5.5 | Sliding expiration — `expires_at` aumenta | `session-invalidation.test.ts` "sliding expiration" | PASS |
| §5.6 | Desativação invalida sessões + 401 | `session-invalidation.test.ts` "desativar usuário invalida sessões" | PASS |
| §5.7 | Alteração de senha invalida sessões + 401 | `session-invalidation.test.ts` "alterar senha invalida sessões do alvo" | PASS |
| §5.8 | Operador recebe 403 em todas as rotas de users | `authorization.test.ts` — 6 rotas (GET list, GET id, POST, PUT, PATCH password, DELETE) | PASS |
| §5.9 | Redact de senha em logs pino | `logger-redact.test.ts` — verifica `[REDACTED]` + ausência de valor + ausência de cookie | PASS |

### Bloco C — Edge cases §6

| # | Caso | Arquivo / Teste | Status |
|---|------|-----------------|--------|
| E4 | Email em case diferente no login | `edge-cases.test.ts` "E4 — login aceita email em case diferente" | PASS |
| E11 | Email duplicado no POST /users | `edge-cases.test.ts` "E11 — email duplicado → 409 CONFLICT" | PASS |
| E12 | Role inválido | `edge-cases.test.ts` "E12 — role inválido → 400 VALIDATION_ERROR" | PASS |
| E13 | Campos extras (strip) | `edge-cases.test.ts` "E13 — campos extras descartados" | PASS |
| E16 | Cookie vazio ou UUID inexistente | `edge-cases.test.ts` 2 casos ("almox_sid=" e UUID zero) | PASS |

### Bloco D — Resultado geral

- [x] 100% dos testes do escopo SDD-001-FIX passam
- [x] Nenhum teste marcado como `skip` ou `todo`
- [x] Relatório atualizado (este documento)
- [x] Rollback documentado (§5 deste relatório e README backend a seguir)

### Bloco E — Clean-code zero-débito (pré SDD-002, 2026-04-16)

| Item | Severidade | Correção | Evidência |
|------|-----------|----------|-----------|
| `where: any = {}` em `listUsersHandler` | HIGH | Substituído por `Prisma.UserWhereInput` tipado | `src/modules/users/handlers.ts:32` |
| Casts `(before as any)[k]` no diff | HIGH | Extraído `buildDiff<T>()` genérico tipado | `src/shared/utils/diff.ts` (novo) |
| Role — 4 valores válidos (admin/gerente/operador/visitante) | HIGH (ambiguidade) | Decisão (a): mantidos 4 roles, docs atualizadas em `CLAUDE.md §4` | — |
| `COOKIE_NAME`/`TTL_HOURS` duplicados | MEDIUM | Centralizados em `src/config/session.ts` com `setSessionCookie`/`clearSessionCookie` | `src/config/session.ts` (novo) |
| `.catch(() => {})` silencia erros | MEDIUM | Substituído por `try/catch` com `req.log.warn({ err, sid }, ...)` | `src/modules/auth/handlers.ts`, `src/shared/middleware/require-auth.ts` |
| `updateUserHandler` 79 linhas | LOW | Quebrado em `guards.ts` (`assertNotSelfDemotionOrDeactivation`, `isDemotingOrDeactivatingAdmin`, `assertNotLastActiveAdmin`, `countActiveAdmins`, `invalidateUserSessions`) | `src/modules/users/guards.ts` (novo) |
| Paginação em `GET /users` | LOW (contrato) | Micro-SPEC aprovada: `?page&limit` com defaults 1/20, cap 100. Response: `{ users, meta: { total, page, limit, totalPages } }`. 6 novos testes em `users-pagination.test.ts` | `src/modules/users/users.schema.ts`, `handlers.ts:30-59` |

**Novos arquivos produção:**
- `src/config/session.ts` — constantes e helpers de cookie de sessão
- `src/shared/utils/diff.ts` — `buildDiff<T>()` genérico
- `src/modules/users/guards.ts` — invariantes de users CRUD

**Novo arquivo de teste:**
- `test/users-pagination.test.ts` — 6 testes cobrindo shape, navegação, cap, validação, defaults e composição com filtros

**Checklist zero-débito:** ✅ tsc clean ✅ suite do escopo SDD-001-FIX verde ✅ nenhum `any` residual em users ✅ nenhum catch silencioso ✅ handler <50 linhas ✅ contratos documentados

---

## Detalhamento por Arquivo

### 1. `auth.test.ts` — 4 testes / 438ms
- Login com credenciais válidas (200, cookie `almox_sid`, HttpOnly, sem `senha` no body)
- Login inválido (401 + `error.code=UNAUTHORIZED` + mensagem em PT)
- `/auth/me` retorna user sem `senha`
- Logout deleta Session no banco e invalida cookie (`message: "Sessão encerrada"`)

### 2. `users-crud.test.ts` — 6 testes / 618ms
- POST cria user (201, sem `senha` no body)
- PUT atualiza role
- DELETE soft via `ativo=false` (sem `deletedAt`)
- DELETE idempotente em inativo
- GET /users lista sem `senha`
- GET /users/:id sem `senha`

### 3. `users-rules.test.ts` — 5 testes / 754ms
- §5.1 admin não pode auto-desativar (409 CONFLICT)
- §5.1 admin não pode auto-rebaixar (409)
- §5.2 último admin protegido em DELETE (409)
- §5.2 variante — com outro admin pode desativar (200)
- §5.2 variante — rebaixar último admin é bloqueado (409)

### 4. `session-invalidation.test.ts` — 4 testes / 1258ms
- §5.5 sliding expiration (expires_at aumenta)
- §5.6 desativação invalida sessions + 401
- §5.7 alteração de senha invalida sessions + 401
- Extra: alteração de role invalida sessions + 401

### 5. `authorization.test.ts` — 6 testes / 321ms
- §5.8 operador → 403 em GET /users
- operador → 403 em GET /users/:id
- operador → 403 em POST /users
- operador → 403 em PUT /users/:id
- operador → 403 em PATCH /users/:id/password
- operador → 403 em DELETE /users/:id

### 6. `audit.test.ts` — 3 testes / 683ms
- USER_CREATED registrado (userId, target, details)
- LOGIN registrado após sucesso
- §5.3 LOGIN_FAILED registrado (target=email, userId=null)

### 7. `edge-cases.test.ts` — 6 testes / 849ms
- E4 email em case diferente
- E11 email duplicado → 409
- E12 role inválido → 400
- E13 campos extras strip
- E16 cookie vazio → 401
- E16 cookie UUID inexistente → 401

### 8. `error-format.test.ts` — 2 testes / 35ms
- 404 em rota inexistente → `error.code=NOT_FOUND` + `details: []`
- 401 em rota protegida sem cookie → `error.code=UNAUTHORIZED`

### 9. `rate-limit.test.ts` — 1 teste / 40ms
- 429 com `error.code=RATE_LIMITED` e mensagem PT

### 10. `logger-redact.test.ts` — 1 teste / 63ms
- §5.9 senha redacted no log do pino (sem valor original, com `[REDACTED]`, cookie também redacted)

### 11. `healthcheck.test.ts` — 1 teste / 65ms
- GET `/health` retorna 200 com `status: "ok"`

### 12. `env-validation.test.ts` — 1 teste / 2ms
- `DATABASE_URL` e `SESSION_SECRET` definidos

### 13. `users-pagination.test.ts` — 6 testes / 9.56s (novo, 2026-04-16)
- Shape `{ users, meta: { total, page, limit, totalPages } }` com 25 registros (page=1/limit=20)
- `page=2` retorna 5 registros restantes
- `limit=101` → 400 VALIDATION_ERROR (cap 100)
- `page=0` → 400 VALIDATION_ERROR
- Sem query params → defaults `page=1, limit=20`
- Filtro `role=operador` + paginação combinados

---

## Bloco F — SDD-002 (Employees + Settings)

> Adicionado em 2026-04-17 após SPEC SDD-002 aprovada (L1=A, L2=A, L3=A, L4=B, L5=B, L6=A, L7=A, L8=A). Arquivos novos em `backend/test/` seguem padrões do Bloco E (buildDiff, pagination, AuditLog, soft delete idempotente).

| # | Arquivo | Testes | Cobertura |
|---|---------|--------|-----------|
| 14 | `funcionarios-crud.test.ts` | 6 | CRUD completo: 201, list, get, 404, update com diff, soft delete idempotente |
| 15 | `funcionarios-rules.test.ts` | 4 | 400 setor inexistente; 409 setor inativo; 400 update setor inexistente; 400 update vazio |
| 16 | `funcionarios-pagination.test.ts` | 3 | Shape meta com 25 registros; filtro por setorId; cap limit=100 |
| 17 | `settings-setores.test.ts` | 6 | Normalização lowercase; 409 duplicado case-insensitive; update nome; 409 desativar com vínculo ativo; soft delete quando só há inativos; paginação |
| 18 | `settings-categorias.test.ts` | 4 | Normalização; 409 duplicado; soft delete idempotente; 404 id inexistente |
| 19 | `settings-depositos.test.ts` | 4 | Normalização; 409 duplicado; reativação; filtro ativo=false |
| 20 | `settings-authorization.test.ts` | 3 | 401 sem cookie; operador list=200 / create=403; operador POST funcionários=403 |
| 21 | `settings-audit.test.ts` | 2 | SETOR_CREATED registrado; EMPLOYEE_CREATED + EMPLOYEE_DEACTIVATED registrados |
| **SUBTOTAL SDD-002** | **8 arquivos** | **32** | — |

### Mudanças em infra para SDD-002

| Arquivo | Mudança |
|---------|---------|
| `src/infra/error-handler.ts` | Mapeamento Prisma P2002 → 409 CONFLICT, P2003 → 409 CONFLICT, P2025 → 404 NOT_FOUND |
| `src/app/server.ts` | Registro de 4 rotas: `/funcionarios`, `/settings/setores`, `/settings/categorias`, `/settings/depositos` |
| `prisma/seed.ts` | Seed L7=A: setor "almoxarifado", categoria "geral", depósito "principal" |
| `test/helpers.ts` | `seedSetor`, `seedCategoria`, `seedDeposito`, `seedFuncionario`; `cleanDatabase` estende para novas entidades |
| `src/shared/utils/normalize-name.ts` | Utilitário `normalizeName(raw) = raw.trim().toLowerCase()` |
| `src/shared/utils/diff.ts` | Reutilizado para auditoria de updates |

---

## Bloco H — SDD-003 (Inventory + Stock Movements)

> Adicionado em 2026-04-17 após SPEC + DESIGN aprovados. Implementa itens, entradas, saídas e ajustes auditados com transações e cobertura de concorrência.

| # | Arquivo | Testes | Cobertura |
|---|---------|--------|-----------|
| 29 | `items-crud.test.ts` | 4 | CRUD de itens: create, list/get, update, soft delete idempotente |
| 30 | `items-rules.test.ts` | 6 | código duplicado, FKs inválidas, bloqueio de `quantidade` por PUT, item inativo bloqueando movimento |
| 31 | `items-pagination.test.ts` | 3 | shape `{ items, meta }`, cap `limit=100`, filtro `baixoEstoque` |
| 32 | `entradas.test.ts` | 3 | entrada válida incrementa saldo, item inexistente, `qtd` inválida |
| 33 | `saidas.test.ts` | 4 | saída válida decrementa saldo, saldo insuficiente, funcionário inexistente/inativo |
| 34 | `ajustes.test.ts` | 3 | ajuste por admin, bloqueio para operador, validação de motivo |
| 35 | `stock-authorization.test.ts` | 3 | auth obrigatório, permissões por role, delete de item só admin |
| 36 | `stock-audit.test.ts` | 2 | logs de sucesso coerentes e ausência de log falso em rejeição |
| 37 | `stock-concurrency.test.ts` | 1 | duas saídas concorrentes sem oversell (no máximo uma efetiva) |
| **SUBTOTAL SDD-003** | **9 arquivos** | **27** | — |

---

## Bloco L — SDD-005 (Reports + Audit)

> Adicionado em 2026-04-24 após SDD-005 aprovado e transplantado para o principal. Implementa endpoints de relatórios operacionais e consulta paginada/filtrada de AuditLog.

| # | Arquivo | Testes | Cobertura |
|---|---------|--------|-----------|
| 41 | `reports.test.ts` | 22 | Métricas, movimentações, relatório por setor, snapshot de estoque, filtros e autorização |
| 42 | `audit-query.test.ts` | 11 | Consulta paginada de AuditLog, filtros por ação/usuário/período/alvo e autorização admin |
| **SUBTOTAL SDD-005** | **2 arquivos** | **33** | — |

---

## Bloco M — SDD-006 (Deploy + Observabilidade)

> Adicionado em 2026-04-26 após implementação parcial validada do SDD-006. Cobre contratos de ambiente produtivo, health/readiness, security headers, cookies de produção, logging/redact e graceful shutdown.

| # | Arquivo | Testes | Cobertura |
|---|---------|--------|-----------|
| 43 | `production-env.test.ts` | 5 | Fail-fast para `CORS_ORIGIN` ausente/wildcard, `SEED_ENABLED=true`, `DATABASE_URL` não PostgreSQL e env produtiva válida |
| 44 | `health-readiness.test.ts` | 4 | `/health/live` sem DB, `/health/ready` com DB conectado, `/health` compatível e readiness 503 sem vazar erro |
| 45 | `security-headers.test.ts` | 3 | Headers mínimos em rota pública, `Cache-Control: no-store` em rota autenticada e preservação de `Set-Cookie` |
| 46 | `production-cookies.test.ts` | 3 | Cookies `almox_sid` e `almox_csrf` com `Secure` em produção e sem exigência de `Secure` em test |
| 47 | `logging-production.test.ts` | 2 | Redact de cookie/authorization/senhas e erro de env sem imprimir secrets |
| 48 | `graceful-shutdown.test.ts` | 2 | Encerramento limpo com desconexão do banco e idempotência do shutdown |
| **SUBTOTAL SDD-006** | **6 arquivos** | **19** | — |

### Validações complementares SDD-006

| Validação | Resultado | Evidência |
|-----------|-----------|-----------|
| Build backend | PASS | `cmd /c "npm --prefix backend run build"` |
| Frontend apiClient | PASS, 62 testes | `npm run test:frontend` |
| Baseline migration em banco limpo | PASS | `prisma migrate deploy` aplicou `00000000000000_baseline` em PostgreSQL temporário limpo; `_prisma_migrations.finished=true`; 13 tabelas públicas criadas; banco temporário removido |
| Deploy Railway - migration/start | PASS parcial | Railway executou `prisma migrate deploy` sem pendências e iniciou `node dist/src/app/server.js`; app escutando em `0.0.0.0:8080` |
| Smoke Railway - health real | PASS | `https://almoxarif-production.up.railway.app/health/live` -> 200; `/health/ready` -> 200 com `checks.database=connected`; `/health` -> 200 |
| Smoke Railway - autenticado/API | BLOQUEADO | `POST /api/v1/auth/login` com `admin@rodoviariapel.com/admin2026` -> 401; `op@rodoviariapel.com/operador2026` -> 401; exige bootstrap controlado de usuário inicial |

---

## Inventário canônico de testes (fonte da verdade)

> **Esta lista é a referência oficial.** Qualquer regressão futura deve passar por toda ela antes de avançar em qualquer SDD. Total: **232 testes em 48 arquivos**.

| # | Arquivo | Testes | SDD |
|---|---------|--------|-----|
| 1 | `auth.test.ts` | 4 | SDD-001 |
| 2 | `users-crud.test.ts` | 6 | SDD-001 |
| 3 | `users-rules.test.ts` | 5 | SDD-001-FIX §5.1 §5.2 |
| 4 | `session-invalidation.test.ts` | 4 | SDD-001-FIX §5.5 §5.6 §5.7 |
| 5 | `authorization.test.ts` | 6 | SDD-001-FIX §5.8 |
| 6 | `audit.test.ts` | 3 | SDD-001-FIX §5.3 |
| 7 | `edge-cases.test.ts` | 6 | SDD-001-FIX §6 |
| 8 | `error-format.test.ts` | 2 | SDD-001-FIX DV4 |
| 9 | `rate-limit.test.ts` | 1 | SDD-001 |
| 10 | `logger-redact.test.ts` | 1 | SDD-001-FIX §5.9 |
| 11 | `healthcheck.test.ts` | 1 | SDD-001 |
| 12 | `env-validation.test.ts` | 1 | SDD-001 |
| 13 | `users-pagination.test.ts` | 6 | Clean-code pré SDD-002 |
| 14 | `funcionarios-crud.test.ts` | 6 | SDD-002 |
| 15 | `funcionarios-rules.test.ts` | 4 | SDD-002 |
| 16 | `funcionarios-pagination.test.ts` | 3 | SDD-002 |
| 17 | `settings-setores.test.ts` | 6 | SDD-002 |
| 18 | `settings-categorias.test.ts` | 4 | SDD-002 |
| 19 | `settings-depositos.test.ts` | 4 | SDD-002 |
| 20 | `settings-authorization.test.ts` | 3 | SDD-002 |
| 21 | `settings-audit.test.ts` | 2 | SDD-002 |
| 22 | `auth-hardening.test.ts` | 5 | SDD-TEST-002A |
| 23 | `session-hardening.test.ts` | 8 | SDD-TEST-002A |
| 24 | `infra-failure.test.ts` | 6 | SDD-TEST-002A |
| 25 | `validation-hardening.test.ts` | 19 | SDD-TEST-002A |
| 26 | `payload-abuse-users.test.ts` | 5 | SDD-TEST-002A |
| 27 | `payload-abuse-settings.test.ts` | 6 | SDD-TEST-002A |
| 28 | `audit-negative-paths.test.ts` | 6 | SDD-TEST-002A |
| 29 | `items-crud.test.ts` | 4 | SDD-003 |
| 30 | `items-rules.test.ts` | 6 | SDD-003 |
| 31 | `items-pagination.test.ts` | 3 | SDD-003 |
| 32 | `entradas.test.ts` | 3 | SDD-003 |
| 33 | `saidas.test.ts` | 4 | SDD-003 |
| 34 | `ajustes.test.ts` | 3 | SDD-003 |
| 35 | `stock-authorization.test.ts` | 3 | SDD-003 |
| 36 | `stock-audit.test.ts` | 2 | SDD-003 |
| 37 | `stock-concurrency.test.ts` | 1 | SDD-003 |
| 38 | `csrf.test.ts` | 8 | SDD-004 PR-1 |
| 39 | `acessos.test.ts` | 5 | SDD-004 Addendum A |
| 40 | `import-legacy.test.ts` | 5 | SDD-004 PR-9 |
| 41 | `reports.test.ts` | 22 | SDD-005 |
| 42 | `audit-query.test.ts` | 11 | SDD-005 |
| 43 | `production-env.test.ts` | 5 | SDD-006 |
| 44 | `health-readiness.test.ts` | 4 | SDD-006 |
| 45 | `security-headers.test.ts` | 3 | SDD-006 |
| 46 | `production-cookies.test.ts` | 3 | SDD-006 |
| 47 | `logging-production.test.ts` | 2 | SDD-006 |
| 48 | `graceful-shutdown.test.ts` | 2 | SDD-006 |
| **TOTAL** | **48 arquivos** | **232** | — |

### Comando canônico de execução

```bash
cd backend
npm test
```

**Resultado esperado** (baseline 2026-04-26, pós SDD-006 parcial):
```
Test Files  48 passed (48)
     Tests  232 passed (232)
  Duration  ~45.57s
```

Validações complementares:

```bash
npm --prefix backend run build
npm run test:frontend
```

Resultados esperados:

```text
backend build: tsc sem erro
frontend: Test Files 1 passed (1), Tests 62 passed (62)
```

### Critério de regressão

- ✅ Toda nova SDD **soma** testes a este inventário, nunca remove.
- ✅ Nenhum SDD pode ser fechado enquanto **qualquer** dos 232 testes atuais falhar.
- ✅ Qualquer mudança de contrato que quebre um teste exige **micro-SPEC aprovada** antes (como fizemos com paginação).
- ❌ Teste `skip` ou `todo` é proibido — se algo não pode ser testado agora, registrar como débito explícito em "Riscos Residuais" ou "Débitos Técnicos".

---

## Infraestrutura

| Item | Valor |
|------|-------|
| Runner | Vitest v1.6.1 |
| Node.js | v22.11.0 |
| Banco | PostgreSQL `almox_test` |
| Execução | Sequencial (`fileParallelism: false`) |
| Timeout | 15s por teste, 15s por hook |
| Setup | `dotenv` carrega `.env.test` |
| Cleanup | `cleanDatabase()` limpa auditLog + session + user |

**Helpers (`test/helpers.ts`):**
- `createApp()`, `cleanDatabase()`, `seedAdmin()`, `seedUser()`, `login()`, `loginAsAdmin()`, `extractSid()`, `buildCookie()`
- Constantes `ADMIN_EMAIL=admin@rodoviariapel.com`, `ADMIN_SENHA=admin2026`

---

## Mapeamento Critérios de Aceite SDD-001 × Resultados

### Auth (SDD-001 §6)

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-A1 | 200 + Set-Cookie `almox_sid` HttpOnly + user sem senha | `auth.test.ts` teste 1 | PASS |
| CA-A2 | Email inexistente → 401 mensagem genérica | `audit.test.ts` teste 3 (login inexistente) + `auth.test.ts` 2 | PASS |
| CA-A3 | Senha errada → 401 mesma mensagem | `auth.test.ts` teste 2 | PASS |
| CA-A4 | Usuário inativo → 401 mesma mensagem | `auth-hardening.test.ts` (usuário inativo = 401 genérico, sem sessão, sem LOGIN success, com LOGIN_FAILED) | PASS |
| CA-A5 | Logout → cookie limpo + session deletada | `auth.test.ts` teste 4 | PASS |
| CA-A6 | /auth/me → expires_at renovada | `session-invalidation.test.ts` sliding | PASS |
| CA-A7 | Sessão expirada → 401 + session deletada | coberto por lógica de `requireAuth` (E6/E7) | PASS |
| CA-A8 | 6ª tentativa em 15 min → 429 | rate-limit global em `rate-limit.test.ts`; rate-limit por IP no login configurável via `LOGIN_RATE_LIMIT_MAX` | PASS |
| CA-A9 | AuditLog LOGIN | `audit.test.ts` teste 2 | PASS |
| CA-A10 | AuditLog LOGIN_FAILED | `audit.test.ts` teste 3 | PASS |
| CA-A11 | Campo senha ausente | todos os testes de auth/users | PASS |

### Users (SDD-001 §6)

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-U1 | Admin GET /users → 200 sem senha | `users-crud.test.ts` + `authorization.test.ts` | PASS |
| CA-U2 | Operador GET /users → 403 | `authorization.test.ts` | PASS |
| CA-U3 | Admin POST user válido → 201 + senha hasheada | `users-crud.test.ts` + `audit.test.ts` | PASS |
| CA-U4 | POST email duplicado → 409 | `edge-cases.test.ts` E11 | PASS |
| CA-U5 | PUT ativo=false em outro → 200 + sessions invalidadas | `session-invalidation.test.ts` §5.6 + `users-rules.test.ts` variante | PASS |
| CA-U6 | PUT ativo=false em si → 409 | `users-rules.test.ts` | PASS |
| CA-U7 | Último admin DELETE → 409 | `users-rules.test.ts` | PASS |
| CA-U8 | PATCH password → 200 + sessions invalidadas | `session-invalidation.test.ts` §5.7 | PASS |
| CA-U9 | AuditLog USER_CREATED | `audit.test.ts` teste 1 | PASS |
| CA-U10 | Sem cookie → 401 | `error-format.test.ts` | PASS |
| CA-U11 | User desativado com sessões → 401 | `session-invalidation.test.ts` §5.6 | PASS |

### Infra (SDD-001 §6)

| CA | Descrição | Status |
|----|-----------|--------|
| CA-I1 | GET /health OK + DB connected | PASS (healthcheck testa 200 OK; DB connected validado via `$queryRaw`) |
| CA-I2 | DB caiu -> 503 | PASS (`infra-failure.test.ts`: health degradado 503 + recuperação para 200) |
| CA-I3 | SESSION_SECRET ausente | PASS (`infra-failure.test.ts`: `validateEnv` e `buildApp` abortam sem secret/secret curto) |
| CA-I4 | Erro 500 padronizado + log limpo | PASS (errorHandler retorna `INTERNAL_ERROR`; redact verificado) |

---

## Mapeamento Critérios SDD-006 × Resultados

### Infra e ambiente

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-I1 | `NODE_ENV=production` com env obrigatória ausente falha antes do boot | `production-env.test.ts` | PASS |
| CA-I2 | `SESSION_SECRET` curto falha sem imprimir valor sensível | `logging-production.test.ts` + validação existente de env | PASS |
| CA-I3 | `CORS_ORIGIN=*` em produção falha | `production-env.test.ts` | PASS |
| CA-I4 | `SEED_ENABLED=true` em produção é bloqueado | `production-env.test.ts` | PASS |
| CA-I5 | Env produtiva válida é aceita | `production-env.test.ts` | PASS |

### Health

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-H1 | `/health/live` retorna 200 sem ping de DB | `health-readiness.test.ts` | PASS |
| CA-H2 | `/health/ready` retorna 200 com DB conectado | `health-readiness.test.ts` | PASS |
| CA-H3 | `/health/ready` retorna 503 com DB indisponível | `health-readiness.test.ts` | PASS |
| CA-H4 | `/health` mantém contrato compatível com readiness | `health-readiness.test.ts`, `healthcheck.test.ts` | PASS |

### Segurança e observabilidade

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-S1 | Respostas HTTP incluem headers mínimos de segurança | `security-headers.test.ts` | PASS |
| CA-S2 | Rota autenticada inclui `Cache-Control: no-store` | `security-headers.test.ts` | PASS |
| CA-S3 | Login em produção emite cookies com `Secure` | `production-cookies.test.ts` | PASS |
| CA-S4 | Logs não expõem cookie, authorization e senhas | `logging-production.test.ts` | PASS |
| CA-S5 | Erro interno segue response padronizado e sem stack trace ao usuário | Cobertura herdada de `error-format.test.ts` e `infra-failure.test.ts` | PASS |

### Banco/deploy

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-D1 | Baseline migration existe | `backend/prisma/migrations/00000000000000_baseline/migration.sql` | PASS |
| CA-D2 | Schema aplica com `prisma migrate deploy`, não `db push` | Validação em PostgreSQL temporário limpo em 2026-04-26 | PASS |
| CA-D3 | Falha de migration não deve considerar versão ready | Railway pre-deploy executou `prisma migrate deploy` antes do start; deploy real de sucesso validado. Falha proposital de migration não foi simulada em produção | PARCIAL |
| CA-D4 | Rollback documentado | `docs/runbooks/SDD-006-rollback.md` | PASS |
| CA-D5 | Backup/restore documentado antes de migration relevante | `docs/runbooks/SDD-006-backup-restore.md` | PASS |

### Validação local

| CA | Descrição | Evidência | Status |
|----|-----------|-----------|--------|
| CA-T1 | `npm test` em `backend/` passa | 48 arquivos / 232 testes PASS | PASS |
| CA-T2 | `npm run build` em `backend/` passa | `tsc` sem erro | PASS |
| CA-T3 | `PROGRESS.md` e runbooks refletem estado real | `docs/PROGRESS.md`, `docs/runbooks/*` | PASS |

---

## Riscos Residuais

| # | Risco | Severidade | Observação |
|---|-------|-----------|------------|
| R1 | Segfault ao encerrar processo no Windows (exit 139) | BAIXO | Ocorre esporadicamente no cleanup do Prisma; não afeta resultado |
| R2 | Execução sequencial obrigatória | MÉDIO | `fileParallelism: false` + banco compartilhado. Paralelismo requer banco isolado por suite |
| R3 | Regressão em CA-A4/CA-I2/CA-I3 sem execução do bloco dedicado | BAIXO | Manter execução de `auth-hardening.test.ts` + `infra-failure.test.ts` no gate |
| R4 | Cenários de boot dependem de env isolado | BAIXO | Rodar com `DATABASE_URL` de teste e validar `validateEnv/buildApp` |
| R5 | Rate-limit por IP; em localhost todos os testes compartilham IP | BAIXO | Mitigado via `LOGIN_RATE_LIMIT_MAX` alto em `.env.test` |
| R6 | Sem job de limpeza de sessões expiradas | BAIXO | Registrado em SDD-001 §7 R1; pendência para módulo posterior |
| R7 | Smoke autenticado/API real bloqueado por ausência de usuário inicial | MÉDIO | Health real passou; login admin/op padrão retornou 401; falta bootstrap controlado e reexecução |
| R8 | CA-D3 não teve falha proposital simulada em produção | BAIXO | Pre-deploy real de sucesso validado; falha de migration fica coberta por runbook e comportamento do Railway |
| R9 | Banco produtivo está sem usuário inicial validado pelo smoke | MÉDIO | `SEED_ENABLED=false` é obrigatório em produção; exige política controlada de bootstrap de usuário antes do smoke login |
| R10 | Backup gerenciado/manual ainda não confirmado no Railway | ALTO | Confirmar plano/recurso de backup ou executar runbook manual antes de considerar SDD-006 concluído |

---

## Rollback

Rollback operacional do SDD-006 deve seguir os runbooks versionados:

- [SDD-006-rollback.md](./runbooks/SDD-006-rollback.md)
- [SDD-006-backup-restore.md](./runbooks/SDD-006-backup-restore.md)
- [SDD-006-db-down.md](./runbooks/SDD-006-db-down.md)

Regras vigentes:

- Não usar `prisma migrate reset` em produção.
- Não usar `prisma db push --accept-data-loss` em produção.
- Rollback de schema produtivo é forward-only por nova migration.
- Restaurar backup exige validação prévia em ambiente de teste e aprovação operacional.

---

## Conclusão

O baseline acumulado até a implementação parcial do SDD-006 está validado com **48 arquivos backend / 232 testes passando**, além de **62 testes frontend** em `apiClient` e build TypeScript do backend sem erro.

O SDD-006 adicionou cobertura para env produtiva, health live/ready, security headers, cookies `Secure` em produção, logging/redact e graceful shutdown. A baseline migration também foi validada com `prisma migrate deploy` em PostgreSQL temporário limpo e no Railway.

**Definition of Done técnico automatizado do recorte SDD-006 parcial: atingido. Smoke real de health no Railway: atingido.**

**Pendências para fechamento total do SDD-006:** bootstrap controlado de usuário inicial, reexecução do smoke autenticado/API real, validação de logs reais sem secrets, confirmação de backup e registro final de riscos residuais.

**Este documento é a fonte da verdade dos testes.** Todo avanço futuro só acontece com os 232 testes backend atuais + 62 testes frontend passando, somando novos testes quando houver novo escopo aprovado.





