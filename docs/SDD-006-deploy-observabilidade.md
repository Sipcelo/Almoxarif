# SDD-006 - Deploy + Observabilidade

> Projeto: Almox - Sistema de Gestao de Almoxarifado
> Modulo: 006 - Deploy + Observabilidade
> Status: SPEC APROVADA
> Versao: 1.0
> Data: 2026-04-24
> Base: workspace principal `d:\monetizando\almox v1.2`

---

## 1. Entendimento

O SDD-006 deve transformar o backend validado em um artefato pronto para ambiente real, com configuracao segura, health/readiness confiavel, logs estruturados, politica de migracao de banco, criterios de rollback e documentacao operacional minima.

Este SDD nao deve reabrir SDD-005. Reports e Audit ja ficam fechados no worktree sem dependencia de deploy/observabilidade.

No principal, o SDD-004 ja esta concluido e o frontend consome o backend via `apiClient`. Portanto, o SDD-006 deve separar:

- deploy do backend/API e banco como entrega operacional independente;
- deploy do frontend estatico como artefato de producao do MVP;
- decisao de dominio unico/cookies/CSP como requisito de producao.

---

## 2. Premissas

| # | Premissa |
|---|----------|
| P1 | Backend no principal esta validado com `42/42` arquivos e `213/213` testes. |
| P2 | `npm run build` do backend passa no principal. |
| P3 | Stack congelada do backend permanece Node.js + Fastify + TypeScript + Prisma + PostgreSQL. |
| P4 | Banco de producao deve ser PostgreSQL. SQLite/localStorage nao sao alvo de producao. |
| P5 | `SEED_ENABLED=false` em producao; seed default nunca deve rodar automaticamente no ambiente real. |
| P6 | `SESSION_SECRET` e `DATABASE_URL` devem vir de environment variables/secrets, nunca do repositorio. |
| P7 | Cookies ja usam `secure: NODE_ENV === "production"`; producao deve rodar com `NODE_ENV=production`. |
| P8 | CORS em producao deve ser restritivo; wildcard com credentials e proibido. |
| P9 | Logs operacionais e AuditLog sao coisas separadas. AuditLog continua no banco; logs operacionais vao para stdout/stderr do runtime. |
| P10 | Nenhuma dependencia npm nova deve ser introduzida sem justificativa explicita no DESIGN. |

---

## 3. Lacunas e decisoes pendentes

Estas decisoes bloqueiam o DESIGN tecnico e a implementacao.

| ID | Lacuna | Opcoes | Recomendacao inicial |
|----|--------|--------|----------------------|
| L1 | Alvo inicial de deploy | Render, Railway, VPS simples | Railway, definido como alvo operacional em 2026-04-26 |
| L2 | Estrategia de migracao Prisma para producao | Criar baseline migration; usar `db push`; recriar schema manualmente | Criar baseline migration e usar `prisma migrate deploy`; `db push` apenas dev/test |
| L3 | Dominio em producao | Backend e frontend em mesmo dominio; subdominios separados; somente API staging | Mesmo dominio no produto final para simplificar cookies/CORS |
| L4 | Observabilidade minima | Health + logs + runbook; endpoint de metricas simples; APM externo | Health + logs + runbook sem nova dependencia npm |
| L5 | Backups | Backup gerenciado do provedor; `pg_dump` manual; ambos | Backup gerenciado quando disponivel + procedimento manual documentado |
| L6 | Security headers/CSP | Headers no Fastify; headers no proxy/host estatico; ambos | Fastify para API; proxy/host estatico para frontend quando houver deploy do frontend |
| L7 | CI/CD | Checklist manual; GitHub Actions; deploy automatico do provedor | Checklist manual no MVP; CI so se aprovado no DESIGN |
| L8 | Docker de producao | Sem Docker; Dockerfile prod; usar build nativo do provedor | Sem Docker por default em Render/Railway; Dockerfile prod so se VPS for escolhido |

---

## 4. SPEC

### 4.1 Objetivo

