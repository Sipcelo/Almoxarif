# SDD-005 — Reports + Audit Endpoints

> Status: **IMPLEMENTADO**
> Data: 2026-04-23
> Autor: Auralynne / Rodoviária de Pelotas

---

## 1. Escopo

Endpoints de backend para relatórios operacionais e consulta paginada do AuditLog. Sem alterações de schema (zero migrações). Sem toque em frontend.

---

## 2. Módulos criados

```
backend/src/modules/
├── reports/
│   ├── reports.schema.ts
│   ├── reports.service.ts
│   ├── reports.handlers.ts
│   └── reports.routes.ts
└── audit/
    ├── audit.schema.ts
    ├── audit.service.ts
    ├── audit.handlers.ts
    └── audit.routes.ts
```

---

## 3. Endpoints

| Método | Rota | Auth | Role | Descrição |
|--------|------|------|------|-----------|
| GET | `/api/v1/reports/metricas` | cookie | qualquer | Métricas agregadas + itens críticos |
| GET | `/api/v1/reports/movimentacoes` | cookie | qualquer | Histórico entradas+saídas+ajustes por período |
| GET | `/api/v1/reports/por-setor` | cookie | qualquer | Saídas agrupadas por setor |
| GET | `/api/v1/reports/estoque` | cookie | qualquer | Snapshot atual do estoque (ativos, ordenado por código) |
| GET | `/api/v1/audit` | cookie | admin | AuditLog paginado com filtros |

---

## 4. Query params

### Reports (metricas, movimentacoes, por-setor)

| Param | Tipo | Default | Regras |
|-------|------|---------|--------|
| `periodo` | int | 30 | min=1, max=365. Janela = now - periodo dias. |

### Estoque

Sem query params.

### Audit

| Param | Tipo | Default | Regras |
|-------|------|---------|--------|
| `page` | int | 1 | min=1 |
| `limit` | int | 20 | min=1, max=100 |
| `action` | string | — | Filtro exato, uppercase normalizado |
| `userId` | UUID | — | Filtro por ator |
| `dataInicio` | YYYY-MM-DD | — | Início do intervalo (inclusive) |
| `dataFim` | YYYY-MM-DD | — | Fim do intervalo (inclusive, até 23:59:59.999) |

Validação: `dataInicio <= dataFim` obrigatório quando ambos presentes.

---

## 5. Contratos de resposta

### GET /api/v1/reports/metricas

```json
{
  "periodo": 30,
  "corte": "2026-03-24T00:00:00.000Z",
  "estoque": {
    "totalItens": 42,
    "totalQtd": 1340,
    "totalValor": "28450.00"
  },
  "entradas": {
    "count": 15,
    "totalQtd": 320
  },
  "saidas": {
    "count": 47,
    "totalQtd": 195,
    "totalValor": "4230.50"
  },
  "itensCriticos": [
    { "id": "uuid", "codigo": "LH001", "descricao": "Detergente", "quantidade": 3, "minimo": 10 }
  ]
}
```

`itensCriticos`: itens ativos onde `quantidade < minimo`. Sem campo `obs`.

### GET /api/v1/reports/movimentacoes

```json
{
  "periodo": 30,
  "entradas": [
    {
      "id": "uuid", "itemId": "uuid", "itemCodigo": "EA001", "itemDescricao": "Papel A4",
      "qtd": 100, "valorUnit": "12.50", "valorTotal": "1250.00",
      "data": "2026-04-10T00:00:00.000Z",
      "responsavelUserId": "uuid", "responsavelNome": "Administrador", "obs": null
    }
  ],
  "saidas": [
    {
      "id": "uuid", "itemId": "uuid", "itemCodigo": "EA001", "itemDescricao": "Papel A4",
      "qtd": 20, "valorUnit": "12.50", "valorTotal": "250.00",
      "data": "2026-04-15T00:00:00.000Z",
      "funcionarioId": "uuid", "funcionarioNome": "Carlos Silva",
      "setorSnapshotNome": "almoxarifado",
      "responsavelUserId": "uuid", "responsavelNome": "Administrador", "obs": null
    }
  ],
  "ajustes": [
    {
      "id": "uuid", "itemId": "uuid", "itemCodigo": "LH001", "itemDescricao": "Detergente",
      "qtdAnterior": 5, "qtdNova": 3, "motivo": "Recontagem física",
      "responsavelUserId": "uuid", "responsavelNome": "Administrador",
      "obs": null, "criadoEm": "2026-04-18T14:32:00.000Z"
    }
  ]
}
```

Sem paginação. Bounded por `periodo ≤ 365`.

