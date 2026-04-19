# Progresso do Projeto — Almox

> **Última atualização:** 2026-04-18 (pós PR-3 SDD-004: refactor Painel/Dashboard via apiClient)
> **Responsável técnico:** Auralynne / Rodoviária de Pelotas
> **Documento de referência:** [CLAUDE.md](../CLAUDE.md), [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md)

---

## 1. Snapshot Executivo

| Métrica | Valor |
|---------|-------|
| SDDs concluídos | **3 de 6** (SDD-001 + SDD-002 + SDD-003; SDD-001-FIX concluído como adendo) |
| SDDs pendentes | 3 (SDD-004, SDD-005, SDD-006) |
| Testes totais | **231/231 passando** (170 backend + 61 frontend apiClient) |
| Arquivos de teste | 39 (38 backend + 1 frontend) |
| Testes `skip`/`todo` | 0 |
| Tempo de execucao da suite | ~52s |
| TypeScript `tsc --noEmit` | ✅ limpo |
| Débitos técnicos de código | **ZERO** |
| Débitos de feature gap | 3 (CA-A4, CA-I2, CA-I3 — registrados, não bloqueantes) |

---

## 2. Status por SDD

| SDD | Escopo | Status | Testes | Evidência |
|-----|--------|--------|--------|-----------|
| **SDD-001** | Bootstrap backend: Fastify + TS + Prisma + PostgreSQL, Auth, Users CRUD, AuditLog, rate limit, error handler, Pino redact | ✅ **CONCLUÍDO** | 40 | `backend/src/**`, `prisma/schema.prisma` |
| **SDD-001-FIX** | Correção DV1/DV3/DV4/DV5/DV7 + clean-code zero-débito (Bloco E: paginação de users) | ✅ **CONCLUÍDO** | 46 (cumulativo) | `RELATORIO-TESTES-SPEC-001.md` Blocos A-E |
| **SDD-002** | Employees + Settings (Funcionários, Setores, Categorias, Depósitos) | ✅ **CONCLUÍDO** | 78 (cumulativo, +32) | `docs/SDD-002-employees-settings.md`, Bloco F |
| **SDD-003** | Inventory + Stock Movements (Itens, Entradas, Saídas, ajustes auditados) | ✅ **CONCLUÍDO** | 160 (cumulativo, +27) | `docs/SDD-003-Inv-Stock.md`, `docs/SDD-003-DESIGN-Inv-Stock.md`, Bloco H |
| **SDD-004** | Integração Frontend ↔ Backend (substituir localStorage por fetch API) | 🚧 **Em progresso** (PR-1 CSRF + PR-2 login + PR-3 Painel) | 170 backend + 61 frontend | `apiClient.js`, `test-frontend/apiClient.test.ts`, `front/js/auth.js`, `front/js/pages/dashboard.js`, `e2e/tests/01-login.spec.ts`, `e2e/tests/02-painel.spec.ts` |
| **SDD-005** | Reports + Audit endpoints | ⏸ Pendente | — | — |
| **SDD-006** | Deploy + Observabilidade | ⏸ Pendente | — | — |

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
| GET | `/health` | público | — | infra |

**Total:** 44 endpoints ativos.

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

---

## 4. Frontend — Estado Atual

**Status:** inalterado desde antes do SDD-001. Continua com localStorage (`alm_*`).

Frontend NÃO consome backend ainda. Integração programada para **SDD-004**.

### Arquivos legados (raiz do repositório)

```
index.html, variables.css, components.css, layout.css, login.css
data.js, utils.js, auth.js, modals.js, app.js, dashboard.js, pages.js
```

Todas as entidades do frontend (`alm_items`, `alm_entradas`, `alm_saidas`, `alm_acessos`, `alm_funcionarios`, `alm_setores`, `alm_categorias`, `alm_depositos`) permanecem em localStorage até SDD-004.

### Riscos do frontend ainda vigentes (§6 do CLAUDE.md)

