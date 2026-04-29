# AGENTS.md — Almox: Sistema de Gestão de Almoxarifado

> Documento de contexto para assistência técnica com SDD rigoroso.
> Última atualização: 2026-04-16 (pós SDD-001 + SDD-001-FIX)

---

## 1. Visão Geral do Projeto

**Nome:** Almox — Sistema de Gestão de Almoxarifado
**Versão atual:** v2.1 (frontend + backend Fastify/Prisma)
**Desenvolvedor original:** Auralynne
**Stack frontend:** HTML5 + CSS3 + JavaScript puro (zero frameworks, zero dependências além de Google Fonts)
**Stack backend:** Node.js, Fastify, TypeScript, Prisma ORM, SQLite (dev)
**Persistência frontend:** localStorage (prefixo `alm_`)
**Persistência backend:** SQLite (dev), Prisma ORM
**Sessão frontend:** sessionStorage (`alm_user`)
**Sessão backend:** Cookie almox_sid (UUID vinculado à tabela Session)
**Deploy atual:** - Frontend: abertura direta de `index.html` no navegador ou servidor estático local - Backend: Fastify rodando localmente (`npm run dev` em backend/)

---

## 2. Estrutura de Arquivos Atual

```
almoxarifado/
├── index.html              ← HTML monolítico (~452 linhas), contém login + app shell + todas as pages + modais
├── variables.css            ← Design tokens, reset CSS, fontes (DM Sans, DM Mono)
├── components.css           ← Botões, badges, cards, tabelas, modais, formulários
├── layout.css               ← Sidebar, topbar, shell do app
├── login.css                ← Tela de login
├── data.js                  ← Camada de dados: DB (localStorage wrapper), Store, SEED, PERMISSIONS, USERS_DEFAULT
├── utils.js                 ← Helpers: datas, notificações, modais, avatares, exportação JSON
├── auth.js                  ← Autenticação: login/logout/sessão, verificação de permissão client-side
├── modals.js                ← CRUD via modais: item, entrada, saída, acesso, funcionário, usuário
├── app.js                   ← Controller principal: init, navegação, sidebar, busca global, badges
├── dashboard.js             ← Renderização do painel inicial com stats, gráficos, atividades
├── pages.js                 ← Todas as páginas: Estoque, Entradas, Saídas, Relatórios, Acesso, Funcionários, Usuários, Configurações, Impressão
├── README.md                ← Documentação de uso
├── SDD_priority.md          ← Vazio (placeholder)
├── proposta_sistema_auralynne.pdf  ← Proposta comercial (PDF corrompido — não legível)
├── auralynne.png            ← Logo Auralynne
├── almox_logo.png           ← Logo Almox
└── backend/
	├── prisma/
	│   ├── schema.prisma         ← Schema do banco (User, Session, AuditLog, etc.)
	│   └── seed.ts               ← Seed de produção (admin@rodoviariapel.com/admin2026, op@rodoviariapel.com/operador2026)
	├── src/
	│   ├── app/server.ts         ← Bootstrap do servidor Fastify
	│   ├── shared/errors/app-error.ts ← Classe AppError com códigos do SDD-001
	│   ├── shared/types/index.ts ← Types globais (SessionUser, Role, ErrorCode)
	│   ├── shared/middleware/require-auth.ts ← Middleware de autenticação/autorização
	│   ├── infra/error-handler.ts ← Handler de erro global (formato oficial)
	│   ├── infra/healthcheck.ts   ← Healthcheck
	│   ├── modules/auth/handlers.ts ← Login/logout, gravação de sessão e audit log
	│   ├── modules/auth/auth.schema.ts ← Zod schema do login
	│   ├── modules/auth/routes.ts ← Rotas de auth, rate-limit
	│   ├── modules/users/handlers.ts ← CRUD de usuários, regras de negócio
	│   ├── modules/users/users.schema.ts ← Zod schemas de usuário
	│   ├── modules/users/routes.ts ← Rotas protegidas de usuários
	├── package.json              ← Dependências backend
	└── ...
```

**Nota:** O README.md referencia pastas `css/` e `js/`, mas os arquivos estão na raiz. Possível reestruturação pendente ou divergência entre README e estrutura real.

---

## 3. Modelo de Dados Atual

