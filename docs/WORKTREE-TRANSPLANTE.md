# Worktree Transplante

Fonte operacional para acompanhar o que foi alterado no worktree Claude antes de promover para o workspace principal.

Ultima atualizacao: 2026-04-24

## Regra de Uso

- Atualizar este arquivo sempre que um arquivo for criado, alterado ou removido no worktree.
- Nao promover alteracoes para o principal sem registrar aqui o escopo e a validacao.
- Separar mudancas por bloco funcional para evitar transplante parcial acidental.
- Marcar claramente o que ja foi validado e o que ainda depende de decisao.

## Worktree Atual

- Origem: `d:\monetizando\almox v1.2\.claude\worktrees\priceless-wright-8af341`
- Destino futuro: `d:\monetizando\almox v1.2`
- Status: blocos A, B e D transplantados para o principal. Bloco C permanece nao transplantado.

## Bloco A - Runner Backend e Env de Teste

Objetivo: estabilizar `npm test` do backend no worktree sem depender de `backend/.env`.

Arquivos alterados/criados no worktree:

- `backend/package.json`
- `backend/vitest.config.ts`
- `backend/scripts/test-pretest.ts`
- `backend/prisma/schema.prisma`

Resumo das alteracoes:

- `backend/package.json`: `pretest` passou de `prisma generate && prisma db push --accept-data-loss` para `tsx scripts/test-pretest.ts`.
- `backend/scripts/test-pretest.ts`: novo script cross-platform que carrega `backend/.env.test` e executa `prisma generate` + `prisma db push --accept-data-loss`.
- `backend/vitest.config.ts`: runner fixado em `pool: "threads"` com `singleThread: true` para evitar instabilidade com banco compartilhado.
- `backend/prisma/schema.prisma`: `binaryTargets = ["native", "windows"]` no Prisma Client para evitar erro de query engine no Windows.

Validacao no worktree:

- `backend/.env` foi removido do worktree antes da validacao.
- `cmd /c "npm test"` em `backend/`: passou 2 vezes consecutivas.
- Resultado: `40/40` arquivos, `203/203` testes.
- `cmd /c "npm run build"` em `backend/`: passou.

Risco/observacao:

- O warning `The CJS build of Vite's Node API is deprecated` permanece, mas nao bloqueia a suite.
- Os testes backend usam banco compartilhado `almox_test`; nao rodar grupos backend em paralelo contra o mesmo banco.

Transplante para principal:

- Status: transplantado em 2026-04-24.
- Arquivos aplicados: `backend/package.json`, `backend/scripts/test-pretest.ts`, `backend/prisma/schema.prisma`.
- `backend/vitest.config.ts` ja estava equivalente no principal.
- Validacao no principal: `cmd /c "npm --prefix backend test"` passou com `42/42` arquivos e `213/213` testes.

## Bloco B - SDD-005 Reports e Audit

Objetivo aparente: adicionar endpoints de relatorios e consulta de auditoria.

Arquivos novos no worktree:

- `backend/src/modules/audit/audit.handlers.ts`
- `backend/src/modules/audit/audit.routes.ts`
- `backend/src/modules/audit/audit.schema.ts`
- `backend/src/modules/audit/audit.service.ts`
- `backend/src/modules/reports/reports.handlers.ts`
- `backend/src/modules/reports/reports.routes.ts`
- `backend/src/modules/reports/reports.schema.ts`
- `backend/src/modules/reports/reports.service.ts`
- `backend/test/audit-query.test.ts`
- `backend/test/reports.test.ts`
- `docs/SDD-005-reports-audit.md`

Arquivos alterados relacionados:

- `backend/src/app/server.ts`
- `docs/PROGRESS.md`

Resumo das alteracoes visiveis:

- `server.ts` registra `reportsRoutes` em `/api/v1/reports`.
- `server.ts` registra `auditRoutes` em `/api/v1/audit`.
- Testes de reports e audit query estao presentes no worktree e passaram dentro da suite completa.
- `PROGRESS.md` do worktree foi atualizado para marcar SDD-005 como implementado no worktree, com baseline `203/203` em `40` arquivos e `49` endpoints ativos.
- `docs/SDD-005-reports-audit.md` e `docs/PROGRESS.md` registram que o SDD-005 fecha sem dependencias pendentes antes do SDD-006.
- O SDD-005 nao adiciona dependencia npm, nao cria migration Prisma, nao depende de frontend/SDD-004 e nao depende de deploy/observabilidade/SDD-006.

Validacao no worktree:

- Incluido na suite backend: `40/40` arquivos, `203/203` testes.
- Fechamento pre-SDD-006: sem dependencia pendente detectada.
- Revalidado apos documentacao de fechamento: `cmd /c "npm test"` em `backend/` passou com `40/40` arquivos e `203/203` testes em 38.56s.
- Revalidado apos documentacao de fechamento: `cmd /c "npm run build"` em `backend/` passou.

Transplante para principal:

- Status: transplantado em 2026-04-24.
- Merge preservou avancos do principal: SDD-004 completo, modulo `acessos`, CORS multi-origem e porta local `3001`.
- Arquivos/diretorios aplicados: `backend/src/modules/reports/**`, `backend/src/modules/audit/**`, `backend/test/reports.test.ts`, `backend/test/audit-query.test.ts`, `docs/SDD-005-reports-audit.md`.
- `backend/src/app/server.ts` foi mesclado manualmente para adicionar `reportsRoutes` e `auditRoutes` sem remover `acessosRoutes`.
- Validacao no principal: backend `42/42` arquivos e `213/213` testes; frontend `62/62`; build backend passou.

Pendencia antes de transplante:

- Revisar aderencia completa ao `docs/SDD-005-reports-audit.md`.
- Conferir se nao ha conflito com specs vigentes no principal.

## Bloco C - Infra Auxiliar do Worktree

Arquivos novos no worktree:

- `docker/Dockerfile.dev`
- `docker/docker-compose.dev.yml`
- `scripts/antigravity.ps1`
- `scripts/antigravity.sh`
- `package-lock.json`

Arquivos alterados:

- `.claude/settings.local.json`
- `CLAUDE.md`

Status:

- Ainda nao revisado para transplante.
- Tratar como bloco separado; nao misturar com runner backend nem SDD-005 sem decisao explicita.
- Nao e dependencia do SDD-005 nem pre-requisito do SDD-006.
- `package-lock.json` da raiz nao declara pacotes; e lockfile vazio derivado do `package.json` raiz sem dependencias.

## Bloco D - SDD-006 Documentacao

Objetivo: iniciar a SPEC do SDD-006 (Deploy + Observabilidade) sem implementar codigo.

Arquivos novos no worktree:

- `docs/SDD-006-deploy-observabilidade.md`

Arquivos alterados relacionados:

- `docs/PROGRESS.md`

Resumo das alteracoes:

- Criada SPEC draft do SDD-006 com status `SPEC DRAFT - AGUARDANDO APROVACAO`.
- Escopo definido para deploy readiness, env de producao, migracoes Prisma, health/live, health/ready, logs, security headers, CORS/cookies, runbooks, backup/restore e rollback.
- Registradas lacunas que bloqueiam DESIGN: alvo de deploy, estrategia de migration baseline, dominio, nivel de observabilidade, backups, CSP/security headers, CI/CD e Docker.
- `PROGRESS.md` do worktree atualizado para marcar SDD-006 como `SPEC DRAFT NO WORKTREE`.

Validacao no worktree:

- Documentacao apenas; nenhum teste de codigo foi necessario nesta etapa.
- Nenhum arquivo de codigo foi alterado para SDD-006.

Transplante para principal:

- Status: transplantado em 2026-04-24.
- Arquivo aplicado: `docs/SDD-006-deploy-observabilidade.md`.
- `docs/PROGRESS.md`, `CLAUDE.md` e `AGENTS.md` atualizados no principal para refletir SDD-005 concluido e SDD-006 em SPEC draft.
- SPEC ajustada no principal para refletir que SDD-004 ja esta concluido no principal.
- Apos "Vamos avancar", SPEC do SDD-006 foi marcada como aprovada e `docs/SDD-006-DESIGN-deploy-observabilidade.md` foi criado como DESIGN draft.

