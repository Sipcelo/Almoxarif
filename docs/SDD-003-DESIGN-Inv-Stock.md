# SDD-003-DESIGN — Inventory + Stock Movements

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado  
> **Cliente:** Rodoviária de Pelotas  
> **Módulo:** 003 — Inventory + Stock Movements  
> **Documento:** DESIGN TÉCNICO  
> **Status:** DESIGN APROVADO  
> **Versão:** 1.0  
> **Data:** 2026-04-17

---

## 1. Entendimento

Este documento descreve o **DESIGN técnico** do SDD-003, após aprovação da SPEC de:

- Itens
- Entradas
- Saídas
- Ajustes manuais auditados

O backend já possui os módulos de Auth, Users, Funcionários e Settings. O SDD-003 adiciona o núcleo transacional de estoque, preservando as invariantes do domínio e preparando a futura integração do frontend no SDD-004.

Estado base considerado:

- SDD-001 concluído — Bootstrap backend, Auth, Users, AuditLog, rate limit
- SDD-001-FIX concluído — correção de desvios e clean-code zero-débito
- SDD-002 concluído — Funcionários, Setores, Categorias, Depósitos
- Frontend ainda não integrado ao backend
- Baseline de regressão atual: 78 testes passando

---

## 2. Premissas

| # | Premissa |
|---|---|
| P1 | Stack atual: Fastify + TypeScript + Prisma |
| P2 | Reutilizar padrões já consolidados: `AppError`, `AuditLog`, `requireAuth`, `requireRole`, Zod `.strip()` |
| P3 | Este módulo entrega apenas backend + testes backend |
| P4 | O saldo oficial será materializado em `Item.quantidade` |
| P5 | Entradas, saídas e ajustes são histórico oficial append-only |
| P6 | O principal risco do módulo é concorrência de estoque |
| P7 | O comportamento de referência para integridade/transações será o de PostgreSQL |
| P8 | `valorAtual` e `valorUnit` usam tipo monetário com precisão controlada |
| P9 | Toda mutação de sucesso gera `AuditLog` persistente |
| P10 | Operações rejeitadas não podem gerar log falso de sucesso |

---

## 3. Lacunas resolvidas no DESIGN

| # | Lacuna | Decisão |
|---|---|---|
| L16 | SQLite dev vs PostgreSQL teste/prod | PostgreSQL é a referência comportamental para transações e concorrência; SQLite é apenas conveniência local |
| L17 | Estratégia anti-oversell | transação + update condicional atômico no saldo |
| L18 | Formato de `AuditLog.details` | JSON serializado estável por ação |
| L19 | Precisão numérica | `Decimal` Prisma para `valorAtual` e `valorUnit` |
| L20 | Shape de filtros/ordenação | paginação 1/20 cap 100; filtros explícitos por recurso; ordenação mínima |

---

## 4. Arquitetura de módulos

### 4.1 Estrutura

```txt
backend/src/modules/
  inventory/
    items.routes.ts
    items.handlers.ts
    items.schema.ts
    items.service.ts
    items.guards.ts
  stock-movements/
    entradas.routes.ts
    entradas.handlers.ts
    entradas.schema.ts
    entradas.service.ts
    saidas.routes.ts
    saidas.handlers.ts
    saidas.schema.ts
    saidas.service.ts
    ajustes.routes.ts
    ajustes.handlers.ts
    ajustes.schema.ts
    ajustes.service.ts
    guards.ts
```

### 4.2 Decisão de design
Usar **service layer explícita** neste módulo.

### 4.3 Motivo
O SDD-003 concentra:
- transações
- invariantes críticas
- concorrência
- snapshot histórico
- auditoria acoplada a mutações

Sem `service layer`, o risco de duplicação e inconsistência aumenta.

---

## 5. Modelagem Prisma

### 5.1 Item

**Tabela:** `items`

| Campo | Tipo lógico | Constraints | Observações |
|---|---|---|---|
| `id` | UUID | PK | |
| `codigo` | String | unique, not null | identificador operacional |
| `descricao` | String | not null | |
| `categoriaId` | UUID | FK | `Categoria` obrigatória e ativa |
| `depositoId` | UUID | FK | `Deposito` obrigatório e ativo |
| `quantidade` | Int | not null, default 0 | saldo materializado oficial |
| `minimo` | Int | not null, default 0 | limiar de alerta |
| `valorAtual` | Decimal | not null, default 0 | valor atual de referência |
| `obs` | String | nullable | |
| `ativo` | Boolean | not null, default true | soft delete |
| `criadoEm` | DateTime | not null | |
| `atualizadoEm` | DateTime | not null | |

