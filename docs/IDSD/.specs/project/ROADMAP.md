# ROADMAP — ASONSEG Portal MVP

> Mapa de épicos, prioridade MoSCoW e fases. Status `pending` é a baseline desta rodada do SPEC Driven (apenas USP-004 entra em pipeline neste ciclo). Fonte da verdade: `IDSD/prd/prd-asonseg-portal-mvp.md §5.1` e `§MoSCoW (linha 946)`.

## Épicos e USPs

| # | Épico | USPs | MoSCoW | Status | Bloqueadores principais |
|---|-------|------|--------|--------|--------------------------|
| 1  | Identidade, Acesso e Papéis           | USP-001 a 008          | Must    | pending | DEC-002 (termos), DEC-011 (verif. identidade) |
| 2  | Cadastros Públicos                    | USP-009 a 012          | Must    | pending | DEC-002 (termo finalidade 7 para CV) |
| 3  | Gestão de Vínculos Pessoa-Empresa     | USP-013 a 015          | Must    | pending | DEC-002 (termo finalidade 5) |
| 4  | Moderação de Conteúdo                 | USP-016 a 018          | Must    | pending | DEC-018/019/020 (checklists) |
| 4b | Sugestão de categoria (Should)        | USP-019                | Should  | pending | DEC-022 (catálogo) |
| 5  | Vagas                                 | USP-020 a 024          | Must    | pending | DEC-019, DEC-022 |
| 6  | Candidaturas e Busca de Candidatos    | USP-025 a 028          | Must    | pending | DEC-004 (termo responsabilidade Empresa) |
| 7  | Serviços                              | USP-029 a 032          | Must    | pending | DEC-020, DEC-022 |
| 8  | Manifestação de Interesse em Serviço  | USP-033, 035           | Must    | pending | DEC-002 (termo finalidade 4) |
| 8b | Cancelamento de manifestação (Should) | USP-034                | Should  | pending | — |
| 9  | Ficha Social, Encaminhamento, Visão Consolidada | USP-036 a 039 | Should  | pending | DEC-008 (termo finalidade 6), DEC-025 (treinamento) |
| 10 | Extração de CV via IA Generativa      | USP-040                | Should  | pending | DEC-003 + DEC-008 (ZDR + provedor) |
| 11 | Indicadores e Relatórios              | USP-041, 042           | Should  | pending | DEC-023 (lista prioritária) |
| 12 | Conformidade LGPD (Consentimentos)    | USP-043                | Must    | pending | DEC-002, DEC-015, DEC-016 |
| 13 | Notificações por E-mail               | USP-044                | Must    | pending | DEC-017 (revisão DPO templates) |

## Fases e Marcos

Detalhes em `IDSD/architecture/architecture-document.md §8` e `IDSD/architecture/pending-decisions.md (sumário por fase)`.

### Fase 0 — Preparação (Semanas 1–2)
Resolver dependências críticas: DEC-001 (DPO ✅ Angélica), DEC-002 (termos), DEC-006 (catálogo permissões), DEC-007 (catálogo áreas/categorias), DEC-008 (ZDR), DEC-011 (verificação identidade), DEC-012 (retenção `auth_attempts`). Onboarding do time + setup de ambientes (GitHub, Vercel, Supabase sa-east-1).

### Fase 1 — Fundação (Semanas 3–8)
Épicos **1, 2, 12, 13** — Identity (USP-001 a 008), Cadastros Públicos (USP-009 a 012), Consentimentos LGPD (USP-043), Notificações (USP-044). Entrega: Pessoa unificada com papéis compostos, consentimentos append-only por finalidade, auditoria imutável, base de e-mails.
**Gate de saída:** aprovação jurídica dos 8 termos (DEC-011).

### Fase 2 — Operação Público-Privada (Semanas 9–16)
Épicos **3, 4, 5, 6, 7, 8** — Empresa, Moderação, Vagas, Candidaturas, Serviços, Manifestações. Entrega: portal completo de empregabilidade com moderação humana, home pública com indicadores em tempo real (ISR + TTL 600s).
**Gate de saída:** checklists operacionais de moderação aprovados.

### Fase 3 — Social e Inteligência (Semanas 17–24)
Épicos **9, 10, 11** — Ficha socioeconômica, Encaminhamento institucional, Visão consolidada, Extração CV via IA, Relatórios. Entrega: gestão social mínima viável + diferencial ASONSEG (badge de encaminhamento).
**Gate de saída:** aprovação DPO da cascata de revogação (DEC-015) + treinamento de encaminhadores (DEC-025).

### Go-Live (Semana 24+)
Validação das metas absolutas (DEC-024), teste de carga, pentest, treinamento completo da equipe. Lançamento 8h–21h.

## Pipeline SPEC Driven nesta rodada

| USP | Spec | Design | Tasks | Local |
|-----|------|--------|-------|-------|
| **USP-004** Autenticar no portal | ✅ | ✅ | ✅ | `.specs/features/usp-004-autenticar-no-portal/` |
| USP-001 a 003, 005 a 044 | — | — | — | (não nesta rodada) |
