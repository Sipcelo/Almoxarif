# SDD-001-FIX — Correção de Desvios do SDD-001

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado
> **Cliente:** Rodoviária de Pelotas
> **Documento:** Complemento corretivo ao SDD-001
> **Status:** SPEC — Aguardando aprovação
> **Versão:** 1.0
> **Data:** 2026-04-16

---

## 1. Entendimento

O relatório `RELATORIO-TESTES-SPEC-001.md` confirma que 12/12 testes passam, mas a análise comparativa contra o **SDD-001 aprovado** identifica **5 desvios de implementação** que violam o contrato técnico acordado. Este documento especifica as correções obrigatórias antes de considerar o SDD-001 como **Done**.

**Decisão do stakeholder:** corrigir desvios antes de seguir para SDD-002.

**Escopo:** ajustar implementação existente. Não há novo escopo funcional — apenas alinhamento ao contrato já aprovado.

---

## 2. Premissas

| # | Premissa |
|---|---|
| P1 | A implementação atual roda, tem base de testes operacional e estrutura de módulos correta — não é reescrita |
| P2 | Os 12 testes existentes continuarão válidos após ajustes, com alterações pontuais de mensagens e formato esperado |
| P3 | Banco `almox_test` pode ser resetado sem perda real (é ambiente de teste) |
| P4 | Banco de desenvolvimento pode ser migrado com `prisma migrate` sem risco (sem usuários reais em produção) |
| P5 | Frontend permanece intocado |

---

## 3. Lacunas

| # | Lacuna | Proposta |
|---|---|---|
| LF1 | Relatório não confirma nome do cookie usado | Verificar e ajustar para `almox_sid` (D2) |
| LF2 | Relatório não confirma se existe teste específico para sliding expiration | Adicionar teste (ver §6) |
| LF3 | Relatório não confirma se `senha` é ocultada em logs | Adicionar teste + verificar config do pino redact |

---

## 4. SPEC de Correção

### 4.1. DV1 — Sessão server-side no banco (ALTA)

**Problema:** implementação usa `@fastify/session` (cookie de sessão assinado, sem estado persistente em banco). Isso **impossibilita** invalidar sessões server-side quando:
- Admin desativa um usuário (CA-U5, CA-U11)
- Admin altera senha de um usuário (CA-U8 — "sessions invalidadas")
- Admin altera role de um usuário (§4.5 do SDD-001 — "invalidar todas as sessions")
- Usuário faz logout (CA-A5 — "session deletada no banco")

**Correção obrigatória:**

1. **Remover** `@fastify/session` do projeto.
2. **Adotar** `@fastify/cookie` para leitura/escrita do cookie. Apenas o cookie `almox_sid` contém o `sessionId` (UUID). Nenhum dado de sessão é armazenado no cookie.
3. **Implementar tabela `Session`** no Postgres conforme §4.2 do SDD-001:
   - `id` (UUID, PK, valor do cookie)
   - `user_id` (FK → User, ON DELETE CASCADE)
   - `expires_at` (DateTime)
   - `criado_em` (DateTime)
   - `ip_address` (String, nullable)
   - `user_agent` (String, nullable)
   - Índices em `user_id` e `expires_at`
4. **Middleware `requireAuth`** deve:
   - Ler `almox_sid` do cookie
   - Buscar `Session` no banco por `id`
   - Validar `expiresAt > now()`
   - Validar `user.ativo === true`
   - Atualizar `expiresAt = now + SESSION_TTL_HOURS` (sliding expiration)
   - Injetar `request.user`
5. **Logout** deve deletar o registro `Session` do banco.
6. **Ao desativar, rebaixar ou alterar senha de um usuário**, deletar **todas** as `Session` desse `user_id`.

**Critério de aceite da correção:**
- Teste novo: admin desativa outro usuário logado → próximo request do usuário desativado retorna 401 e a `Session` não existe mais no banco.
- Teste novo: admin altera senha de outro usuário → sessions anteriores desse usuário foram deletadas.

---

### 4.2. DV3 — Mensagens em português (Média)

**Problema:** mensagens em inglês (`"Login successful"`, `"Invalid credentials"`, `"Too many requests"`) — sistema é para cliente brasileiro (Rodoviária de Pelotas).

**Correção obrigatória — padronizar para português:**

