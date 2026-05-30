# ADR-0030 — Revalidação de status e permissão por requisição

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** segurança, autorização, sessão

## Contexto e Problema

Inativar uma Pessoa, revogar uma permissão delegada ou remover um vínculo deve ter efeito **imediato**, mesmo com sessão já aberta. O intent USP-007/F1 marca `(arquitetural-estrutural)`: "invalidação de sessão na inativação? Custa performance". Os must-not:

- USP-007/P-001, USP-004/P-004, USP-008/P-001, USP-014/P-002: Pessoa recém-inativada / com permissão revogada / vínculo removido **não pode** executar operação autenticada em sessão já aberta — "a verificação precisa rejeitar a próxima requisição em janela curta".
- USP-004/P-006, USP-005/E-003: redefinição de senha invalida **todas** as sessões ativas.
- USP-008/P-004: reativar Pessoa **não restaura** permissões antigas (volta zerada).
- USP-008/L-002: revogação aplica-se no **próximo carregamento** (janela curta acordada).

A tensão é performance: revalidar status/permissões a cada request custa uma consulta extra; confiar só no token da sessão (12h) deixa janela perigosa.

## Drivers de Decisão

- Efeito de inativação/revogação em **janela curta** (segurança > microperformance).
- Volume baixo (ADR-0010) tolera revalidação por request.
- Reativação começa do zero (sem restaurar grants).

## Opções Consideradas

### Opção A — Revalidação de status + permissões a cada requisição autenticada (consulta leve, cacheável por janela curta)
- **Descrição:** Todo request autenticado revalida, antes de autorizar: (a) a Pessoa está **ativa**; (b) suas **permissões delegadas** vigentes; (c) seus **vínculos de Empresa** ativos. A consulta é leve (índices por `person_id`) e pode ser **cacheada por janela curta** (ex.: ≤30s) se necessário, aceitando que a revogação valha "no próximo carregamento" (USP-008/L-002). Reset de senha incrementa um `session_epoch` da Pessoa, invalidando tokens emitidos antes. Reativação cria estado de permissões **vazio**.
- **Prós:** Inativação/revogação efetivas em janela curta; coerente com todos os must-not; barato no volume do MVP.
- **Contras:** Uma consulta extra por request (ou cache de ≤30s) — desprezível no volume.

### Opção B — Confiar no token de sessão até expirar (12h)
- **Contras:** Janela de 12h em que Pessoa inativada continua operando — viola USP-007/P-001. Rejeitada.

### Opção C — Push de revogação (invalidação ativa via pub/sub)
- **Contras:** Mensageria/infra extra — proibida pelo ADR-0010 no volume. Rejeitada.

## Decisão

Adotamos a **Opção A**: **revalidação de status + permissões + vínculos a cada requisição autenticada**, com cache opcional de **janela curta (≤30s)**; **`session_epoch`** invalida sessões no reset de senha; **reativação volta sem grants**. A "janela curta acordada" é parametrizável (default: revalidação por request; cache ≤30s se a performance exigir).

## Consequências

**Positivas:**
- Inativação, revogação e remoção de vínculo efetivas em janela curta (satisfaz USP-004/007/008/014).
- Reset de senha derruba todas as sessões; reativação não vaza permissões antigas. A reativação é formalizada como **USP-045** (fluxo inverso da USP-007; reabilita login, preserva histórico, volta com zero permissões delegadas).

**Negativas (trade-offs aceitos):**
- Custo de uma consulta por request (ou cache ≤30s) — aceito dado o volume.

**Neutras / a monitorar:**
- Se o volume crescer muito, mover a revalidação para cache de sessão com TTL ≤30s (já previsto).

## Referências

- ADR-0011 (negócio — Pessoa/papéis), ADR-0001 (negócio — permissões delegadas), ADR-0023 (auditoria).
- USPs servidas: USP-004, USP-005, USP-007, USP-008, USP-014, USP-045 (Reativar Pessoa — fluxo inverso da USP-007).
