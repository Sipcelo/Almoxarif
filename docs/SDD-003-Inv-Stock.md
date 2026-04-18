# SDD-003 — Inventory + Stock Movements

> **Projeto:** Almox — Sistema de Gestão de Almoxarifado  
> **Cliente:** Rodoviária de Pelotas  
> **Módulo:** 003 — Inventory + Stock Movements (Itens, Entradas, Saídas, Ajustes auditados)  
> **Status:** SPEC APROVADA  
> **Versão:** 1.0  
> **Data:** 2026-04-17

---

## 1. Entendimento

Este módulo implementa no backend o domínio operacional de estoque do sistema:

- Itens
- Entradas
- Saídas
- Ajustes manuais auditados

O objetivo é substituir no backend as regras críticas que hoje ainda existem apenas no frontend legado/localStorage, preservando compatibilidade conceitual com as telas existentes e preparando a futura integração frontend ↔ backend no SDD-004.

Estado base considerado:

- SDD-001 concluído — Bootstrap backend, Auth, Users, AuditLog, rate limit
- SDD-001-FIX concluído — correção de desvios e clean-code zero-débito
- SDD-002 concluído — Funcionários, Setores, Categorias, Depósitos
- Frontend ainda não integrado ao backend
- Próximo módulo oficial: SDD-003 — Inventory + Stock Movements

---

## 2. Decisões aprovadas

| # | Decisão | Status |
|---|---|---|
| D1 | `codigo` do item é obrigatório e único | ✅ Aprovado |
| D2 | Unicidade de item é por `codigo` | ✅ Aprovado |
| D3 | Manter `valorAtual` no item | ✅ Aprovado |
| D4 | Entrada usa `responsavelUserId` derivado da sessão | ✅ Aprovado |
| D5 | Saída exige `funcionarioId` obrigatório | ✅ Aprovado |
| D6 | Saída grava snapshot do setor no momento da retirada | ✅ Aprovado |
| D7 | Ajuste manual terá endpoint próprio | ✅ Aprovado |
| D8 | Delete de item = soft delete (`ativo=false`) | ✅ Aprovado |
| D9 | Item inativo bloqueia novas movimentações | ✅ Aprovado |
| D10 | Criação de item / entradas / saídas permitidas para `admin`, `gerente`, `operador` | ✅ Aprovado |
| D11 | Ajuste manual permitido apenas para `admin` | ✅ Aprovado |
| D12 | Entradas, saídas e ajustes são append-only | ✅ Aprovado |
| D13 | `valorUnit` é obrigatório em entradas e saídas | ✅ Aprovado |
| D14 | Quantidade é inteira positiva, sem decimal | ✅ Aprovado |
| D15 | Motivo é obrigatório no ajuste | ✅ Aprovado |

---

## 3. Premissas

| # | Premissa |
|---|---|
| P1 | Stack: Fastify + TypeScript + Prisma |
| P2 | Reaproveitar padrões já consolidados no backend: `AppError`, `AuditLog`, `requireAuth`, `requireRole`, Zod `.strip()` |
| P3 | Frontend não será integrado neste módulo — apenas APIs e testes backend |
| P4 | Entidades auxiliares já existem: `Funcionario`, `Setor`, `Categoria`, `Deposito` |
| P5 | O domínio deve preservar as invariantes já registradas no projeto |
| P6 | Nenhuma movimentação será editável ou deletável nesta fase |
| P7 | O módulo deve ser compatível conceitualmente com o frontend legado (`alm_items`, `alm_entradas`, `alm_saidas`) |
| P8 | IDs sempre UUID |
| P9 | Toda mutação relevante deve gerar `AuditLog` persistente |
| P10 | O SDD-003 não cobre relatórios nem integração frontend ↔ backend |

---

## 4. Lacunas remanescentes para DESIGN

Estas lacunas não impedem a SPEC funcional, mas precisam ser resolvidas no DESIGN:

