# SDD-001 — Bootstrap + Auth + Users

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado
> **Cliente:** Rodoviária de Pelotas
> **Módulo:** 001 — Bootstrap do backend + Autenticação + Gestão de Usuários
> **Status:** SPEC APROVADA
> **Versão:** 1.1 (consolidada com decisões aprovadas)
> **Data:** 2026-04-15

---

## 1. Entendimento

Este módulo cobre três entregas interdependentes:

1. **Bootstrap do backend** — Projeto Node.js com Fastify, TypeScript, Prisma, PostgreSQL. Estrutura de pastas, configuração, healthcheck, error handler padronizado, logger estruturado, CORS.
2. **Auth** — Login, logout, sessão server-side com cookie httpOnly, rate limiting, hash de senha com bcrypt.
3. **Users** — CRUD de usuários do sistema com autorização server-side, vinculado a roles.

O frontend existente continuará funcionando com localStorage durante a transição. A integração frontend ↔ backend será feita em módulo posterior. Este módulo entrega **apenas o backend com APIs testáveis**.

---

## 2. Decisões Aprovadas

| # | Decisão | Status |
|---|---|---|
| D1 | TTL de sessão = 8 horas com sliding expiration | ✅ Aprovado |
| D2 | Cookie name = `almox_sid` | ✅ Aprovado |
| D3 | Mínimo 1 admin ativo no sistema. Impedir exclusão/desativação do último | ✅ Aprovado |
| D4 | Admin não pode rebaixar/desativar a si mesmo | ✅ Aprovado |
| D5 | Senha mínima 8 chars, sem requisitos adicionais de complexidade nesta fase | ✅ Aprovado |
| D6 | Seed admin: `admin@rodoviariapel.com` / `admin2026`. Seed operador: `op@rodoviariapel.com` / `operador2026` | ✅ Aprovado |
| D7 | PostgreSQL (Render free tier) | ✅ Aprovado |
| D8 | Soft delete (`ativo = false`) como política padrão. Exclusão física proibida nesta fase | ✅ Aprovado |

### Lacunas resolvidas

| # | Lacuna | Resolução |
|---|---|---|
| L1 | TTL de sessão | 8 horas, sliding expiration (renova a cada request) |
| L2 | Sessões simultâneas | Sem limite nesta fase. Risco registrado |
| L3 | Política de senha | Mínimo 8 chars, sem complexidade adicional |
| L4 | Admin desativa a si mesmo | Impedido via regra de negócio |
| L5 | Mínimo de admins | Mínimo 1 admin ativo. Impedir remoção do último |
| L6 | Porta do servidor | Ler `PORT` do env, default `3000`. Host `0.0.0.0` |
| L7 | Nome do cookie | `almox_sid` |

---

## 3. Premissas

| # | Premissa |
|---|---|
| P1 | Stack: Fastify + TypeScript + Prisma + PostgreSQL |
| P2 | Sessão server-side via cookie httpOnly |
| P3 | Deploy em Render (PostgreSQL free tier) |
| P4 | Não haverá integração com frontend neste módulo — apenas APIs consumíveis via HTTP client |
| P5 | Roles existentes: `admin`, `gerente`, `operador`, `visitante` — mantidos do sistema atual |
| P6 | Seed de desenvolvimento separado de produção — controlado por env var |
| P7 | Não há usuários reais em produção ainda — migração de dados legados não é escopo deste módulo |
| P8 | O sistema terá um único admin inicial criado via seed |

---

## 4. SPEC

### 4.1. Bootstrap

#### 4.1.1. Estrutura de diretórios

