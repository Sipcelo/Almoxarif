# Runbook SDD-006 - Deploy

> Projeto: Almox
> Escopo: deploy operacional do backend/API e frontend estatico no SDD-006
> Status: procedimento MVP

---

## 1. Objetivo

Executar deploy controlado do Almox no Railway, em ambiente real ou staging produtivo, usando build nativo do provedor, PostgreSQL gerenciado, migrations Prisma versionadas e verificacoes de health/readiness.

---

## 2. Premissas

- Alvo inicial: Railway Node service + PostgreSQL gerenciado.
- Backend: `backend/`, configurado como Root Directory do servico Railway.
- Frontend: arquivos estaticos do repositorio, sem build step obrigatorio.
- `NODE_ENV=production` no ambiente real.
- Banco produtivo usa PostgreSQL via `DATABASE_URL`.
- Migrations produtivas usam `prisma migrate deploy`.
- `prisma db push`, `migrate reset` e `db seed` sem gate sao proibidos em producao.
- Railway injeta `PORT`; nao definir `PORT` manualmente salvo necessidade operacional especifica.
- App deve ouvir em `0.0.0.0:$PORT`.

---

## 3. Pre-check local

Executar antes de qualquer deploy:

```bash
npm --prefix backend test
npm --prefix backend run build
npm run test:frontend
```

Resultado esperado:

- Backend: `49 passed`, `236 passed`.
- Frontend: `1 passed`, `62 passed`.
- TypeScript sem erro.

---

## 4. Envs obrigatorias

Configurar no provedor, nunca versionar valores reais:

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=<minimo 32 caracteres, gerado fora do repo>
CORS_ORIGIN=https://<frontend-ou-dominio-publico-autorizado>
SEED_ENABLED=false
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
```

Regras:

- No Railway, configurar as variaveis no servico backend em `Variables`.
- `DATABASE_URL` deve referenciar o servico PostgreSQL do mesmo projeto. O nome `Postgres` no exemplo deve ser ajustado ao nome real do servico de banco.
- Railway aplica alteracoes de variaveis como staged changes; revisar e fazer deploy para aplicar.
- Secrets sensiveis devem ser sealed quando aplicavel, especialmente `SESSION_SECRET`.
- `CORS_ORIGIN=*` bloqueia boot em producao.
- `SEED_ENABLED=true` bloqueia boot em producao.
- `DATABASE_URL` deve comecar com `postgresql://` ou `postgres://`.
- `SESSION_SECRET` nao pode aparecer em log, commit, print ou ticket publico.

---

## 5. Configuracao Railway

Criar/ajustar projeto:

1. Criar projeto no Railway.
2. Adicionar PostgreSQL pelo menu `+ New`.
3. Criar servico backend conectado ao repositorio Git.
4. Definir Root Directory do servico backend como:

```text
/backend
```

5. Gerar dominio publico do servico backend em `Settings -> Networking -> Public Networking -> Generate Domain`.
6. Configurar healthcheck path do servico backend como:

```text
/health/ready
```

Observacoes Railway:

- Railway fornece `PORT` automaticamente quando a variavel nao e definida.
- Healthcheck usa o `PORT` do servico.
- Healthcheck do Railway e usado no momento do deploy para promover a nova versao; nao substitui monitoramento continuo.
- Para monorepo isolado, o Root Directory faz build/start operarem dentro de `backend/`.

---

## 6. Comandos Railway

Com Root Directory = `/backend`, configurar:

Build command:

```bash
npm ci && npm run prisma:generate && npm run build
```

Pre-deploy command:

```bash
npm run migrate:deploy
```

Start command:

```bash
npm start
```

Regras:

- A migration deve rodar como pre-deploy command, entre build e start.
- Se `npm run migrate:deploy` falhar, o deploy nao deve prosseguir.
- Nao colocar migration dentro do `npm start`.
- Nao executar seed automatica em producao.

Se a equipe optar por nao usar Root Directory, usar comandos equivalentes a partir da raiz:

```bash
npm --prefix backend ci && npm --prefix backend run prisma:generate && npm --prefix backend run build
npm --prefix backend run migrate:deploy
npm --prefix backend start
```

---

## 7. Sequencia de deploy Railway

1. Confirmar que a suite local passou.
2. Confirmar que o servico PostgreSQL existe no mesmo projeto/ambiente.
3. Confirmar que `DATABASE_URL` referencia o PostgreSQL correto.
4. Confirmar que as envs produtivas estao cadastradas no servico backend.
5. Confirmar backup gerenciado ou banco vazio antes da primeira migration.
6. Confirmar Root Directory `/backend`.
7. Confirmar Build command, Pre-deploy command e Start command.
8. Confirmar healthcheck path `/health/ready`.
9. Executar deploy no Railway.
10. Conferir nos logs que o pre-deploy command aplicou migrations.
11. Gerar/confirmar dominio publico HTTPS.
12. Validar liveness:

```bash
curl -i https://<dominio-railway>/health/live
```