**Relações:**
- `categoria -> Categoria`
- `deposito -> Deposito`
- `entradas -> Entrada[]`
- `saidas -> Saida[]`
- `ajustes -> Ajuste[]`

**Índices:**
- unique em `codigo`
- índice em `(ativo, categoriaId, depositoId)`
- índice em `(quantidade, minimo)`

### 5.2 Entrada

**Tabela:** `entradas`

| Campo | Tipo lógico | Constraints | Observações |
|---|---|---|---|
| `id` | UUID | PK | |
| `itemId` | UUID | FK | obrigatório |
| `qtd` | Int | > 0 | inteiro positivo |
| `valorUnit` | Decimal | >= 0 | obrigatório |
| `data` | DateTime | not null | default now se ausente |
| `responsavelUserId` | UUID | FK | derivado da sessão |
| `obs` | String | nullable | |
| `criadoEm` | DateTime | not null | |

**Índices:**
- `itemId`
- `data`
- `responsavelUserId`

### 5.3 Saida

**Tabela:** `saidas`

| Campo | Tipo lógico | Constraints | Observações |
|---|---|---|---|
| `id` | UUID | PK | |
| `itemId` | UUID | FK | obrigatório |
| `qtd` | Int | > 0 | inteiro positivo |
| `valorUnit` | Decimal | >= 0 | obrigatório |
| `data` | DateTime | not null | default now se ausente |
| `funcionarioId` | UUID | FK | obrigatório |
| `setorSnapshotId` | UUID | FK nullable | snapshot histórico |
| `setorSnapshotNome` | String | not null | snapshot histórico |
| `responsavelUserId` | UUID | FK | derivado da sessão |
| `obs` | String | nullable | |
| `criadoEm` | DateTime | not null | |

**Índices:**
- `itemId`
- `funcionarioId`
- `data`
- `setorSnapshotId`

### 5.4 Ajuste

**Tabela:** `ajustes`

| Campo | Tipo lógico | Constraints | Observações |
|---|---|---|---|
| `id` | UUID | PK | |
| `itemId` | UUID | FK | obrigatório |
| `qtdAnterior` | Int | not null | |
| `qtdNova` | Int | >= 0 | |
| `motivo` | String | not null | obrigatório |
| `responsavelUserId` | UUID | FK | derivado da sessão |
| `obs` | String | nullable | |
| `criadoEm` | DateTime | not null | |

**Índices:**
- `itemId`
- `responsavelUserId`
- `criadoEm`

### 5.5 Convenções Prisma
- usar camelCase no código TypeScript
- usar `@map` / `@@map` para `snake_case` no banco
- usar `Decimal` Prisma para valores monetários
- `updatedAt` via `@updatedAt` no Item

---

## 6. Estratégia de saldo e integridade

### 6.1 Regra-mãe
`Item.quantidade` é o **saldo materializado oficial**.

### 6.2 Histórico oficial
`Entrada`, `Saida` e `Ajuste` são o histórico oficial de mutações.

### 6.3 Motivo da escolha
- leitura rápida para listagens e alertas
- compatibilidade conceitual com o frontend legado
- evita recálculo a cada consulta
- simplifica futura integração no SDD-004

### 6.4 Restrição essencial
`Item.quantidade` **não pode ser alterado diretamente** por `PUT /items/:id`.

Saldo só muda por:
- entrada
- saída
- ajuste

---

## 7. Estratégia transacional

### 7.1 Entradas
Executar em uma única transação:

1. validar item
2. validar item ativo
3. criar `Entrada`
4. atualizar `Item.quantidade = quantidade + qtd`
5. atualizar `Item.valorAtual = valorUnit`
6. criar `AuditLog`

### 7.2 Saídas
Executar em uma única transação:

1. validar item
2. validar item ativo
3. validar funcionário ativo
4. carregar setor atual do funcionário
5. decrementar saldo de forma atômica
6. se decremento falhar por saldo insuficiente, abortar
7. criar `Saida` com snapshot do setor
8. criar `AuditLog`

### 7.3 Ajustes
Executar em uma única transação:

1. validar item
2. validar item ativo
3. ler `qtdAnterior`
4. atualizar `Item.quantidade = qtdNova`
5. criar `Ajuste`
6. criar `AuditLog`

