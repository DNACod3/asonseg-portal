# USP-042 — Relatórios operacionais do Portal (Spec)

> **ICE mode — thin adapter.** Resolves the connection-matrix card of USP-042 and **indexes** the ICE
> artifacts as source of truth. Requirement IDs **are** the ICE IDs (`E-NNN`/`P-NNN`) plus the epic ACs
> (`AC-042-N`). Nothing outside the card enters (anti-fabrication rule).

**Sizing:** **Large** (hard floor — ICED **and** carries must-nots `P-001..P-008`; multi-component: 5 relatórios + CSV + PDF + RBAC + auditoria de export).
**Módulo dono:** `reporting` (estende a camada `domain`/`queries` fundada pela USP-041).
**Épico:** 11. **Fase:** 6 (ROADMAP).

## Source-of-truth pointers (resolved from the matrix card)

| Card pointer | Resolves to |
|---|---|
| Intent | `docs/IDSD/ice-portal-asonseg/intents/intent-USP-042.md` |
| Expectations (the SPEC) | `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-042.md` (E-001..E-005, P-001..P-008, L-001..L-004, D-001..D-008) |
| PRD story + ACs | `docs/prd/prd-asonseg-portal-mvp.md` USP-042 (AC-042-1, AC-042-2) + §4 Métricas (MP1–MP10) |
| Epic spec | `.specs/features/indicadores-relatorios/spec.md` (P1 — Relatórios; AC 1..9) |
| Schemas | queries agregadas sobre todas as entidades operacionais; `audit_log` (export) (TD §4.5) |
| Endpoints | `reporting.relatorio`, `reporting.exportar` (CSV/PDF) (TD §4.4) |
| Eventos | **`REPORT_EXPORTED`** (audit, com escopo de PII) (TD §4.6) — **ausente do catálogo hoje → adicionar** |
| Runbooks | `runbook-view-model-visibility`, `runbook-search-pagination` (pré-agregação), `runbook-audit-log` |
| ADRs técnicos | ADR-0022 (ficha social fora dos relatórios do coordenador), ADR-0023 (export auditado), ADR-0017 (visibilidade por papel), ADR-0008 (retenção) |

## Requirements (ICE IDs — the testable contract)

| ID | Requirement (from expectations-USP-042) | MP / AC |
|---|---|---|
| **E-001** | Usuário autorizado (coordenador→escopo da própria área; diretoria→geral; AS→relatórios sociais) acessa relatório com lista **filtrável por período, status e categoria** — respeitando visibilidade por papel. | AC-042-1/3/4/5/6/7 |
| **E-002** | Exportação **CSV** (≤ 10s p95, janela mensal) e **PDF** (≤ 20s p95), com **cabeçalho/watermark** "Dados pessoais — uso restrito conforme LGPD" em qualquer exportação com PII. | AC-042-2/8/9 |
| **E-003** | **Log imutável** de cada export (quem, qual relatório, quais filtros, data/hora, escopo de PII). | — |
| **E-004** | Todo relatório de encaminhamentos (MP9) exibe a **taxa de "sem resultado registrado" lado a lado** com a taxa de sucesso. | AC-042-6 |
| **E-005** | Janela longa (> 1 ano) usa **pré-agregação ou paginação** — sem travar a UI. Resolvido: pré-agregação; **sem recusa de janela no MVP** (volume baixo), limite tunável. | — |

**Report set (D-005/QP-005 resolvido como spec assumption — ver design.md §Assumptions):**

| Relatório | Métrica(s) | Filtros | Fonte |
|---|---|---|---|
| R1 Vagas | MP4 | período, status | `jobs` (Job.status, publishedAt/createdAt) |
| R2 Candidaturas | MP6 | período | `jobs` (Application.appliedAt) |
| R3 Serviços + Manifestações | MP5, MP7 | período, categoria | `services` (Service.status/categoryId; ServiceInterest.interestedAt) |
| R4 Encaminhamentos | MP8, MP9 | período | `referrals` (Referral.createdAt/result) |
| R5 Fila de moderação | MP10, MP3 | período | `audit_log` (submit→decisão); prestadores ativos |
| R6 Social por região (AS/BOARD) | — (ficha social) | região | `persons` (SocioeconomicRecord) — **PII sensível, escopo AS/BOARD** |

## Must-nots (first-class negative ACs — each owned by a task with a green negative test)