| # | Lacuna | Impacto |
|---|---|---|
| L16 | Provider por ambiente: SQLite local vs PostgreSQL em teste/prod | afeta concorrência e comportamento transacional |
| L17 | Estratégia de concorrência para evitar oversell | afeta integridade do saldo |
| L18 | Formato exato de `AuditLog.details` | afeta rastreabilidade e testes |
| L19 | Precisão numérica de `valorAtual` e `valorUnit` | afeta schema Prisma |
| L20 | Shape final de filtros/ordenação | afeta contrato de listagem |

---

## 5. SPEC

### 5.1 Objetivo

Implementar no backend o módulo de:

- Itens
- Entradas
- Saídas
- Ajustes manuais auditados

com integridade transacional, autorização server-side, auditoria persistente e compatibilidade conceitual com o frontend legado.

### 5.2 Escopo

Este SDD deve entregar:

1. Modelagem Prisma para `Item`, `Entrada`, `Saida`, `Ajuste`
2. Rotas HTTP para CRUD de itens e criação/listagem de movimentações
3. Regras de saldo
4. Transações para mutações de estoque
5. Auditoria persistente
6. Testes automatizados do módulo
7. Seeds mínimas necessárias para destravar testes

### 5.3 Fora de escopo

- integração com frontend
- relatórios
- importação do legado
- edição de movimentações
- exclusão física de movimentações
- CSRF
- security headers
- deploy
- observabilidade avançada
- dashboard
- exportação/importação JSON

---

## 6. Estrutura recomendada

```txt
backend/src/modules/
  inventory/
    items.routes.ts
    items.handlers.ts
    items.schema.ts
    items.guards.ts
  stock-movements/
    entradas.routes.ts
    entradas.handlers.ts
    entradas.schema.ts
    saidas.routes.ts
    saidas.handlers.ts
    saidas.schema.ts
    ajustes.routes.ts
    ajustes.handlers.ts
    ajustes.schema.ts
    guards.ts
```

---

## 7. Modelagem de dados

### 7.1 Item

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK | |
| `codigo` | String | unique, not null | Obrigatório e único |
| `descricao` | String | not null | |
| `categoria_id` | UUID | FK → `Categoria.id` | Obrigatório |
| `deposito_id` | UUID | FK → `Deposito.id` | Obrigatório |
| `quantidade` | Int | not null, default 0 | `>= 0` |
| `minimo` | Int | not null, default 0 | `>= 0` |
| `valor_atual` | Decimal | not null, default 0 | `>= 0` |
| `obs` | String | nullable | |
| `ativo` | Boolean | not null, default true | Soft delete |
| `criado_em` | DateTime | not null | |
| `atualizado_em` | DateTime | not null | |

### 7.2 Entrada

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK | |
| `item_id` | UUID | FK → `Item.id` | Obrigatório |
| `qtd` | Int | not null | inteiro positivo |
| `valor_unit` | Decimal | not null | obrigatório, `>= 0` |
| `data` | DateTime | not null | default now se ausente |
| `responsavel_user_id` | UUID | FK → `User.id` | vem da sessão |
| `obs` | String | nullable | |
| `criado_em` | DateTime | not null | |

### 7.3 Saida

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK | |
| `item_id` | UUID | FK → `Item.id` | Obrigatório |
| `qtd` | Int | not null | inteiro positivo |
| `valor_unit` | Decimal | not null | obrigatório, `>= 0` |
| `data` | DateTime | not null | default now se ausente |
| `funcionario_id` | UUID | FK → `Funcionario.id` | Obrigatório |
| `setor_snapshot_id` | UUID | FK nullable → `Setor.id` | snapshot histórico |
| `setor_snapshot_nome` | String | not null | snapshot histórico |
| `responsavel_user_id` | UUID | FK → `User.id` | vem da sessão |
| `obs` | String | nullable | |
| `criado_em` | DateTime | not null | |

### 7.4 Ajuste

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | UUID | PK | |
| `item_id` | UUID | FK → `Item.id` | Obrigatório |
| `qtd_anterior` | Int | not null | |
| `qtd_nova` | Int | not null | `>= 0` |
| `motivo` | String | not null | obrigatório |
| `responsavel_user_id` | UUID | FK → `User.id` | vem da sessão |
| `obs` | String | nullable | |
| `criado_em` | DateTime | not null | |

---

## 8. Regras de persistência