### 7.4 Regra operacional
Toda operação que mexe em saldo deve ser **atômica**:
- ou persiste tudo
- ou não persiste nada

---

## 8. Estratégia de concorrência

### 8.1 Problema central
Evitar oversell / saldo negativo sob requisições simultâneas.

### 8.2 Estratégia adotada
Usar **update condicional atômico** no saldo para saídas.

### 8.3 Padrão de saída
Dentro da transação, usar update com condição equivalente a:

- item correto
- item ativo
- `quantidade >= qtd`

Se a atualização afetar 0 linhas:
- tratar como saldo insuficiente
- abortar operação

### 8.4 Resultado esperado
Em duas saídas concorrentes que excedam o saldo agregado:
- no máximo uma efetiva
- a outra falha
- o saldo nunca fica negativo

### 8.5 Entradas concorrentes
Podem coexistir, desde que permaneçam dentro da mesma transação.

---

## 9. Snapshot de setor na saída

### 9.1 Decisão
Persistir snapshot do setor na saída:

- `setorSnapshotId`
- `setorSnapshotNome`

### 9.2 Fonte
Derivar do `Funcionario` no momento da retirada.

### 9.3 Motivo
Preservar histórico mesmo se o funcionário mudar de setor depois.

---

## 10. Auditoria

### 10.1 Ações novas
- `ITEM_CREATED`
- `ITEM_UPDATED`
- `ITEM_DEACTIVATED`
- `ENTRADA_CREATED`
- `SAIDA_CREATED`
- `AJUSTE_CREATED`

### 10.2 Shape de `details`
`AuditLog.details` será JSON serializado, estável por ação.

#### ITEM_CREATED
```json
{
  "codigo": "ITM-001",
  "descricao": "Papel A4",
  "categoriaId": "uuid",
  "depositoId": "uuid",
  "quantidadeInicial": 100,
  "minimo": 10,
  "valorAtual": "12.50"
}
```

#### ITEM_UPDATED
```json
{
  "before": {},
  "after": {},
  "diff": {}
}
```

#### ENTRADA_CREATED
```json
{
  "itemId": "uuid",
  "qtd": 10,
  "saldoAntes": 100,
  "saldoDepois": 110,
  "valorUnit": "12.50"
}
```

#### SAIDA_CREATED
```json
{
  "itemId": "uuid",
  "funcionarioId": "uuid",
  "setorSnapshotId": "uuid",
  "setorSnapshotNome": "almoxarifado",
  "qtd": 5,
  "saldoAntes": 20,
  "saldoDepois": 15,
  "valorUnit": "12.50"
}
```

#### AJUSTE_CREATED
```json
{
  "itemId": "uuid",
  "qtdAnterior": 20,
  "qtdNova": 15,
  "motivo": "Correção de contagem física"
}
```

### 10.3 Regra de segurança
Operação rejeitada não pode gerar log falso de sucesso.

---

## 11. Services e guards

### 11.1 `items.service.ts`
Responsabilidades:
- criar item
- atualizar item
- inativar item
- listar itens
- detalhar item

### 11.2 `items.guards.ts`
Responsabilidades:
- validar categoria ativa
- validar depósito ativo
- bloquear update de `quantidade`
- bloquear mutação em item inativo quando aplicável

### 11.3 `entradas.service.ts`
Responsabilidades:
- criar entrada transacional
- listar entradas
- detalhar entrada

### 11.4 `saidas.service.ts`
Responsabilidades:
- criar saída transacional com decremento atômico
- listar saídas
- detalhar saída

### 11.5 `ajustes.service.ts`
Responsabilidades:
- criar ajuste transacional
- listar ajustes
- detalhar ajuste

### 11.6 `stock-movements/guards.ts`
Responsabilidades:
- validar item ativo
- validar funcionário ativo
- validar setor utilizável
- construir snapshot do setor
- lançar `AppError` canônico

---

## 12. Contratos HTTP e status codes

### 12.1 Items
- `POST /items` → `201`
- `PUT /items/:id` → `200`
- `DELETE /items/:id` → `200`
- duplicidade de código → `409`
- categoria/deposito inválido/inativo → `400` ou `409` conforme regra consolidada
- item inexistente → `404`

### 12.2 Entradas
- sucesso → `201`
- item inexistente → `404`
- item inativo → `409`
- payload inválido → `400`

### 12.3 Saídas
- sucesso → `201`
- item inexistente → `404`
- item inativo → `409`
- funcionário inexistente → `404`
- funcionário inativo → `409`
- saldo insuficiente → `409 CONFLICT`

