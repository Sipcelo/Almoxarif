# SDD-002 — Employees + Settings

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado
> **Cliente:** Rodoviária de Pelotas
> **Módulo:** 002 — Funcionários + Configurações (Setores, Categorias, Depósitos)
> **Status:** SPEC em elaboração — aguardando aprovação
> **Versão:** 0.1 (draft)
> **Data:** 2026-04-16

---

## 1. Entendimento

Este módulo entrega os cadastros auxiliares que sustentam o módulo seguinte (Inventory + Stock Movements em SDD-003):

1. **Funcionários** — pessoas que retiram material do almoxarifado. Não fazem login. Não têm senha. Diferem de `User` (que é acesso ao sistema).
2. **Settings** — três listas de apoio:
   - **Setores** — departamentos (Diretor, Contábil, Almoxarifado, Operações…). Usados por Funcionário e por Saídas (SDD-003).
   - **Categorias** — classificação de Item de estoque (SDD-003).
   - **Depósitos** — locais físicos onde o item está armazenado (SDD-003).

Este módulo entrega **apenas APIs REST** testáveis. Integração com frontend ocorre em SDD-004.

---

## 2. Premissas

| # | Premissa |
|---|---|
| P1 | Stack mantida: Fastify + TypeScript + Prisma + PostgreSQL |
| P2 | Padrões SDD-001 reutilizados integralmente: `AppError`, `errorHandler`, `requireAuth`/`requireRole`, `buildDiff`, Zod com `.strip()`, snake_case via `@map`, IDs UUID |
| P3 | Paginação no padrão SDD-001 pós-refactor: `{ data, meta: { total, page, limit, totalPages } }` |
| P4 | Soft delete via `ativo = false`, consistente com User |
| P5 | Autorização: criação/edição/remoção exige role `admin`; leitura permitida a qualquer usuário autenticado |
| P6 | Todas as ações mutativas geram `AuditLog` com `userId` do ator, `action`, `target`, `details` (diff), `ipAddress` |
| P7 | `AuditLog.action` ganha novos códigos: `EMPLOYEE_CREATED/UPDATED/DEACTIVATED`, `SETOR_CREATED/UPDATED/DEACTIVATED`, idem Categoria e Depósito |
| P8 | Sem integração com localStorage legado neste módulo — dados anteriores não serão migrados automaticamente (migração fica em SDD-004) |

---

## 3. Lacunas — decisões necessárias antes de aprovar

| # | Lacuna | Opção A | Opção B | Recomendação |
|---|--------|---------|---------|--------------|
| L1 | **Normalização Setor/Categoria/Depósito** | Entidades separadas (tabelas com UUID, nome único, ativo). Funcionário referencia Setor por FK `setor_id`. | Campos string livres em Funcionário/Item (modelo legado). | **A** — permite renomear sem inconsistência, rastreabilidade, soft delete. Maior robustez alinhada ao §7 do CLAUDE.md (invariantes). |
| L2 | **O que fazer com Setor referenciado ao tentar desativar?** | Bloquear desativação (409 CONFLICT) se houver Funcionário ativo apontando para o Setor. | Permitir desativação mesmo com referências (flag histórico). | **A** — evita órfãos semânticos. Cliente desativa o funcionário primeiro ou reatribui. |
| L3 | **Unicidade de nome em Setor/Categoria/Depósito** | Único por nome normalizado (trim + case-insensitive). | Permitir duplicatas. | **A** — evita "Almoxarifado" vs "almoxarifado" vs " Almoxarifado ". |
| L4 | **Funcionário precisa de `email`?** | Sim, opcional, único quando presente. | Não — só nome/setor/cargo. | **B** — legado não tem, SDD-003 não exige. Adicionar depois se necessário. |
| L5 | **Código/matrícula de funcionário** | Campo `matricula` único (string curta). | Apenas `id` UUID interno. | **B** — legado não tem; adicionar via SPEC futura se o cliente pedir. |
| L6 | **Pode haver Funcionário sem Setor?** | Não — `setor_id` NOT NULL. | Sim — `setor_id` nullable (visitante, temporário). | **A** — invariante de domínio mais forte. Se precisar flex, registrar débito. |
| L7 | **Seed inicial de Setores/Categorias/Depósitos** | Seed mínimo (ex: Setor "Almoxarifado", Categoria "Geral", Depósito "Principal") para destravar SDD-003. | Começar vazio — cliente cadastra tudo. | **A** — destrava SDD-003 e testes dependentes. Seeds claramente marcados como dados-semente, não dados-demo. |
| L8 | **Hard-limit de registros** | Sem limite. | Limite de 1000 por tipo (defesa contra abuso). | **A** — volumetria pequena na prática. Registrar risco. |