Resultado esperado: HTTP 200, `status="ok"`.

13. Validar readiness:

```bash
curl -i https://<dominio-railway>/health/ready
```

Resultado esperado: HTTP 200, `checks.database="connected"`.

14. Validar compatibilidade:

```bash
curl -i https://<dominio-railway>/health
```

Resultado esperado: mesmo contrato de readiness.

15. Se ainda nao existir admin ativo no banco produtivo, executar bootstrap controlado de admin.
16. Executar smoke login com usuario controlado.
17. Verificar logs do Railway.

---

## 8. Bootstrap controlado de admin

Usar somente quando o banco produtivo estiver sem usuario admin ativo. Nao substituir por `SEED_ENABLED=true` em producao.

Variaveis temporarias obrigatorias no Railway:

```env
BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN
BOOTSTRAP_ADMIN_EMAIL=<email-admin-controlado>
BOOTSTRAP_ADMIN_PASSWORD=<senha-temporaria-forte-12-a-128-caracteres>
BOOTSTRAP_ADMIN_NAME=<nome-do-admin>
```

Regras:

- Nao registrar a senha em chat, ticket, commit ou print.
- Rodar em one-off command/job no servico backend, apontando para o mesmo `DATABASE_URL` produtivo.
- Se ja existir admin ativo, o script deve retornar `action="skipped"` e nao alterar o banco.
- Se criar/promover admin, deve registrar AuditLog `ADMIN_BOOTSTRAPPED`.
- Remover as variaveis temporarias de bootstrap apos execucao, ou ao menos remover/rotacionar `BOOTSTRAP_ADMIN_PASSWORD`.

Comando preferencial no artefato buildado:

```bash
npm run bootstrap:admin:dist
```

Fallback se o shell one-off executar em contexto fonte com dev dependencies disponiveis:

```bash
npm run bootstrap:admin
```

Saidas esperadas:

```json
{ "action": "created", "userId": "...", "email": "..." }
```

ou:

```json
{ "action": "promoted", "userId": "...", "email": "..." }
```

ou:

```json
{ "action": "skipped", "reason": "ja existe admin ativo" }
```

Depois do bootstrap, executar imediatamente o smoke login. Em caso de falha, nao ativar seed; revisar variaveis, banco alvo e logs do one-off.

---

## 9. Smoke login

Requisitos:

- Usuario admin previamente criado por procedimento seguro.
- HTTPS ativo.
- Origem do frontend igual a `CORS_ORIGIN` quando houver origem separada.

Validar:

- Login retorna 200.
- Cookie `almox_sid` possui `HttpOnly`, `SameSite=Lax` e `Secure`.
- Cookie `almox_csrf` possui `SameSite=Lax` e `Secure`.
- `/api/v1/auth/me` retorna usuario autenticado.
- Senha, cookie, authorization e `DATABASE_URL` nao aparecem em log.

---

## 10. Evidencias obrigatorias

Registrar no fechamento do deploy:

- Commit/versao implantada.
- Resultado de `npm --prefix backend test`.
- Resultado de `npm --prefix backend run build`.
- Resultado de `npm run test:frontend`.
- Root Directory configurado como `/backend`.
- Build command configurado.
- Pre-deploy command `npm run migrate:deploy` configurado e executado.
- Start command `npm start` configurado.
- Healthcheck path `/health/ready` configurado.
- Respostas de `/health/live`, `/health/ready` e `/health`.
- Evidencia do bootstrap controlado quando aplicavel, sem senha exposta.
- Evidencia de smoke login.
- Confirmacao de que logs nao vazam secrets.
- Confirmacao de backup gerenciado ou procedimento manual adotado.

---

## 11. Falha durante deploy

Se migration falhar:

- Nao promover a versao como ready.
- Capturar erro sem expor secrets.
- Verificar estado do banco.
- Acionar runbook de rollback se codigo ja tiver sido promovido.

Se readiness retornar 503:

- Manter liveness como indicador de processo vivo.
- Acionar runbook de banco indisponivel.

Se login falhar por cookie/CORS:

- Conferir `NODE_ENV=production`.
- Conferir HTTPS.
- Conferir `CORS_ORIGIN`.
- Conferir dominio unico ou origem exata.

---

## 12. Referencias Railway

- Build/start commands: https://docs.railway.com/reference/build-and-start-commands
- Pre-deploy command: https://docs.railway.com/guides/pre-deploy-command
- PostgreSQL: https://docs.railway.com/guides/postgresql
- Public networking/PORT: https://docs.railway.com/public-networking
- Healthchecks: https://docs.railway.com/reference/healthchecks
- Variables: https://docs.railway.com/variables
- Monorepo/Root Directory: https://docs.railway.com/guides/monorepo

---

## 13. Gate de conclusao

Deploy so e considerado concluido quando:

- `/health/live` retorna 200.
- `/health/ready` retorna 200.
- Smoke login passa.
- Logs nao mostram secrets.
- Backup/politica de backup foi confirmado.
- Evidencias foram registradas.
