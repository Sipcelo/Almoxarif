# SDD-004 — Integração Frontend ↔ Backend

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado
> **Cliente:** Rodoviária de Pelotas
> **Módulo:** 004 — Integração Frontend ↔ Backend (apiClient + CSRF + migração legacy)
> **Status:** SPEC APROVADA
> **Versão:** 1.0
> **Data de aprovação:** 2026-04-18
> **Dependências:** SDD-001, SDD-001-FIX, SDD-002, SDD-003, SDD-TEST-002A (todos concluídos, baseline 162/162)

---

## 1. Entendimento

Substituir a camada local de dados do frontend (`DB`/`Store` sobre `localStorage`) por um cliente HTTP (`apiClient`) que consome os 44 endpoints já ativos no backend. Integração entidade-por-entidade **in-place** (L1=C): a assinatura de `Store.getItems()`, `Store.setItems(...)` etc. é preservada; apenas a implementação passa a ser `fetch` com `credentials: "include"`. Mantém-se o frontend puro (sem framework), conforme §8 do CLAUDE.md.

Encerra os riscos S1–S7, D1–D6, A1–A4 e P1–P4 do §6 do CLAUDE.md no frontend, pois nenhum dado sensível continuará em `localStorage` após migração.

---

## 2. Premissas

| # | Premissa |
|---|---|
| P1 | Backend em 162/162, zero débito — baseline congelada para esta SPEC |
| P2 | Cookie `almox_sid` é `HttpOnly` + `SameSite=Lax` (já configurado) — frontend nunca lê o cookie diretamente |
| P3 | CORS já permite `credentials: true` na origem do frontend dev — produção exigirá `ALLOWED_ORIGINS` configurado |
| P4 | Mensagens de erro do backend estão em PT e são seguras para exibição ao usuário final (§DV3 do SDD-001-FIX) |
| P5 | O frontend atual já tem `utils.js` com infra de toast (`showNotification`) — será reaproveitada |
| P6 | Polling/real-time não são exigidos — todas as atualizações são pull após ação do usuário |
| P7 | `apiClient` vive em um único arquivo novo (`apiClient.js`), sem build step — `<script>` tradicional |
| P8 | Roles válidos para UI: `admin`, `gerente`, `operador`, `visitante` (CLAUDE.md §4) |

---

## 3. Decisões aprovadas

| # | Decisão | Resposta |
|---|---|---|
| L1 | Estratégia de migração | **C** — camada `apiClient` substitui `DB`/`Store` in-place, integração por entidade |
| L2 | Paridade de dados legados | **B** — script one-shot export/import localStorage → backend |
| L3 | Tratamento de erro na UI | **B** — toast com `error.message` do backend (já em PT) |
| L4 | Sessão expirada / 401 | **A** — redirect duro para login limpando estado, com mensagem "Sua sessão expirou" |
| L5 | Ordem das telas | Mantida: Login → Painel → Estoque → Entradas → Saídas → Funcionários → Configurações → Usuários → Relatórios |
| L6 | CSRF | **A** — token por sessão incluído no SDD-004 |
| L7 | Controle de acesso físico (`alm_acessos`) | **B** — backlog para SDD-005 |
| L8 | Testes | **C** — Playwright mínimo + vitest unit tests no `apiClient` |

### Defaults assumidos (LR1–LR5)

Se não houver objeção durante o DESIGN, estes viram parte da SPEC:

| # | Item | Default |
|---|---|---|
| LR1 | Nome do header CSRF | `x-almox-csrf` |
| LR2 | Local do token CSRF no frontend | cookie não-HttpOnly `almox_csrf` emitido no login; frontend lê via `document.cookie` e ecoa em header |
| LR3 | Diretório do migration tool | `backend/scripts/import-legacy.ts` |
| LR4 | Endpoint base configurável | `window.ALMOX_API_BASE` com fallback `/api/v1` |
| LR5 | Timeout padrão de requests | 10s (abortar com mensagem genérica) |

---

## 4. SPEC

### 4.1 Objetivo

Entregar frontend 100% dependente do backend, sem `localStorage` como fonte de verdade, com CSRF em vigor e E2E mínimo verde.

### 4.2 Escopo

**Dentro:**
- Novo módulo `apiClient.js` com métodos para os 44 endpoints
- Refactor in-place de `auth.js`, `data.js`, `modals.js`, `app.js`, `dashboard.js`, `pages.js` para chamar `apiClient` em vez de `localStorage`
- CSRF token-per-session (backend + frontend)
- Script `backend/scripts/import-legacy.ts` para migrar dados `alm_*` → Postgres (one-shot, admin-only)
- Tela/modal de "sessão expirada"
- Testes unitários de `apiClient` (vitest, com `fetch` mockado)
- E2E Playwright: login + 1 fluxo feliz por módulo (9 fluxos)