1. Todas as novas entidades usam UUID.
2. Tabelas e colunas em `snake_case`.
3. `Item` usa soft delete via `ativo=false`.
4. `Entrada`, `Saida` e `Ajuste` são append-only.
5. Nenhuma movimentação pode ser alterada ou apagada fisicamente nesta fase.
6. Toda mutação crítica deve gerar `AuditLog`.

---

## 9. Contrato de rotas

### 9.1 Items
- `GET /api/v1/items`
- `GET /api/v1/items/:id`
- `POST /api/v1/items`
- `PUT /api/v1/items/:id`
- `DELETE /api/v1/items/:id`

### 9.2 Entradas
- `GET /api/v1/entradas`
- `GET /api/v1/entradas/:id`
- `POST /api/v1/entradas`

### 9.3 Saídas
- `GET /api/v1/saidas`
- `GET /api/v1/saidas/:id`
- `POST /api/v1/saidas`

### 9.4 Ajustes
- `GET /api/v1/ajustes`
- `GET /api/v1/ajustes/:id`
- `POST /api/v1/ajustes`

---

## 10. Autorização

### 10.1 Items
- `GET` list/detail: qualquer usuário autenticado
- `POST`: `admin`, `gerente`, `operador`
- `PUT`: `admin`, `gerente`, `operador`
- `DELETE`: `admin`

### 10.2 Entradas
- `GET`: qualquer usuário autenticado
- `POST`: `admin`, `gerente`, `operador`

### 10.3 Saídas
- `GET`: qualquer usuário autenticado
- `POST`: `admin`, `gerente`, `operador`

### 10.4 Ajustes
- `GET`: `admin`, `gerente`
- `POST`: `admin`

---

## 11. Contrato de input

### 11.1 POST /items

```json
{
  "codigo": "string, min 1, max 50",
  "descricao": "string, min 2, max 200",
  "categoriaId": "uuid",
  "depositoId": "uuid",
  "quantidade": 0,
  "minimo": 0,
  "valorAtual": 0,
  "obs": "string|null"
}
```

### 11.2 PUT /items/:id

Campos permitidos:
- `codigo`
- `descricao`
- `categoriaId`
- `depositoId`
- `minimo`
- `valorAtual`
- `obs`

Campos proibidos:
- `quantidade`

**Regra:** saldo só muda por entrada, saída ou ajuste.

### 11.3 POST /entradas

```json
{
  "itemId": "uuid",
  "qtd": 10,
  "valorUnit": 12.5,
  "data": "ISO8601 opcional",
  "obs": "string|null"
}
```

`responsavelUserId` é derivado da sessão.

### 11.4 POST /saidas

```json
{
  "itemId": "uuid",
  "qtd": 5,
  "valorUnit": 12.5,
  "funcionarioId": "uuid",
  "data": "ISO8601 opcional",
  "obs": "string|null"
}
```

`responsavelUserId` é derivado da sessão.  
`setorSnapshot*` é derivado do funcionário.

### 11.5 POST /ajustes

```json
{
  "itemId": "uuid",
  "qtdNova": 15,
  "motivo": "string obrigatória, min 5, max 500",
  "obs": "string|null"
}
```

---

## 12. Regras de negócio

### 12.1 Itens
1. `codigo` obrigatório e único.
2. `categoriaId` deve existir e estar ativa.
3. `depositoId` deve existir e estar ativo.
4. `quantidade` inicial inteira e `>= 0`.
5. `minimo` inteiro e `>= 0`.
6. `valorAtual >= 0`.
7. item inativo não aceita novas movimentações.

### 12.2 Entradas
1. item deve existir e estar ativo.
2. `qtd` inteira e positiva.
3. `valorUnit` obrigatório e `>= 0`.
4. `responsavelUserId` vem da sessão.
5. operação em transação:
   - cria `Entrada`
   - incrementa `Item.quantidade`
   - atualiza `Item.valorAtual`
   - gera `AuditLog`

### 12.3 Saídas
1. item deve existir e estar ativo.
2. funcionário deve existir e estar ativo.
3. `funcionarioId` é obrigatório.
4. `qtd` inteira e positiva.
5. `valorUnit` obrigatório e `>= 0`.
6. estoque não pode ficar negativo.
7. operação em transação:
   - valida saldo
   - cria `Saida`
   - decrementa `Item.quantidade`
   - gera `AuditLog`