Entregar o backend Almox pronto para deploy real, com operacao verificavel, configuracao segura, migracao controlada de banco, health/readiness, logs, headers de seguranca, rollback documentado e criterios objetivos de aceite.

### 4.2 Escopo

Dentro do SDD-006:

- Contrato de ambiente de producao (`NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `LOG_LEVEL`, rate limits, porta/host).
- Fail-fast em producao para env ausente ou insegura.
- Estrategia Prisma de producao sem `db push --accept-data-loss`.
- Healthcheck operacional com liveness e readiness.
- Logs estruturados seguros em stdout/stderr.
- Security headers minimos para API.
- CORS/cookies/proxy coerentes com ambiente real.
- Graceful shutdown do backend.
- Runbooks de deploy, rollback, banco indisponivel, rotacao de secret e backup/restore.
- Atualizacao de `.env.example`, `PROGRESS.md` e docs operacionais.
- Testes automatizados dos novos contratos de infra.

Fora do SDD-006:

- Reabrir a integracao frontend/backend do SDD-004.
- Criar nova UI ou refatorar telas.
- Criar dashboard grafico de observabilidade.
- Introduzir APM externo, tracing distribuido, Prometheus ou OpenTelemetry sem aprovacao explicita.
- Alta disponibilidade multi-regiao.
- Fila/job scheduler novo.
- Alterar regras de dominio de estoque, usuarios, reports ou audit.

### 4.3 Contrato de runtime

Runtime esperado:

| Item | Contrato |
|------|----------|
| Node | Node.js 22 LTS ou runtime compativel aprovado no DESIGN |
| Build | `npm ci`, `npm run prisma:generate`, `npm run build` |
| Start | `npm run start` |
| Porta | `PORT` fornecido pelo provedor, fallback apenas em dev |
| Host | `0.0.0.0` em deploy |
| Banco | PostgreSQL via `DATABASE_URL` |
| Logs | JSON em producao, stdout/stderr |

Regras:

- `NODE_ENV=production` e obrigatorio no ambiente real.
- `SESSION_SECRET` deve ter no minimo 32 caracteres.
- `SEED_ENABLED` deve ser ausente ou `false` em producao.
- `CORS_ORIGIN` deve ser obrigatorio em producao e nao pode ser `*`.
- `DATABASE_URL` deve apontar para PostgreSQL; banco local/teste nao e aceitavel em producao.
- Comandos destrutivos (`prisma db push --accept-data-loss`, `migrate reset`, `db seed` sem gate) sao proibidos em producao.

### 4.4 Banco e migracoes

O SDD-006 deve criar uma politica segura de migracao para producao.

Contrato:

- Toda alteracao de schema produtiva deve ser representada por migration versionada.
- `prisma migrate deploy` e o comando permitido para aplicar migrations em producao.
- `prisma db push` fica restrito a dev/test e scripts de runner local.
- Como o worktree atual nao possui pasta `backend/prisma/migrations`, o DESIGN deve definir o baseline inicial a partir do schema atual.
- Migrations aplicadas em producao sao imutaveis; rollback de schema deve ser forward-only por nova migration.
- Antes do primeiro deploy produtivo, deve existir procedimento de backup/restore ou confirmacao formal de banco vazio.

### 4.5 Health, liveness e readiness

Contrato minimo:

| Rota | Auth | Verifica DB | Uso |
|------|------|-------------|-----|
| `GET /health/live` | publico | nao | Processo vivo |
| `GET /health/ready` | publico | sim | App pronto para receber trafego |
| `GET /health` | publico | sim | Compatibilidade com contrato atual |

Resposta liveness 200:

```json
{
  "status": "ok",
  "service": "almox-backend",
  "version": "1.0.0",
  "timestamp": "2026-04-24T00:00:00.000Z",
  "uptime": 123
}
```

Resposta readiness 200:

```json
{
  "status": "ok",
  "service": "almox-backend",
  "version": "1.0.0",
  "timestamp": "2026-04-24T00:00:00.000Z",
  "uptime": 123,
  "checks": {
    "database": "connected"
  }
}
```

Resposta readiness 503:

```json
{
  "status": "degraded",
  "service": "almox-backend",
  "version": "1.0.0",
  "timestamp": "2026-04-24T00:00:00.000Z",
  "uptime": 123,
  "checks": {
    "database": "unreachable"
  }
}
```

Regras:

- `/health/live` nao deve depender do banco.
- `/health/ready` deve executar ping real no banco.
- `/health` deve manter compatibilidade com os testes atuais e pode ser alias de readiness.
- Health endpoints nao retornam secrets, connection strings, cookies, user data ou stack traces.

### 4.6 Observabilidade operacional

Logs obrigatorios:

- startup concluido, com ambiente seguro e versao;
- falha de validacao de env, sem imprimir secret;
- request log padrao do Fastify em producao;
- erros 5xx com `requestId`, rota, metodo e codigo interno;
- graceful shutdown iniciado/concluido;
- falha de conexao com banco no readiness.

Campos sensiveis proibidos em log:

- `senha`, `password`, `novaSenha`;
- `SESSION_SECRET`;
- `DATABASE_URL`;
- cookies (`almox_sid`, `almox_csrf`);
- headers `authorization` e `cookie`;
- payloads completos de login.

AuditLog permanece como trilha de negocio. Logs operacionais nao substituem AuditLog.

### 4.7 Security headers e CORS

Headers minimos para respostas da API em producao:

| Header | Valor esperado |
|--------|----------------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | politica restritiva sem sensores/camera/microfone/geolocation |
| `Cache-Control` | `no-store` para respostas autenticadas |

CSP:

- Para API JSON, CSP pode ser minima.
- Para frontend estatico, CSP deve ser definida no host/proxy quando o frontend for servido em producao.
- A CSP final deve considerar Google Fonts usado pelo frontend atual ou remover essa dependencia em decisao separada.

CORS:

- `credentials: true` permanece obrigatorio.
- `CORS_ORIGIN=*` e proibido em producao.
- Se frontend e backend ficarem em mesmo dominio, CORS pode ser reduzido ao minimo.
- Se subdominios forem usados, `CORS_ORIGIN` deve apontar exatamente para a origem autorizada.

Cookies:

- `almox_sid`: `HttpOnly`, `SameSite=Lax`, `Secure` em producao.
- `almox_csrf`: nao-HttpOnly por design double-submit, `SameSite=Lax`, `Secure` em producao.
- Em producao, trafego HTTP puro nao e aceitavel.

### 4.8 Deploy e rollback

O DESIGN deve detalhar comandos do provedor escolhido. A SPEC exige estes pontos independentemente do provedor:

Pre-deploy:

- suite backend verde;
- build TypeScript limpo;
- Prisma Client gerado;
- envs de producao cadastradas;
- banco acessivel;
- backup ou confirmacao de banco vazio;
- migrations pendentes revisadas.

Deploy:

- aplicar migrations com `prisma migrate deploy`;
- subir nova versao;
- verificar `/health/live`;
- verificar `/health/ready`;
- fazer login smoke test com credencial controlada ou usuario admin criado por procedimento seguro;
- validar que logs nao imprimem secrets.

Rollback:

- rollback de codigo deve ser documentado por plataforma;
- rollback de schema em producao deve ser forward-only;
- se migration for incompatavel com versao anterior, rollback exige plano especifico antes do deploy;
- banco deve ter backup antes de migration destrutiva ou irreversivel.

### 4.9 Backups e recuperacao

Contrato minimo:

- Documentar onde o backup do Postgres fica.
- Documentar periodicidade minima.
- Documentar como restaurar em ambiente de teste antes de declarar restore produtivo seguro.
- Documentar retencao minima.
- Documentar dono operacional do backup.

Para MVP:

- se provedor tiver backup gerenciado, usar o backup gerenciado;
- se nao tiver, documentar comando `pg_dump`/restore sem armazenar senha em arquivo versionado;
- backup manual deve ser explicitamente marcado como risco operacional.

### 4.10 Testes previstos

Novos testes esperados no SDD-006:

| Arquivo sugerido | Cobertura |
|------------------|-----------|
| `backend/test/production-env.test.ts` | fail-fast de env produtiva insegura |
| `backend/test/health-readiness.test.ts` | `/health/live`, `/health/ready`, `/health` |
| `backend/test/security-headers.test.ts` | headers minimos em respostas HTTP |
| `backend/test/logging-production.test.ts` | redact e ausencia de secrets em logs |
| `backend/test/graceful-shutdown.test.ts` | encerramento limpo de app/prisma quando aplicavel |

Comandos de validacao:

```bash
cd backend
npm test
npm run build
```

O baseline inicial do SDD-006 parte de `213/213` testes backend e `62/62` testes frontend. A contagem final sera definida no DESIGN.

---

## 5. Edge cases

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | `NODE_ENV=production` sem `SESSION_SECRET` | boot aborta antes de ouvir porta |
| E2 | `SESSION_SECRET` curto | boot aborta com erro explicito sem imprimir valor |
| E3 | `NODE_ENV=production` sem `CORS_ORIGIN` | boot aborta |
| E4 | `CORS_ORIGIN=*` em producao | boot aborta |
| E5 | Banco fora do ar apos boot | `/health/live` 200, `/health/ready` 503 |
| E6 | Banco fora do ar no boot | app pode iniciar, mas readiness fica 503 ate banco voltar, se provedor exigir processo vivo |
| E7 | Migration falha | deploy falha; app novo nao deve ser promovido como ready |
| E8 | Provedor reinicia processo | app sobe com env validada e readiness so fica ok apos DB conectado |
| E9 | Seed habilitado acidentalmente em producao | boot aborta ou comando de seed se recusa a rodar |
| E10 | Logs recebem payload de login | senha/cookies/authorization aparecem como `[REDACTED]` ou nao aparecem |
| E11 | Frontend e backend em origens diferentes | cookies exigem HTTPS, CORS exato e credentials; se nao configurado, login falha de forma esperada |
| E12 | Rollback de codigo com schema novo | permitido apenas se schema for backward-compatible; senao exige migration forward de reparo |
| E13 | CSP bloqueia fonte externa | frontend deve continuar funcional ou CSP deve permitir explicitamente a origem aprovada |
| E14 | Health endpoint chamado por bots | nao retorna dados sensiveis nem aumenta carga relevante |

---

## 6. Criterios de aceite

### 6.1 Infra e ambiente

| # | Dado | Quando | Entao |
|---|------|--------|-------|
| CA-I1 | `NODE_ENV=production` e env obrigatoria ausente | iniciar app | boot falha antes de ouvir porta |
| CA-I2 | `SESSION_SECRET` menor que 32 chars | iniciar app | boot falha com mensagem segura |
| CA-I3 | `CORS_ORIGIN=*` em producao | iniciar app | boot falha |
| CA-I4 | `SEED_ENABLED=true` em producao | iniciar app ou seed | operacao e bloqueada |
| CA-I5 | env produtiva valida | iniciar app | servidor ouve em `PORT` e `HOST` corretos |

### 6.2 Health

| # | Dado | Quando | Entao |
|---|------|--------|-------|
| CA-H1 | processo vivo | GET `/health/live` | 200 + `status="ok"` sem ping de DB |
| CA-H2 | banco conectado | GET `/health/ready` | 200 + `checks.database="connected"` |
| CA-H3 | banco indisponivel | GET `/health/ready` | 503 + `checks.database="unreachable"` |
| CA-H4 | contrato legado | GET `/health` | mantem resposta compativel com readiness |

### 6.3 Seguranca

| # | Dado | Quando | Entao |
|---|------|--------|-------|
| CA-S1 | resposta HTTP de producao | qualquer rota | headers minimos de seguranca presentes |
| CA-S2 | rota autenticada | resposta enviada | `Cache-Control: no-store` presente |
| CA-S3 | login em producao | POST `/auth/login` | cookies saem com `Secure` |
| CA-S4 | log de request com cookie | request autenticado | cookie nao aparece em claro no log |
| CA-S5 | erro interno | rota falha | response padronizado e sem stack trace ao usuario |

### 6.4 Banco/deploy

| # | Dado | Quando | Entao |
|---|------|--------|-------|
| CA-D1 | schema atual pronto para producao | preparar deploy | baseline migration existe ou decisao formal equivalente aprovada |
| CA-D2 | deploy produtivo | aplicar schema | usa `prisma migrate deploy`, nao `db push --accept-data-loss` |
| CA-D3 | migration falha | executar deploy | versao nova nao e considerada ready |
| CA-D4 | rollback necessario | executar runbook | passos de rollback de codigo e banco estao documentados |
| CA-D5 | backup antes de migration relevante | executar deploy | backup/restore ou banco vazio confirmado |

### 6.5 Validacao local

| # | Dado | Quando | Entao |
|---|------|--------|-------|
| CA-T1 | worktree apos implementacao | `npm test` em `backend/` | todos os testes passam |
| CA-T2 | worktree apos implementacao | `npm run build` em `backend/` | build TypeScript passa |
| CA-T3 | docs apos implementacao | revisar `PROGRESS.md` e runbooks | estado real esta atualizado |

---

## 7. Riscos

| # | Risco | Severidade | Mitigacao |
|---|-------|------------|-----------|
| R1 | Deploy com dominio/CORS/cookies incoerentes quebrar login do frontend | Alto | Definir dominio no DESIGN e validar login real no smoke test |
| R2 | Ausencia atual de migrations versionadas bloquear producao segura | Alto | Criar baseline migration no SDD-006 |
| R3 | `db push --accept-data-loss` ser usado por engano em producao | Alto | Proibir em docs, scripts e criterios de aceite |
| R4 | CORS/cookies falharem em subdominios | Medio | Decidir dominio no DESIGN e testar login real |
| R5 | Sem backup gerenciado no provedor escolhido | Alto | Exigir procedimento manual e registrar risco residual |
| R6 | CSP quebrar Google Fonts ou assets legados | Medio | Testar frontend e documentar origens permitidas |
| R7 | Logs excessivos vazarem dados pessoais | Alto | Redact obrigatorio e testes de log |
| R8 | Plataforma free tier dormir ou reiniciar | Medio | Health/readiness + registrar risco operacional ao cliente |
| R9 | Observabilidade sem alertas ativos detectar falha tarde | Medio | Runbook MVP + opcao de alerta no provedor se aprovado |

---

## 8. Proximas decisoes

Antes do DESIGN, aprovar:

1. Alvo inicial de deploy: Railway.
2. Escopo do primeiro deploy: API + frontend estatico juntos ou API/staging primeiro.
3. Estrategia de migration inicial: baseline Prisma migration recomendado.
4. Politica de backup: recurso do provedor ou `pg_dump` documentado.
5. Nivel de observabilidade: health/logs/runbook sem dependencia nova ou endpoint de metricas dedicado.
6. Uso de Docker em producao: apenas se VPS for escolhido ou se o provedor exigir.

---

## 9. Definition of Done

- [ ] SPEC aprovada.
- [ ] DESIGN aprovado.
- [ ] Alvo de deploy documentado.
- [ ] Env de producao validada e documentada.
- [ ] `backend/.env.example` atualizado sem secrets reais.
- [ ] Politica de migrations definida e validada.
- [ ] Health/live e health/ready implementados e testados.
- [ ] Security headers implementados e testados.
- [ ] Logs/redact validados.
- [ ] Graceful shutdown documentado/testado quando aplicavel.
- [ ] Runbooks de deploy, rollback, DB down, backup/restore e secret rotation criados.
- [ ] `npm test` passando no backend.
- [ ] `npm run build` passando no backend.
- [ ] `PROGRESS.md` atualizado.
- [ ] `WORKTREE-TRANSPLANTE.md` atualizado no workspace principal.
- [ ] Riscos residuais registrados.

---

## 10. Gate

SPEC aprovada pela diretriz "Vamos avançar" em 2026-04-24.

Nenhuma implementacao de SDD-006 deve iniciar antes da aprovacao do DESIGN tecnico subsequente.