| Contexto | Antes (errado) | Depois (correto) |
|---|---|---|
| Login bem-sucedido | `"Login successful"` | Não retornar `message` — retornar apenas `{ user: {...} }` conforme §4.3 do SDD-001 |
| Login falhado | `"Invalid credentials"` | `"Credenciais inválidas"` |
| Logout | qualquer | `"Sessão encerrada"` |
| Rate limit | `"Too many requests"` | `"Limite de requisições excedido. Tente novamente em breve."` |
| Sessão ausente/expirada | — | `"Sessão expirada ou inválida"` |
| Sem permissão | — | `"Sem permissão para esta ação"` |
| Email duplicado | — | `"E-mail já cadastrado"` |
| Último admin | — | `"Não é possível remover/desativar o último administrador ativo"` |
| Auto-ação bloqueada | — | `"Administrador não pode desativar ou rebaixar a si mesmo"` |

**Critério de aceite:** grep nos arquivos `src/` não encontra mensagens de erro voltadas ao usuário em inglês.

---

### 4.3. DV4 — Formato de erro padronizado (ALTA)

**Problema:** implementação retorna `{ error, message }` (dois campos planos). SDD-001 §4.1.5 especifica `{ error: { code, message, details } }` (objeto aninhado com código machine-readable).

**Correção obrigatória:**

Toda resposta de erro deve seguir:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível",
    "details": []
  }
}
```

**Códigos válidos** (já especificados no SDD-001):
`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

**Campo `details`:**
- Omitir ou retornar array vazio `[]` quando não aplicável
- Em erros de validação zod, retornar `[{ path: "campo", message: "erro" }]`

**Ajustes necessários:**
- Atualizar `app/plugins/error-handler.ts` para emitir o formato correto
- Atualizar `app/plugins/rate-limit.ts` (`errorResponseBuilder`) para retornar o mesmo formato com `code: "RATE_LIMITED"`
- Atualizar classe `AppError` se estiver emitindo formato diferente

**Critério de aceite:**
- Atualizar `error-format.test.ts` para verificar: `body.error.code === "NOT_FOUND"`, `typeof body.error.message === "string"`
- Testes existentes que assertam `error: "xxx"` devem ser atualizados para `error.code === "xxx"`
- Nenhuma rota retorna formato antigo `{ error: string, message: string }`

---

### 4.4. DV5 — Soft delete por flag `ativo` (Média)

**Problema:** implementação usa `deletedAt` (timestamp nullable). SDD-001 §2 (D8 aprovado) especifica `ativo: false` (boolean).

**Justificativa da SPEC:** o sistema legado já usa `ativo` em toda a UI (`data.js`, `modals.js`, `pages.js`), e o mapeamento §8 do SDD-001 explicita `ativo` como campo mantido. Usar `deletedAt` cria fricção desnecessária na integração futura frontend↔backend.

**Correção obrigatória:**

1. Alterar schema Prisma:
   - **Remover** coluna `deletedAt` da tabela `users`
   - **Manter** coluna `ativo` (Boolean, not null, default `true`) — já existe no schema definido
2. Migration Prisma:
   ```
   npx prisma migrate dev --name remove_deleted_at_use_ativo
   ```
3. Ajustar service/controller de users:
   - `DELETE /api/v1/users/:id` → setar `ativo = false` (não mais `deletedAt = now()`)
   - Listagens não devem filtrar automaticamente por `ativo` — deixar filtro explícito via query param `?ativo=false`
4. Ajustar teste 2.3 (`users-crud.test.ts`):
   - Assertion deve ser `ativo === false` (não `deletedAt !== null`)

**Critério de aceite:**
- Schema Prisma não tem campo `deletedAt`
- Teste 2.3 passa com nova assertion
- `DELETE` em usuário já inativo retorna 200 (idempotente, conforme §4.5 SDD-001)

---

### 4.5. DV7 — Email do seed admin (Média)

**Problema:** seed usa `admin@almoxarifado.com` (legado). SDD-001 §4.6 (D6 aprovado) especifica `admin@rodoviariapel.com`.

**Correção obrigatória:**

1. Ajustar `prisma/seed.ts`:
   | Campo | Valor correto |
   |---|---|
   | Email admin | `admin@rodoviariapel.com` |
   | Senha admin | `admin2026` |
   | Email operador | `op@rodoviariapel.com` |
   | Senha operador | `operador2026` |

2. Ajustar `test/helpers.ts` — `seedAdmin()` e `loginAsAdmin()` devem usar `admin@rodoviariapel.com` / `admin2026`.

