# Runbook SDD-006 - Banco Indisponivel

> Projeto: Almox
> Escopo: diagnostico e resposta quando PostgreSQL estiver indisponivel
> Status: procedimento MVP

---

## 1. Objetivo

Definir resposta operacional quando o backend estiver vivo, mas sem conexao funcional com o PostgreSQL.

---

## 2. Sinais esperados

| Sinal | Interpretacao |
|-------|---------------|
| `/health/live` 200 | Processo backend esta vivo |
| `/health/ready` 503 | Backend nao esta pronto para trafego |
| `/health` 503 | Compatibilidade com readiness degradada |
| Erros 5xx em rotas autenticadas | Possivel falha de DB ou dependencia interna |

Resposta esperada de readiness degradada:

```json
{
  "status": "degraded",
  "service": "almox-backend",
  "checks": {
    "database": "unreachable"
  }
}
```

---

## 3. Diagnostico inicial

1. Verificar liveness:

```bash
curl -i https://<dominio>/health/live
```

2. Verificar readiness:

```bash
curl -i https://<dominio>/health/ready
```

3. Verificar painel/status do provedor PostgreSQL.
4. Verificar se `DATABASE_URL` esta cadastrada no servico correto.
5. Verificar se houve rotacao de senha, mudanca de host ou suspensao do banco.
6. Verificar logs do backend por erros de conexao, sem expor connection string.

---

## 4. Causas comuns

- Banco pausado/suspenso pelo provedor.
- Credencial de `DATABASE_URL` expirada ou alterada.
- Banco removido ou recriado.
- Limite de conexoes atingido.
- Rede do provedor indisponivel.
- Migration travada ou deploy incompleto.
- Servico apontando para banco errado.

---

## 5. Acoes de recuperacao

### Banco pausado

1. Reativar banco no provedor.
2. Aguardar readiness voltar para 200.
3. Executar smoke login.

### Credencial incorreta

1. Corrigir `DATABASE_URL` no provedor.
2. Reiniciar backend se o provedor nao reiniciar automaticamente.
3. Validar `/health/ready`.
4. Executar smoke login.

### Limite de conexoes

1. Verificar conexoes abertas no provedor.
2. Reiniciar backend se houver vazamento temporario.
3. Avaliar upgrade de plano se recorrente.
4. Registrar risco operacional.

### Migration falhou

1. Nao executar `migrate reset`.
2. Verificar estado da migration.
3. Corrigir via migration forward-only ou `migrate resolve` apenas com backup e decisao formal.
4. Acionar runbook de rollback se a aplicacao nova nao puder operar.

---

## 6. Comunicacao operacional

Mensagem minima:

- Sistema indisponivel ou degradado por falha de banco.
- Escritas podem estar indisponiveis.
- Dados ja persistidos nao devem ser considerados perdidos sem diagnostico.
- Proxima atualizacao em janela definida pelo responsavel operacional.

Evitar:

- Divulgar `DATABASE_URL`.
- Divulgar stack trace.
- Divulgar credenciais ou nomes internos desnecessarios.

---

## 7. Evidencias obrigatorias

Registrar:

- Horario de deteccao.
- Resultado de `/health/live`.
- Resultado de `/health/ready`.
- Status do provedor PostgreSQL.
- Mudancas recentes de deploy/env/migration.
- Acao tomada.
- Horario de recuperacao.
- Risco residual.

---

## 8. Gate de recuperacao

Incidente de DB down so e considerado recuperado quando:

- `/health/live` retorna 200.
- `/health/ready` retorna 200.
- Smoke login passa.
- Rotas principais consultam dados sem 5xx.
- Logs nao mostram erro recorrente de conexao.
