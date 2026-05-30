# ADR-0021 — Unicidade sob concorrência (UNIQUE + 409 determinístico)

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** data, concorrência

## Contexto e Problema

Diversas chaves de negócio precisam ser únicas **mesmo sob submits simultâneos**. O intent USP-001/F1 marca explicitamente como `(arquitetural-estrutural)`: "AC-001-2 e AC-001-3 declaram unicidade mas não escrevem o comportamento sob concorrência". Os expectations transformam em must-not:

- USP-001/P-001: "NÃO PODE criar duas Pessoas com mesmo CPF nem mesmo e-mail, mesmo sob submits simultâneos … 409 no segundo submit, nunca 500, nunca persistência dupla."
- USP-012/P-006: idem para CNPJ de Empresa.
- USP-013/P-004: vínculo único `(pessoa, empresa, tipo ativo)`.
- USP-025/E-002, USP-033/D-004: candidatura/manifestação única sob duplo-clique.

A validação "consulta-depois-insere" no app sofre de TOCTOU (time-of-check/time-of-use): duas requisições concorrentes passam na checagem e inserem duas linhas.

## Drivers de Decisão

- Garantia forte de unicidade que não dependa de timing da aplicação.
- Resposta de erro **determinística** (409), nunca 500 nem dupla escrita.
- Custo mínimo — usar o que o Postgres já oferece.

## Opções Consideradas

### Opção A — Constraint `UNIQUE` no banco + captura do erro de violação → 409
- **Descrição:** A unicidade é garantida por constraint no Postgres (incl. índices parciais para "ativo", ex.: `UNIQUE (candidato_id, vaga_id) WHERE status='ativa'`). A aplicação tenta inserir; ao receber violação de unicidade do Prisma (P2002), traduz para `{ ok: false, error: 'CONFLICT' }` / HTTP 409 com mensagem específica.
- **Prós:** Garantia no nível do dado (impossível furar por concorrência); determinístico; idempotência natural para duplo-clique.
- **Contras:** Requer mapear o código de erro do driver; mensagens de conflito precisam ser específicas por chave.
- **Custo:** US$0.

### Opção B — Lock pessimista / serialização
- **Descrição:** `SELECT ... FOR UPDATE` ou nível de isolamento serializável antes de inserir.
- **Prós:** Também correto.
- **Contras:** Mais contention e complexidade; desnecessário para inserções idempotentes quando a constraint resolve.

## Decisão

Adotamos a **Opção A**: **constraint `UNIQUE` no banco como fonte da verdade** (CPF e e-mail em `persons`; CNPJ em `companies`; índices parciais para candidatura/manifestação/vínculo ativos), com **tradução determinística da violação para 409** e mensagem específica por chave. A checagem prévia no app (para UX) é permitida, mas **nunca é a garantia** — a constraint é.

## Consequências

**Positivas:**
- Unicidade impossível de furar por concorrência (TOCTOU eliminado).
- Duplo-clique resolve para uma única linha + 409 no segundo — satisfaz USP-025/USP-033.

**Negativas (trade-offs aceitos):**
- Acoplamento ao código de erro do Prisma/Postgres — isolado num helper de tradução.

**Neutras / a monitorar:**
- Índices parciais "ativo" exigem cuidado: a coluna de status entra no índice; documentar no schema (TD §4.5).

## Referências

- ADR-0020 (transação), ADR-0023 (auditoria).
- USPs servidas: USP-001, USP-003, USP-012, USP-013, USP-025, USP-033.
