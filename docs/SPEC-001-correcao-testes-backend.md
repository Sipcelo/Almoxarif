# SPEC-001: Correção Estrutural da Base de Testes do Backend

**Status:** Aguardando aprovação
**Data:** 2026-04-15
**Conversa origem:** f498d24b-4d87-4248-9c15-92a0f83f36f2

---

## 1. Entendimento

A base de testes do backend (`backend/test/*.test.ts`) está inoperante. Nenhum teste executa com sucesso. A causa raiz não é um bug pontual — são **11 problemas estruturais** acumulados que vão desde dependências ausentes até incompatibilidade entre o que os testes esperam e o que o código-fonte entrega.

O objetivo desta SPEC é corrigir **toda a infraestrutura de testes** para que os 7 arquivos de teste existentes executem e passem, com o mínimo de alteração ao código-fonte de produção necessária para suportar os testes.

---

## 2. Premissas

| # | Premissa |
|---|----------|
| P1 | O banco de testes será **SQLite** (conforme CLAUDE.md §8: "SQLite - fase inicial"), não PostgreSQL |
| P2 | O backend opera dentro de `backend/` com seu próprio `package.json` e `node_modules` — isolado da raiz |
| P3 | As versões do backend (`fastify@4`, `@prisma/client@5`) são as corretas; as da raiz (`fastify@5`) são instalações acidentais |
| P4 | Os testes usam **Vitest** + **supertest** contra a instância Fastify em memória (sem levantar servidor real) |
| P5 | O Prisma schema é a fonte de verdade para o modelo de dados do backend |
| P6 | O frontend em `front/` e na raiz **não deve ser alterado** por esta SPEC |
| P7 | Os arquivos `backend/auth.js` e `backend/data.js` são stubs vazios ("conteúdo movido") e podem ser removidos |
| P8 | A SPEC do CLAUDE.md (§11) governa: implementar estritamente conforme aprovado |

---

## 3. Lacunas

| # | Lacuna | Impacto | Decisão proposta |
|---|--------|---------|-----------------|
| L1 | O schema Prisma usa `postgresql` mas CLAUDE.md especifica SQLite para fase inicial | Testes precisam de banco real ou mock | **Decisão: migrar datasource para SQLite em testes. Manter PostgreSQL como option de produção via env var** |
| L2 | Não existe modelo `AuditLog` no schema — `audit.test.ts` depende dele | Teste de auditoria não funciona | **Decisão: criar modelo `AuditLog` no schema** |
| L3 | Não existe campo `deletedAt` em `User` — `users-crud.test.ts` depende dele | Soft delete não funciona | **Decisão: adicionar `deletedAt DateTime?` ao model User** |
| L4 | Não existem rotas `/users` CRUD nem `/auth/me` — 4 testes dependem delas | Testes retornam 404 | **Decisão: criar handlers e registrar rotas** |
| L5 | Não existe rate limit registrado — teste depende de resposta 429 | Teste de rate limit falha | **Decisão: registrar `@fastify/rate-limit`** |
| L6 | O `healthcheck.ts` está escrito como plugin Fastify mas registrado como handler direto em `server.ts` | Rota retorna função ao invés de `{status:"ok"}` | **Decisão: corrigir para formato compatível** |
| L7 | O `package.json` da raiz instala dependências que colidem com o backend | Resolução de módulo imprevisível | **Decisão: limpar `package.json` da raiz (remover dependências de backend)** |

---

## 4. SPEC — Ações Verificáveis

### Fase 1: Limpeza de Conflitos

#### 1.1 Remover `package.json` da raiz (dependências conflitantes)

**Estado atual:** `C:/Users/Admin/Downloads/almox v1/almox v1.2/package.json` contém:
```json
{
  "dependencies": {
    "@fastify/cookie": "^11.0.2",
    "@fastify/cors": "^11.2.0",
    "@fastify/session": "^11.1.1",
    "fastify": "^5.8.5",
    "pino-pretty": "^13.1.3"
  }
}
```

**Ação:** Substituir por `package.json` mínimo sem dependências de backend:
```json
{
  "name": "almox-workspace",
  "private": true
}
```

**Ação:** Remover `node_modules` e `package-lock.json` da raiz.

**Ação:** Remover `.env.test` da raiz (arquivo duplicado e incoerente).

