# SDD-004 Addendum A - Modulo de Acessos

Status: aprovado e implementado
Data: 2026-04-18

## 1. Entendimento

Fechar o debito de migracao do Controle de Acesso que ainda dependia de `Store.getAcessos()/setAcessos` no frontend.

## 2. Escopo

Incluido neste addendum:
- Backend: entidade `Acesso` no Prisma.
- Backend: `GET /api/v1/acessos` e `POST /api/v1/acessos`.
- Backend: auditoria `ACESSO_CREATED`.
- Frontend: `apiClient.acessos.list/create`.
- Frontend: migracao de `Modals.saveAcesso`, `PageAcesso.render`, `Impressao.acessos` e `Utils.exportJSON`.

Fora deste addendum:
- Novo redesign de tela.
- Mudanca de permissao de menu fora do baseline atual.

## 3. Regras de autorizacao

- `GET /api/v1/acessos`: admin.
- `POST /api/v1/acessos`: admin.

## 4. Contrato resumido

### POST /api/v1/acessos
Payload:
- `nome` string obrigatorio
- `tipo` enum `Entrada|Saida`
- `hora` string `HH:mm`
- `data` string `YYYY-MM-DD`
- `cargo` string opcional

Resposta:
- `201 { acesso }`

### GET /api/v1/acessos
Query:
- `q` opcional (busca por nome/cargo/tipo)
- `tipo` opcional
- `dataInicio` opcional `YYYY-MM-DD`
- `dataFim` opcional `YYYY-MM-DD`
- `page` e `limit`

Resposta:
- `{ acessos, meta }`

## 5. Criterios de aceite

- Fluxo principal de acesso sem `Store.getAcessos()/setAcessos` em modal, pagina, impressao e exportacao.
- Backend compila com novo modulo.
- Teste frontend permanece verde.
