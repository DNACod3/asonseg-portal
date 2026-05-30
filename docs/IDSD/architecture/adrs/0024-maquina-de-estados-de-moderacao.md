# ADR-0024 — Máquina de estados de moderação (`transitionContent`)

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** domínio, moderação, data

## Contexto e Problema

O ADR-0015 (negócio) impõe moderação humana pré-publicação para vaga, CV e serviço, com ciclo de vida de status e regras de transição (motivo obrigatório em devolução/rejeição, e-mail ao autor, moderador responsável registrado). Editar conteúdo aprovado **volta a rascunho** e re-modera. Os must-not estruturais:

- USP-016/P-005: autor não pode moderar o próprio conteúdo (mesmo com permissão delegada — item some da fila dele).
- USP-016/P-006: transição de moderação sem auditoria (decisor, motivo, data) é proibida — inclusive via API; batch registra cada decisão.
- USP-020/P-001: vaga de Empresa "não verificada" não vai a "ativo" sem a verificação da Empresa na mesma decisão (USP-017) — atomicamente.
- USP-023/P-001, USP-032: editar → re-moderação; **preservar data de publicação original** ao re-aprovar (anti-manipulação de ranking).

O risco é dispersar a lógica de transição por várias Server Actions, permitindo transições inválidas, sem motivo ou sem auditoria.

## Drivers de Decisão

- Uma única porta para transição (impossível pular validação/auditoria).
- Transições válidas declaradas (não inferidas ad-hoc).
- Efeitos colaterais (e-mail, verificação de Empresa) consistentes com a transição.

## Opções Consideradas

### Opção A — Função única `transitionContent(content, to, ctx)` no módulo `moderation`
- **Descrição:** Toda mudança de status de conteúdo passa por `transitionContent`, que: (1) valida se a transição `from→to` é permitida pela tabela de transições; (2) exige motivo quando a transição configura `requiresReason`; (3) roda em transação com `withAudit` (ADR-0023); (4) dispara efeitos via outbox (e-mail — ADR-0020) e efeitos acoplados (verificar Empresa na 1ª vaga — USP-017). Nenhum `prisma.content.update({status})` direto é permitido.
- **Prós:** Ponto único; transições inválidas impossíveis; auditoria e motivo garantidos; conflito-de-interesse (autor≠moderador) resolvido na query da fila.
- **Contras:** Disciplina para nunca atualizar status fora da porta (reforçado no project-guideline e no review).

### Opção B — Status como coluna livre, regras por Server Action
- **Contras:** Lógica duplicada e divergente; fácil pular auditoria/motivo (viola USP-016/P-006). Rejeitada.

### Opção C — Biblioteca de state machine (XState etc.)
- **Contras:** CLAUDE.md proíbe libs de state machine; overkill para um grafo pequeno. Rejeitada.

## Decisão

Adotamos a **Opção A**. Estados: `rascunho → em_moderacao → {ativo | aguardando_ajustes | rejeitado}`; pós-`ativo`: `pausado`, `expirado` (só vaga), `arquivado`; editar conteúdo ativo → `rascunho` (re-moderação). A **tabela de transições** declara, por par, se é permitida, se exige motivo e quais efeitos dispara. `transitionContent` é a **única** via de mudança de status, roda em transação com auditoria, e a fila de moderação **exclui itens cujo autor é o moderador** (USP-016/P-005). Re-aprovação **preserva `published_at` original** (USP-023/P-001).

## Consequências

**Positivas:**
- Transições inválidas impossíveis; motivo e auditoria garantidos; anti-manipulação de ranking embutido.
- Verificação de Empresa na 1ª vaga (USP-017) acoplada atomicamente à aprovação (USP-020/P-001).

**Negativas (trade-offs aceitos):**
- Toda evolução de fluxo passa por editar a tabela de transições — centralização proposital.

**Neutras / a monitorar:**
- MP10 (tempo médio de moderação) instrumentado a partir dos timestamps de transição.

## Referências

- ADR-0015 (negócio), ADR-0023 (auditoria), ADR-0020 (transação/outbox), `runbook-moderation-transition`.
- USPs servidas: USP-009, USP-015, USP-016, USP-017, USP-018, USP-020, USP-021, USP-022, USP-023, USP-029, USP-030, USP-031, USP-032.