| # | Risco | Severidade | Mitigação planejada |
|---|-------|-----------|---------------------|
| S1-S7 | Senhas em texto puro, auth client-side, autorização por UI, dados no console | CRÍTICO | Mitigado no backend; removido do frontend em SDD-004 |
| D1-D6 | Sem transacionalidade, sem UUID, dados desnormalizados | CRÍTICO | Resolvido por SDD-003 (movimentos) + SDD-004 (integração) |
| A1-A4 | Sem auditoria | ALTO | Resolvido no backend; exposto no frontend em SDD-005 |
| P1-P4 | localStorage inadequado | ALTO | Substituído por API em SDD-004 |

---

## 5. Testes — Inventário Canônico

**Regra de ouro:** nenhum SDD avança se qualquer teste existente falhar. Detalhes completos em [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md).

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
| **TOTAL** | **38 arquivos** | **170** |

### Comando canônico

```bash
cd backend
# Unix
DATABASE_URL=postgresql://postgres:123456@localhost:5432/almox_test npx vitest run --reporter=basic
# Windows (cmd)
set DATABASE_URL=postgresql://postgres:123456@localhost:5432/almox_test
npx vitest run --reporter=basic
# Windows (PowerShell)
$env:DATABASE_URL="postgresql://postgres:123456@localhost:5432/almox_test"
npx vitest run --reporter=basic
```

**Resultado esperado:** `Test Files 38 passed (38) | Tests 170 passed (170)`.

---

## 6. Débitos Técnicos

### 6.1 Débitos de código

**ZERO.** Política do projeto: nenhum SDD avança com débito técnico em aberto.

### 6.2 Débitos de feature gap (registrados, não bloqueantes)

| # | Item | Severidade | Escopo |
|---|------|-----------|--------|
| CA-A4 | Teste explícito de login com `ativo=false` (hoje coberto indiretamente) | BAIXO | Próxima iteração de auth |
| CA-I2 | Resposta 503 quando DB cai | BAIXO | SDD-006 (observabilidade) |
| CA-I3 | Validação de boot quando `SESSION_SECRET` ausente | BAIXO | SDD-006 |

---

## 7. Próximos Passos

### 7.1 Imediato — SDD-004 (Integração Frontend ↔ Backend)

Escopo imediato:
- substituir camada local (`DB`/`Store`) por `fetch` com cookie credentials
- manter fluxo incremental sem ruptura de telas
- fechar contratos de erro e autorização já ativos no backend

### 7.2 Médio prazo

- **SDD-004** Integração frontend: substituir camada `DB`/`Store` por `apiClient` com fetch + cookie credentials
- **SDD-005** Endpoints de relatórios e consulta de AuditLog paginado
- **SDD-006** Deploy (Render/Railway/VPS) + observabilidade (healthcheck completo, métricas, alertas)

---

## 8. Políticas vigentes (fixas)

1. **SDD rigoroso** — toda demanda passa por SPEC → aprovação → DESIGN → implementação (§11 do CLAUDE.md)
2. **Zero débito técnico** — nenhum SDD fecha com débito em aberto (diretriz do usuário em 2026-04-16)
3. **Regressão zero** — inventário de 170 testes deve continuar passando integralmente
4. **Migração incremental** — frontend permanece até SDD-004; nada é quebrado sem substituto pronto
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

---

## 10. Referências rápidas

- **Contexto técnico:** [`CLAUDE.md`](../CLAUDE.md)
- **SPEC SDD-001:** [`docs/SDD-001-bootstrap-auth-users.md`](./SDD-001-bootstrap-auth-users.md)
- **SPEC SDD-001-FIX:** [`docs/SDD-001-FIX-correcao-desvios.md`](./SDD-001-FIX-correcao-desvios.md)
- **SPEC SDD-002:** [`docs/SDD-002-employees-settings.md`](./SDD-002-employees-settings.md)
- **Relatório de testes (fonte da verdade):** [`docs/RELATORIO-TESTES-SPEC-001.md`](./RELATORIO-TESTES-SPEC-001.md)
- **Schema Prisma:** [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)
- **Seed:** [`backend/prisma/seed.ts`](../backend/prisma/seed.ts)