### Frontend

Todos os dados estão em localStorage como JSON, com prefixo `alm_`.

### Backend

Persistência relacional via Prisma/SQLite:

**User:**
| Campo | Tipo | Observações |
|---|---|---|
| id | UUID | PK |
| nome | String | |
| email | String | Único, minúsculo |
| senha | String | Hash bcrypt |
| role | String | admin, operador |
| ativo | Boolean | Soft delete |
| criado_em | DateTime | |
| atualizado_em | DateTime | |

**Session:**
| Campo | Tipo | Observações |
|---|---|---|
| id | UUID | PK, valor do cookie almox_sid |
| user_id | UUID | FK → User |
| expires_at | DateTime | Sliding expiration |
| criado_em | DateTime | |
| ip_address | String | nullable |
| user_agent | String | nullable |

**AuditLog:**
| Campo | Tipo | Observações |
|---|---|---|
| id | Int | PK |
| action | String | LOGIN, LOGIN_FAILED, etc. |
| actor | String | email ou id |
| target | String | email ou id |
| details | String | |
| ip_address | String | |
| criado_em | DateTime | |

### Entidades

| Chave localStorage | Estrutura                                                                                  | Observações                                                            |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `alm_users`        | `[{id, nome, email, senha, role, ativo}]`                                                  | **Senhas em texto puro.** Seed: admin123, op123                        |
| `alm_items`        | `[{id, codigo, descricao, categoria, deposito, quantidade, minimo, valor, obs}]`           | Estoque. `quantidade` é gerenciada por entradas/saídas + edição direta |
| `alm_entradas`     | `[{id, itemId, itemNome, itemCodigo, qtd, valorUnit, data, resp, obs}]`                    | Desnormalizado (nome do item copiado). Sem vínculo formal com users    |
| `alm_saidas`       | `[{id, itemId, itemNome, itemCodigo, qtd, valorUnit, data, funcId, funcNome, setor, obs}]` | Desnormalizado. `funcId` referencia funcionários                       |
| `alm_acessos`      | `[{id, nome, tipo, hora, data, cargo}]`                                                    | Controle de acesso físico (entrada/saída de pessoas)                   |
| `alm_categorias`   | `[string]`                                                                                 | Lista simples de categorias de item                                    |
| `alm_depositos`    | `[string]`                                                                                 | Lista simples de depósitos                                             |
| `alm_funcionarios` | `[{id, nome, setor, cargo, ativo}]`                                                        | Funcionários (quem retira material)                                    |
| `alm_setores`      | `[string]`                                                                                 | Lista simples de setores                                               |

### Geração de IDs

IDs são sequenciais, calculados via `Math.max(...arr.map(x => x.id)) + 1`. Sem UUID, sem proteção contra colisão em cenário multiusuário.

---

## 4. Autenticação e Autorização — Estado Atual

### Frontend

Autenticação local, client-side, sem backend (legado, mantido para compatibilidade):

- Login: comparação direta `email === email && senha === senha` (texto puro, sem hash)
- Sessão: objeto `{id, nome, email, role}` salvo em `sessionStorage`

### Backend

Autenticação server-side, segura:

- Login: POST `/api/v1/auth/login` (email normalizado, senha hash bcrypt)
- Sessão: cookie `almox_sid` (UUID), vinculado à tabela Session
- Expiração: sliding expiration renovada a cada request
- Logout: deleta Session do banco
- Rate limiting configurável por rota
- AuditLog registra LOGIN/LOGIN_FAILED

Autorização:

- Roles válidos (backend): `admin`, `gerente`, `operador`, `visitante`
- Roles seedados por padrão: `admin`, `operador` (gerente/visitante ficam disponíveis para atribuição via `PUT /users/:id`)
- **Role ≠ Setor.** Role define acesso ao sistema; Setor (Diretor, Contábil, Almoxarifado...) é atributo de Funcionário (entidade distinta, escopo SDD-002).
- Middleware `requireAuth` e `requireRole` validam sessão, ativo, permissões
- Toda ação sensível validada server-side

### Credenciais padrão (seed backend)

| Perfil        | Email                   | Senha        |
| ------------- | ----------------------- | ------------ |
| Administrador | admin@rodoviariapel.com | admin2026    |
| Operador      | op@rodoviariapel.com    | operador2026 |

