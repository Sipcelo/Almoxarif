# DESIGN — SDD-004: Integração Frontend ↔ Backend

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado
> **Cliente:** Rodoviária de Pelotas
> **Módulo:** 004 — Integração Frontend ↔ Backend (DESIGN técnico)
> **Status:** DESIGN APROVADO
> **Versão:** 1.0
> **Data de aprovação:** 2026-04-18
> **SPEC base:** [SDD-004-frontend-integration.md](./SDD-004-frontend-integration.md)
> **Decisões técnicas:** D1=B, D2=A, D3=A, D4=B, D5=B

---

## 1. Visão arquitetural

```
┌───────────────────────────────────────────────────────────┐
│                        Navegador                           │
│  ┌──────────────────┐    ┌──────────────────────────────┐ │
│  │ index.html       │    │ apiClient.js (NEW)           │ │
│  │  ├─ auth.js  ────┼───►│  ├─ http() → fetch wrapper   │ │
│  │  ├─ app.js       │    │  ├─ ApiError class           │ │
│  │  ├─ pages.js     │    │  ├─ csrfFromCookie()         │ │
│  │  ├─ modals.js    │    │  └─ módulos: auth, users,    │ │
│  │  ├─ dashboard.js │    │     funcionarios, items, ... │ │
│  │  └─ data.js ─────┼────┤                              │ │
│  │     (Store fica  │    │ sessionStorage.alm_user      │ │
│  │      in-memory)  │    │ (cache UI apenas)            │ │
│  └──────────────────┘    └──────────────────────────────┘ │
│         Cookies: almox_sid (HttpOnly) + almox_csrf (JS)   │
└────────────────────┬──────────────────────────────────────┘
                     │ credentials: include
                     │ x-almox-csrf: <token>
                     ▼
┌───────────────────────────────────────────────────────────┐
│                    Fastify Backend                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ preHandler: requireAuth → requireCsrf (NEW)          │ │
│  │                           (aplica em POST/PUT/       │ │
│  │                            PATCH/DELETE exceto       │ │
│  │                            /auth/login e /health)    │ │
│  └──────────────────────────────────────────────────────┘ │
│  Routes: 44 existentes (sem mudança de contrato)          │
│  Login/me agora retornam `{ user, csrfToken }`            │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Decisões técnicas

| # | Decisão | Resposta |
|---|---|---|
| D1 | Entrega do token CSRF no login | **B** — cookie `almox_csrf` + campo `csrfToken` no body (redundância explícita) |
| D2 | Rotação do token CSRF | **A** — token fixo por sessão (vida útil = sessão) |
| D3 | Estratégia de migration | **A** — `prisma db push --force-reset` em dev/test |
| D4 | Escopo de entrega | **B** — 9 PRs, uma por tela (ordem §4.8 da SPEC) |
| D5 | Playwright contra qual backend | **B** — backend inicializado pelo Playwright via `webServer` |

---

## 3. Mudanças de backend

### 3.1 Schema Prisma

**Arquivo:** `backend/prisma/schema.prisma`

```prisma
model Session {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime @map("expires_at")
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  csrfToken  String   @map("csrf_token")           // ← NOVO
  criadoEm   DateTime @default(now()) @map("criado_em")

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```

**Migração (D3=A):** `prisma db push --force-reset` em dev/test. Sem migration file para produção ainda (projeto não está em prod). Nota adicionada no `PROGRESS.md`.

### 3.2 Middleware `require-csrf`

**Arquivo novo:** `backend/src/shared/middleware/require-csrf.ts`

```ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/app-error";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_HEADER = "x-almox-csrf";

export async function requireCsrf(req: FastifyRequest, _reply: FastifyReply) {
  if (!MUTATING_METHODS.has(req.method)) return;

  const sessionUser = req.sessionUser;       // populado por requireAuth
  const sessionCsrf = req.sessionCsrfToken;  // novo campo populado por requireAuth

  if (!sessionUser || !sessionCsrf) {
    throw new AppError("UNAUTHORIZED", "Sessão inválida", 401);
  }

  const headerToken = req.headers[CSRF_HEADER];
  if (typeof headerToken !== "string" || headerToken.length === 0) {
    throw new AppError("CSRF_ERROR", "Token CSRF ausente", 403);
  }

  if (headerToken !== sessionCsrf) {
    throw new AppError("CSRF_ERROR", "Token CSRF inválido", 403);
  }
}
```

**Registro:** preHandler global **após** `requireAuth`, com exceção explícita em rotas públicas (`/auth/login`, `/health`).

**Novo código de erro:** `CSRF_ERROR` adicionado em `src/shared/errors/app-error.ts` e `src/shared/types/index.ts` (lista 7 → 8 ErrorCodes canônicos). Atualizar `CLAUDE.md §15` e `RELATORIO-TESTES-SPEC-001.md`.

### 3.3 Alterações em `requireAuth`

**Arquivo:** `backend/src/shared/middleware/require-auth.ts`

```ts
declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
    sessionId?: string;
    sessionCsrfToken?: string;   // ← NOVO
  }
}
```

Após `prisma.session.findUnique(...)`, extrair `session.csrfToken` e anexar em `req.sessionCsrfToken`.

### 3.4 `authRoutes` — emissão e limpeza do cookie CSRF

**Arquivo:** `backend/src/modules/auth/handlers.ts`

```ts
// loginHandler, após criar a sessão:
const csrfToken = randomUUID();
await prisma.session.create({ data: { ..., csrfToken } });
setSessionCookie(reply, session.id);
setCsrfCookie(reply, csrfToken);                // ← NOVO helper
return reply.send({ user: safeUser, csrfToken }); // D1=B: body + cookie

