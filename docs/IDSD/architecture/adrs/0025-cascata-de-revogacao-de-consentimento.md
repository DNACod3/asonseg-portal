# ADR-0025 — Cascata de revogação de consentimento por finalidade

- **Status:** Accepted (mecanismo) · D-002 (termos) resolvido em 2026-06-03 · semântica em revisão pela DPO (diretora Angélica) + jurídico — draft em `docs/lgpd/cascata-revogacao-semantica.md`
- **Data:** 2026-05-28 (atualizado 2026-05-29)
- **Decisores:** Arquiteto Bravi, Tech Lead · semântica: DPO diretora Angélica (D-001 resolvido) + jurídico (D-002 resolvido em 2026-06-03)
- **Tags:** LGPD, domínio, data

## Contexto e Problema

O ADR-0013 dá à Pessoa o direito de revogar um consentimento por finalidade, desativando **apenas** o papel/funcionalidade vinculado, sem afetar as outras finalidades. O intent USP-043/F2 marca `(arquitetural-estrutural → vira ADR técnico)`: "a matriz de cascata precisa estar explícita (revogação 2 → cancela candidaturas ativas? Esconde? Mantém histórico mas bloqueia novas?)". Os must-not:

- USP-043/P-002: "NÃO PODE deixar papel/funcionalidade ativa após revogação … sem janela de 'papel ativo mas consentimento revogado'."
- USP-025/P-004, USP-030/P-004, USP-033/P-004: ação bloqueada quando consentimento revogado, **mesmo se o job de invalidação atrasar** (verificação on-read).
- USP-039/P-006: revogação para uso ativo, **mas preserva histórico** com marcação "finalidade revogada em DD/MM/AAAA" (coerente com retenção indefinida — ADR-0008).

Há duas dimensões: o **mecanismo** (como garantir que nenhuma operação ligada a uma finalidade revogada prossiga) — decisão do arquiteto; e a **semântica** (o que exatamente acontece com candidaturas/manifestações já ativas — cancela? esconde? mantém?) — decisão de negócio/DPO.

## Drivers de Decisão

- Zero janela de "papel ativo sem consentimento" (P-002).
- Consistência mesmo com job atrasado → verificação **on-read** obrigatória.
- Preservar histórico (ADR-0008) — revogação desativa uso, não apaga.

## Opções Consideradas (mecanismo)

### Opção A — Matriz finalidade→efeitos declarativa + verificação on-read em cada operação ligada à finalidade
- **Descrição:** Uma `revocation_cascade_matrix` declara, por finalidade, os efeitos (papéis a desativar, conteúdo a pausar, candidaturas a marcar). A revogação roda em transação (ADR-0020): grava o registro de revogação (append-only, ADR-0023) e aplica os efeitos da matriz. **Além disso**, toda operação ligada a uma finalidade verifica o consentimento ativo **no momento da leitura/ação** (`requireActiveConsent`), garantindo consistência mesmo se algum efeito assíncrono atrasar.
- **Prós:** Determinístico; sem janela (on-read fecha o gap); histórico preservado por flag, não por delete.
- **Contras:** `requireActiveConsent` em todos os pontos certos exige disciplina (encapsulada no `runbook-consent-gate`).

### Opção B — Só efeitos no momento da revogação (sem on-read)
- **Contras:** Se um efeito falha/atrasa, abre a janela proibida por P-002. Rejeitada.

## Decisão

Adotamos a **Opção A** para o **mecanismo**: matriz declarativa de cascata + `requireActiveConsent` on-read em toda operação ligada a finalidade + registro de revogação append-only (ADR-0023). A **semântica concreta** de cada finalidade (em especial o destino de candidaturas/manifestações ativas e se a Empresa é notificada) será **definida pela DPO designada (diretora Angélica) + jurídico** (D-001 resolvido; D-002 resolvido em 2026-06-03) **antes da USP-043**, preenchendo a matriz finalidade→efeitos. Um **draft de proposta** dessa matriz está em `docs/lgpd/cascata-revogacao-semantica.md`, aguardando aprovação da DPO + jurídico para virar adendo deste ADR. O owner está confirmado; a arquitetura aceita qualquer semântica que a DPO definir — basta preencher a matriz, sem mudança estrutural.

## Consequências

**Positivas:**
- Garante P-002 (sem janela) por design; on-read é a rede de segurança.
- Histórico preservado com marcação de revogação (USP-039/P-006 + ADR-0008).

**Negativas (trade-offs aceitos):**
- Verificação on-read adiciona uma checagem barata em operações ligadas a finalidade.
- USP-043 (e dependentes) **não vão a produção** até a semântica ser definida pela DPO e os termos aprovados (D-001 resolvido; D-002/termos aprovados em 2026-06-03; resta a definição da semântica — draft em revisão).

**Neutras / a monitorar:**
- A matriz é parametrizável; revisões da semântica não exigem mudança estrutural.

## Referências

- ADR-0013 (negócio), ADR-0008 (negócio — retenção), ADR-0020, ADR-0023, `runbook-consent-gate`.
- Draft da semântica (matriz finalidade→efeitos): `docs/lgpd/cascata-revogacao-semantica.md` · checklist/DPO: `docs/lgpd/checklist-revisao-lgpd.md`, `docs/lgpd/dpo.md`.
- USPs servidas: USP-007, USP-025, USP-026, USP-030, USP-033, USP-034, USP-039, USP-043.