**Fora:**
- `alm_acessos` (SDD-005)
- Service worker, offline, PWA
- Reescrita visual ou de UX
- Paginação/virtualização de tabelas grandes (backlog)
- Relatórios de auditoria (SDD-005)
- Security headers / CSP (SDD-006)

### 4.3 Contrato do `apiClient`

```
apiClient.auth.login(email, senha)          → { user }
apiClient.auth.logout()                      → void
apiClient.auth.me()                          → { user }
apiClient.users.list({ page, limit, q })    → { users, meta }
apiClient.users.get(id)                      → { user }
apiClient.users.create(payload)              → { user }
apiClient.users.update(id, payload)          → { user }
apiClient.users.updatePassword(id, senha)   → { user }
apiClient.users.remove(id)                   → void
apiClient.funcionarios.{list|get|create|update|remove}
apiClient.setores.{list|get|create|update|remove}
apiClient.categorias.{list|get|create|update|remove}
apiClient.depositos.{list|get|create|update|remove}
apiClient.items.{list|get|create|update|remove}
apiClient.entradas.{list|create}
apiClient.saidas.{list|create}
apiClient.ajustes.{list|create}              // admin
apiClient.health()                           → { status, checks }
```

Todos retornam `Promise`. Todos jogam `ApiError { code, message, status, details }` em falha. **Nunca** silenciam erro.

### 4.4 Regras do `apiClient`

| # | Regra |
|---|---|
| R1 | Toda request passa `credentials: "include"` |
| R2 | Toda request mutável (POST/PUT/PATCH/DELETE) envia header `x-almox-csrf: <token do cookie almox_csrf>` |
| R3 | `Content-Type: application/json` em todo corpo; body serializado com `JSON.stringify` |
| R4 | Response 2xx → resolve `await res.json()` (ou `null` em 204) |
| R5 | Response 4xx/5xx → parse `{ error: { code, message, details } }` e joga `ApiError` |
| R6 | Status 401 em qualquer request → dispara evento global `almox:session-expired` (handler único mostra banner L4) |
| R7 | Falha de rede / timeout → `ApiError { code: "NETWORK_ERROR", message: "Falha de conexão. Tente novamente." }` |
| R8 | Timeout de 10s via `AbortController` |
| R9 | Nunca persiste dados retornados em `localStorage` — apenas em variáveis de módulo/memória |

### 4.5 CSRF (L6=A)

**Backend:**
- No `POST /api/v1/auth/login` e `GET /api/v1/auth/me`: além do cookie `almox_sid` (HttpOnly), emitir cookie `almox_csrf=<uuid>` com `HttpOnly=false`, `SameSite=Lax`, `Secure` em prod. Valor armazenado em `Session.csrfToken` (coluna nova NOT NULL).
- Middleware `requireCsrf` aplica-se a POST/PUT/PATCH/DELETE; compara header `x-almox-csrf` com `Session.csrfToken`. Mismatch ou ausente → 403 `CSRF_ERROR`.
- `POST /api/v1/auth/logout`: limpa ambos cookies.
- Rotas públicas (`login`, `/health`) isentas.

**Frontend:**
- `apiClient` lê `document.cookie` procurando `almox_csrf=` e injeta em header em requests mutáveis.
- Ausência do cookie → erro local antes da request: `ApiError { code: "CSRF_MISSING" }`.

**Migração Prisma:**
- Adicionar `csrf_token String` NOT NULL à tabela `sessions`.

### 4.6 Sessão expirada (L4=A)

- Handler único em `auth.js` escuta `almox:session-expired`.
- Ação:
  1. Remove estado em memória (`currentUser`, caches do `apiClient`).
  2. Limpa `sessionStorage.alm_user`.
  3. Renderiza tela de login com banner: **"Sua sessão expirou. Faça login novamente."**
  4. Não preserva formulário em andamento.

### 4.7 Tratamento de erro na UI (L3=B)

- Todo `catch (e)` em código que chama `apiClient`:
  - `e.status === 401`: já tratado em R6, não exibe toast.
  - `e.code === "CSRF_ERROR"`: força reload (token stale).
  - Caso contrário: `showNotification(e.message, "error")` — usa `error.message` do backend diretamente.
- Erros 400 com `details`: exibir `details.map(d => d.message).join("; ")`.

### 4.8 Ordem de integração das telas (L5)

Cada passo fecha com testes verdes antes do próximo.