// meHandler:
return reply.send({ user: safeUser, csrfToken: req.sessionCsrfToken });

// logoutHandler:
clearSessionCookie(reply);
clearCsrfCookie(reply);                         // ← NOVO helper
return reply.send({ message: "Sessão encerrada" });
```

**Arquivo:** `backend/src/config/session.ts`

```ts
const CSRF_COOKIE_NAME = "almox_csrf";

export function setCsrfCookie(reply: FastifyReply, token: string) {
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    path: "/",
    httpOnly: false,                 // precisa ser legível pelo JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export function clearCsrfCookie(reply: FastifyReply) {
  reply.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
}
```

### 3.5 Testes de backend adicionais

**Arquivo novo:** `backend/test/csrf.test.ts` — 8 testes:

1. POST sem header CSRF → 403 `CSRF_ERROR`
2. POST com header inválido → 403 `CSRF_ERROR`
3. POST com header correto → 200/201
4. PUT sem header → 403
5. PATCH sem header → 403
6. DELETE sem header → 403
7. GET nunca exige CSRF → 200
8. Login público aceito sem cookie CSRF; resposta tem `csrfToken` no body e cookie

**Efeito cruzado:** os 162 testes existentes que fazem POST/PUT/PATCH/DELETE precisam enviar CSRF. Atualização cirúrgica em `test/helpers.ts`:

```ts
export async function loginAsAdmin(app: FastifyInstance): Promise<{ cookie: string; csrfToken: string }> {
  // retorna cookie + token
}

