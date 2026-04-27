# SDD-001 Addendum - Fechamento de Debitos CA-A4, CA-I2, CA-I3

> Projeto: Almox - Sistema de Gestao de Almoxarifado
> Modulo: SDD-001 Addendum (Auth + Infra hardening debts)
> Status: SPEC aprovada e executada
> Versao: 1.0
> Data: 2026-04-18

---

## 1. Entendimento

Existem 3 debitos de baixa severidade ainda marcados como abertos na documentacao:

- CA-A4: teste explicito de login com usuario `ativo=false`
- CA-I2: comportamento `503` quando DB cai no `/health`
- CA-I3: validacao de boot sem `SESSION_SECRET`

Objetivo deste addendum:

1. transformar os 3 itens em criterio objetivo e testavel
2. fechar o gap entre implementacao/testes e status documental
3. manter o principio de zero debito antes da proxima fase

---

## 2. Premissas

| # | Premissa |
|---|---|
| P1 | Stack permanece Fastify + TypeScript + Prisma + PostgreSQL |
| P2 | Nao ha mudanca de contrato publico alem dos cenarios de validacao |
| P3 | Erros continuam no formato canonico `{ error: { code, message, details } }` |
| P4 | Testes devem rodar na suite backend existente, sem criar fluxo paralelo |
| P5 | Documentacao (`PROGRESS.md` e `RELATORIO-TESTES-SPEC-001.md`) deve refletir status real apos validacao |

---

## 3. Lacunas

| # | Lacuna | Impacto |
|---|---|---|
| L1 | Definir se CA-I3 considera apenas ausencia de `SESSION_SECRET` ou tambem tamanho minimo | Pode gerar fechamento parcial indevido |
| L2 | Definir ambiente da simulacao de DB down para CA-I2 (mock vs queda real) | Pode tornar teste flakey |
| L3 | Definir se CA-A4 exige somente 401 ou tambem assert de nao criar sessao/audit success | Pode deixar brecha de regressao |

Resolucao proposta neste addendum:

- L1: CA-I3 cobre ausencia e valor curto (<32)
- L2: CA-I2 usa mock controlado de `prisma.$queryRaw` para determinismo
- L3: CA-A4 exige 401 + mensagem generica + ausencia de session + sem log LOGIN

---

## 4. SPEC

### 4.1 Escopo

Dentro do escopo:

1. Validar CA-A4, CA-I2 e CA-I3 com testes automatizados explicitos
2. Ajustar status documental desses criterios para refletir resultado final
3. Registrar evidencia de execucao

Fora do escopo:

1. novas features de auth
2. mudanca de arquitetura de healthcheck
3. alteracao de observabilidade alem do necessario para os 3 criterios

### 4.2 Regras contratuais por criterio

#### CA-A4 - Login com usuario inativo

Requisitos:

1. `POST /api/v1/auth/login` com credencial valida de usuario `ativo=false` retorna `401`
2. mensagem deve ser generica (`Credenciais invalidas`) para nao vazar estado de conta
3. nao deve criar `Session`
4. nao deve gravar audit de sucesso (`LOGIN`)
5. deve gravar `LOGIN_FAILED`

#### CA-I2 - DB down no healthcheck

Requisitos:

1. `GET /health` retorna `503` quando acesso ao DB falhar
2. body deve trazer `status: "degraded"` e `checks.database: "unreachable"`
3. resposta nao pode vazar stacktrace/mensagem interna da excecao
4. apos recuperacao, `/health` volta para `200` com `status: "ok"`

#### CA-I3 - Boot sem SESSION_SECRET

Requisitos:

1. `validateEnv()` deve falhar quando `SESSION_SECRET` ausente
2. `validateEnv()` deve falhar quando `SESSION_SECRET` curto (<32)
3. `buildApp()` deve abortar boot com erro explicito quando `SESSION_SECRET` ausente

### 4.3 Atualizacao documental obrigatoria

Apos testes passarem:

1. `PROGRESS.md` deve remover CA-A4/CA-I2/CA-I3 da lista de debitos abertos
2. `RELATORIO-TESTES-SPEC-001.md` deve marcar CA-I2 e CA-I3 como `PASS`
3. registrar comando e resultado objetivo da suite que comprova fechamento

---

## 5. Edge cases

| # | Caso | Resultado esperado |
|---|---|---|
| E1 | Usuario inativo com senha correta | 401 generico, sem session |
| E2 | Usuario inexistente vs inativo | mesma mensagem, evitar enumeracao |
| E3 | DB falha temporaria em um request de health | 503 somente no periodo de falha |
| E4 | DB recupera apos falha | health volta para 200 |
| E5 | `SESSION_SECRET` existe mas com espacos/valor vazio | boot abortado |
| E6 | `SESSION_SECRET` com 31 chars | boot abortado |

---

## 6. Criterios de aceite

| # | Criterio | Evidencia |
|---|---|---|
| CA-A4-1 | Login de usuario inativo retorna 401 generico | teste backend dedicado |
| CA-A4-2 | Nao cria session nem LOGIN success | teste backend dedicado |
| CA-I2-1 | `/health` retorna 503 com body degradado quando DB down | teste backend dedicado |
| CA-I2-2 | `/health` volta a 200 apos recuperacao | teste backend dedicado |
| CA-I3-1 | `validateEnv` falha sem SESSION_SECRET | teste backend dedicado |
| CA-I3-2 | `validateEnv` falha com SESSION_SECRET curto | teste backend dedicado |
| CA-I3-3 | `buildApp` aborta boot sem SESSION_SECRET | teste backend dedicado |
| DOC-1 | `PROGRESS.md` sem CA-A4/CA-I2/CA-I3 em aberto | diff documental |
| DOC-2 | `RELATORIO-TESTES-SPEC-001.md` com CA-I2/CA-I3 = PASS | diff documental |

---

## 7. Riscos

| # | Risco | Severidade | Mitigacao |
|---|---|---|---|
| R1 | Fechar apenas no codigo e esquecer docs | Medio | Tornar atualizacao documental criterio obrigatorio |
| R2 | Teste de DB down instavel | Baixo | Mock controlado em vez de derrubar banco real |
| R3 | Regressao em auth ao ajustar mensagens | Baixo | Garantir asserts de mensagens em testes existentes |

---

## 8. Proximas decisoes

| # | Decisao | Opcao recomendada |
|---|---|---|
| D1 | Fonte oficial de fechamento dos 3 debitos | resultado da suite backend + update de docs |
| D2 | Momento de execucao | executar imediatamente antes do proximo gate de fase |

---

## 9. Gate

Execucao concluida neste ciclo com validacao objetiva dos 3 criterios.