Pendencia antes de implementacao:

- Aprovar/reprovar a SPEC.
- Apos aprovacao, produzir DESIGN tecnico antes de qualquer codigo.

## Bloco E - SDD-006 Implementacao Parcial

Objetivo: registrar o estado do SDD-006 apos aprovacao da SPEC/DESIGN e implementacao parcial de deploy/observabilidade no principal.

Arquivos novos relacionados:

- `backend/prisma/migrations/00000000000000_baseline/migration.sql`
- `backend/src/infra/logger-options.ts`
- `backend/src/infra/security-headers.ts`
- `backend/src/infra/shutdown.ts`
- `backend/test/production-env.test.ts`
- `backend/test/health-readiness.test.ts`
- `backend/test/security-headers.test.ts`
- `backend/test/production-cookies.test.ts`
- `backend/test/logging-production.test.ts`
- `backend/test/graceful-shutdown.test.ts`
- `docs/runbooks/SDD-006-deploy.md`
- `docs/runbooks/SDD-006-rollback.md`
- `docs/runbooks/SDD-006-backup-restore.md`
- `docs/runbooks/SDD-006-db-down.md`
- `docs/runbooks/SDD-006-secret-rotation.md`
- `docs/SDD-006-DOD-review.md`

Arquivos alterados relacionados:

- `backend/.env.example`
- `backend/package.json`
- `backend/src/app/server.ts`
- `backend/src/config/env.ts`
- `backend/src/infra/healthcheck.ts`
- `docs/PROGRESS.md`
- `docs/RELATORIO-TESTES-SPEC-001.md`
- `AGENTS.md`
- `CLAUDE.md`

Resumo das alteracoes:

- Env produtiva insegura bloqueada: `CORS_ORIGIN` ausente/wildcard, `SEED_ENABLED=true`, `DATABASE_URL` nao PostgreSQL e secret fraco.
- Health endpoints expandidos para `/health/live`, `/health/ready` e `/health`.
- Security headers minimos aplicados via plugin Fastify.
- Logger options centralizado com redact de cookie, authorization e senhas.
- Cookies `Secure` em producao cobertos por teste.
- Graceful shutdown implementado e testado com idempotencia.
- Baseline migration Prisma criada e validada com `prisma migrate deploy` em banco PostgreSQL temporario limpo.
- Runbooks operacionais criados para deploy, rollback, backup/restore, DB down e rotacao de secret.
- Relatorio de testes atualizado para baseline backend `48/232` e frontend `1/62`.
- Alvo operacional de deploy definido como Railway Node service + PostgreSQL gerenciado.
- Runbook de deploy ajustado para Railway: Root Directory `/backend`, pre-deploy command `npm run migrate:deploy`, start command `npm start`, healthcheck path `/health/ready`.

Validacao no principal:

- `npm --prefix backend test` passou com `48/48` arquivos e `232/232` testes.
- `npm run test:frontend` passou com `1/1` arquivo e `62/62` testes.
- `cmd /c "npm --prefix backend run build"` passou.
- `prisma migrate deploy` aplicou `00000000000000_baseline` em banco PostgreSQL temporario limpo; banco temporario removido.

Pendencia para fechamento total:

- Executar smoke/deploy real no alvo operacional aprovado.
- Registrar riscos residuais finais apos smoke/deploy real.

## Estado do Principal

Observacao importante:

- O principal agora e a bancada principal de trabalho.
- O worktree antigo deve ser tratado como fonte historica ate decisao explicita de remocao.
- O arquivo `backend/.env` local e ignorado pelo git; nao deve ser transplantado.

## Checklist Para Transplantar

1. Rodar no worktree: `cmd /c "npm test"` em `backend/`.
2. Rodar no worktree: `cmd /c "npm run build"` em `backend/`.
3. Confirmar `backend/.env` ausente no worktree.
4. Copiar apenas os arquivos do bloco aprovado.
5. Rodar os mesmos comandos no principal.
6. Atualizar este documento com data, bloco transplantado e resultado.