export function authHeaders(ctx: { cookie: string; csrfToken: string }) {
  return { cookie: ctx.cookie, "x-almox-csrf": ctx.csrfToken };
}
```

**Impacto:** substituir `headers: { cookie }` por `headers: authHeaders(ctx)` em chamadas mutáveis. ~60–80 edits em 30+ arquivos, feito numa única PR (PR-1). Nenhum teste é removido.

**Baseline resultante após PR-1:** 162 + 8 = **170 backend tests**.

---

## 4. Frontend — `apiClient.js`

### 4.1 Localização e carga

**Arquivo novo:** `apiClient.js` (raiz do repositório, ao lado de `auth.js`).

**Inclusão em `index.html`:** `<script src="apiClient.js"></script>` **antes** de `auth.js`, `data.js`, `modals.js`, `app.js`, `pages.js`, `dashboard.js`.

### 4.2 Estrutura interna

```js
// apiClient.js
(function (global) {
  const API_BASE = global.ALMOX_API_BASE || "/api/v1";
  const TIMEOUT_MS = 10000;
  const CSRF_HEADER = "x-almox-csrf";
  const CSRF_COOKIE = "almox_csrf";
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  class ApiError extends Error {
    constructor({ code, message, status, details }) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details || [];
    }
  }

  function csrfFromCookie() {
    const match = document.cookie.match(/(?:^|;\s*)almox_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function http(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers = { "Content-Type": "application/json" };
    if (MUTATING.has(method)) {
      const token = csrfFromCookie();
      if (!token) {
        clearTimeout(timer);
        throw new ApiError({
          code: "CSRF_MISSING",
          message: "Sessão inconsistente. Faça login novamente.",
          status: 0,
        });
      }
      headers[CSRF_HEADER] = token;
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: "include",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new ApiError({
        code: "NETWORK_ERROR",
        message: "Falha de conexão. Tente novamente.",
        status: 0,
      });
    }
    clearTimeout(timer);

    if (res.status === 204) return null;

    let payload = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try { payload = await res.json(); } catch { payload = null; }
    }

    if (res.ok) return payload;

    if (res.status === 401) {
      global.dispatchEvent(new CustomEvent("almox:session-expired"));
    }

    const err = (payload && payload.error) || {};
    throw new ApiError({
      code: err.code || "UNKNOWN",
      message: err.message || "Erro inesperado",
      status: res.status,
      details: err.details,
    });
  }

  const apiClient = {
    ApiError,
    auth: {
      login: (email, senha) => http("POST", "/auth/login", { email, senha }),
      logout: () => http("POST", "/auth/logout"),
      me: () => http("GET", "/auth/me"),
    },
    users: {
      list: (q) => http("GET", `/users${qs(q)}`),
      get: (id) => http("GET", `/users/${id}`),
      create: (p) => http("POST", "/users", p),
      update: (id, p) => http("PUT", `/users/${id}`, p),
      updatePassword: (id, senha) => http("PATCH", `/users/${id}/password`, { senha }),
      remove: (id) => http("DELETE", `/users/${id}`),
    },
    funcionarios: crudFactory("/funcionarios"),
    setores: crudFactory("/settings/setores"),
    categorias: crudFactory("/settings/categorias"),
    depositos: crudFactory("/settings/depositos"),
    items: crudFactory("/items"),
    entradas: { list: (q) => http("GET", `/entradas${qs(q)}`), create: (p) => http("POST", "/entradas", p) },
    saidas:   { list: (q) => http("GET", `/saidas${qs(q)}`),   create: (p) => http("POST", "/saidas", p) },
    ajustes:  { list: (q) => http("GET", `/ajustes${qs(q)}`),  create: (p) => http("POST", "/ajustes", p) },
    health: () => http("GET", "/health"),
  };

  global.apiClient = apiClient;
})(window);
```

`crudFactory` e `qs` são helpers internos. Tamanho estimado: ~220 linhas (abaixo do limite 400 por arquivo).

### 4.3 Teste unitário

**Arquivo novo:** `test-frontend/apiClient.test.js` (nova pasta na raiz).

- Setup: vitest com environment `jsdom`; `fetch` mockado via `vi.fn()`.
- Padrão:

```js
it("users.create envia POST com CSRF e corpo JSON", async () => {
  document.cookie = "almox_csrf=abc-123";
  fetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ user: {} }),
    headers: new Headers({ "content-type": "application/json" }),
  });
  await apiClient.users.create({ nome: "X", email: "x@x.com", senha: "s", role: "operador" });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/users"),
    expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "x-almox-csrf": "abc-123" }),
    }),
  );
});
```

- Cobertura mínima:
  - 1 happy + 1 401 + 1 4xx + 1 network/timeout por método público (~50 testes)
  - 3 testes de CSRF (missing cookie, error 403, GET sem header)
  - 1 teste de timeout (AbortController)
  - 1 teste de 204 No Content
- **Configuração separada:** `vitest.config.frontend.ts` com `environment: "jsdom"`. Sem conflito com o backend.

---

## 5. Refactor das páginas existentes

### 5.1 Mapa de substituição

| Arquivo | O que muda | O que NÃO muda |
|---|---|---|
| `data.js` | `DB` wrapper de localStorage vira cache **in-memory** invalidado após cada mutação; `Store.getItems()` retorna último fetch | API pública do `Store` (`getItems`, `setItems`...) |
| `auth.js` | `login()` chama `apiClient.auth.login`; `logout()` chama `apiClient.auth.logout`; `currentUser()` usa cache de `apiClient.auth.me()` | Assinatura de `Auth.can(role)` |
| `modals.js` | Handlers de save/delete chamam `apiClient.<entidade>.*` e tratam `ApiError` via `showNotification` | Layout dos modais |
| `pages.js` | Cada `renderX()` faz `await apiClient.<entidade>.list()` antes de render; trata erro via toast | Markup das páginas |
| `dashboard.js` | `renderDashboard()` faz fetchs paralelos via `Promise.all` | Cards e gráfico (mock mantido até SDD-005) |
| `app.js` | Listener de `almox:session-expired` chama `logoutLocal()` e renderiza banner | Navegação, sidebar |

### 5.2 Contrato do Store pós-refactor

```js
// data.js (ANTES)
const Store = {
  getItems() { return DB.get("alm_items") || []; },
  setItems(v) { DB.set("alm_items", v); },
};