### 12.4 Ajustes
- sucesso → `201`
- sem role admin → `403`
- motivo inválido → `400`
- item inexistente → `404`
- item inativo → `409`

### 12.5 Padronização
Usar `409` para conflitos de estado de domínio.

---

## 13. Filtros e paginação

### 13.1 GET /items
Query params:
- `search`
- `categoriaId`
- `depositoId`
- `ativo`
- `baixoEstoque`
- `page`
- `limit`

### 13.2 Filtro `baixoEstoque`
Traduzir para:
- `quantidade <= minimo`

### 13.3 Ordenação mínima
- `codigo`
- `descricao`
- `criado_em`

### 13.4 GET /entradas, /saidas, /ajustes
Query params:
- `itemId`
- `dataInicio`
- `dataFim`
- `page`
- `limit`

### 13.5 Padrão
- `page=1`
- `limit=20`
- `limit<=100`

---

## 14. Validação Zod

### 14.1 Item
- `codigo`: trim, min 1, max 50
- `descricao`: trim, min 2, max 200
- `quantidade`: int nonnegative
- `minimo`: int nonnegative
- `valorAtual`: número não negativo
- `.strip()` para campos extras

### 14.2 Entrada / Saída
- `qtd`: int positive
- `valorUnit`: nonnegative
- `data`: opcional
- `obs`: opcional

### 14.3 Ajuste
- `qtdNova`: int nonnegative
- `motivo`: trim, min 5, max 500

### 14.4 Regra fixa
`responsavelUserId` nunca entra no payload.
Sempre vem da sessão.

---

## 15. Seeds e helpers de teste

### 15.1 Seeds existentes
O módulo pode depender de:
- admin
- operador
- setor `almoxarifado`
- categoria `geral`
- depósito `principal`

### 15.2 Helpers novos recomendados
Adicionar em `backend/test/helpers.ts`:
- `seedItem`
- `seedEntrada`
- `seedSaida`
- `seedAjuste`
- `seedInventoryBase`
- `getItemSaldo`

### 15.3 Cleanup
Expandir `cleanDatabase()` para limpar:
1. `audit_logs`
2. `ajustes`
3. `saidas`
4. `entradas`
5. `items`
6. entidades auxiliares criadas no teste
7. `sessions`
8. `users` de teste

---

## 16. Estratégia de testes do SDD-003

### 16.1 Arquivos novos
- `items-crud.test.ts`
- `items-rules.test.ts`
- `items-pagination.test.ts`
- `entradas.test.ts`
- `saidas.test.ts`
- `ajustes.test.ts`
- `stock-concurrency.test.ts`
- `stock-audit.test.ts`
- `stock-authorization.test.ts`

### 16.2 Cobertura por arquivo

#### `items-crud.test.ts`
- create 201
- get list
- get by id
- update 200
- soft delete 200
- delete idempotente

#### `items-rules.test.ts`
- código duplicado 409
- categoria inválida
- depósito inválido
- PUT tentando alterar `quantidade`
- item inativo bloqueia movimentação

#### `items-pagination.test.ts`
- shape `{ items, meta }`
- defaults 1/20
- cap 100
- filtros

#### `entradas.test.ts`
- entrada válida incrementa saldo
- item inexistente
- item inativo
- qtd inválida
- valorUnit inválido

#### `saidas.test.ts`
- saída válida decrementa saldo
- saldo insuficiente
- funcionário inválido
- funcionário inativo
- item inativo

#### `ajustes.test.ts`
- ajuste por admin
- ajuste por operador = 403
- motivo ausente
- qtdNova inválida

#### `stock-concurrency.test.ts`
- duas saídas simultâneas
- entrada e saída simultâneas
- duas entradas simultâneas

#### `stock-audit.test.ts`
- log coerente em create/update/deactivate/entrada/saida/ajuste
- sem log falso de sucesso em operação rejeitada

#### `stock-authorization.test.ts`
- visitante/sem auth
- operador ajustando
- operador criando item/entrada/saída
- admin deletando item

### 16.3 Regra de regressão
Os 78 testes atuais continuam obrigatórios e a nova suíte é cumulativa.

---

## 17. Compatibilidade com o legado

### 17.1 Mapeamento conceitual
- `alm_items.valor` → `Item.valorAtual`
- `alm_entradas.resp` → `responsavelUserId` da sessão
- `alm_saidas.funcId` → `funcionarioId`
- `alm_saidas.setor` → `setorSnapshotNome`

