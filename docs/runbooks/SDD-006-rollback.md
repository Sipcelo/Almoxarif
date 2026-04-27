# Runbook SDD-006 - Rollback

> Projeto: Almox
> Escopo: rollback de codigo e estrategia segura para schema/banco no SDD-006
> Status: procedimento MVP

---

## 1. Objetivo

Definir como reverter uma implantacao com falha sem corromper dados, sem usar comandos destrutivos e sem assumir rollback automatico de schema.

---

## 2. Premissas

- Rollback de codigo depende do provedor.
- Rollback de schema em producao e forward-only.
- Migration aplicada em producao e imutavel.
- Restaurar backup e acao excepcional, nao rotina.
- O backend so deve receber trafego quando `/health/ready` estiver 200.

---

## 3. Quando acionar rollback

Acionar quando houver:

- `/health/live` fora do ar apos deploy.
- `/health/ready` 503 persistente sem causa externa de banco.
- Login quebrado em producao.
- Erros 5xx recorrentes em rotas criticas.
- Migration aplicada com efeito incompatavel com a versao atual.
- Vazamento de secret em logs.

---

## 4. Antes de reverter

Coletar evidencias:

- Versao/commit atual.
- Versao/commit anterior.
- Timestamp do deploy.
- Resultado de `/health/live`.
- Resultado de `/health/ready`.
- Logs relevantes sem secrets.
- Lista de migrations aplicadas no deploy.
- Confirmacao se houve escrita de dados apos a implantacao.

---

## 5. Rollback de codigo

Procedimento geral:

1. Selecionar a ultima versao estavel no provedor.
2. Promover/redeployar a versao anterior.
3. Nao executar `migrate reset`.
4. Nao executar `db push --accept-data-loss`.
5. Verificar `/health/live`.
6. Verificar `/health/ready`.
7. Executar smoke login.
8. Monitorar logs por pelo menos uma janela operacional curta.

---

## 6. Rollback de schema

Regra:

- Nao fazer rollback destrutivo de migration produtiva.
- Corrigir schema por nova migration forward-only.
- Se a versao anterior nao for compativel com o schema novo, rollback de codigo deve ser bloqueado ate existir plano de reparo.

Procedimento:

1. Identificar migration problematica.
2. Confirmar se os dados foram alterados.
3. Criar nova migration corretiva em ambiente controlado.
4. Testar migration corretiva contra copia/backup.
5. Aplicar em producao com `prisma migrate deploy`.
6. Validar readiness e smoke login.

---

## 7. Quando restaurar backup

Restaurar backup apenas se:

- Houve perda/corrupcao de dados.
- Migration destrutiva foi aplicada por erro.
- Nao existe reparo forward-only seguro.
- Dono operacional aprovou a restauracao.

Antes de restaurar:

- Bloquear trafego de escrita.
- Registrar janela de perda de dados.
- Restaurar primeiro em ambiente de teste.
- Validar integridade minima.
- Comunicar impacto operacional.

---

## 8. Evidencias obrigatorias

Registrar:

- Motivo do rollback.
- Versao antes/depois.
- Estado do banco.
- Migrations envolvidas.
- Health antes/depois.
- Smoke login depois.
- Risco residual.

---

## 9. Comandos proibidos em producao

Nao executar:

```bash
prisma migrate reset
prisma db push --accept-data-loss
prisma db seed
```

Seed em producao so pode ocorrer por procedimento explicitamente aprovado e nunca com `SEED_ENABLED=true` no boot.

---

## 10. Gate de conclusao

Rollback so e considerado concluido quando:

- Codigo estavel esta em execucao.
- `/health/live` retorna 200.
- `/health/ready` retorna 200.
- Smoke login passa.
- Nenhum secret apareceu em log.
- Evidencias foram registradas.