| ID | Prohibition (expectations P-NNN + pipeline privacy floor) | Anchor |
|---|---|---|
| **REL42-MN-01** | **NÃO PODE** gerar export com PII **sem** watermark/cabeçalho "Dados pessoais — uso restrito conforme LGPD". | P-001 (F1), E-002 |
| **REL42-MN-02** | **NÃO PODE** permitir acesso ao **relatório de fila de moderação** (R5) por usuário sem permissão `MODERATE_JOB`/`MODERATE_CV`/`MODERATE_SERVICE` (ou coordenador/diretoria). Rascunho não vaza para voluntário sem permissão. | P-006 (F6); pipeline (b) |
| **REL42-MN-03** | **NÃO PODE** servir qualquer relatório/exportação operacional a anônimo/usuário não autorizado — nega, **sem gerar dados nem arquivo**. | E-001 AC-042-2; pipeline (b) |
| **REL42-MN-04** | **NÃO PODE** exibir a taxa de sucesso de encaminhamento (MP9) **sem** exibir simultaneamente a taxa de "sem resultado registrado". | P-004 (F4), E-004 |
| **REL42-MN-05** | **NÃO PODE** incluir ficha social (USP-036) em relatório disponível ao **coordenador** — só AS/BOARD têm relatório com dado sensível social; coordenador recebe versão **stripped** (campos sensíveis nem SELECIONADOS nem serializados). | P-007 (F6), ADR-0022; pipeline (c) |
| **REL42-MN-06** | **NÃO PODE** exportar PII sem o usuário ter aceito, no momento do export, a **ciência de responsabilidade** (checkbox LGPD) — registrado. | P-008 |
| **REL42-MN-07** | **NÃO PODE** concluir um export **sem** registrar `REPORT_EXPORTED` no log append-only (quem/relatório/filtros/escopo PII). Falha do audit ⇒ rollback do export. | E-003, L-002, ADR-0023 |

> **P-002 (sem DPO → só relatórios agregados)** e **P-005 (janela longa síncrona)** — ver design.md §Assumptions:
> P-002 é **gate de go-live (B-001)**, não de dev (relatórios PII construídos, produção condicionada ao sign-off do DPO);
> P-005 é **restrição de design** (queries agregadas + `take`/paginação; sem recusa de janela no MVP), não teste negativo.

## Limits

- **L-001:** CSV mensal ≤ 10s p95; PDF ≤ 20s p95 (RNF 6.1).
- **L-002:** cada export em log imutável (ADR-0008/0023).
- **L-003:** visibilidade por papel — coordenador (própria área) / diretoria (geral) / AS (social).
- **L-004:** retenção indefinida para dados históricos (ADR-0008).

## Edge cases (from epic spec)

- Período sem dados → lista vazia; export CSV/PDF **só com cabeçalhos**, sem erro.
- CSV > 10s / PDF > 20s → registrar desvio de performance (monitoramento).
- Não autorizado tenta exportar → nega, **não gera arquivo** (REL42-MN-03).
- MP9 sem resultados registrados → tratar ausência sem percentual indevido ("—" ou 0), com a taxa "sem resultado" (E-004).

## Independent Test (do ponto de vista do dono)

Autenticar como coordenador → acessar R1..R5, aplicar filtros período/status/categoria, ver listas filtradas;
exportar janela mensal em CSV e PDF (validar conteúdo + watermark + tempos); tentar como voluntário sem
permissão → negado (R5 e export); diretoria vê MP9 com "sem resultado registrado" ao lado (D-004); AS vê R6
social por região, coordenador vê R6 **sem** os dados sensíveis (D-007).

## Requirement Traceability

| ID | Owning task(s) | Test type |
|---|---|---|
| E-001 | T1 (RBAC guards), T3–T7 (queries), T11 (páginas) | unit + integration + e2e |
| E-002 | T8 (CSV), T9 (PDF), T10 (export action) | unit + integration |
| E-003 / REL42-MN-07 | T2 (evento), T10 (withAudit) | integration |
| E-004 / REL42-MN-04 | T6 (referral outcome rates) | unit + integration |
| E-005 | T3–T7 (agregados + `take`) | integration |
| REL42-MN-01 | T8 (CSV watermark), T9 (PDF), T10 | unit + integration |
| REL42-MN-02 | T1 (fila gate), T7 (R5), T11 | integration + page |
| REL42-MN-03 | T1, T10, T11 | integration + page |
| REL42-MN-05 | T1 (social guard), T5 (social view), T11 | integration + page |
| REL42-MN-06 | T10 (ciência checkbox) | integration |