// data.js (DEPOIS)
const Store = {
  _caches: { items: null, funcionarios: null /* ... */ },
  async refreshItems() {
    const { items } = await apiClient.items.list({ limit: 100 });
    this._caches.items = items;
    return items;
  },
  getItems() { return this._caches.items || []; },
  // setItems removido: mutações vão direto pelo apiClient em modals.js
};
```

**Impacto:** chamadas `Store.setItems(...)` em `modals.js` viram `await apiClient.items.create(...)` + `await Store.refreshItems()`. Refactor cirúrgico, callsite por callsite.

### 5.3 Tela de "sessão expirada"

**Arquivo:** `auth.js`

```js
window.addEventListener("almox:session-expired", () => {
  sessionStorage.removeItem("alm_user");
  document.getElementById("app").innerHTML = "";
  renderLogin({ expiredBanner: true });
});

function renderLogin(opts = {}) {
  // adiciona <div class="banner">Sua sessão expirou. Faça login novamente.</div>
  // se opts.expiredBanner
}
```

CSS do banner em `login.css` (adição mínima, ~10 linhas).

---

## 6. Script de importação legacy

### 6.1 Localização e execução

**Arquivo:** `backend/scripts/import-legacy.ts`

```
ALLOW_LEGACY_IMPORT=true SEED_ENABLED=false \
  node --loader tsx backend/scripts/import-legacy.ts /path/to/export.json
```

### 6.2 Pseudocódigo

```
1. Validar env ALLOW_LEGACY_IMPORT=true; senão abortar
2. Ler e parsear JSON. Validar shape com Zod (legacyExportSchema)
3. Abrir transaction Prisma
4. Para cada entidade na ordem:
   setores → categorias → depositos → funcionarios → users → items → entradas → saidas
   4.1 Para cada registro:
       a) Normalizar nome/email (trim + lowercase)
       b) Dedupe: findFirst por chave natural
       c) Se existe → skip + log
       d) Senha em users: bcrypt.hash(senha, 12)
       e) Create com UUID novo
       f) AuditLog { action: "LEGACY_IMPORT", target: entity:id, actor: "SYSTEM" }
   4.2 Registrar { created, skipped, failed } por entidade
5. Para entradas/saidas:
   - Mapear itemCodigo → item.id no banco
   - Se item não existe, skip + warn