**Nenhuma dessas lacunas pode ser inferida.** Requer sua decisão explícita para cada uma antes da aprovação da SPEC.

---

## 4. SPEC (condicionada às decisões acima — descrita assumindo opções recomendadas)

### 4.1. Modelo de Dados (Prisma)

```prisma
model Setor {
  id           String         @id @default(uuid())
  nome         String         @unique              // normalizado: trim + lower
  ativo        Boolean        @default(true)
  criadoEm     DateTime       @default(now())      @map("criado_em")
  atualizadoEm DateTime       @updatedAt           @map("atualizado_em")
  funcionarios Funcionario[]

  @@map("setores")
}

model Categoria {
  id           String   @id @default(uuid())
  nome         String   @unique
  ativo        Boolean  @default(true)
  criadoEm     DateTime @default(now()) @map("criado_em")
  atualizadoEm DateTime @updatedAt      @map("atualizado_em")

  @@map("categorias")
}

model Deposito {
  id           String   @id @default(uuid())
  nome         String   @unique
  ativo        Boolean  @default(true)
  criadoEm     DateTime @default(now()) @map("criado_em")
  atualizadoEm DateTime @updatedAt      @map("atualizado_em")

  @@map("depositos")
}

model Funcionario {
  id           String   @id @default(uuid())
  nome         String
  cargo        String
  setorId      String   @map("setor_id")
  setor        Setor    @relation(fields: [setorId], references: [id], onDelete: Restrict)
  ativo        Boolean  @default(true)
  criadoEm     DateTime @default(now()) @map("criado_em")
  atualizadoEm DateTime @updatedAt      @map("atualizado_em")

  @@index([setorId])
  @@map("funcionarios")
}
```

Observação: `onDelete: Restrict` reforça L2 no nível do banco caso alguma rotina tente `DELETE` físico (que não deveria acontecer — sempre soft delete).

### 4.2. Estrutura de pastas

```
backend/src/modules/
├── funcionarios/
│   ├── funcionarios.schema.ts
│   ├── handlers.ts
│   ├── guards.ts               ← assertSetorAtivo, assertNoActiveEmployeesInSetor
│   └── routes.ts
├── settings/
│   ├── setores/
│   │   ├── setores.schema.ts
│   │   ├── handlers.ts
│   │   └── routes.ts
│   ├── categorias/
│   │   ├── categorias.schema.ts
│   │   ├── handlers.ts
│   │   └── routes.ts
│   └── depositos/
│       ├── depositos.schema.ts
│       ├── handlers.ts
│       └── routes.ts
```

`settings/` não é um módulo monolítico porque cada sub-entidade tem handlers e rotas próprios. A divisão é estrutural, não funcional.

### 4.3. Endpoints

Prefixo base: `/api/v1`. Todos exigem `requireAuth`. Ações mutativas exigem `requireRole(["admin"])`.

#### 4.3.1. Funcionários

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| GET | `/funcionarios` | autenticado | Lista paginada. Query: `?page&limit&ativo&setorId&search` (search sobre nome/cargo). |
| GET | `/funcionarios/:id` | autenticado | Detalhe com `setor` incluído. |
| POST | `/funcionarios` | admin | Cria. Body: `{ nome, cargo, setorId }`. Valida Setor ativo. |
| PUT | `/funcionarios/:id` | admin | Atualiza parcial. Campos: `nome?, cargo?, setorId?, ativo?`. |
| DELETE | `/funcionarios/:id` | admin | Soft delete (`ativo=false`). Idempotente. |

#### 4.3.2. Settings — Setores / Categorias / Depósitos