#### 1.2 Remover stubs vazios do backend

**Ação:** Excluir `backend/auth.js` e `backend/data.js` (contêm apenas comentário "Conteúdo movido de js/...").

**Justificativa:** São resíduos de migração. Presença na raiz do backend pode causar confusão de imports.

---

### Fase 2: Dependências do Backend

#### 2.1 Atualizar `backend/package.json`

**Adicionar ao `dependencies`:**
```
@fastify/rate-limit@^8.0.0
pino@^8.0.0
```

**Adicionar ao `devDependencies`:**
```
vitest@^1.0.0
supertest@^6.0.0
@types/supertest@^2.0.0
dotenv@^16.0.0
pino-pretty@^10.0.0
```

**Ação:** Executar `npm install` dentro de `backend/`.

#### 2.2 Gerar Prisma Client

**Ação:** Após atualizar o schema (Fase 3), executar `npx prisma generate` dentro de `backend/`.

---

### Fase 3: Schema Prisma

#### 3.1 Migrar datasource para suportar SQLite em testes

**Estado atual:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Ação:** Manter `postgresql` como provider de produção. Para testes, usar SQLite via `.env.test`:
```
DATABASE_URL="file:./test.db"
```

**NOTA:** Prisma não permite trocar provider via env var. A solução é:
- Provider do schema: `"sqlite"` para fase inicial (conforme CLAUDE.md §8)
- Quando migrar para PostgreSQL em produção, trocar o provider no schema

**Decisão para esta SPEC:** Provider = `"sqlite"` (alinhado com CLAUDE.md §8: "SQLite - fase inicial").

#### 3.2 Adicionar `deletedAt` ao model `User`

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  role      String
  active    Boolean   @default(true)
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

#### 3.3 Criar model `AuditLog`

```prisma
model AuditLog {
  id        Int      @id @default(autoincrement())
  action    String
  actor     String?
  target    String?
  details   String?
  createdAt DateTime @default(now())
}
```

#### 3.4 Schema final

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  role      String
  active    Boolean   @default(true)
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  action    String
  actor     String?
  target    String?
  details   String?
  createdAt DateTime @default(now())
}
```

---

### Fase 4: Código-fonte — Correções Mínimas

#### 4.1 `server.ts` — Exportar `buildApp()` sem auto-start

**Estado atual:** `server.ts` cria `server`, registra plugins e chama `start()` no import. Testes não conseguem importar sem levantar o servidor.

**Ação:** Refatorar para padrão factory:

```typescript
// server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "../modules/auth/routes";
import { userRoutes } from "../modules/users/routes";
import { healthRoutes } from "../infra/healthcheck";
import { errorHandler } from "../infra/error-handler";

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test"
      ? { level: "info" }
      : false,
  });

  // Plugins
  await app.register(cors, { origin: process.env.CORS_ORIGIN || "*" });
  await app.register(cookie);
  await app.register(session, {
    secret: process.env.SESSION_SECRET || "default_secret",
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
    },
  });
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes, { prefix: "/users" });

  return app;
}

