# Relatorio de Usabilidade - Entrada em Massa por Nota

**Data:** 2026-04-29  
**Escopo:** teste de UI para funcionarios, carga de 100 itens e soma de entradas de estoque.  
**Referencia:** fluxo atual do MVP ate SDD-006 concluido.

---

## 1. Entendimento

O cenario solicitado e validar uma operacao operacional parecida com lancamento de nota:

- criar 8/9 funcionarios;
- adicionar entrada de estoque em massa com 100 itens;
- garantir que o sistema some quantidades e valores dos itens lancados;
- avaliar a usabilidade do fluxo.

---

## 2. Premissas

- O frontend atual continua sendo a UI oficial do MVP.
- A entrada implementada no produto e unitaria: um item por modal `Registrar Entrada`.
- O backend atual expoe `POST /api/v1/entradas` para uma entrada por item.
- Nao existe, ate esta data, entidade `nota`, `nota fiscal`, `entrada em lote`, importacao CSV/Excel ou endpoint bulk aprovado em SPEC.

---

## 3. Teste Automatizado Adicionado

Arquivo:

- `e2e/tests/10-usabilidade-entrada-massa.spec.ts`

Cenario coberto:

- login real pela UI como admin;
- criacao de 9 funcionarios pela tela de Funcionarios;
- preparacao controlada de categoria, deposito e setor via API autenticada;
- criacao de 100 itens e 100 entradas autenticadas, simulando uma carga de nota;
- validacao pela UI de Entradas:
  - 100 linhas filtradas;
  - soma das quantidades;
  - soma dos valores totais por linha;
- validacao pela UI de Estoque:
  - 100 itens filtrados;
  - soma consolidada das quantidades em estoque;
- verificacao explicita de que o modal atual de entrada nao possui campo de nota, lote, massa ou arquivo.

---

## 4. Resultado Esperado

O teste deve passar como baseline de carga/usabilidade do estado atual.

O resultado nao prova que ja existe "entrada por nota em uma unica acao", porque esse fluxo ainda nao esta implementado. Ele prova:

- a UI suporta consultar/renderizar uma massa de 100 entradas e 100 itens;
- as somas exibidas nas tabelas batem com o payload lancado;
- a ausencia do fluxo bulk/nota e uma lacuna de produto, nao um bug isolado.

---

## 5. Gap de Produto Confirmado

Para o comportamento desejado de lancar uma nota com 100 itens de uma vez, ainda falta uma SPEC propria.

Pontos que precisam ser definidos antes de implementar:

- modelo de dados da nota: numero, fornecedor, data, total bruto, descontos/frete/impostos se existirem;
- se a nota cria itens novos, atualiza itens existentes ou exige item pre-cadastrado;
- regra de duplicidade de nota;
- atomicidade: se um item falhar, toda a nota deve fazer rollback ou aceitar parcial;
- validacao de total informado versus soma calculada;
- formato de entrada: formulario dinamico, CSV, XLSX, XML de NF-e ou importacao manual;
- auditoria por nota e por linha;
- limite de linhas por nota;
- permissao necessaria para lancamento em massa;
- comportamento de valor unitario quando o item ja tem `valorAtual`.

---

## 6. Execucao

Comando isolado:

```bash
npm --prefix e2e test -- tests/10-usabilidade-entrada-massa.spec.ts
```

Resultado:

```text
1 passed (17.3s)
```

Suite E2E completa:

```bash
npm --prefix e2e test
```

Resultado:

```text
11 passed (38.3s)
```

---

## 7. Status

PASS para o teste de usabilidade do estado atual.

Gap aberto para novo SDD: entrada em massa por nota/lote em uma unica acao.