Mesmo shape para as três entidades. Rotas: `/setores`, `/categorias`, `/depositos`.

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| GET | `/{entidade}` | autenticado | Lista paginada. Query: `?page&limit&ativo&search`. |
| GET | `/{entidade}/:id` | autenticado | Detalhe. |
| POST | `/{entidade}` | admin | Cria. Body: `{ nome }`. Normaliza (trim+lowercase) e valida unicidade. |
| PUT | `/{entidade}/:id` | admin | Atualiza `nome` ou `ativo`. Setor: bloqueia `ativo=false` se houver Funcionário ativo referenciando. |
| DELETE | `/{entidade}/:id` | admin | Soft delete (`ativo=false`). Idempotente. Setor: mesma regra do PUT. |

### 4.4. Validações Zod (exemplo Funcionário)

```ts
const funcSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  cargo: z.string().trim().min(2).max(100),
  setorId: z.string().uuid(),
}).strip();
```

Settings:
```ts
const nameSchema = z.string().trim().min(2).max(100)
  .transform(v => v.toLowerCase());
```

### 4.5. AuditLog — novos valores de `action`

- `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `EMPLOYEE_DEACTIVATED`
- `SETOR_CREATED`, `SETOR_UPDATED`, `SETOR_DEACTIVATED`
- `CATEGORIA_CREATED`, `CATEGORIA_UPDATED`, `CATEGORIA_DEACTIVATED`
- `DEPOSITO_CREATED`, `DEPOSITO_UPDATED`, `DEPOSITO_DEACTIVATED`

`details` contém diff via `buildDiff` (reuso de `shared/utils/diff.ts`).

### 4.6. Seed

`prisma/seed.ts` é estendido:

```ts
// Idempotente: upsert por nome único
await prisma.setor.upsert({ where: { nome: "almoxarifado" }, update: {}, create: { nome: "almoxarifado" } });
await prisma.categoria.upsert({ where: { nome: "geral" }, update: {}, create: { nome: "geral" } });
await prisma.deposito.upsert({ where: { nome: "principal" }, update: {}, create: { nome: "principal" } });
```

Não cria Funcionário por padrão. Cliente preenche.

---

## 5. Edge Cases

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Criar Funcionário com `setorId` inexistente | 400 VALIDATION_ERROR (não é NOT_FOUND — é input inválido) |
| E2 | Criar Funcionário com `setorId` de Setor `ativo=false` | 409 CONFLICT — "Setor inativo não aceita novos funcionários" |
| E3 | Desativar Setor com Funcionário ativo | 409 CONFLICT — "Setor tem funcionários ativos vinculados" |
| E4 | Desativar Setor com apenas Funcionários inativos | 200 OK |
| E5 | Criar Setor com nome duplicado (case/espaços) | 409 CONFLICT — normalização captura "Almox" vs "almox" |
| E6 | PUT Setor alterando nome para outro já existente | 409 CONFLICT |
| E7 | DELETE Funcionário já inativo | 200 OK (idempotente — sem novo AuditLog) |
| E8 | Operador tenta POST/PUT/DELETE em qualquer rota | 403 FORBIDDEN (consistência com SDD-001) |
| E9 | Campos extras no body (`.strip()`) | Descartados silenciosamente |
| E10 | `page=0` ou `limit=101` | 400 VALIDATION_ERROR |
| E11 | Atualização parcial sem nenhum campo | 400 VALIDATION_ERROR (body vazio após strip) |
| E12 | FK constraint hit (race ao deletar Setor após POST Funcionário) | Prisma lança `P2003`; errorHandler traduz para 409 CONFLICT com mensagem |

---

## 6. Critérios de Aceite (CA)

### Funcionários

- **CA-F1:** `POST /funcionarios` com body válido + setor ativo → 201 + `{ funcionario: { id, nome, cargo, setorId, ativo:true, criadoEm } }` + `AuditLog` `EMPLOYEE_CREATED`.
- **CA-F2:** `POST` com `setorId` inexistente → 400 VALIDATION_ERROR.
- **CA-F3:** `POST` com `setorId` de Setor inativo → 409 CONFLICT.
- **CA-F4:** `PUT /funcionarios/:id` mudando `setorId` para outro ativo → 200 + diff em `AuditLog`.
- **CA-F5:** `DELETE /funcionarios/:id` → 200 + `ativo=false` + `EMPLOYEE_DEACTIVATED`. Segundo DELETE → 200 idempotente.
- **CA-F6:** `GET /funcionarios` paginado → shape `{ funcionarios, meta }`, filtros `ativo`, `setorId`, `search` combinam.
- **CA-F7:** Operador em qualquer rota mutativa → 403 FORBIDDEN.

### Settings (um CA cobre as 3 entidades)

- **CA-S1:** `POST /setores` com nome normalizado → 201 + único. Duplicata (com variação de case/espaço) → 409.
- **CA-S2:** `PUT /setores/:id { ativo: false }` com Funcionário ativo → 409 CONFLICT.
- **CA-S3:** `PUT /setores/:id { ativo: false }` sem vínculos → 200 + `ativo=false`.
- **CA-S4:** `DELETE /setores/:id` segue mesma regra CA-S2/S3.
- **CA-S5:** Mesmas regras CA-S1/S3/S4 aplicáveis a Categorias e Depósitos (sem a regra de vínculo — eles não têm FK de saída neste módulo).
- **CA-S6:** `GET /{entidade}` paginado consistente com SDD-001.
- **CA-S7:** Operador mutando qualquer entidade de settings → 403.

### Integridade

- **CA-I1:** `AuditLog` contém `userId` do ator, nunca nulo em ação mutativa.
- **CA-I2:** Todas as respostas seguem `{ error: { code, message, details } }` em falha.
- **CA-I3:** Seed rodado duas vezes não cria duplicatas (idempotência via upsert).

---

## 7. Testes Obrigatórios

| # | Arquivo | Testes | Cobertura |
|---|---------|--------|-----------|
| T1 | `funcionarios-crud.test.ts` | 6 | CRUD completo + shape + soft delete + idempotência |
| T2 | `funcionarios-rules.test.ts` | 4 | setor inativo, setor inexistente, cascade rules, search combinado |
| T3 | `funcionarios-pagination.test.ts` | 3 | shape meta, navegação, filtros+página |
| T4 | `settings-setores.test.ts` | 6 | CRUD + unicidade normalizada + regra de vínculo |
| T5 | `settings-categorias.test.ts` | 4 | CRUD + unicidade |
| T6 | `settings-depositos.test.ts` | 4 | CRUD + unicidade |
| T7 | `settings-authorization.test.ts` | 3 | operador → 403 em POST/PUT/DELETE das 3 entidades |
| T8 | `settings-audit.test.ts` | 2 | AuditLog gerado em CREATE/UPDATE/DELETE para cada entidade |

**Total previsto:** 32 novos testes. Meta: 78/78 passing (46 atuais + 32 novos).

Todos os testes usam `helpers.ts` (reutilizados) + novos helpers: `seedSetor`, `seedCategoria`, `seedDeposito`, `seedFuncionario`.

---

## 8. Riscos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Mudança de nome de Setor impacta histórico de Saídas (SDD-003) | FK por `setor_id` preserva identidade mesmo com rename. AuditLog registra diff. |
| R2 | Seed de produção planta setores/categorias que cliente não quer | Seeds idempotentes via upsert com nomes claramente genéricos ("almoxarifado", "geral", "principal"). Cliente renomeia/desativa. |
| R3 | Lista de setores pode crescer sem controle | Paginação obrigatória + limite 100 por página. Volume esperado < 50. |
| R4 | Race condition: desativar Setor exatamente quando novo Funcionário é criado | `P2003` FK error do Prisma é capturado pelo errorHandler e convertido para 409 CONFLICT. |
| R5 | Frontend legado quebra ao integrar (SDD-004) | Fora de escopo deste módulo. Contrato documentado nesta SPEC. |

---

## 9. Próximas decisões (bloqueantes)

Responda L1 a L8 da seção 3. Sugestão de formato de resposta:
```
L1: A
L2: A
L3: A
L4: B
L5: B
L6: A
L7: A
L8: A
```
Ou ajustes pontuais se divergir das recomendações.

Após aprovação:
1. Gerar migration Prisma.
2. Implementar módulos `funcionarios/` e `settings/{setores,categorias,depositos}/`.
3. Estender `seed.ts`.
4. Escrever os 32 testes (T1–T8).
5. Atualizar `RELATORIO-TESTES-SPEC-001.md` com bloco SDD-002 ou criar `RELATORIO-TESTES-SDD-002.md`.
6. Atualizar `CLAUDE.md §15` com status "SDD-002 CONCLUÍDO".

---

## 10. Gate

**Aguardando aprovação da SPEC.** Nada será implementado até respostas a L1–L8 e confirmação explícita.