| Ordem | Tela | Endpoints consumidos | E2E obrigatório |
|---|---|---|---|
| 1 | Login | `auth.login`, `auth.me`, `auth.logout` | login feliz + login inválido |
| 2 | Painel (Dashboard) | `items.list`, `entradas.list`, `saidas.list` | carrega cards sem erro |
| 3 | Estoque | `items.*`, `categorias.list`, `depositos.list` | criar item + listar |
| 4 | Entradas | `entradas.create`, `entradas.list`, `items.list` | registrar entrada |
| 5 | Saídas | `saidas.create`, `saidas.list`, `funcionarios.list` | registrar saída |
| 6 | Funcionários | `funcionarios.*`, `setores.list` | criar funcionário |
| 7 | Configurações | `setores.*`, `categorias.*`, `depositos.*` | criar setor |
| 8 | Usuários | `users.*` | criar usuário |
| 9 | Relatórios | leitura via endpoints já cobertos | abre preview de impressão |

### 4.9 Migração de dados legados (L2=B)

**Script:** `backend/scripts/import-legacy.ts`

**Input:** JSON exportado do frontend legacy (botão "Exportar" já existente em Configurações).

**Comando:**
```
ALLOW_LEGACY_IMPORT=true SEED_ENABLED=false \
  node --loader tsx backend/scripts/import-legacy.ts <arquivo.json>
```

**Regras:**
- Só roda se `ALLOW_LEGACY_IMPORT=true` (proteção).
- Dedupe por `codigo` (items), `email` (users), `nome` normalizado (setor/categoria/deposito/funcionario).
- IDs sequenciais legados são descartados; backend gera novos UUIDs.
- Senhas em texto puro de `alm_users` são hasheadas com bcrypt salt 12.
- `AuditLog` com `action="LEGACY_IMPORT"` por entidade.
- Relatório stdout: `{ created, skipped, failed }` por tabela.
- Entradas/saídas legadas: importar apenas se `itemCodigo` casar com `Item.codigo` existente; caso contrário skip + warn.

### 4.10 Testes (L8=C)

**Unitários (vitest):**
- `apiClient.test.ts` — 1 teste por endpoint × (happy + 401 + 4xx + network) ≈ 50 testes com `fetch` mockado.
- CSRF: 3 testes (header injetado, cookie ausente, mismatch).

**E2E (Playwright):**
- Config em `e2e/` (nova pasta na raiz).
- 1 browser (chromium), 1 viewport (1280×800).
- `baseURL` via env (default `http://localhost:5173`).
- 9 specs (uma por tela, §4.8). Cada spec: 1 happy path.
- Pré-condição: banco seedado com admin; `e2e/setup.ts` limpa entre specs.
- CI: rodam sequencialmente após suite de backend.

**Baseline após SDD-004:** 162 (backend) + ~55 (apiClient unit) + 9 (E2E) = **~226 testes**.

---

## 5. Edge cases

| # | Caso | Comportamento |
|---|---|---|
| E1 | Cookie `almox_sid` válido mas `almox_csrf` ausente | `apiClient` joga `CSRF_MISSING` local; UI mostra "Sessão inconsistente" e dispara logout |
| E2 | Dois tabs abertos, logout em um | Próxima request mutável no outro → 401 → `almox:session-expired` → redirect |
| E3 | Usuário desativado durante uso | Próxima request → 401 → fluxo L4 |
| E4 | Senha alterada pelo admin | Próxima request → 401 → fluxo L4 |
| E5 | Role rebaixado durante uso | Backend 403 → toast "Você não tem permissão para essa ação" |
| E6 | Backend offline | `ApiError NETWORK_ERROR` → toast; UI não trava |
| E7 | Resposta 429 (rate limit) | Toast com `error.message`; botão continua habilitado |
| E8 | Content-Type ≠ JSON (proxy/gateway) | `ApiError NETWORK_ERROR` |
| E9 | Import legado com código duplicado | Skip + log; não aborta lote |
| E10 | Import legado com senha em texto puro | Hasheada com bcrypt salt 12 |
| E11 | Reload com sessão válida | `apiClient.auth.me()` revalida; 200 restaura; 401 vai pra login |
| E12 | Sem JavaScript habilitado | `<noscript>` informa que JS é obrigatório |
| E13 | CSRF token no cookie mas sem sessão | Backend retorna 401 antes de checar CSRF |
| E14 | Fetch bloqueado por extensão | `ApiError NETWORK_ERROR` |

---

## 6. Critérios de aceite

### 6.1 Globais

- [ ] Baseline backend mantida: **162/162 continuam passando**
- [ ] `npx tsc --noEmit` limpo no backend
- [ ] Middleware `require-csrf.ts` implementado e coberto por testes
- [ ] Migration Prisma aplicada (`csrf_token` em `sessions`)
- [ ] Frontend não contém mais nenhum `localStorage.setItem("alm_*", ...)` exceto `sessionStorage.alm_user` como cache de UI
- [ ] Nenhum dado sensível (users, items, entradas, saidas) em `localStorage` após login
- [ ] `fetch` do frontend sempre com `credentials: "include"`
- [ ] Toda request mutável envia `x-almox-csrf`

