# ADR-0023 — Log append-only de auditoria e consentimentos

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead, DPO (diretora Angélica — D-001 resolvido)
- **Tags:** segurança, auditoria, LGPD, data

## Contexto e Problema

O ADR-0010 declara o log imutável de auditoria como **restrição absoluta** (não negociável por custo). O ADR-0013 exige registro de consentimento com versão+data+IP, revogável. Os intents marcam `(arquitetural-estrutural)`: USP-043/F7 "log de consentimentos append-only, criptografado, com hash". Os must-not reforçam:

- USP-043/P-007: "NÃO PODE armazenar consentimentos em tabela mutável editável por engenheiro com acesso ao banco. Append-only, criptografado, com hash de integridade."
- USP-043/P-009: revogação **cria novo registro**, nunca muta o anterior.
- USP-001/P-006, USP-004/P-005: falha na auditoria invalida a transação ou dispara alerta — "não fica silenciosa".
- USP-016/P-006: operação de moderação via API sem registro de auditoria é proibida.
- USP-038/P-003: resultado de encaminhamento versionado (nova linha), nunca sobrescrito.

## Drivers de Decisão

- Imutabilidade real (não só convenção de código) — resistente a quem tem acesso ao banco.
- Consentimento como prova jurídica (LGPD art. 8º) — integridade verificável.
- Auditoria acoplada à transação de negócio (não pode faltar silenciosamente).

## Opções Consideradas

### Opção A — Tabelas append-only com `REVOKE UPDATE, DELETE` no nível do DB + hash de integridade + cripto em repouso
- **Descrição:** `audit_log` e `consents` recebem apenas `INSERT`. No Postgres, `REVOKE UPDATE, DELETE` para o role da aplicação. Cada linha de consentimento carrega titular+finalidade+versão+data+IP+status e um **hash encadeado** (hash da linha + hash anterior) para detectar adulteração. Revogação e mudança de resultado = **novo INSERT**. `withAudit('EVENT', tx)` grava o log **na mesma transação** da escrita de negócio (ADR-0020): se a auditoria falha, a transação reverte.
- **Prós:** Imutabilidade garantida pelo DB; integridade verificável por hash; auditoria nunca silenciosa.
- **Contras:** Correções legítimas exigem novo registro compensatório (by design); cripto em repouso depende do provedor (Supabase) + cripto de coluna para campos sensíveis.

### Opção B — Imutabilidade só por convenção de código
- **Contras:** Não resiste a acesso direto ao banco — viola explicitamente USP-043/P-007. Rejeitada.

### Opção C — Append-only em store externo (ex.: bucket WORM)
- **Contras:** Mais infra e custo; desnecessário no volume; complica consultas. Rejeitada para o MVP.

## Decisão

Adotamos a **Opção A**. `audit_log` e `consents` são **append-only forçado no DB** (`REVOKE UPDATE, DELETE`), com **hash de integridade encadeado** nos consentimentos e **criptografia em repouso** (Supabase + cripto de coluna para ficha social e CV — ADR-0028/§7 do TD). Toda escrita sensível passa por `withAudit(EVENT, tx)` na **mesma transação** (ADR-0020); o catálogo de eventos é um enum fechado. Revogação de consentimento e atualização de resultado de encaminhamento são **novos INSERTs**.

## Consequências

**Positivas:**
- Consentimento e auditoria à prova de adulteração — satisfaz USP-043/P-007/P-009 e as exigências de auditoria transversais.
- Inativação preserva consentimentos como "suspensos" (USP-007/P-005), coerente com retenção indefinida (ADR-0008).

**Negativas (trade-offs aceitos):**
- "Edição" vira sempre append (mais linhas); consultas precisam pegar a versão vigente.
- `REVOKE` no DB exige cuidado nas migrations e no role de deploy.

**Neutras / a monitorar:**
- Auditoria de **leitura** de dado sensível (quem viu a ficha social) fica como evolução V2 — registrar export já no MVP (USP-039/P-007, USP-042).

## Referências

- ADR-0008 (negócio — retenção), ADR-0013 (negócio — consentimentos), ADR-0010 (negócio — log absoluto), ADR-0020 (transação).
- USPs servidas: USP-001 a USP-008, USP-015, USP-016, USP-036, USP-037, USP-038, USP-039, USP-042, USP-043.