// Auto-start apenas quando executado diretamente (não quando importado por testes)
if (require.main === module) {
  buildApp().then(async (app) => {
    const PORT = process.env.PORT || 3000;
    await app.listen({ port: Number(PORT), host: "0.0.0.0" });
  });
}
```

#### 4.2 `logger.ts` — Simplificar

**Estado atual:** Exporta instância pino com `.child()`, incompatível com Fastify.

**Ação:** Remover `logger.ts`. O logger será configurado inline no `buildApp()` (opção `logger: { level: "info" }` ou `false` em testes). Arquivo desnecessário.

#### 4.3 `healthcheck.ts` — Corrigir assinatura

**Estado atual:** Escrito como plugin mas registrado como handler.

**Ação:** Reescrever como plugin Fastify:
```typescript
import { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok" };
  });
}
```

#### 4.4 Criar `modules/auth/routes.ts`

Registrar rotas com prefixo `/auth`:
```typescript
import { FastifyInstance } from "fastify";
import { loginHandler, logoutHandler, meHandler } from "./handlers";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", loginHandler);
  app.post("/logout", logoutHandler);
  app.get("/me", meHandler);
}
```

#### 4.5 `modules/auth/handlers.ts` — Adicionar `meHandler`

**Estado atual:** Tem `loginHandler` e `logoutHandler`. Falta `meHandler`.

**Ação:** Adicionar:
```typescript
export const meHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  if (!req.session?.user) {
    return reply.status(401).send({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.session.user.id },
    select: { id: true, email: true, role: true, active: true },
  });
  if (!user) {
    return reply.status(401).send({ error: "Unauthorized", message: "User not found" });
  }
  return reply.send(user);
};
```

#### 4.6 Criar `modules/users/routes.ts` + `handlers.ts`

CRUD com autorização admin-only, soft delete, e auditoria:

**Rotas:**
- `POST /users` — Criar usuário (admin only)
- `PUT /users/:id` — Atualizar usuário (admin only)
- `DELETE /users/:id` — Soft delete (admin only)

**Cada operação DEVE:**
- Validar sessão (usuário logado)
- Verificar role admin
- Registrar `AuditLog` com action, actor, target, details

#### 4.7 Criar `infra/error-handler.ts`

Handler global de erros para formato consistente:
```typescript
export function errorHandler(error: any, req: FastifyRequest, reply: FastifyReply) {
  if (error.statusCode === 429) {
    return reply.status(429).send({ error: "Too many requests", message: error.message });
  }
  return reply.status(error.statusCode || 500).send({
    error: error.name || "InternalServerError",
    message: error.message || "Internal server error",
  });
}
```

---

### Fase 5: Correção dos Testes

#### 5.1 `vitest.config.ts` — Limpar

**Estado atual:** Instancia `PrismaClient` desnecessariamente.

**Ação:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
});
```

#### 5.2 `test/setup.ts` — Corrigir para SQLite

**Estado atual:** Usa `TRUNCATE` (incompatível com SQLite).

**Ação:**
```typescript
import dotenv from "dotenv";
import path from "path";
import { execSync } from "child_process";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

// Reset database antes de cada suite
beforeAll(async () => {
  // Usa prisma db push para sincronizar schema com SQLite
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
});
```

#### 5.3 Corrigir `backend/.env.test`

```
DATABASE_URL="file:./test.db"
SESSION_SECRET="test-secret-for-tests-only"
NODE_ENV="test"
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=60000
```

#### 5.4 Corrigir todos os `*.test.ts`

**Mudanças comuns a todos os testes que usam `app`:**
```typescript
// ANTES (quebrado)
import { app } from "../src/app/server";

// DEPOIS
import { buildApp } from "../src/app/server";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});
```

**`auth.test.ts`:**
- Substituir `TRUNCATE` por seed via Prisma dentro do `beforeAll`
- Hash real de `admin123` via bcrypt no seed (não string placeholder)
- Ajustar assertions: `response.body.message` (não `.token`); `.error` no campo correto

**`users-crud.test.ts`:**
- Remover `include: { deletedAt: true }` (campo escalar, não relação — usar `select`)
- Seed admin e login antes de operações CRUD

**`audit.test.ts`:**
- Remover `TRUNCATE`, usar `deleteMany` do Prisma
- Seed admin e login antes de criar usuário

**`rate-limit.test.ts`:**
- Ajustar número de requests para `RATE_LIMIT_MAX` + 1

**`healthcheck.test.ts`:**
- Usar `app.inject()` do Fastify ao invés de `supertest` (mais idiomático, evita necessidade de bind de porta)

**`error-format.test.ts`:**
- Verificar campos `error` e `message` no body

**`env-validation.test.ts`:**
- Sem mudanças necessárias (apenas depende de `dotenv` carregar `.env.test`)

---

### Fase 6: Configuração TypeScript

#### 6.1 `tsconfig.json` — Incluir testes

**Ação:** Adicionar `"include": ["src", "test"]` para que os testes compilem.

---

## 5. Edge Cases