8. grava snapshot do setor:
   - `setorSnapshotId`
   - `setorSnapshotNome`

### 12.4 Ajustes
1. endpoint próprio.
2. somente `admin` pode criar.
3. item deve existir e estar ativo.
4. `motivo` obrigatório.
5. `qtdNova >= 0`.
6. operação em transação:
   - lê `qtdAnterior`
   - cria `Ajuste`
   - atualiza saldo do item
   - gera `AuditLog`

### 12.5 Exclusão/Inativação
1. `DELETE /items/:id` faz soft delete (`ativo=false`).
2. delete é idempotente.
3. item permanece no banco.
4. item inativo não aceita novas entradas, saídas ou ajustes.
5. movimentações históricas nunca são apagadas.

---

## 13. Auditoria obrigatória

O módulo deve registrar:

- `ITEM_CREATED`
- `ITEM_UPDATED`
- `ITEM_DEACTIVATED`
- `ENTRADA_CREATED`
- `SAIDA_CREATED`
- `AJUSTE_CREATED`

Cada evento deve conter:
- ator
- ação
- alvo
- timestamp
- detalhes mínimos coerentes

---

## 14. Paginação e filtros

### 14.1 GET /items

Filtros:
- `search`
- `categoriaId`
- `depositoId`
- `ativo`
- `baixoEstoque`

Paginação:
- `page=1` default
- `limit=20` default
- `limit<=100`

Response:

```json
{
  "items": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

### 14.2 GET /entradas, /saidas, /ajustes

Filtros:
- `itemId`
- `dataInicio`
- `dataFim`

Paginação:
- `page=1`
- `limit=20`
- `limit<=100`

---

## 15. Seeds mínimas

O módulo pode depender dos seeds existentes:

- `setor: almoxarifado`
- `categoria: geral`
- `deposito: principal`

Criar seed adicional apenas se necessário para testes de:
- item base
- funcionário ativo vinculado a setor ativo

---

## 16. Suite de testes obrigatória

Nenhum dos 133 testes atuais pode ser removido. O SDD-003 deve somar novos testes.

Arquivos mínimos esperados:

```txt
backend/test/
  items-crud.test.ts
  items-rules.test.ts
  items-pagination.test.ts
  entradas.test.ts
  saidas.test.ts
  ajustes.test.ts
  stock-concurrency.test.ts
  stock-audit.test.ts
  stock-authorization.test.ts