```
backend/
├── src/
│   ├── app/
│   │   ├── server.ts               ← Instância Fastify, registro de plugins, boot
│   │   └── plugins/
│   │       ├── cors.ts             ← Configuração CORS
│   │       ├── session.ts          ← Plugin de cookie (httpOnly)
│   │       ├── rate-limit.ts       ← Rate limiting global e por rota
│   │       └── error-handler.ts    ← Handler de erros padronizado
│   ├── config/
│   │   └── env.ts                  ← Validação e tipagem de env vars com zod
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts      ← Schemas zod para validação de input
│   │   └── users/
│   │       ├── users.routes.ts
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── users.schema.ts
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── require-auth.ts     ← Middleware: requer sessão válida
│   │   │   └── require-role.ts     ← Middleware: requer role específica
│   │   ├── errors/
│   │   │   └── app-error.ts        ← Classe de erro padronizada
│   │   └── types/
│   │       └── index.ts            ← Tipos compartilhados (SessionUser, Role, etc.)
│   └── infra/
│       ├── logger.ts               ← Configuração de logger (pino via Fastify)
│       ├── prisma.ts               ← Instância Prisma singleton
│       └── healthcheck.ts          ← Rota GET /health
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                     ← Seed de desenvolvimento (idempotente)
│   └── migrations/
├── .env.example
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

#### 4.1.2. Dependências

**Runtime:**
- `fastify` — framework HTTP
- `@fastify/cookie` — parsing e setagem de cookies
- `@fastify/cors` — CORS
- `@fastify/rate-limit` — rate limiting
- `@prisma/client` — ORM client
- `bcrypt` — hash de senhas
- `zod` — validação de schemas

**Dev:**
- `typescript`
- `tsx` — execução TS em dev (watch mode)
- `prisma` — CLI e migrações
- `@types/bcrypt`
- `@types/node`
- `pino-pretty` — formatação de logs em dev

#### 4.1.3. Environment variables

| Variável | Tipo | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `NODE_ENV` | enum | não | `development` | `development`, `production`, `test` |
| `PORT` | number | não | `3000` | Porta do servidor |
| `HOST` | string | não | `0.0.0.0` | Host de bind |
| `DATABASE_URL` | string | **sim** | — | Connection string PostgreSQL |
| `SESSION_SECRET` | string | **sim** | — | Secret para cookie. Mínimo 32 chars |
| `SESSION_TTL_HOURS` | number | não | `8` | TTL da sessão em horas |
| `CORS_ORIGIN` | string | não | `http://localhost:8080` | Origem permitida |
| `RATE_LIMIT_MAX` | number | não | `100` | Requests por janela (global) |
| `RATE_LIMIT_WINDOW_MS` | number | não | `60000` | Janela de rate limit em ms |
| `SEED_ENABLED` | boolean | não | `false` | Habilita seed de dados demo |
| `LOG_LEVEL` | enum | não | `info` | `debug`, `info`, `warn`, `error` |

Todas validadas na inicialização via zod. Falha na validação impede o boot e loga o erro com detalhe de qual variável falhou.

#### 4.1.4. Healthcheck

```
GET /health
```

**200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-04-15T10:00:00.000Z",
  "uptime": 3600,
  "checks": { "database": "connected" }
}
```

**503** (database unreachable):
```json
{
  "status": "degraded",
  "version": "1.0.0",
  "timestamp": "...",
  "uptime": 3600,
  "checks": { "database": "unreachable" }
}
```

#### 4.1.5. Formato de erro padronizado

Toda resposta de erro segue:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível",
    "details": []
  }
}
```

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input inválido (zod ou Fastify) |
| `UNAUTHORIZED` | 401 | Sessão ausente, expirada ou inválida |
| `FORBIDDEN` | 403 | Sem permissão (role insuficiente) |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `CONFLICT` | 409 | Conflito (email duplicado, último admin, auto-ação) |
| `RATE_LIMITED` | 429 | Rate limit excedido |
| `INTERNAL_ERROR` | 500 | Erro interno não tratado |

#### 4.1.6. Logger

Pino (nativo do Fastify), formato JSON estruturado em produção, `pino-pretty` em dev.

Campos obrigatórios por log: `timestamp`, `level`, `msg`, `requestId`.