6. Commit
7. Imprimir relatório final
```

**Tratamento de erro:**
- Falha em registro individual → log + `failed`, **não aborta** lote.
- Falha estrutural (JSON inválido) → aborta antes de abrir transaction.

### 6.3 Testes

**Arquivo novo:** `backend/test/import-legacy.test.ts` (5 testes):

1. Import válido de JSON de exemplo → contagens corretas
2. Reexecução idempotente → skipped sobe, created = 0
3. Senha texto puro → bcrypt aplicado (hash começa com `$2b$12$`)
4. Entrada com `itemCodigo` inexistente → skip + warn
5. ENV `ALLOW_LEGACY_IMPORT` ausente → aborta com exit code != 0

**Fixture:** `backend/test/fixtures/legacy-export.json` (~5 registros por entidade).

---

## 7. E2E com Playwright

### 7.1 Setup

**Instalação:** `npm install --save-dev @playwright/test` em `e2e/package.json` isolado (não polui backend).

**Estrutura:**

```
e2e/
├── package.json
├── playwright.config.ts
├── setup.ts                    # seed + cleanup helpers
├── fixtures.ts                 # usuários de teste
├── tests/
│   ├── 01-login.spec.ts
│   ├── 02-painel.spec.ts
│   ├── 03-estoque.spec.ts
│   ├── 04-entradas.spec.ts
│   ├── 05-saidas.spec.ts
│   ├── 06-funcionarios.spec.ts
│   ├── 07-configuracoes.spec.ts
│   ├── 08-usuarios.spec.ts
│   └── 09-relatorios.spec.ts
└── README.md
```

### 7.2 `playwright.config.ts` (D5=B)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.ALMOX_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: "cd ../backend && npm run dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npx http-server .. -p 5173 -c-1",
      url: "http://localhost:5173/index.html",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

### 7.3 Spec-tipo

```ts
// 03-estoque.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsAdmin, cleanBackend } from "../setup";

test.beforeEach(async ({ page }) => {
  await cleanBackend();
  await loginAsAdmin(page);
});

