# Runbook SDD-006 - Rotacao de Secret

> Projeto: Almox
> Escopo: rotacao de `SESSION_SECRET` e secrets operacionais do backend
> Status: procedimento MVP

---

## 1. Objetivo

Trocar secrets de producao sem versionar valores, sem vazar credenciais e com validacao operacional apos a troca.

---

## 2. Secrets cobertos

| Secret | Uso |
|--------|-----|
| `SESSION_SECRET` | Assinatura/seguranca de sessao |
| `DATABASE_URL` | Conexao PostgreSQL |
| Credenciais do provedor | Acesso operacional ao host/banco |

Este runbook foca em `SESSION_SECRET`. Rotacao de `DATABASE_URL` deve tambem seguir o runbook de banco indisponivel se afetar conectividade.

---

## 3. Impacto esperado

Rotacionar `SESSION_SECRET` pode invalidar sessoes existentes.

Impactos:

- Usuarios podem precisar fazer login novamente.
- Cookies antigos podem deixar de ser aceitos.
- Nao deve haver perda de dados.
- AuditLog permanece no banco.

---

## 4. Gerar novo secret

Gerar fora do repositorio, com no minimo 32 caracteres.

Exemplo local:

```bash
openssl rand -base64 48
```

Regras:

- Nao commitar.
- Nao colar em issue publica.
- Nao imprimir em logs.
- Nao reutilizar secret antigo.

---

## 5. Janela recomendada

Executar em janela de menor uso, pois sessoes podem ser invalidadas.

Antes da troca:

- Avisar usuarios se houver uso ativo.
- Confirmar acesso ao painel do provedor.
- Confirmar que rollback de env e possivel.
- Confirmar que `SEED_ENABLED=false`.

---

## 6. Procedimento

1. Gerar novo `SESSION_SECRET`.
2. Atualizar env no provedor.
3. Reiniciar/redeployar backend conforme comportamento do provedor.
4. Validar liveness:

```bash
curl -i https://<dominio>/health/live
```

5. Validar readiness:

```bash
curl -i https://<dominio>/health/ready
```

6. Executar login novo no frontend.
7. Validar `/api/v1/auth/me`.
8. Conferir logs para garantir que o secret nao apareceu.

---

## 7. Falha apos rotacao

Se o backend nao subir:

- Conferir comprimento minimo do secret.
- Conferir se a env foi salva no servico correto.
- Conferir se `NODE_ENV=production` esta correto.
- Reverter temporariamente para o secret anterior apenas se ele nao estiver comprometido.

Se usuarios nao conseguem logar:

- Limpar cookies locais.
- Validar HTTPS.
- Validar cookies `Secure`.
- Verificar CORS/origem.

Se houve vazamento de secret:

- Gerar outro secret imediatamente.
- Trocar no provedor.
- Invalidar sessoes.
- Registrar incidente.

---

## 8. Rotacao de DATABASE_URL

Usar apenas quando o provedor rotacionar credenciais ou houver suspeita de vazamento.

Sequencia minima:

1. Criar nova credencial no provedor.
2. Atualizar `DATABASE_URL`.
3. Reiniciar backend.
4. Validar `/health/ready`.
5. Executar smoke login.
6. Revogar credencial antiga.

Se readiness ficar 503, seguir `SDD-006-db-down.md`.

---

## 9. Evidencias obrigatorias

Registrar:

- Data/hora da rotacao.
- Secret rotacionado, sem registrar valor.
- Responsavel.
- Resultado de `/health/live`.
- Resultado de `/health/ready`.
- Resultado de smoke login.
- Confirmacao de ausencia de secret em logs.

---

## 10. Gate de conclusao

Rotacao so e considerada concluida quando:

- Backend esta vivo.
- Readiness esta 200.
- Login novo funciona.
- Logs nao contem secret.
- Secret antigo foi revogado quando aplicavel.