Campos **nunca** logados (redact): `senha`, `password`, `secret`, `token`, `cookie`, `authorization`.

#### 4.1.7. CORS

- Origem: `CORS_ORIGIN` (env var)
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Credentials: `true` (obrigatório para envio de cookies)
- Allowed headers: `Content-Type, Authorization`

#### 4.1.8. Versionamento de API

Todas as rotas sob prefixo `/api/v1/`.

---

### 4.2. Schema Prisma

**Provider:** PostgreSQL

**Models deste módulo:**

**User:**

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Não sequencial |
| `nome` | String | not null | |
| `email` | String | unique, not null | Normalizado lowercase |
| `senha` | String | not null | Hash bcrypt, NUNCA texto puro |
| `role` | String | not null, default `"operador"` | Enum lógico: admin, gerente, operador, visitante |
| `ativo` | Boolean | not null, default `true` | Soft delete flag |
| `criado_em` | DateTime | not null, auto | |
| `atualizado_em` | DateTime | not null, auto-update | |

Relações: `sessions Session[]`, `auditLogs AuditLog[]`

**Session:**

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Valor do cookie `almox_sid` |
| `user_id` | UUID | FK → User.id, ON DELETE CASCADE | |
| `expires_at` | DateTime | not null | TTL = 8h, sliding |
| `criado_em` | DateTime | not null, auto | |
| `ip_address` | String | nullable | IP do request de login |
| `user_agent` | String | nullable | User-Agent do request de login |

Índices: `user_id`, `expires_at`

**AuditLog:**

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | |
| `user_id` | UUID | FK → User.id nullable, ON DELETE SET NULL | Nullable para tentativas de login falhadas |
| `action` | String | not null | `LOGIN`, `LOGOUT`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `PASSWORD_CHANGED`, `LOGIN_FAILED` |
| `target` | String | nullable | ID do recurso afetado |
| `details` | String | nullable | JSON com diff ou contexto |
| `ip_address` | String | nullable | |
| `timestamp` | DateTime | not null, auto | |

Índices: `user_id`, `action`, `timestamp`

**Convenções:**
- Nomes de tabelas em `snake_case` via `@@map`
- Nomes de colunas em `snake_case` via `@map`
- IDs como UUID — nunca sequenciais
- Campos de auditoria (`criado_em`, `atualizado_em`) em toda entidade

---

### 4.3. Auth — Rotas e Contratos

#### POST /api/v1/auth/login

| Aspecto | Detalhe |
|---|---|
| **Autenticação** | Pública |
| **Rate limit** | 5 tentativas / IP / 15 minutos |

**Input:**
```json
{ "email": "string (email, max 255, trim, lowercase)", "senha": "string (min 1, max 128)" }
```

**Lógica:**
1. Validar input via zod
2. Buscar user por email
3. Se não encontrado → 401 `UNAUTHORIZED` ("Credenciais inválidas")
4. Se `ativo === false` → 401 (mesma mensagem genérica)
5. `bcrypt.compare(senha, user.senha)`
6. Se falha → registrar `AuditLog` action `LOGIN_FAILED` com ip + email como target → 401
7. Criar `Session` com `expiresAt = now + 8h`
8. Setar cookie: `almox_sid=<sessionId>; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
9. Em produção: adicionar flag `Secure`
10. Registrar `AuditLog` action `LOGIN` com userId, ip
11. Retornar `{ user: { id, nome, email, role } }` — status 200

**Resposta 401:**
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Credenciais inválidas" } }
```

Mensagem idêntica para email inexistente, senha errada e usuário inativo — não revelar motivo.

#### POST /api/v1/auth/logout

| Aspecto | Detalhe |
|---|---|
| **Autenticação** | `requireAuth` |

**Lógica:**
1. Ler `almox_sid` do cookie
2. Deletar `Session` do banco
3. Limpar cookie (`Max-Age=0`)
4. Registrar `AuditLog` action `LOGOUT`
5. Retornar `{ "message": "Sessão encerrada" }` — status 200