### 6.2 Por tela

Cada tela com **um** E2E happy path passando.

| Tela | Critério |
|---|---|
| Login | admin válido → painel; inválido → toast "Credenciais inválidas", sem redirect; após logout cookie removido |
| Painel | carrega stats sem erro; backend down → toast, UI não trava |
| Estoque | criar item código único → 201 e aparece na lista; duplicado → toast 409 PT |
| Entradas | registrar → `item.saldo` aumenta; item inativo → 409 PT |
| Saídas | registrar com saldo → saldo diminui; sem saldo → 409 "Estoque insuficiente" |
| Funcionários | criar em setor ativo → 201; setor inativo → 409 |
| Configurações | criar setor → 201; duplicado case-insensitive → 409 |
| Usuários | admin cria → 201; operador tenta → 403 |
| Relatórios | preview de impressão com dados do backend; zero uso de localStorage |

### 6.3 Migração legacy

- [ ] Script `import-legacy.ts` roda contra JSON de exemplo e produz relatório correto
- [ ] Nenhuma senha persistida em texto puro
- [ ] AuditLog `LEGACY_IMPORT` por entidade
- [ ] Reexecução idempotente (dedupe correto)

### 6.4 CSRF

- [ ] POST sem header → 403 `CSRF_ERROR`
- [ ] POST com header inválido → 403 `CSRF_ERROR`
- [ ] GET nunca exige CSRF
- [ ] Login público aceito; emite `almox_csrf`
- [ ] Logout limpa ambos cookies

### 6.5 Sessão expirada

- [ ] 401 dispara banner + redirect
- [ ] Formulário em andamento é descartado
- [ ] Banner desaparece em login válido subsequente

---

## 7. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | CORS prod exigirá `ALLOWED_ORIGINS` | MÉDIO | `.env.example` documenta; fail-fast em prod se ausente |
| R2 | Cookie `almox_csrf` não-HttpOnly é legível por JS → risco XSS exfiltrar | MÉDIO | Aceito no design double-submit; mitigação real com CSP em SDD-006 |
| R3 | Migração legacy perder dados com schema divergente | MÉDIO | Dry-run obrigatório; relatório mostra skips |
| R4 | Playwright pesado e flaky | BAIXO | 9 specs felizes; sem retry automático; flakes viram bug |
| R5 | Código legado duplicado dificulta refactor | MÉDIO | Respeitar §16.3 CLAUDE.md (mudanças cirúrgicas) |
| R6 | `sessionStorage.alm_user` é mutável pelo usuário | BAIXO | Tratado como cache UI; `auth.me()` revalida em boot |
| R7 | Rota de impressão depende de layout atual | BAIXO | Intocada; só muda fonte de dados |
| R8 | Timeout 10s pode ser curto em listas grandes | BAIXO | Revisar após SDD-005; paginação/streaming se necessário |

---

## 8. Definition of Done

- [ ] SPEC aprovada
- [ ] DESIGN aprovado
- [ ] Migration CSRF aplicada
- [ ] `apiClient.js` completo com testes (~55)
- [ ] 9 telas migradas (ordem §4.8)
- [ ] E2E Playwright verde (9 specs)
- [ ] Baseline backend 162/162 intocada
- [ ] `tsc --noEmit` limpo
- [ ] Zero `localStorage.setItem("alm_*")` fora de `sessionStorage.alm_user`
- [ ] `PROGRESS.md`, `RELATORIO-TESTES-SPEC-001.md`, `CLAUDE.md §15` atualizados
- [ ] Débito técnico = zero
- [ ] Script `import-legacy.ts` validado contra export real

---

## 9. Próximos passos

1. Produzir DESIGN técnico detalhado (próxima entrega):
   - Contrato completo do `apiClient` (tipos, parâmetros, retornos)
   - Diff Prisma para `csrf_token`
   - Estrutura de diretórios `e2e/`
   - Fluxo de migração legacy com pseudocódigo
   - Plano de refactor tela-a-tela com pontos de corte
2. Aprovação do DESIGN
3. Implementação conforme §4.8 (uma PR por tela sugerida)

---

## 10. Referências

- [CLAUDE.md](../CLAUDE.md) §4, §6, §8, §11, §15, §16
- [SDD-001-bootstrap-auth-users.md](./SDD-001-bootstrap-auth-users.md)
- [SDD-002-employees-settings.md](./SDD-002-employees-settings.md)
- [SDD-003-Inv-Stock.md](./SDD-003-Inv-Stock.md)
- [SDD-Pentester.md](./SDD-Pentester.md)
- [PROGRESS.md](./PROGRESS.md)
- [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md)