3. Ajustar `test/auth.test.ts` — teste 1.3 deve assertar `email: "admin@rodoviariapel.com"` (não `admin@almoxarifado.com`).

**Critério de aceite:**
- Nenhum arquivo em `backend/` referencia `@almoxarifado.com`
- Todos os testes usam o email correto da Rodoviária

---

## 5. Testes Adicionais Obrigatórios

Os testes abaixo **não existem** no relatório atual e são exigidos pelos critérios de aceite do SDD-001. Sem eles, a Definition of Done não é atendida.

### 5.1. CA-U6 — Admin não pode desativar a si mesmo

**Dado** admin logado
**Quando** PUT `/api/v1/users/:id` (onde `:id` é o próprio admin) com body `{ ativo: false }`
**Então** resposta 409 + `error.code === "CONFLICT"` + mensagem sobre auto-desativação

### 5.2. CA-U7 — Não é possível remover o último admin

**Dado** sistema com apenas 1 admin ativo
**Quando** DELETE `/api/v1/users/:id` nesse admin
**Então** resposta 409 + `error.code === "CONFLICT"` + mensagem sobre último admin

**Variante:** mesmo cenário com PUT `{ ativo: false }` → também 409.
**Variante:** mesmo cenário com PUT `{ role: "operador" }` → também 409 (rebaixar o último admin).

### 5.3. CA-A10 — Audit log em login falhado

**Dado** credenciais inválidas
**Quando** POST `/api/v1/auth/login`
**Então** tabela `audit_logs` contém registro com:
- `action: "LOGIN_FAILED"`
- `target` = email tentado
- `ip_address` preenchido
- `user_id` nulo

### 5.4. CA-A11 — Senha nunca aparece em response

**Dado** qualquer endpoint que retorne `User`
**Quando** resposta é serializada
**Então** campo `senha` **não** existe no body

Teste prático: GET `/api/v1/users` e GET `/api/v1/users/:id` — verificar `JSON.stringify(body).includes("senha") === false`.

### 5.5. Sliding expiration

**Dado** sessão válida com `expiresAt = T`
**Quando** request autenticado em `T - 1h`
**Então** `expiresAt` no banco passa a ser aproximadamente `T - 1h + SESSION_TTL_HOURS` (renovada)

**Verificação:** ler `expires_at` do banco antes do request, fazer request autenticado (`/auth/me`), ler de novo — deve ter aumentado.

### 5.6. Invalidação de sessão ao desativar usuário (cobre DV1)

**Dado** usuário B logado com sessão ativa, admin A logado
**Quando** A faz PUT `/api/v1/users/B` com `{ ativo: false }`
**Então** todas as `Session` de B foram deletadas do banco
**E** próximo request de B retorna 401

### 5.7. Invalidação de sessão ao alterar senha

**Dado** usuário B logado com sessão ativa, admin A logado
**Quando** A faz PATCH `/api/v1/users/B/password`
**Então** todas as `Session` de B foram deletadas
**E** próximo request de B retorna 401

### 5.8. Autorização por role (não-admin)

**Dado** operador logado
**Quando** GET `/api/v1/users`
**Então** 403 + `error.code === "FORBIDDEN"`

**Variantes:** POST, PUT, DELETE, PATCH password → todos 403.

### 5.9. Redact de senha em logs

**Dado** POST `/auth/login` com senha `"teste123"`
**Quando** o log do request é gravado
**Então** log não contém a string `"teste123"` nem o campo `senha` visível (deve estar redacted como `[REDACTED]` ou similar)

**Verificação sugerida:** capturar stream de log do pino em memória durante o teste e grep na saída.

---

## 6. Edge Cases Adicionais

Edge cases do SDD-001 §5 que não foram cobertos e devem ser testados:

| # | Edge case | Teste |
|---|---|---|
| E4 | Email em case diferente no login | POST login com `ADMIN@RODOVIARIAPEL.COM` → deve funcionar (normalização lowercase) |
| E11 | Criar usuário com email duplicado | POST `/users` duas vezes com mesmo email → segundo retorna 409 |
| E12 | Role inválido | POST `/users` com `role: "superuser"` → 400 `VALIDATION_ERROR` |
| E13 | Campos extras no payload | POST com campo `senhaSecreta` não previsto → zod strip, sem erro |
| E16 | Cookie vazio ou malformado | Request com cookie `almox_sid=;` → 401 |