test("criar item com código único aparece na lista", async ({ page }) => {
  await page.goto("/index.html#estoque");
  await page.getByRole("button", { name: "Novo Item" }).click();
  await page.getByLabel("Código").fill("PROD-001");
  await page.getByLabel("Descrição").fill("Item de teste");
  await page.getByLabel("Categoria").selectOption("geral");
  await page.getByLabel("Depósito").selectOption("principal");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("PROD-001")).toBeVisible();
});
```

### 7.4 Integração com baseline

Novo inventário:
- Backend: 170 (162 + 8 csrf)
- Frontend (apiClient unit): ~55
- E2E: 9
- **Total:** ~234

`PROGRESS.md` e `RELATORIO-TESTES-SPEC-001.md` reestruturam a tabela em 3 blocos: **Backend / Frontend / E2E**. Blocos A–H viram sub-itens de Backend.

---

## 8. Cronograma por PR (D4=B)

| PR | Escopo | Entregas | Testes somados | Acumulado |
|---|---|---|---|---|
| **PR-1** | Backend CSRF + migration + atualização dos 162 testes existentes | `csrf_token` em `sessions`, `requireCsrf`, body `csrfToken` no login/me, cookie `almox_csrf`, helpers atualizados, `csrf.test.ts` | +8 | 170 backend |
| **PR-2** | `apiClient.js` + testes unitários + tela 1 (Login) + handler `almox:session-expired` | `apiClient.js`, `test-frontend/apiClient.test.js`, refactor `auth.js`, banner sessão expirada, E2E `01-login.spec.ts` | +55 unit, +1 E2E | 226 |
| **PR-3** | Tela 2 Painel | refactor `dashboard.js`, E2E `02-painel.spec.ts` | +1 | 227 |
| **PR-4** | Tela 3 Estoque | refactor `pages.js` + `modals.js` item, E2E `03-estoque.spec.ts` | +1 | 228 |
| **PR-5** | Tela 4 Entradas | E2E `04-entradas.spec.ts` | +1 | 229 |
| **PR-6** | Tela 5 Saídas | E2E `05-saidas.spec.ts` | +1 | 230 |
| **PR-7** | Tela 6 Funcionários | E2E `06-funcionarios.spec.ts` | +1 | 231 |
| **PR-8** | Tela 7 Configurações | E2E `07-configuracoes.spec.ts` | +1 | 232 |
| **PR-9** | Tela 8 Usuários + Tela 9 Relatórios + `import-legacy.ts` + docs finais | refactor restante + script + 5 testes do importador + E2E 08/09 | +5 importer, +2 E2E | **239** |

Cada PR deve deixar:
- tsc limpo
- suite completa verde
- zero `console.log`
- zero `localStorage.setItem("alm_*")` novo em telas já migradas

---

## 9. Rollback

| Estágio | Estratégia |
|---|---|
| PR-1 | `git revert` + `prisma db push --force-reset` em dev/test (banco de test é descartável) |
| PR-2 | `git revert`. Frontend volta a falhar pelo login body — revert também de `auth.js` |
| PR-3..9 | `git revert` da PR. Backend intocado |
| Final | Tag `pre-sdd-004` criada **antes** da PR-1. Rollback completo = `git reset --hard pre-sdd-004` |

Script `import-legacy.ts` é idempotente. Em caso de falha catastrófica: `DELETE` nas tabelas afetadas + re-seed + re-import.

---

## 10. Débitos, riscos e não-objetivos

### 10.1 Débitos que este SDD NÃO cria

- `alm_acessos` permanece no frontend legacy → backlog SDD-005
- Security headers, CSP → SDD-006
- Logs estruturados de auditoria via endpoint → SDD-005

### 10.2 Riscos técnicos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Playwright adiciona ~150 MB de dependência | Confinar em `e2e/package.json`; não incluir em `backend/` |
| R2 | Atualização dos 162 testes pode introduzir regressão sutil | PR-1 dedicada; review cuidadosa; suite completa verde antes do merge |
| R3 | Frontend legacy sem build step não suporta `import` | IIFE expondo `window.apiClient` (já previsto) |
| R4 | Cookie `almox_csrf` com `SameSite=Lax` bloqueia cross-origin em prod | Frontend e backend sob mesmo domínio em prod (decisão SDD-006) |
| R5 | `document.cookie` pode ser mutado por extensões hostis | Double-submit resiliente dentro do próprio domínio |
| R6 | Timeout 10s curto para import-legacy | Script roda em Node, não passa pelo `apiClient` |

### 10.3 Métricas de aceite (DoD operacional)

- [ ] `npx vitest run` (backend) → 170 passing
- [ ] `npx vitest run -c vitest.config.frontend.ts` → ~55 passing
- [ ] `npx playwright test` → 9 passing
- [ ] `npx tsc --noEmit` → limpo
- [ ] `grep -R "localStorage.setItem(\"alm_" .` → zero hits fora de `sessionStorage.alm_user`
- [ ] `docs/PROGRESS.md` §1, §3.2, §5 atualizados
- [ ] `docs/RELATORIO-TESTES-SPEC-001.md` reorganizado em 3 blocos (Backend / Frontend / E2E)
- [ ] `CLAUDE.md §15` com SDD-004 marcado CONCLUÍDO
- [ ] Tag git `sdd-004-complete` criada

---

## 11. Próximos passos

Ao aprovar este DESIGN, inicia-se a **PR-1**:

1. Criar tag `pre-sdd-004`
2. Migration Prisma (`csrf_token`)
3. Middleware `require-csrf.ts` + novo `ErrorCode` `CSRF_ERROR`
4. Refactor `authRoutes` para emitir `csrfToken` no body (D1=B)
5. Atualização dos 162 testes para enviar header CSRF
6. Novos 8 testes em `csrf.test.ts`
7. Docs parciais (PROGRESS com 170 backend)

Demais PRs seguem em sequência §8.

---

## 12. Referências

- [CLAUDE.md](../CLAUDE.md) §4, §6, §8, §11, §15, §16
- [SDD-004-frontend-integration.md](./SDD-004-frontend-integration.md) (SPEC base)
- [SDD-001-bootstrap-auth-users.md](./SDD-001-bootstrap-auth-users.md)
- [SDD-002-employees-settings.md](./SDD-002-employees-settings.md)
- [SDD-003-Inv-Stock.md](./SDD-003-Inv-Stock.md)
- [PROGRESS.md](./PROGRESS.md)
- [RELATORIO-TESTES-SPEC-001.md](./RELATORIO-TESTES-SPEC-001.md)