### 17.2 Divergências intencionais
O backend **não replica** fragilidades do legado:
- não existe edição direta de saldo
- não existe delete físico de item
- não existe movimentação sem ator autenticado
- não existe saída sem funcionário ativo

---

## 18. Edge cases

### 18.1 Limites
- `qtd=0`, `qtd<0`
- `qtdNova<0`
- `minimo<0`
- `valorAtual<0`
- `valorUnit<0`
- strings longas
- paginação inválida

### 18.2 Payload inválido
- IDs inválidos
- `responsavelUserId` manual no payload
- `quantidade` em `PUT /items`
- campos extras com `.strip()`

### 18.3 Permissões
- operador tentando ajuste
- visitante tentando mutação
- sem auth em qualquer rota de mutação
- delete de item por não-admin

### 18.4 Sessão expirada
- cookie inválido
- sessão inexistente
- sessão expirada em entrada/saída/ajuste

### 18.5 Concorrência
- duas saídas concorrentes
- entrada e saída concorrentes
- duas entradas concorrentes
- retry/double submit

### 18.6 Duplicidade
- código duplicado
- delete repetido
- filtros com IDs inexistentes

### 18.7 Idempotência
- delete lógico repetido
- falha parcial não gera saldo solto

### 18.8 Falha parcial
- falha após criar movimentação
- falha após atualizar saldo
- falha antes do `AuditLog`

### 18.9 Recuperação
- saldo coerente após erro
- consistência após transação abortada

### 18.10 Volumetria
- 1.000 itens
- 10.000 movimentos
- paginação intacta

### 18.11 Dados legados
- não migrar dados agora
- apenas refletir domínio no backend

---

## 19. Critérios de aceite

- **Dado** categoria e depósito ativos, **quando** criar item válido, **então** retorna `201`, persiste item e gera `ITEM_CREATED`.
- **Dado** `codigo` duplicado, **quando** criar item, **então** retorna `409`.
- **Dado** tentativa de alterar `quantidade` por `PUT /items/:id`, **quando** enviar request, **então** o saldo permanece inalterado.
- **Dado** item ativo, **quando** registrar entrada válida, **então** saldo aumenta exatamente `qtd`, `valorAtual` é atualizado e `ENTRADA_CREATED` é persistido.
- **Dado** saldo insuficiente, **quando** registrar saída, **então** retorna `409`, não altera saldo e não cria `SAIDA_CREATED`.
- **Dado** funcionário ativo e saldo suficiente, **quando** registrar saída, **então** cria `Saida`, decrementa saldo e grava snapshot do setor.
- **Dado** admin autenticado, **quando** criar ajuste válido, **então** `qtdAnterior` e `qtdNova` são persistidos corretamente e `AJUSTE_CREATED` é registrado.
- **Dado** operador autenticado, **quando** tentar ajuste, **então** retorna `403`.
- **Dado** duas saídas concorrentes que excedem o saldo agregado, **quando** executadas, **então** no máximo uma efetiva.
- **Dado** qualquer nova SDD, **quando** a suíte for executada, **então** os testes anteriores continuam verdes e os novos do SDD-003 também.

---

## 20. Riscos

| # | Risco | Severidade | Observação |
|---|---|---|---|
| R1 | Concorrência é o risco principal do módulo | ALTO | oversell / saldo inconsistente |
| R2 | Divergência SQLite/PostgreSQL por ambiente | MÉDIO | testes críticos devem seguir semântica de Postgres |
| R3 | `AuditLog.details` sem shape estável | MÉDIO | quebra testes e relatórios futuros |
| R4 | Uso incorreto de float em vez de Decimal | MÉDIO | risco de drift monetário |
| R5 | Suite com concorrência ficar flakey | MÉDIO | exige helpers e isolamento adequados |
| R6 | Gaps de infra fora do SDD-003 continuam abertos | BAIXO | CA-I2 e CA-I3 já registrados fora deste módulo |

---

## 21. Próximos passos

1. Implementar o SDD-003 conforme este DESIGN e a SPEC aprovada
2. Criar migração Prisma
3. Implementar services, guards, handlers e routes
4. Adicionar a suíte de testes do módulo
5. Atualizar:
   - relatório canônico de testes
   - `PROGRESS(4).md`
   - baseline total de testes

---

## 22. Gate

**Documento de DESIGN aprovado. Pronto para implementação.**
