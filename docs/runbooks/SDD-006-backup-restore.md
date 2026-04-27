# Runbook SDD-006 - Backup e Restore

> Projeto: Almox
> Escopo: backup e recuperacao do PostgreSQL no SDD-006
> Status: procedimento MVP

---

## 1. Objetivo

Definir politica minima de backup/restore para proteger dados antes de deploys, migrations e incidentes operacionais.

---

## 2. Premissas

- Banco produtivo: PostgreSQL gerenciado.
- Backup gerenciado do provedor e preferencial.
- `pg_dump` e contingencia manual quando backup gerenciado nao estiver disponivel.
- Senhas e connection strings nao podem ser versionadas.
- Restore produtivo so deve ocorrer depois de teste em ambiente separado.

---

## 3. Politica minima

| Item | Regra MVP |
|------|-----------|
| Periodicidade | Diario quando backup gerenciado estiver disponivel |
| Retencao minima | 7 dias, se o plano do provedor permitir |
| Backup antes de migration relevante | Obrigatorio |
| Restore testado | Obrigatorio antes de restore produtivo |
| Dono operacional | Responsavel tecnico do projeto |

Se o provedor nao oferecer backup automatico no plano contratado, registrar risco operacional e executar backup manual antes de cada deploy com migration.

---

## 4. Backup gerenciado

Checklist:

1. Confirmar que backups estao habilitados no provedor.
2. Confirmar frequencia e retencao.
3. Confirmar ultimo backup concluido.
4. Confirmar onde restaurar backup em ambiente de teste.
5. Registrar timestamp do backup antes de deploy/migration.

---

## 5. Backup manual com pg_dump

Usar variavel de ambiente local segura. Nao salvar senha no repositorio.

Exemplo:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=almox-backup-YYYYMMDD-HHMM.dump
```

Validar arquivo:

```bash
pg_restore --list almox-backup-YYYYMMDD-HHMM.dump
```

Regras:

- Guardar dump fora do repositorio.
- Proteger acesso ao arquivo.
- Registrar hash/checksum quando aplicavel.
- Nunca anexar dump em ticket publico.

---

## 6. Restore em ambiente de teste

Criar banco temporario e restaurar:

```bash
createdb almox_restore_test
pg_restore --dbname=almox_restore_test --clean --if-exists almox-backup-YYYYMMDD-HHMM.dump
```

Validar:

- Tabelas principais existem.
- Usuarios administrativos esperados existem.
- `/health/ready` funciona apontando para o banco restaurado.
- Smoke login funciona com credencial controlada.
- Consultas de estoque, movimentacoes e audit nao falham.

---

## 7. Restore em producao

Usar apenas com aprovacao operacional.

Sequencia:

1. Bloquear trafego de escrita ou colocar aplicacao em manutencao.
2. Registrar versao atual e horario de inicio.
3. Confirmar que restore foi testado.
4. Executar restore conforme mecanismo do provedor ou `pg_restore`.
5. Aplicar migrations pendentes somente se necessario e aprovado.
6. Subir aplicacao.
7. Validar `/health/live`.
8. Validar `/health/ready`.
9. Executar smoke login.
10. Registrar janela de perda de dados, se houver.

---

## 8. Riscos

- Plano sem backup gerenciado aumenta risco operacional.
- Backup manual pode ficar obsoleto rapidamente.
- Restore pode sobrescrever dados validos criados apos o backup.
- Dumps podem conter dados sensiveis e devem ser protegidos.

---

## 9. Evidencias obrigatorias

Registrar:

- Tipo de backup: gerenciado ou manual.
- Timestamp do backup.
- Local seguro onde o backup foi armazenado.
- Resultado do teste de restore.
- Responsavel pela aprovacao.
- Resultado de health/smoke apos restore.

---

## 10. Gate de conclusao

Backup/restore so e considerado seguro quando:

- Backup existe e foi identificado.
- Restore foi testado fora de producao.
- Dados minimos foram validados.
- Evidencias foram registradas.