---

## 5. Funcionalidades Existentes

### Frontend

1. **Login** — Formulário com email/senha, toggle de visibilidade de senha (localStorage)
2. **Painel (Dashboard)** — Cards estatísticos, top 5 estoque, gráfico de barras (mock), atividades recentes (in-memory), controle de acesso com paginação
3. **Estoque** — CRUD de itens, filtros, ordenação, badges de status
4. **Entradas** — Registro de entrada, atualização de quantidade
5. **Saídas** — Registro de saída, valida saldo, impressão de termo
6. **Relatórios** — Impressão: estoque, movimentações, acessos, relatório por setor
7. **Controle de Acesso** — Registro de entrada/saída de pessoas
8. **Funcionários** — CRUD de funcionários
9. **Usuários** — CRUD de usuários do sistema
10. **Configurações** — Gerenciamento de categorias, depósitos, setores; exportação JSON; limpar dados

### Backend

1. **Auth** — Login seguro, logout, sessão no banco, audit log, rate limit, schemas Zod
2. **Usuários** — CRUD completo, regras de negócio (último admin, auto-ação, soft delete, invalidação de sessões), schemas Zod
3. **Healthcheck** — `/health` com ping ao banco
4. **Error handling** — Formato `{ error: { code, message, details } }` padronizado
5. **Logger** — Pino com redact de senha
6. **Infra** — CORS, versionamento de API, middlewares globais
7. **Seed** — Usuários admin/operador padrão
8. **(Próximos)** — Endpoints de estoque, entradas, saídas, auditoria, relatórios

---

## 6. Riscos e Vulnerabilidades Confirmadas

Após análise do código-fonte, os seguintes riscos estão **confirmados** (não são suposições):

### Segurança — CRÍTICO

| #   | Risco                              | Evidência                                                                                 |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| S1  | Senhas em texto puro               | `data.js` L21-22: `senha:'admin123'`, `senha:'op123'`. Comparação direta em `auth.js` L26 |
| S2  | Autenticação 100% client-side      | `auth.js`: login compara contra localStorage. Sem backend                                 |
| S3  | Autorização apenas por UI          | `Auth.can()` oculta itens na sidebar. Qualquer código no console acessa Store diretamente |
| S4  | Sessão sem expiração               | `sessionStorage` persiste até fechar o navegador, sem TTL                                 |
| S5  | Sem rate limiting                  | Login aceita tentativas ilimitadas                                                        |
| S6  | Sem CORS (irrelevante sem backend) | Não há backend para proteger                                                              |
| S7  | Dados manipuláveis via console     | `localStorage` acessível diretamente. Qualquer usuário pode alterar role, estoque, etc.   |

### Integridade de Dados — CRÍTICO

| #   | Risco                                        | Evidência                                                                                                                         |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Sem transacionalidade                        | `modals.js` L94-96: `item.quantidade+=qtd; Store.setItems(items); Store.setEntradas(...)` — duas escritas separadas, sem rollback |
| D2  | Edição direta de quantidade                  | `Modals.saveItem()` permite alterar `quantidade` sem registro de ajuste                                                           |
| D3  | Exclusão física de itens                     | `Modals.deleteItem()` remove item do array sem soft delete, sem auditoria                                                         |
| D4  | Dados desnormalizados                        | Entradas e saídas copiam `itemNome`, `itemCodigo`, `funcNome` — divergem se o original for editado                                |
| D5  | IDs sequenciais frágeis                      | `Store.nextId()` usa `Math.max()` — vulnerável a colisão se dados forem manipulados                                               |
| D6  | Sem validação de estoque negativo no backend | Validação `item.quantidade < qtd` existe apenas no client (`modals.js` L186)                                                      |

### Auditoria — AUSENTE

| #   | Risco                               | Evidência                                                                                                                 |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A1  | Sem trilha de auditoria persistente | `App.activities` é array in-memory, perdido ao recarregar página                                                          |
| A2  | Sem registro de quem fez o quê      | Entradas registram `resp` (texto livre), saídas registram `funcNome`. Nenhum vincula ao usuário logado de forma confiável |
| A3  | Sem log de exclusões                | `deleteItem` não registra quem excluiu, quando, nem o estado anterior                                                     |
| A4  | Sem log de alterações               | `saveItem` em modo edição não registra diff do que mudou                                                                  |