#### GET /api/v1/auth/me

| Aspecto | Detalhe |
|---|---|
| **Autenticação** | `requireAuth` |

**Lógica:**
1. `requireAuth` já validou sessão e injetou `request.user`
2. Retornar `{ user: { id, nome, email, role } }` — status 200

O middleware `requireAuth` faz sliding expiration automaticamente.

---

### 4.4. Middlewares

#### requireAuth

Executado como `preHandler` em toda rota protegida.

**Lógica:**
1. Ler cookie `almox_sid`
2. Se ausente → 401
3. Buscar `Session` por ID (include `user`)
4. Se não encontrada → limpar cookie → 401
5. Se `expiresAt < now()` → deletar session, limpar cookie → 401
6. Se `user.ativo === false` → deletar session, limpar cookie → 401
7. Atualizar `expiresAt = now + TTL` (sliding expiration)
8. Injetar `request.user = { id, nome, email, role }`

#### requireRole(roles: string[])

Executado como `preHandler` após `requireAuth`.

**Lógica:**
1. Verificar `request.user.role` está em `roles`
2. Se não → 403 `FORBIDDEN`

---

### 4.5. Users — Rotas e Contratos

Todas as rotas requerem `requireAuth` + `requireRole(['admin'])`.

#### GET /api/v1/users

Lista todos os usuários.

**Query params opcionais:**
- `role` — filtrar por role
- `ativo` — filtrar por status (`true`/`false`)
- `search` — busca por nome ou email (ILIKE)

**Response 200:**
```json
{
  "users": [
    { "id": "uuid", "nome": "string", "email": "string", "role": "string", "ativo": true, "criadoEm": "ISO8601" }
  ],
  "total": 1
}
```

Campo `senha` **nunca** retornado em nenhum endpoint.

#### GET /api/v1/users/:id

Retorna um usuário por ID.

**200:** Mesmo formato do item de lista.
**404:** Se ID não encontrado.

#### POST /api/v1/users

Cria novo usuário.

**Input:**
```json
{
  "nome": "string (min 2, max 100, trim)",
  "email": "string (email, max 255, trim, lowercase)",
  "senha": "string (min 8, max 128)",
  "role": "enum: admin | gerente | operador | visitante"
}
```

**Lógica:**
1. Validar input via zod
2. Verificar unicidade de email → 409 `CONFLICT` se duplicado
3. Hash da senha: `bcrypt.hash(senha, 12)`
4. Criar registro
5. `AuditLog` action `USER_CREATED`, target = novo userId, details = `{ nome, email, role }`
6. Retornar usuário criado (sem senha) — status 201

#### PUT /api/v1/users/:id

Atualiza usuário existente.

**Input (todos opcionais):**
```json
{
  "nome": "string (min 2, max 100, trim)",
  "email": "string (email, max 255, trim, lowercase)",
  "role": "enum",
  "ativo": "boolean"
}
```

**Regras de negócio:**
1. Se alterando email → verificar unicidade → 409 se duplicado
2. Admin não pode rebaixar seu próprio role → 409
3. Admin não pode setar `ativo: false` em si mesmo → 409
4. Se desativando/rebaixando o último admin ativo → 409 com mensagem explicativa

**Efeitos colaterais:**
- Se `ativo` mudou para `false` → invalidar (deletar) todas as sessions do usuário
- Se `role` mudou → invalidar todas as sessions (forçar re-login)
- `AuditLog` action `USER_UPDATED`, details = JSON com campos que mudaram (valores before/after, sem senha)

**200:** Usuário atualizado (sem senha).

#### PATCH /api/v1/users/:id/password

Altera senha de um usuário.

**Input:**
```json
{ "novaSenha": "string (min 8, max 128)" }
```

**Lógica:**
1. Hash nova senha: `bcrypt.hash(novaSenha, 12)`
2. Atualizar no banco
3. Invalidar todas as sessions do usuário
4. `AuditLog` action `PASSWORD_CHANGED`, target = userId