```

Cobertura mínima:
- CRUD de item
- validação de item
- soft delete
- entrada válida/inválida
- saída válida/inválida
- ajuste válido/inválido
- autorização por role
- auditoria
- concorrência mínima
- regressão de saldo

---

## 17. Edge cases

### 17.1 Limites
- `qtd = 0`
- `qtd < 0`
- `qtdNova < 0`
- `minimo < 0`
- `valorAtual < 0`
- `valorUnit < 0`
- strings longas
- paginação inválida

### 17.2 Payload inválido
- `itemId` inválido
- `funcionarioId` inválido
- `categoriaId` inválido
- `depositoId` inválido
- payload com campos extras
- tentativa de enviar `responsavelUserId`
- tentativa de alterar `quantidade` via PUT item

### 17.3 Permissões
- visitante tentando criar item
- operador tentando ajustar estoque
- usuário sem auth consultando ou movimentando
- usuário sem role admin tentando deletar item

### 17.4 Sessão expirada
- cookie inválido
- sessão inexistente
- sessão expirada em endpoint de mutação

### 17.5 Concorrência
Casos obrigatórios:
- duas saídas simultâneas do mesmo item
- entrada e saída simultâneas
- duas entradas simultâneas
- dupla submissão de saída

### 17.6 Duplicidade
- `codigo` duplicado
- re-delete de item já inativo
- filtros com IDs inexistentes

### 17.7 Idempotência
- delete lógico repetido
- falha parcial não pode deixar saldo sem movimentação correspondente

### 17.8 Falha parcial
- erro entre criação da movimentação e update do saldo
- erro entre update do saldo e auditoria
- rollback transacional completo

### 17.9 Recuperação
- item consistente após erro transacional
- saldo persistido corresponde ao histórico válido

### 17.10 Volumetria
- 1.000 itens
- 10.000 movimentações
- paginação funcional

### 17.11 Dados legados
O backend não deve reproduzir:
- edição direta de quantidade
- exclusão física de item
- desnormalização insegura do legado

---

## 18. Critérios de aceite

### 18.1 Items
- **Dado** categoria e depósito válidos, **quando** criar item válido, **então** retorna `201`, persiste item e gera `ITEM_CREATED`.
- **Dado** `codigo` duplicado, **quando** criar item, **então** retorna `409`.
- **Dado** item existente, **quando** atualizar campos permitidos, **então** retorna `200` e gera `ITEM_UPDATED`.
- **Dado** tentativa de alterar `quantidade` via PUT, **quando** enviar request, **então** o saldo não deve ser alterado.
- **Dado** item existente, **quando** deletar, **então** `ativo=false`, resposta `200`, operação idempotente e com `ITEM_DEACTIVATED`.

### 18.2 Entradas
- **Dado** item ativo, **quando** registrar entrada válida, **então** retorna `201`, cria `Entrada`, incrementa saldo, atualiza `valorAtual` e gera `ENTRADA_CREATED`.
- **Dado** item inexistente ou inativo, **quando** registrar entrada, **então** falha sem alterar saldo.
- **Dado** `qtd <= 0`, **quando** registrar entrada, **então** retorna `400`.

### 18.3 Saídas
- **Dado** item ativo com saldo suficiente e funcionário ativo, **quando** registrar saída válida, **então** retorna `201`, cria `Saida`, decrementa saldo, grava snapshot do setor e gera `SAIDA_CREATED`.
- **Dado** saldo insuficiente, **quando** registrar saída, **então** falha e não altera saldo.
- **Dado** funcionário inexistente ou inativo, **quando** registrar saída, **então** falha sem criar movimentação.
- **Dado** item inativo, **quando** registrar saída, **então** falha sem alterar saldo.

### 18.4 Ajustes
- **Dado** item ativo e admin autenticado, **quando** registrar ajuste válido com motivo, **então** retorna `201`, cria `Ajuste`, altera saldo e gera `AJUSTE_CREATED`.
- **Dado** motivo ausente, **quando** registrar ajuste, **então** retorna `400`.
- **Dado** operador autenticado, **quando** tentar ajuste, **então** retorna `403`.

### 18.5 Transações
- **Dado** falha em qualquer etapa da operação, **quando** a transação abortar, **então** não deve existir alteração parcial de saldo.
- **Dado** duas saídas concorrentes que excedam o saldo total, **quando** executadas, **então** no máximo uma pode ser efetivada.

### 18.6 Auditoria
- **Dado** mutação válida, **quando** persistida, **então** deve existir `AuditLog` coerente.
- **Dado** operação rejeitada, **quando** falhar, **então** não pode haver log falso de sucesso.

---

## 19. Riscos

| # | Risco | Severidade | Observação |
|---|---|---|---|
| R1 | Concorrência de estoque mal modelada | ALTO | principal risco do módulo |
| R2 | Divergência SQLite/PostgreSQL por ambiente | MÉDIO | pode afetar testes transacionais |
| R3 | Snapshot de setor aumenta redundância | BAIXO | aceito para preservar histórico |
| R4 | PUT /items aceitar campos demais | MÉDIO | pode reabrir bypass de regra |
| R5 | Auditoria desacoplada da mutação | ALTO | pode gerar inconsistência entre saldo e trilha |
| R6 | Tempo da suíte crescer com testes concorrentes | BAIXO | esperado |

---

## 20. Próximos passos

Após esta SPEC:
1. Produzir o **DESIGN do SDD-003**
2. Fechar:
   - schema Prisma exato
   - estratégia transacional
   - abordagem de concorrência
   - shape de `AuditLog.details`
   - seeds e helpers de teste
3. Só então implementar
4. Atualizar `PROGRESS(4).md` e relatório canônico de testes após entrega

---

## 21. Gate

**Aguardando aprovação do DESIGN.**