---

## 7. Critérios de Aceite Consolidados

A correção só é considerada aceita quando **todos** os itens abaixo forem verdadeiros:

### Bloco A — Desvios corrigidos

- [ ] DV1: `@fastify/session` removido; tabela `Session` implementada; logout deleta do banco; desativação/rebaixamento/alteração de senha invalidam sessions
- [ ] DV3: todas as mensagens de erro em português; grep confirma ausência de mensagens em inglês em `src/`
- [ ] DV4: formato `{ error: { code, message, details } }` em 100% das respostas de erro; rate-limit usa mesmo formato
- [ ] DV5: schema Prisma sem `deletedAt`; soft delete via `ativo = false`; teste 2.3 atualizado
- [ ] DV7: seed e helpers usam `admin@rodoviariapel.com` / `admin2026` e `op@rodoviariapel.com` / `operador2026`

### Bloco B — Testes adicionais

- [ ] §5.1 Admin não pode se desativar (CA-U6)
- [ ] §5.2 Último admin protegido em DELETE, PUT ativo=false, PUT role (CA-U7)
- [ ] §5.3 Login falhado gera `AuditLog LOGIN_FAILED` (CA-A10)
- [ ] §5.4 Campo `senha` ausente em responses (CA-A11)
- [ ] §5.5 Sliding expiration verificada no banco
- [ ] §5.6 Desativação invalida sessões ativas
- [ ] §5.7 Alteração de senha invalida sessões ativas
- [ ] §5.8 Operador recebe 403 em rotas de users
- [ ] §5.9 Senha não aparece em logs

### Bloco C — Edge cases

- [ ] §6 E4, E11, E12, E13, E16 cobertos

### Bloco D — Resultado geral

- [ ] 100% dos testes passam (incluindo os anteriores que foram ajustados)
- [ ] Nenhum teste marcado como `skip` ou `todo`
- [ ] Relatório de testes atualizado com o novo mapeamento CA × resultado
- [ ] Rollback documentado no README do backend

---

## 8. Riscos da Correção

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| RC1 | Migração que remove `deletedAt` pode quebrar dados existentes | Baixo | Ambiente ainda não tem dados reais em produção. Ok usar `prisma migrate dev` sem preservar dados |
| RC2 | Troca de `@fastify/session` para sessão no banco aumenta latência por request | Baixo | Query por PK indexada é O(1). Aceitável |
| RC3 | Mudança no formato de erro pode quebrar clientes existentes | Nulo | Não há cliente integrado ainda — frontend ainda usa localStorage |
| RC4 | Teste de redact de senha pode ser frágil dependendo do setup do pino | Médio | Documentar técnica usada (ex: capturar stream de log em memória) |

---

## 9. Definition of Done (DoD) do SDD-001 após correção

Para declarar o **SDD-001 como Done**, todos os itens abaixo devem estar verdadeiros:

| Item | Status atual | Status requerido |
|---|---|---|
| SPEC aprovada | ✅ | ✅ |
| Desvios DV1-DV7 corrigidos | ❌ | ✅ |
| Implementação aderente ao escopo aprovado | ⚠️ | ✅ |
| Testes passando | ✅ (12/12) | ✅ (12 ajustados + ~12 novos) |
| Critérios de aceite do SDD-001 evidenciados | ⚠️ Parcial | ✅ Total (CA-A1 a CA-A11, CA-U1 a CA-U11, CA-I1 a CA-I4) |
| Migração aplicada | ✅ | ✅ (+ nova migration) |
| Logs e auditoria verificados | ⚠️ | ✅ (inclui LOGIN_FAILED e redact) |
| Rollback documentado | ❌ | ✅ |
| Riscos residuais registrados | ✅ (R1-R4) | ✅ |

---

## 10. Próximas Decisões

| # | Decisão | Bloqueante? |
|---|---|---|
| DC1 | Aprovar esta SPEC de correção como escopo obrigatório antes de SDD-002 | Sim |
| DC2 | Aprovar que o relatório final após correção substitua o RELATORIO-TESTES-SPEC-001.md | Sim |

---

## 11. Gate

**Aguardando aprovação da SPEC de correção.**

Após aprovação, o desenvolvedor executa as correções, atualiza os testes, produz novo relatório e só então o SDD-001 é declarado Done. Apenas nesse ponto passamos para o SDD-002.
