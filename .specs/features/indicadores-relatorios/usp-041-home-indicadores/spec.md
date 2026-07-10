# USP-041 — Home pública com indicadores em tempo real (Spec)

> **ICE mode — thin adapter.** This spec does **not** re-derive requirements. It resolves the
> connection-matrix card of USP-041 (`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` §2) and
> **indexes** the ICE artifacts as the source of truth. Requirement IDs **are** the ICE IDs
> (`E-NNN`/`P-NNN`) plus the epic ACs (`AC-041-N`). Anything not reachable from the card does not
> enter (anti-fabrication rule).

**Sizing:** **Large** (hard floor — USP is ICED **and** carries must-nots `P-001..P-005`). Design + Tasks mandatory.
**Módulo dono:** `reporting` (greenfield within the module — only the LGPD art.19 access-report exists today).
**Épico:** 11 — Indicadores e Relatórios. **Fase:** 6 (ROADMAP) / TD §5 lists it under Fase 3 build order — reconciled to Fase 6 per ROADMAP.

## Source-of-truth pointers (resolved from the matrix card)

| Card pointer | Resolves to |
|---|---|
| Intent | `docs/IDSD/ice-portal-asonseg/intents/intent-USP-041.md` |
| Expectations (the SPEC) | `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-041.md` (E-001..E-003, P-001..P-005, L-001..L-003, D-001..D-005) |
| PRD story + ACs | `docs/prd/prd-asonseg-portal-mvp.md` USP-041 (AC-041-1, AC-041-2) + §4 Métricas (MP1, MP2, MP4) |
| Epic spec | `.specs/features/indicadores-relatorios/spec.md` (P1 — Home) |
| Schemas | agregados sobre `jobs`/`persons`(candidate)/`companies` — sem PII (TD §4.5) |
| Endpoint | `reporting.indicadoresHome` — ISR + cache TTL 600s + revalidação on-demand (TD §4.4) |
| Eventos | — (leitura; nenhum evento de auditoria — indicadores são agregados não-sensíveis) |
| Runbooks | `runbook-view-model-visibility` (só agregados), `runbook-search-pagination` |
| ADRs técnicos | ADR-0022 (sem PII), ADR-0026 (consistência on-read), ADR-0019 (ISR/CDN), ADR-0010 (custo mínimo), ADR-0017 (indicadores agregados) |

## Problem / Intent (indexed, not restated)

Visitante anônimo abre a home e vê a atividade real do portal — **vagas ativas, candidatos ativos,
empresas verificadas** — como sinal social de tração e argumento de credibilidade institucional.
Indicadores são **agregados, sem PII** (ADR-0017). Ver `intent-USP-041.md` §1.

## Requirements (ICE IDs — the testable contract)

| ID | Requirement (from expectations-USP-041) | MP | Maps to epic AC |
|---|---|---|---|
| **E-001** | Home exibe: total de vagas `ACTIVE`, total de candidatos com perfil `ACTIVE`, total de Empresas verificadas — **apenas contagens agregadas, sem PII**. | MP4, MP1, MP2 | AC-041-1/2/3 |
| **E-002** | Indicadores atualizados com cache curto (janela do Arquiteto), p95 ≤ 1.5s mesmo em pico (RNF 6.1 + RP-009). Resolvido (D-012): **ISR TTL 600s + revalidação on-demand**. | — | AC-041-4 |
| **E-003** | WHERE um indicador está abaixo do limiar mínimo configurável (cold start), exibir **"Em breve"** em vez do número. Resolvido: **N = 5** (contadores < 5 → "Em breve"), tunável. | — | (F1) |

## Must-nots (first-class negative ACs — each owned by a task with a green negative test)

| ID | Prohibition (from expectations P-NNN + pipeline privacy floor) | Anchor |
|---|---|---|
| **REL41-MN-01** | A home **NÃO PODE** expor qualquer PII direta (nome de candidato, empresa individualizada, linha de pessoa) — só contagens agregadas. Nenhuma linha/nome/identificador de pessoa/empresa pode alcançar o payload RSC/Flight. | P-005, ADR-0017; pipeline (a) |
| **REL41-MN-02** | O sistema **NÃO PODE** exibir `0`/número cru quando o indicador está `< N` (=5) no cold start — deve exibir "Em breve" (política de exibição mínima da diretoria). | P-001 (F1), E-003 |
| **REL41-MN-03** | A home **NÃO PODE** manter TTL de cache dos indicadores **> a janela acordada (600s)**. `export const revalidate` da home ≤ 600. | P-002 (F2), P-003 (F3) |

> **P-004 (contraindicadores da diretoria)** — governança de "Empresas verificadas" (acompanhar MP10 +
> taxa de reprovação da verificação) é **entregue por USP-042** (relatório de fila de moderação +
> verificação), não pela home pública. Cross-USP; sem teste negativo em 041. Ver design.md §Assumptions.

## Limits

- **L-001 (Performance):** home ≤ 1.5s p95 (RNF 6.1).
- **L-002 (Cache TTL):** ≤ janela do Arquiteto = **600s** (D-012).
- **L-003 (Cache/CDN):** ISR Vercel (ADR-0019) — sem CDN paga no MVP.

## Edge cases (from epic spec)

- Baseline 0 (nenhuma vaga/candidato/empresa) → indicadores exibem "Em breve" (E-003/REL41-MN-02), **sem erro**.
- Query de indicadores falha / cache indisponível → home permanece carregável (fallback), **sem quebrar a página** (ADR-0026 tolerância on-read).

## Independent Test (do ponto de vista do dono)

Acessar a home como anônimo (sem sessão) → os 3 indicadores aparecem com valores coerentes com o banco
(ou "Em breve" quando `< 5`); aprovar uma nova vaga (USP-016) e confirmar que o contador atualiza após a
revalidação; a home carrega em ≤ 1.5s p95 (D-002/D-005 dos expectations).

## Out of scope (indexed)

- Metas absolutas MP1–MP10 (QP-007/D-004 — não confirmadas com sponsor) → **home mostra valor corrente, não progresso-vs-meta**. Ver design.md.
- Dashboard embutido no site institucional, SEO técnico avançado → V2 (epic spec Out of Scope).

## Requirement Traceability

| ID | Owning task(s) | Test type |
|---|---|---|
| E-001 | T2 (query), T4 (component), T5 (page) | integration + component + e2e |
| E-002 | T5 (page ISR), T6 (revalidação on-demand), T3 (guard TTL) | static guard + integration |
| E-003 | T1 (threshold rule), T4 (component) | unit + component |
| REL41-MN-01 | T2, T4, T5 | integration/component (no-PII) |
| REL41-MN-02 | T1, T4 | unit + component (negative) |
| REL41-MN-03 | T3 | static guard (negative) |
