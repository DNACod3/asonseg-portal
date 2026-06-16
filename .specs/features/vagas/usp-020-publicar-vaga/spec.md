# USP-020 — Publicar vaga — Spec

> **Modo ICE (thin adapter).** Esta spec NÃO re-deriva requisitos. Ela RESOLVE o card
> da USP-020 na matriz de conexões e aponta para os artefatos ICE que são a fonte da verdade.
> Board: US **#161** (Épico #6 — Vagas) · subtasks **#162–#165** · seq-19 · Fase 2 · Estimate 22h.

## Entrada (card da matriz)

`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → **USP-020 — Publicar vaga**

- **Upstream:** USP-012 (Empresa cadastrada), USP-013 (Pessoa é responsável da Empresa), USP-001 (autenticada). ✅ implementados.
- **Downstream:** USP-016/017 (moderar/verificar 1ª vaga), USP-021/022 (descoberta), USP-023 (editar), USP-024 (expiração).
- **ADRs negócio:** ADR-0014, ADR-0015. **ADRs técnicos:** ADR-0024, ADR-0021, ADR-0028, ADR-0020.
- **Runbooks:** runbook-server-action, runbook-moderation-transition, runbook-search-pagination.
- **Schemas (TD §4.5):** `jobs` (validade obrigatória), `companies`, máquina de estados (`ContentStatus`).
- **Endpoint (TD §4.4):** `jobs.publicarVaga` (→ `IN_MODERATION` via `transitionContent`).
- **Evento (TD §4.6):** `CONTENT_SUBMITTED_TO_MODERATION` (audit).
- **Risco:** RP-005 (empresa-fantasma usa vaga como vetor). **Dep:** D-007 (catálogo de áreas).

## Requisitos (fonte da verdade — não copiar, resolver)

A spec real são os arquivos ICE — IDs preservados verbatim:

- **Intent:** `docs/IDSD/ice-portal-asonseg/intents/intent-USP-020.md`
- **Expectations:** `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-020.md`

### Escopo testável que entra NESTA US (#161 / #162–#165)

| ID | Resumo | Em escopo? |
| --- | --- | --- |
| **E-001** | Submeter vaga válida com validade futura → persiste em `IN_MODERATION`, vinculada à Empresa | ✅ sim |
| **E-003** | Salvar rascunho a qualquer momento, sem submeter | ✅ sim |
| **E-004** | Validade ≤ hoje (America/Sao_Paulo) → bloqueia submit, mensagem clara | ✅ sim |
| **E-005 / P-005** | Validade > teto (**180 dias**, tunável) → bloqueia submit | ✅ sim |
| **P-006** | Só Pessoa-responsável **ativa** da Empresa pode publicar; bypass negado por gate | ✅ sim |
| **P-003** | Dedup **exata** (título + Empresa + área) → UNIQUE → 409/`CONFLICT` (ADR-0021) | ✅ sim |
| **L-003** | Campos obrigatórios: título, área, descrição, requisitos, regime, local, validade | ✅ sim |
| **L-004** | Log imutável da submissão (`withAudit`) | ✅ sim |
| **E-002 / P-001** | 1ª vaga de Empresa não-verificada arrasta verificação na **aprovação** | ⛔ USP-016/017 (hook stub) |
| **P-002 / P-007** | Filtro on-read (só `ACTIVE` + validade ≥ hoje + Empresa verificada) na busca | ⛔ USP-021/024 |
| **P-004** | Checklist legal na moderação | ⛔ USP-016 + gate Fase 0 |

> A fronteira da US: **rascunho + submissão à moderação + formulário**. Toda visibilidade,
> aprovação e verificação de Empresa é downstream. USP-020 só leva a vaga até `IN_MODERATION`.

## Gates / Q-abertas herdadas (não bloqueiam dev nem merge)

- **D-001 (BLOQUEANTE para produção):** catálogo D-007 (áreas) fechado + checklist legal validada.
  Status: `JobArea` (taxonomia US #111) já existe no schema; conteúdo do catálogo é gate operacional de release.
- **P-004 (checklist legal):** entregável de Fase 0 (coordenador + jurídico) — pré-produção, não pré-merge.

## Definition of Done (US #161)

- [ ] E-001, E-003, E-004, E-005, P-003, P-006, L-003, L-004 cobertos por testes (facts do skill-tdad).
- [ ] Subtasks #162–#165 fechadas e PRs merged (squash).
- [ ] Sem regressão em `npm run typecheck` / `lint` / testes.