### Persistência — INADEQUADA PARA PRODUÇÃO

| #   | Risco                                 | Evidência                                           |
| --- | ------------------------------------- | --------------------------------------------------- |
| P1  | localStorage é por navegador          | Não sincroniza entre máquinas ou navegadores        |
| P2  | Sem backup automático                 | Backup apenas via exportação manual JSON            |
| P3  | `clearAll()` apaga tudo e reseta seed | Sem confirmação robusta, sem proteção               |
| P4  | Seeds e dados demo misturados         | `initStore()` planta dados demo se chave não existe |

---

## 7. Invariantes de Domínio (Regras de Negócio Mínimas)

Estas invariantes devem ser preservadas em qualquer evolução:

1. Estoque não pode ficar negativo.
2. Toda saída deve validar saldo disponível antes de efetivar.
3. Toda entrada deve gerar registro rastreável (quem, quando, quanto, qual item).
4. Toda saída deve gerar registro rastreável (quem retirou, para qual setor, quando, quanto, qual item).
5. Todo ajuste manual de quantidade deve exigir justificativa e gerar registro de auditoria.
6. Toda ação sensível deve ter autorização server-side (após migração para backend).
7. Ocultar ação na UI não constitui autorização.
8. Movimentações não devem ser apagadas fisicamente sem política aprovada — preferir cancelamento, estorno ou soft delete auditado.
9. Seeds e dados demo não podem contaminar ambiente de produção.
10. IDs devem ser gerados de forma segura (UUID ou equivalente no backend).

---

## 8. Diretrizes Arquiteturais

### Frontend

- **Não migrar** para React, Vue, Angular, Next ou similares sem SPEC aprovada com justificativa objetiva.
- Preservar o frontend atual.
- Evitar reescrita cosmética.
- Migrar responsabilidades críticas (auth, autorização, persistência, validação de regras) do client para o backend de forma incremental.

### Backend (a ser construído)

- **Runtime:** Node.js
- **Framework:** Fastify (padrão). Express apenas com justificativa explícita.
- **Linguagem:** TypeScript
- **Banco:** SQLite (fase inicial)
- **ORM:** Prisma (padrão)
- **Auth:** Sessão segura server-side ou JWT + refresh token (requer justificativa na SPEC)
- **Deploy inicial:** Render, Railway ou VPS simples

### Estrutura recomendada do backend