**200:** `{ "message": "Senha atualizada" }`

Somente admins executam esta rota nesta fase. Quando houver "alterar minha própria senha", exigirá `senhaAtual`.

#### DELETE /api/v1/users/:id

Soft delete (desativação).

**Regras de negócio:**
1. Admin não pode deletar a si mesmo → 409
2. Não pode deletar o último admin ativo → 409
3. Seta `ativo = false` — NÃO remove do banco
4. Invalida todas as sessions do usuário
5. `AuditLog` action `USER_DEACTIVATED`, target = userId

**200:** `{ "message": "Usuário desativado" }`

Idempotente: chamar em usuário já inativo retorna 200.

---

### 4.6. Seed de Desenvolvimento

Controlado por `SEED_ENABLED=true`. Nunca roda se ausente ou `false`.

| Email | Senha (texto) | Role |
|---|---|---|
| `admin@rodoviariapel.com` | `admin2026` | admin |
| `op@rodoviariapel.com` | `operador2026` | operador |

Comportamento:
- Idempotente: se email já existe, não duplica, não sobrescreve
- Senhas hasheadas com bcrypt (salt rounds: 12) na criação
- Registra `AuditLog` action `USER_CREATED` para cada usuário criado pelo seed

---

## 5. Edge Cases

| # | Caso | Tratamento |
|---|---|---|
| E1 | Login com email inexistente | 401 — mensagem genérica, sem revelar se email existe |
| E2 | Login com usuário inativo | 401 — mesma mensagem genérica |
| E3 | Login com senha vazia | 400 `VALIDATION_ERROR` (zod rejeita antes do service) |
| E4 | Login com email em case diferente | Email normalizado lowercase no schema zod |
| E5 | Cookie com UUID inexistente | 401 — sessão não encontrada |
| E6 | Cookie com sessão expirada | 401 — session deletada, cookie limpo |
| E7 | Usuário desativado enquanto logado | Próximo request com `requireAuth` detecta `ativo=false`, destrói session, retorna 401 |
| E8 | Dois admins; um deleta o outro (ficaria com 1) | Permitido — regra só bloqueia remoção do **último** |
| E9 | Admin tenta mudar próprio role | 409 — impedido |
| E10 | Admin tenta desativar a si mesmo | 409 — impedido |
| E11 | Criar usuário com email duplicado | 409 `CONFLICT` |
| E12 | Role inválido no payload | 400 `VALIDATION_ERROR` (zod enum) |
| E13 | Campos extras no payload | Ignorados (zod `.strip()`) |
| E14 | Request sem Content-Type application/json | 400 — Fastify rejeita |
| E15 | Body > 1MB | 413 — limite Fastify |
| E16 | Cookie `almox_sid` vazio ou malformado | 401 — tratado como ausente |
| E17 | Rate limit excedido no login | 429 com header `Retry-After` |
| E18 | Servidor reinicia | Sessions sobrevivem no PostgreSQL |
| E19 | Dois requests criam mesmo email simultaneamente | UNIQUE constraint: um 201, outro 409 |
| E20 | `SESSION_SECRET` não configurado | Boot falha com erro explícito da validação zod |
| E21 | Dados legados no localStorage do frontend | Não afetam backend — coexistência até módulo de integração |
| E22 | `DATABASE_URL` inválida | Boot falha com erro do Prisma. Healthcheck retorna 503 se cair após boot |

---

## 6. Critérios de Aceite

### Auth