| # | Cenário | Tratamento |
|---|---------|-----------|
| E1 | `test.db` residual de execução anterior | `prisma db push --force-reset` apaga e recria |
| E2 | Hash bcrypt diferente entre seed do teste e comparação | Usar `bcrypt.hashSync("admin123", 10)` no seed do teste, não string hardcoded |
| E3 | Rate limit com requests paralelas pode variar | Usar requests sequenciais no teste de rate limit |
| E4 | Session cookie não propagada entre requests | Extrair `set-cookie` do login e passar em requests seguintes |
| E5 | `require.main === module` não funciona com ESM | `tsconfig.json` usa `"module": "CommonJS"`, ok |
| E6 | Prisma Client não gerado antes de rodar testes | Adicionar script `"pretest": "prisma generate && prisma db push"` |

---

## 6. Critérios de Aceite

| # | Critério | Verificação |
|---|---------|------------|
| CA1 | `npm install` dentro de `backend/` completa sem erros | Comando retorna exit 0 |
| CA2 | `npx prisma generate` completa sem erros | Comando retorna exit 0 |
| CA3 | `npx vitest run` executado de `backend/` roda **todos os 7 arquivos de teste** | Zero arquivos ignorados ou com erro de import |
| CA4 | **auth.test.ts**: 4 testes passam (login ok, login falha, /me com sessão, logout invalida sessão) | Vitest report: 4 pass |
| CA5 | **users-crud.test.ts**: 3 testes passam (create, update, soft delete) | Vitest report: 3 pass |
| CA6 | **healthcheck.test.ts**: 1 teste passa (GET /health retorna 200 + `{status:"ok"}`) | Vitest report: 1 pass |
| CA7 | **rate-limit.test.ts**: 1 teste passa (resposta 429 após exceder limite) | Vitest report: 1 pass |
| CA8 | **audit.test.ts**: 1 teste passa (criação de user gera registro em AuditLog) | Vitest report: 1 pass |
| CA9 | **env-validation.test.ts**: 1 teste passa (DATABASE_URL e SESSION_SECRET definidos) | Vitest report: 1 pass |
| CA10 | **error-format.test.ts**: 1 teste passa (rota inexistente retorna 404 com `error` e `message`) | Vitest report: 1 pass |
| CA11 | Nenhum arquivo em `front/` foi alterado | `git diff front/` vazio |
| CA12 | `package.json` da raiz não tem dependências de backend | Sem `fastify`, `@fastify/*`, `pino-pretty` |
| CA13 | `backend/auth.js` e `backend/data.js` removidos | Arquivos não existem |

---

## 7. Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|-----------|-----------|
| R1 | SQLite não suporta todas as features de PostgreSQL (ex: `CASCADE`, arrays) | MÉDIO | Schema usa apenas tipos compatíveis. Migrações futuras para PostgreSQL requerem nova SPEC |
| R2 | `@fastify/session` v8 pode ter API diferente da esperada pelos testes | BAIXO | Verificar docs da versão exata instalada |
| R3 | `bcrypt` pode falhar na instalação no Windows (binding nativo) | MÉDIO | Alternativa: `bcryptjs` (implementação JS pura) |
| R4 | `pino-pretty` como transport pode não funcionar em todas as versões do pino | BAIXO | Logger desabilitado em testes (`logger: false`) |
| R5 | `require.main === module` não impede auto-start se vitest fizer import dinâmico | BAIXO | Vitest usa ESM transform — testar se funciona; fallback para env var `NODE_ENV=test` |

---

## 8. Próximas Decisões

| # | Decisão pendente | Depende de |
|---|-----------------|-----------|
| ND1 | Migração para PostgreSQL em produção | Deploy definido |
| ND2 | Cobertura mínima 80% exigirá mais testes além dos 7 existentes | Esta SPEC passar |
| ND3 | CI/CD pipeline para rodar testes automaticamente | Esta SPEC passar |
| ND4 | Testes de integração com frontend | Backend estável + API documentada |

---

## 9. Escopo Excluído

- **NÃO** será alterado nenhum arquivo em `front/` ou `front/js/` ou `front/css/`
- **NÃO** será alterado o `index.html` da raiz
- **NÃO** será migrado o frontend para framework
- **NÃO** será implementado CRUD completo de todas as entidades (apenas users, conforme testes existentes)
- **NÃO** será implementado deploy
- **NÃO** serão criados testes novos além da correção dos 7 existentes

---

## Gate

**Aguardando aprovação da SPEC.**

Após aprovação, implementação seguirá a ordem: Fase 1 > 2 > 3 > 4 > 5 > 6, com validação parcial ao final de cada fase.