### GET /api/v1/reports/por-setor

```json
{
  "periodo": 30,
  "setores": [
    {
      "setor": "almoxarifado",
      "count": 12,
      "totalQtd": 80,
      "totalValor": "1640.00",
      "itens": [
        { "itemCodigo": "EA001", "itemDescricao": "Papel A4", "qtd": 40, "valor": "500.00" }
      ],
      "funcionarios": [
        { "funcionarioId": "uuid", "funcionarioNome": "Carlos Silva", "qtd": 40, "valor": "500.00" }
      ]
    }
  ]
}
```

Ordenado por `totalValor desc`. `itens` e `funcionarios` ordenados por `valor desc`.

### GET /api/v1/reports/estoque

```json
{
  "geradoEm": "2026-04-23T10:00:00.000Z",
  "totalItens": 42,
  "totalQtd": 1340,
  "totalValor": "28450.00",
  "itens": [
    {
      "id": "uuid", "codigo": "EA001", "descricao": "Papel A4",
      "categoria": "Material de Escritório/Administrativo",
      "deposito": "principal",
      "quantidade": 45, "minimo": 10,
      "valorAtual": "12.50", "valorTotal": "562.50",
      "status": "ok",
      "obs": null, "criadoEm": "2026-01-10T00:00:00.000Z"
    }
  ]
}
```

`status`: `"ok"` (qtd >= min) | `"baixo"` (0 < qtd < min) | `"zero"` (qtd === 0). Ordenado por `codigo` asc.

### GET /api/v1/audit

```json
{
  "logs": [
    {
      "id": "uuid", "action": "LOGIN", "target": "uuid",
      "details": null, "ipAddress": "127.0.0.1",
      "timestamp": "2026-04-23T09:00:00.000Z",
      "user": { "id": "uuid", "nome": "Administrador", "email": "admin@rodoviariapel.com" }
    }
  ],
  "meta": { "total": 240, "page": 1, "limit": 20, "totalPages": 12 }
}
```

`user`: `null` se `userId=null` (ex: LOGIN_FAILED). `details`: objeto parseado ou `null`.

---

## 6. Categorias de itens e prefixos de código (convenção)

| Categoria | Prefixo de código |
|-----------|------------------|
| Material de Escritório/Administrativo | `EA` |
| Produtos de Limpeza e Higiene | `LH` |
| Manutenção Geral | `MG` |
| Segurança (EPIs) | `SE` |
| Operacional/Encomendas | `OE` |

Backend não valida prefixo — convenção de nomeação, não invariante técnica.

---

## 7. Decisões de design

- Agregações computadas em JS (sem `$queryRaw`) — volume pequeno justifica.
- `movimentacoes` retorna arrays separados (entradas/saidas/ajustes) — cliente faz merge/sort.
- `valorTotal` e `totalValor` retornados como string decimal (`"12.50"`) para evitar perda de precisão float.
- CSRF não incide — todos os endpoints são GET.
- `audit` endpoint restrito a `admin` via hook no nível do plugin.

---

## 8. Testes (Bloco I)

| Arquivo | Descrição | Bloco |
|---------|-----------|-------|
| `test/reports.test.ts` | Happy path + validações dos 4 endpoints de report | I-A |
| `test/audit-query.test.ts` | Happy path + auth + filtros + paginação do endpoint /audit | I-B |

---

## 9. Invariantes preservadas

- Zero migrações de schema.
- Zero alterações em módulos existentes além de `server.ts` (+4 linhas).
- Baseline 170 testes não afetado.

---

## 10. Fechamento pre-SDD-006

O SDD-005 fica fechado no worktree sem dependencia operacional do SDD-006.

Independencias verificadas:

- Nao depende de deploy, observabilidade externa, metricas externas, alertas ou ambiente de producao.
- Nao depende da integracao frontend do SDD-004; os endpoints ficam consumiveis por HTTP autenticado.
- Nao adiciona dependencias npm novas em `backend/package.json`.
- Nao cria nem exige migration Prisma nova.
- Nao exige `backend/.env`; o runner de teste carrega `backend/.env.test` via `scripts/test-pretest.ts`.
- Usa somente infraestrutura backend ja existente: Fastify, Prisma, Zod, auth por cookie, `requireAuth`, `requireRole` e AuditLog.

Criterio de fechamento:

- Suite backend no worktree: `40/40` arquivos e `203/203` testes passando.
- Build backend no worktree: `npm run build` passando.
- Qualquer requisito novo de deploy/observabilidade deve entrar somente no SDD-006, sem reabrir SDD-005.