```
backend/
├── src/
│   ├── app/                    ← Bootstrap, plugins Fastify
│   ├── config/                 ← Env vars, constantes
│   ├── modules/
│   │   ├── auth/               ← Login, logout, sessão/token, refresh
│   │   ├── users/              ← CRUD de usuários do sistema
│   │   ├── roles/              ← Roles e permissões
│   │   ├── employees/          ← Funcionários
│   │   ├── inventory/          ← Itens de estoque
│   │   ├── stock-movements/    ← Entradas, saídas, ajustes
│   │   ├── reports/            ← Relatórios
│   │   ├── settings/           ← Categorias, depósitos, setores
│   │   └── audit/              ← Trilha de auditoria
│   ├── shared/                 ← Middlewares, decorators, helpers compartilhados
│   └── infra/                  ← Logger, error handler, healthcheck
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 9. Requisitos Mínimos de Segurança

Exigidos desde a primeira versão com backend real:

- [ ] Hash robusto de senha (bcrypt ou argon2)
- [ ] Proibição absoluta de senha em texto puro
- [ ] Validação server-side de todos os inputs
- [ ] Autorização server-side para todas as ações sensíveis
- [ ] Sanitização e validação de input (zod ou similar)
- [ ] Gestão segura de sessão ou token (httpOnly, secure, sameSite)
- [ ] Rate limiting em rotas de autenticação
- [ ] CORS explícito e restritivo
- [ ] Secrets fora do código (env vars)
- [ ] Logs sem vazamento de segredos ou dados sensíveis
- [ ] Princípio do menor privilégio em todas as rotas
- [ ] Auditoria para ações sensíveis (CRUD de itens, movimentações, alteração de roles, exclusões)

---

## 10. Requisitos Mínimos de Observabilidade

Desde a primeira versão com backend real:

- [ ] Logs estruturados (JSON, com timestamp, level, contexto)
- [ ] Healthcheck endpoint (`GET /health`)
- [ ] Erros padronizados (formato consistente de resposta de erro)
- [ ] Versionamento explícito de API (`/api/v1/...`)
- [ ] Rastreabilidade: ator + ação + alvo + timestamp em todo registro de auditoria
- [ ] Separação entre log operacional e log de auditoria
- [ ] Migrações versionadas (Prisma migrate)
- [ ] Configuração 100% por environment variables

---

## 11. Modo de Trabalho — SDD Rigoroso

### Fluxo obrigatório para toda demanda

```
1. Entender a demanda
2. Levantar premissas e lacunas
3. Produzir SPEC verificável
4. Solicitar aprovação explícita da SPEC
5. Produzir DESIGN técnico (quando aplicável)
6. Solicitar aprovação do DESIGN (quando aplicável)
7. Implementar estritamente conforme aprovado
8. Validar por critérios objetivos
9. Registrar riscos residuais e próximos passos
```

### Regras de bloqueio

- **Não** implementar antes da aprovação da SPEC.
- **Não** mascarar incerteza como decisão.
- **Não** inferir regra crítica sem registrar como lacuna.
- **Não** propor migração de frontend por preferência pessoal.
- **Não** aceitar autenticação client-side como solução final.
- **Não** aceitar autorização apenas por UI.
- **Não** misturar especificação com implementação.
- **Não** entregar código sem critérios objetivos de aceite.

### Formato de resposta obrigatório

Toda resposta técnica deve seguir:

1. **Entendimento** — resumo objetivo da demanda
2. **Premissas** — premissas adotadas explicitamente
3. **Lacunas** — o que não está definido e impede decisão segura
4. **SPEC** — especificação verificável, linguagem contratual
5. **Edge cases** — limites, payload inválido, permissões, sessão expirada, concorrência, duplicidade, idempotência, falha parcial, rollback, recuperação, volumetria, dados legados, inconsistência pré-existente
6. **Critérios de aceite** — objetivos e testáveis (Dado/Quando/Então, status HTTP, efeito persistido, evento auditável, restrição de autorização)
7. **Riscos** — técnicos, operacionais, de segurança
8. **Próximas decisões** — o que depende de aprovação
9. **Gate** — "Aguardando aprovação da SPEC."

### Definition of Done

Uma entrega é concluída quando:

- [ ] SPEC aprovada
- [ ] DESIGN aprovado (quando aplicável)
- [ ] Implementação aderente ao escopo aprovado
- [ ] Testes passando
- [ ] Migração aplicada (quando existir)
- [ ] Logs e auditoria verificados
- [ ] Rollback documentado
- [ ] Critérios de aceite evidenciados
- [ ] Riscos residuais registrados

---

## 12. Prioridades do Projeto

Ordem estrita de prioridade:

1. Segurança
2. Integridade do estoque
3. Persistência confiável
4. Autorização server-side
5. Auditoria e rastreabilidade
6. Consistência do modelo de dados
7. APIs estáveis
8. Migração incremental sem ruptura
9. Observabilidade mínima
10. UX incremental

---

## 13. Próximos Passos Recomendados

Com base na análise do estado atual, a sequência sugerida de evolução é:

1. **Migração incremental de features para backend** — estoque, entradas, saídas, funcionários, auditoria, relatórios
2. **Script de migração de dados** — localStorage → SQLite
3. **Integração frontend ↔ backend** — substituir chamadas locais por fetch API
4. **Aprimoramento de segurança e observabilidade** — logs, healthcheck, erros
5. **Deploy** — ambiente real

---

## 14. Estilo de Comunicação

- Direto
- Técnico
- Crítico
- Sem floreio
- Sem marketing
- Sem linguagem vaga
- Orientado a contrato, risco e execução

---

## 15. Estado de Implementação por SDD

| SDD | Escopo | Status | Evidência |
|-----|--------|--------|-----------|
| SDD-001 | Backend bootstrap: Fastify + TS + Prisma + PostgreSQL, Auth (login/logout/me, cookie `almox_sid`, sessão em DB, sliding expiration), CRUD de Users, rate limit, error handler, AuditLog, Pino com redact | **CONCLUÍDO** | `backend/src/**`, `backend/prisma/schema.prisma` |
| SDD-001-FIX | Correção dos desvios DV1/DV3/DV4/DV5/DV7 detectados no relatório. 40/40 testes passando em 12 arquivos. | **CONCLUÍDO** | `docs/RELATORIO-TESTES-SPEC-001.md`, `backend/test/**` |
| SDD-002 | Employees + Settings (Funcionários, Categorias, Depósitos, Setores) | **CONCLUÍDO** | `docs/SDD-002-employees-settings.md`, `backend/src/modules/funcionarios/**`, `backend/src/modules/settings/**`, 78/78 testes em 21 arquivos (Bloco F) |
| SDD-003 | Inventory + Stock Movements (Itens, Entradas, Saídas, ajustes auditados) | **CONCLUÍDO** | `docs/SDD-003-Inv-Stock.md`, `backend/src/modules/inventory/**`, `backend/src/modules/stock-movements/**` |
| SDD-004 | Integração Frontend ↔ Backend (substituir localStorage por fetch API) | **CONCLUÍDO** | `apiClient.js`, `test-frontend/apiClient.test.ts`, `front/js/**`, `backend/scripts/import-legacy.ts`, `backend/test/import-legacy.test.ts`, `e2e/tests/**` |
| SDD-005 | Reports + Audit endpoints | **CONCLUÍDO** | `docs/SDD-005-reports-audit.md`, `backend/src/modules/reports/**`, `backend/src/modules/audit/**`, `backend/test/reports.test.ts`, `backend/test/audit-query.test.ts` |
| SDD-006 | Deploy + Observabilidade | **DEPLOY/HEALTH/FRONTEND/LOGS/BACKUP MANUAL VALIDADO; RISCOS FINAIS PENDENTES** | `docs/SDD-006-deploy-observabilidade.md`, `docs/SDD-006-DESIGN-deploy-observabilidade.md`, `docs/SDD-006-DOD-review.md`, `docs/runbooks/**`, `backend/scripts/bootstrap-admin.ts`, `backend/src/infra/static-frontend.ts`, `backend/public/**`, Railway `https://almoxarif-production.up.railway.app`, `/` 200 HTML, `/health/ready` 200 com `database=connected`, logs reais sem secrets, backup manual com restore testado |

### Riscos da §6 já mitigados pelo SDD-001+FIX

- **S1** senhas em texto puro → resolvido (bcrypt salt 12 no backend; seed `admin@rodoviariapel.com/admin2026` e `op@rodoviariapel.com/operador2026`).
- **S2** auth client-side → resolvido no backend (sessão server-side em DB com cookie `almox_sid` httpOnly).
- **S3** autorização por UI → resolvido no fluxo principal (backend `requireAuth` + `requireRole` consumido via `apiClient`).
- **S4** sessão sem expiração → resolvido (sliding expiration configurável, TTL 8h default).
- **S5** sem rate limit → resolvido (global + por rota, configurável via env).
- **S7** dados manipuláveis via console → resolvido para o fluxo principal; persistência oficial fica no backend.

### Débitos registrados (não bloqueantes)

- Nenhum débito de feature gap aberto em 2026-04-24.

### Estado atual SDD-006

Base operacional ja validada:
- SPEC aprovada: `docs/SDD-006-deploy-observabilidade.md`.
- DESIGN aprovado: `docs/SDD-006-DESIGN-deploy-observabilidade.md`.
- Infra implementada: env produtiva, health live/ready, security headers, logging/redact, graceful shutdown, cookies Secure em producao, baseline migration e bootstrap controlado de admin.
- Runbooks criados: `docs/runbooks/SDD-006-deploy.md`, `docs/runbooks/SDD-006-rollback.md`, `docs/runbooks/SDD-006-backup-restore.md`, `docs/runbooks/SDD-006-db-down.md`, `docs/runbooks/SDD-006-secret-rotation.md`.
- Runner validado: `npm test` no backend com `50/50` arquivos e `242/242` testes; `npm run test:frontend` com `62/62`; build backend passando.
- Migration validada: `prisma migrate deploy` aplicou `00000000000000_baseline` em banco PostgreSQL temporario limpo.
- Alvo operacional definido: Railway Node service + PostgreSQL gerenciado.
- Deploy real Railway validado parcialmente em 2026-04-28: commit `c6575e5`, migration sem pendencias, app ouvindo em `0.0.0.0:8080`, `/health/live`, `/health/ready` e `/health` retornando 200; readiness com `database=connected`.
- Smoke autenticado/API real tentado em 2026-04-28: login admin e operador padrao retornou 401; banco produtivo sem usuario inicial/controlado.
- Bootstrap controlado de admin executado em 2026-04-29 via Railway CLI; resultado `action=created` para `admin@rodoviariapel.com`; variaveis temporarias `BOOTSTRAP_*` removidas.
- Smoke autenticado/API real passou em 2026-04-29: login admin, `/api/v1/auth/me`, `/api/v1/items` e `/api/v1/reports/estoque` com sessao valida.
- Decisao frontend/API-only fechada: publicar frontend estatico no mesmo dominio do backend Railway, usando `backend/public/**` servido por Fastify.
- Frontend estatico validado no Railway em 2026-04-29: `GET /` 200 HTML, `/apiClient.js` 200, `/front/css/variables.css` 200.
- Logs reais validados no Railway em 2026-04-29: 300 linhas app/deploy + 200 linhas HTTP auditadas, sem ocorrencias nos padroes sensiveis do SDD-006.
- Backup manual aplicado em 2026-04-29 porque backup gerenciado nao foi confirmavel via CLI: dump fora do repo, SHA-256 registrado, `pg_restore --list` PASS e restore PASS em Docker PostgreSQL 18 temporario.
- Pendente para fechamento total: registro final de riscos residuais.

---

## 16. Diretrizes de Codificação

> Complementam §11 (Modo de Trabalho) e §14 (Estilo de Comunicação). Em caso de conflito, §11 prevalece.

### 16.1 Pensar Antes de Codificar

Não assuma. Não esconda confusão. Exponha tradeoffs.

Antes de implementar:
- Declare premissas explicitamente. Se incerto, pergunte.
- Se existirem múltiplas interpretações, apresente-as — não escolha silenciosamente.
- Se existir abordagem mais simples, diga. Questione quando justificável.
- Se algo estiver indefinido, pare. Nomeie o que está confuso. Pergunte.

### 16.2 Simplicidade Primeiro

Código mínimo que resolve o problema. Nada especulativo.

- Sem features além do que foi pedido.
- Sem abstrações para uso único.
- Sem "flexibilidade" ou "configurabilidade" não solicitadas.
- Sem tratamento de erros para cenários impossíveis.
- Se escrever 200 linhas e caber em 50, reescreva.
- Pergunta de controle: "Um engenheiro sênior diria que está complicado demais?" Se sim, simplifique.

### 16.3 Mudanças Cirúrgicas

Toque apenas o que for necessário. Limpe apenas a sua própria bagunça.

Ao editar código existente:
- Não "melhore" código adjacente, comentários ou formatação.
- Não refatore o que não está quebrado.
- Mantenha o estilo existente, mesmo que faria diferente.
- Se notar código morto não relacionado, mencione — não delete.

Quando suas mudanças criarem órfãos:
- Remova imports/variáveis/funções que **suas** mudanças tornaram não usados.
- Não remova código morto pré-existente sem solicitação.
- Teste: cada linha alterada deve rastrear diretamente ao pedido do usuário.

### 16.4 Execução Orientada a Objetivos

Defina critérios de sucesso. Itere até verificar.

Transforme tarefas em objetivos verificáveis:
- "Adicionar validação" → "Escrever testes para inputs inválidos, depois fazê-los passar"
- "Corrigir o bug" → "Escrever teste que reproduz, depois fazê-lo passar"
- "Refatorar X" → "Garantir que testes passam antes e depois"

Para tarefas multi-passo, declare plano breve:
```
1. [Passo] → verificar: [check]
2. [Passo] → verificar: [check]
3. [Passo] → verificar: [check]
```

Critérios fortes de sucesso permitem iterar de forma independente. Critérios fracos ("fazer funcionar") exigem clarificação constante.
