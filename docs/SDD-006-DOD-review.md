# SDD-006 - DoD Review contra SPEC/DESIGN

> Projeto: Almox
> Modulo: SDD-006 - Deploy + Observabilidade
> Data: 2026-04-28
> Status: DoD tecnico/documental validado; deploy/health real no Railway validado; smoke autenticado bloqueado por ausencia de usuario inicial

---

## 1. Fontes verificadas

- SPEC: `docs/SDD-006-deploy-observabilidade.md`
- DESIGN: `docs/SDD-006-DESIGN-deploy-observabilidade.md`
- Progresso: `docs/PROGRESS.md`
- Relatorio de testes: `docs/RELATORIO-TESTES-SPEC-001.md`
- Runbooks: `docs/runbooks/*`
- Contexto: `AGENTS.md`, `CLAUDE.md`, `docs/WORKTREE-TRANSPLANTE.md`

---

## 2. Resultado executivo

| Area | Status | Evidencia |
|------|--------|-----------|
| Implementacao tecnica local | PASS | Env, health, headers, logging, cookies, shutdown e baseline migration implementados |
| Testes backend | PASS | `48/48` arquivos, `232/232` testes |
| Testes frontend | PASS | `1/1` arquivo, `62/62` testes |
| Build backend | PASS | `npm --prefix backend run build` passou |
| Migration em banco limpo | PASS | `prisma migrate deploy` aplicou `00000000000000_baseline` em PostgreSQL temporario limpo |
| Runbooks | PASS | 5 runbooks criados em `docs/runbooks/` |
| Documentacao de progresso/testes/contexto | PASS | `PROGRESS.md`, `RELATORIO-TESTES-SPEC-001.md`, `AGENTS.md`, `CLAUDE.md`, `WORKTREE-TRANSPLANTE.md` atualizados |
| Smoke/deploy real | PASS parcial | Railway em `https://almoxarif-production.up.railway.app`; commit `c6575e5`; `/health/live`, `/health/ready` e `/health` retornando 200 |
| Alvo operacional | DEFINIDO | Railway Node service + PostgreSQL gerenciado |

Conclusao: o DoD tecnico/documental do recorte implementado esta atendido e o smoke real de health no Railway passou. O smoke autenticado/API foi tentado e bloqueou em login 401 para os usuarios padrao. O SDD-006 ainda nao deve ser marcado como concluido porque faltam bootstrap controlado de usuario inicial, smoke autenticado/API, validacao de logs reais, confirmacao de backup e registro final de riscos residuais.

---

## 3. DoD da SPEC

Fonte: `docs/SDD-006-deploy-observabilidade.md` secao 9.

| Item | Status | Evidencia |
|------|--------|-----------|
| SPEC aprovada | PASS | Gate da SPEC em 2026-04-24 |
| DESIGN aprovado | PASS | Gate do DESIGN em 2026-04-24 |
| Alvo de deploy documentado | PASS | DESIGN D1: Railway Node service + PostgreSQL gerenciado |
| Env de producao validada e documentada | PASS | `backend/src/config/env.ts`, `production-env.test.ts`, `.env.example`, runbook de deploy |
| `backend/.env.example` atualizado sem secrets reais | PASS | `backend/.env.example` |
| Politica de migrations definida e validada | PASS | Baseline migration + `prisma migrate deploy` em banco limpo |
| Health/live e health/ready implementados e testados | PASS | `healthcheck.ts`, `health-readiness.test.ts` |
| Security headers implementados e testados | PASS | `security-headers.ts`, `security-headers.test.ts` |
| Logs/redact validados | PASS | `logger-options.ts`, `logging-production.test.ts` |
| Graceful shutdown documentado/testado quando aplicavel | PASS | `shutdown.ts`, `graceful-shutdown.test.ts`, relatorio de testes |
| Runbooks de deploy, rollback, DB down, backup/restore e secret rotation criados | PASS | `docs/runbooks/SDD-006-*.md` |
| `npm test` passando no backend | PASS | `48/48`, `232/232` |
| `npm run build` passando no backend | PASS | `tsc` sem erro |
| `PROGRESS.md` atualizado | PASS | `docs/PROGRESS.md` |
| `WORKTREE-TRANSPLANTE.md` atualizado no workspace principal | PASS | Bloco E do SDD-006 |
| Riscos residuais registrados | PASS | `RELATORIO-TESTES-SPEC-001.md` R7/R8 + esta matriz |