| # | Dado | Quando | Então |
|---|---|---|---|
| CA-A1 | Credenciais válidas | POST `/api/v1/auth/login` | 200 + `Set-Cookie: almox_sid` httpOnly + body com user sem senha |
| CA-A2 | Email inexistente | POST `/api/v1/auth/login` | 401 + `"Credenciais inválidas"` |
| CA-A3 | Senha incorreta | POST `/api/v1/auth/login` | 401 + mensagem idêntica a CA-A2 |
| CA-A4 | Usuário inativo | POST `/api/v1/auth/login` | 401 + mensagem idêntica a CA-A2 |
| CA-A5 | Sessão válida | POST `/api/v1/auth/logout` | 200 + cookie limpo + session deletada no banco |
| CA-A6 | Sessão válida | GET `/api/v1/auth/me` | 200 + user data + `expires_at` renovada no banco |
| CA-A7 | Sessão expirada | GET `/api/v1/auth/me` | 401 + session deletada no banco |
| CA-A8 | 6ª tentativa errada em 15 min (mesmo IP) | POST `/api/v1/auth/login` | 429 + header `Retry-After` |
| CA-A9 | Login bem-sucedido | — | `audit_logs` contém `LOGIN` com userId, ip, timestamp |
| CA-A10 | Login falhado | — | `audit_logs` contém `LOGIN_FAILED` com ip, email como target |
| CA-A11 | Qualquer response de auth | — | Campo `senha` ausente no body e nos logs |

### Users

| # | Dado | Quando | Então |
|---|---|---|---|
| CA-U1 | Admin logado | GET `/api/v1/users` | 200 + lista sem campo `senha` |
| CA-U2 | Operador logado | GET `/api/v1/users` | 403 `FORBIDDEN` |
| CA-U3 | Admin logado | POST `/api/v1/users` válido | 201 + user criado + senha hasheada no banco |
| CA-U4 | Admin logado | POST `/api/v1/users` email duplicado | 409 `CONFLICT` |
| CA-U5 | Admin logado | PUT com `ativo: false` em outro user | 200 + sessions invalidadas + audit log |
| CA-U6 | Admin logado | PUT no próprio user com `ativo: false` | 409 |
| CA-U7 | Único admin | DELETE nele mesmo | 409 |
| CA-U8 | Admin logado | PATCH password de outro user | 200 + hash atualizado + sessions invalidadas |
| CA-U9 | Criação de user | — | `audit_logs` com `USER_CREATED`, target = userId |
| CA-U10 | Sem cookie | Qualquer rota de users | 401 |
| CA-U11 | User desativado com sessions ativas | Próximo request | 401 + sessions removidas |

### Infra

| # | Dado | Quando | Então |
|---|---|---|---|
| CA-I1 | Servidor + DB ok | GET `/health` | 200 + `"ok"` + `"connected"` |
| CA-I2 | Servidor ok, DB caiu | GET `/health` | 503 + `"degraded"` |
| CA-I3 | `SESSION_SECRET` ausente | Boot | Servidor não inicia, stderr explicativo |
| CA-I4 | Erro 500 | — | Response padronizado + log sem dados sensíveis |

---

## 7. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Sessions expiradas acumulam registros | Médio | Job de limpeza periódica — pendência para próximo módulo |
| R2 | Render free tier desliga após inatividade | Médio | Sessions sobrevivem no Postgres. Documentar para o cliente |
| R3 | Render Postgres free tier tem limite de storage | Baixo | Suficiente para esta fase. Monitorar |
| R4 | Sem rate limiting por userId, apenas por IP | Baixo | Suficiente para esta fase |
| R5 | Sem 2FA | Médio | Evolução futura |
| R6 | Sem rotação de `SESSION_SECRET` | Baixo | Documentar procedimento manual |
| R7 | Sliding expiration mantém sessão ativa indefinidamente com uso contínuo | Baixo | Aceitável para sistema interno |
| R8 | Sem limite de sessões simultâneas | Baixo | Implementar se necessário |

---

## 8. Contextos para Implementação

Para implementar este módulo, consultar:

| Contexto | Localização | Finalidade |
|---|---|---|
| `claude.md` | Raiz do projeto | Visão geral, riscos confirmados, invariantes, estado do frontend |
| `SDD_priority.md` | Raiz do projeto | Instruções SDD, prioridades, regras de bloqueio |
| `data.js` | Raiz do projeto | Modelo de dados localStorage — referência para nomes de campos legados |
| `auth.js` | Raiz do projeto | Lógica de auth client-side — referência para fluxo existente |
| `modals.js` | Raiz do projeto | CRUD de usuários via modals — referência para campos e validações |
| `pages.js` | Raiz do projeto | PageUsuarios — listagem, toggle ativo, delete no client |
| Este SDD | `docs/SDD-001-bootstrap-auth-users.md` | Contrato técnico |

### Mapeamento de campos: legado → novo

| Campo legado (localStorage) | Campo novo (PostgreSQL) | Notas |
|---|---|---|
| `id` (int sequencial) | `id` (UUID) | Tipo muda. IDs legados não migram neste módulo |
| `nome` | `nome` | Mantido |
| `email` | `email` | Mantido, normalizado lowercase |
| `senha` (texto puro) | `senha` (bcrypt hash) | **Mudança crítica** |
| `role` | `role` | Mantido. Mesmos valores |
| `ativo` | `ativo` | Mantido |
| — | `criado_em` | Novo |
| — | `atualizado_em` | Novo |
| — | `Session` (tabela) | Substitui sessionStorage |
| — | `AuditLog` (tabela) | Não existia equivalente |

### Checklist de implementação

- [ ] Inicializar projeto Node.js com package.json
- [ ] Configurar TypeScript (tsconfig.json)
- [ ] Instalar dependências
- [ ] Criar .env.example e .gitignore
- [ ] `config/env.ts` — validação zod de env vars
- [ ] `infra/prisma.ts` — singleton Prisma
- [ ] `infra/logger.ts` — config pino com redact
- [ ] `infra/healthcheck.ts` — GET /health
- [ ] `prisma/schema.prisma` — User, Session, AuditLog
- [ ] `prisma migrate dev` — migration inicial
- [ ] `shared/errors/app-error.ts`
- [ ] `shared/types/index.ts`
- [ ] `shared/middleware/require-auth.ts`
- [ ] `shared/middleware/require-role.ts`
- [ ] `app/plugins/cors.ts`
- [ ] `app/plugins/session.ts`
- [ ] `app/plugins/rate-limit.ts`
- [ ] `app/plugins/error-handler.ts`
- [ ] `modules/auth/auth.schema.ts`
- [ ] `modules/auth/auth.service.ts`
- [ ] `modules/auth/auth.controller.ts`
- [ ] `modules/auth/auth.routes.ts`
- [ ] `modules/users/users.schema.ts`
- [ ] `modules/users/users.service.ts`
- [ ] `modules/users/users.controller.ts`
- [ ] `modules/users/users.routes.ts`
- [ ] `app/server.ts` — boot
- [ ] `prisma/seed.ts` — seed idempotente
- [ ] Testar todos os critérios de aceite
- [ ] Verificar que `senha` não aparece em responses ou logs
- [ ] Documentar rollback
- [ ] README.md do backend

---

## 9. Rollback

Em caso de necessidade de reverter:

1. `prisma migrate reset` — destrói tabelas
2. Remover diretório `backend/`
3. Frontend continua inalterado — zero dependência neste módulo

Risco de rollback: **nenhum.**

---

## 10. Próximos Módulos

| SDD | Módulo | Dependência |
|---|---|---|
| SDD-002 | Employees + Settings (Funcionários, Categorias, Depósitos, Setores) | SDD-001 |
| SDD-003 | Inventory + Stock Movements (Itens, Entradas, Saídas) | SDD-001, SDD-002 |
| SDD-004 | Integração Frontend ↔ Backend (substituir localStorage por fetch) | SDD-001, SDD-002, SDD-003 |
| SDD-005 | Reports + Audit (Relatórios server-side, consulta de auditoria) | SDD-003 |
| SDD-006 | Deploy + Observabilidade (Render, monitoring, alertas) | SDD-001+ |