---

## 4. DoD do DESIGN

Fonte: `docs/SDD-006-DESIGN-deploy-observabilidade.md` secao 10.

| Item | Status | Evidencia |
|------|--------|-----------|
| DESIGN aprovado | PASS | Gate do DESIGN em 2026-04-24 |
| Implementacao segue a ordem do §7 | PASS | Env -> health -> headers -> cookies -> shutdown -> migration -> docs/runbooks -> suite |
| Nenhuma dependencia npm nova introduzida | PASS | Mudancas em `backend/package.json` foram scripts; sem nova dependencia |
| Baseline migration criada | PASS | `backend/prisma/migrations/00000000000000_baseline/migration.sql` |
| Health/live e health/ready testados | PASS | `health-readiness.test.ts` |
| Env produtiva insegura bloqueada | PASS | `production-env.test.ts` |
| Security headers testados | PASS | `security-headers.test.ts` |
| Cookies `Secure` em producao testados | PASS | `production-cookies.test.ts` |
| Runbooks criados | PASS | `docs/runbooks/` com 5 arquivos |
| Backend test suite passa | PASS | `48/48`, `232/232` |
| Frontend test suite passa | PASS | `1/1`, `62/62` |
| Build backend passa | PASS | `npm --prefix backend run build` |
| `PROGRESS.md`, `RELATORIO-TESTES-SPEC-001.md`, `CLAUDE.md` e `AGENTS.md` atualizados | PASS | Arquivos atualizados nesta revisao |

---

## 5. Criterios ainda nao fechados em ambiente real

Estes itens nao bloqueiam o DoD tecnico/documental local, mas bloqueiam marcar o SDD-006 como concluido operacionalmente.

| Item | Status | Motivo |
|------|--------|--------|
| Smoke login em deploy real | BLOQUEADO | `POST /api/v1/auth/login` com admin padrao -> 401; operador padrao -> 401; exige bootstrap controlado de usuario inicial |
| Validar `/health/live` e `/health/ready` no Railway | PASS | 2026-04-28: `/health/live` 200; `/health/ready` 200 com `checks.database=connected`; `/health` 200 |
| Validar logs reais do Railway sem secrets | PENDENTE | Exige runtime real |
| Confirmar backup gerenciado ou politica manual no Railway | PENDENTE | Exige projeto/plano final |
| CA-D3: migration falha nao promove versao ready | PARCIAL | Railway pre-deploy executou `prisma migrate deploy` antes do start; falha proposital de migration nao foi simulada |

---

## 6. Riscos residuais para fechamento total

| # | Risco | Severidade | Mitigacao |
|---|-------|------------|-----------|
| R1 | Smoke autenticado/API real bloqueado por ausencia de usuario inicial | Medio | Criar/confirmar usuario controlado e testar login/me/endpoints principais |
| R2 | Railway usa porta dinamica e target port pode divergir | Baixo | Evidencia atual: app ouvindo em `0.0.0.0:8080`; dominio ajustado para target port correspondente |
| R3 | Cookies/CORS podem falhar em dominio real | Medio | Smoke login com HTTPS e `CORS_ORIGIN` exato |
| R4 | Backup gerenciado pode nao existir no plano escolhido | Alto | Confirmar antes de migration produtiva; usar runbook de backup manual se necessario |
| R5 | Logs reais podem conter metadados do provedor fora do controle da app | Baixo | Revisar logs apos smoke e ajustar configuracao se necessario |
| R6 | Banco produtivo nao tem usuario inicial validado pelo smoke | Medio | `SEED_ENABLED=false` e necessario em producao; definir bootstrap controlado de admin |

---

## 7. Gate

Status atual:

- DoD tecnico/documental local: PASS.
- Deploy/health real no Railway: PASS parcial.
- Fechamento operacional total do SDD-006: PENDENTE.

Proximo passo autorizado:

1. Definir e executar bootstrap controlado de usuario inicial/admin.
2. Reexecutar smoke autenticado/API real no Railway.
3. Validar logs reais sem secrets.
4. Confirmar backup gerenciado ou aplicar runbook manual.
5. Atualizar riscos residuais finais.
6. So entao marcar SDD-006 como concluido.
