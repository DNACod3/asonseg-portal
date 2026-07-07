# USP-017 — Validar Empresa na primeira vaga publicada — Spec

> 🧬 **ICE mode — este spec é um ADAPTADOR, não uma re-derivação.** A fonte canônica de requisitos é
> [`intent-USP-017.md`](../../../../docs/IDSD/ice-portal-asonseg/intents/intent-USP-017.md) +
> [`expectations-USP-017.md`](../../../../docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-017.md).
> Entrada única: card USP-017 em [`matriz-conexoes.md`](../../../../docs/IDSD/ice-portal-asonseg/matriz-conexoes.md).
> Nada entra aqui que o card não aponte.

**Issue:** #155 · **Épico:** #233 (Moderação) · **Fase:** 2 · **Prioridade:** P1 (Must) · **Requisito:** MOD-02
**Sub-tasks (PRs):** #156 (side-effect backend) · #157 (UI verificação)

## 0. Refactor context (Fase 2 — restyle preservando comportamento, padrão AD-015)

> ⚠️ **Esta USP já está implementada em `master`** (`PrismaCompanyVerifyHook`, campos de verificação na
> `Company`, `verification-panel.tsx`, View Models e histórico de rejeições). Este ciclo é um **refactor de
> estilo** (adoção do Design System AD-014) + alinhamento a `project-guideline`, **preservando** todos os
> ACs e proibições abaixo — padrão AD-015 (*style-only*, comportamento intacto, consistência documentada).
> Spec/design/tasks descrevem a US "como se nova" (baseline); o Implementer **refatora o código existente**.
>
> **Baseline de comportamento a PRESERVAR (não pode regredir):** atomicidade da verificação dentro do `tx`
> de ativação (`PrismaCompanyVerifyHook.onContentActivated`, ADR-0024/AD-010); snapshot dos dados vigentes
> (`verifiedSnapshot`, P-004); idempotência via `isVerified` (E-004/AD-2); `onContentRejected` +
> `rejectionCount++` (E-003); rota única de marcação `isVerified` (P-005 — guard `no-external-verify`);
> checklist seedável `VerificationChecklistItem` (AD-013/B-004) com fallback; a query
> `viewCompanyVerificationContexts` + histórico (`listCompanyRejectionsByCompany`); os View Models. Prova de
> não-regressão: a suíte `src/modules/moderation/**/__tests__/` + `src/modules/companies/**/__tests__/`
> permanece **verde**.
>
> **O que muda:** só o componente de apresentação `moderation/components/verification-panel.tsx` — hoje em
> paleta crua (`bg-amber-50`, `border-green-200`, `text-red-700`, `<input>`/`<checkbox>` nativos), fora dos
> primitivos/tokens de `@/shared/ui`. A **lógica** do painel (gating da checklist `onReadinessChange`, diff
> `changedSinceVerification`, curto-circuito E-004) permanece intacta.

## 1. História

Como **coordenador** (ou voluntário delegado), quero **verificar os dados da Empresa** (CNPJ, razão
social, endereço) durante a moderação da **primeira vaga** dela — ou de uma Empresa que voltou a
"não verificada" por edição identitária (USP-015) — para **evitar empresas-fantasma** no portal.

É a **defesa principal contra RP-005** no MVP (consulta automática à Receita está fora de escopo).

## 2. Critérios de aceite (= expectations, IDs canônicos)

| ID | EARS / Proibição | Sub-task |
|---|---|---|
| **E-001** | WHEN o coordenador modera vaga de Empresa "não verificada" → exibir dados da Empresa em destaque + banner "primeira vaga / Empresa editada — verificar manualmente" + **checklist interativa**. | #157 |
| **E-002** | WHEN aprova a vaga → marcar Empresa "verificada", registrar log (responsável + data/hora + ref. à vaga) e **snapshot** dos dados da Empresa no instante da verificação. Na MESMA operação que ativa a vaga (efeito colateral de `transitionContent`). | #156 |
| **E-003** | IF coordenador identifica inconsistência → permitir **rejeitar** a vaga com motivo obrigatório, **incrementar contador de rejeições** da Empresa, manter "não verificada", registrar log. | #156 (+#157 motivo) |
| **E-004** | WHEN modera vaga subsequente de Empresa **já verificada** → moderar só o conteúdo, sem painel de verificação; exibir apenas "Empresa verificada em DD/MM/AAAA por NomeCoordenador". | #156 + #157 |
| **P-001** | NÃO PODE aprovar vaga de Empresa "não verificada" sem a checklist ter sido **apresentada e seus itens marcados** (ou dispensados com motivo). *Mecanismo RESOLVIDO; conteúdo dos itens = entregável Fase 0.* | #157 |
| **P-002** | NÃO PODE apresentar aprovação-da-vaga e verificação-da-Empresa como decisão única indistinguível — separação visual + confirmação consciente de cada uma. | #157 |
| **P-003** | NÃO PODE ocultar do moderador o **histórico de rejeições** da Empresa (quantas, quando, por quem, motivos). | #157 |
| **P-004** | NÃO PODE usar snapshot dos dados do **rascunho**: verificação é sobre os dados **vigentes no momento da moderação** (edição via USP-015 fica visível). | #156 |
| **P-005** | NÃO PODE marcar Empresa "verificada" por **nenhuma rota fora desta USP** (sem admin manual, sem API direta, sem marcação automática). | #156 |

### Requisitos de adoção do Design System (novos nesta rodada de restyle — AD-014/AD-015)

| ID | AC / Proibição (EARS) | Sub-task |
|---|---|---|
| **DS-17-01** | QUANDO o `VerificationPanel` renderiza (banner de 1ª vaga/edição, dados da Empresa, diff D-006, histórico de rejeições, checklist, estado "verificada" E-004) ENTÃO DEVE usar tokens/primitivos de `@/shared/ui` com paridade **light/dark** via `[data-theme]` — sem cor "presa" a um tema. | #157 |
| **DS-17-MN-1** | NÃO PODE reter utilitário de paleta crua (`bg-amber-50`, `border-green-200`, `bg-red-50`, `text-gray-*`, `border-gray-300`, `bg-amber-200`, hex) em `moderation/components/verification-panel.tsx`. | #157 (teste negativo) |
| **DS-17-MN-2** | NÃO PODE alterar comportamento: gating da checklist (P-001), separação verificar↔decidir (P-002), histórico de rejeições (P-003), diff de campos (D-006), curto-circuito de Empresa já verificada (E-004) e o contrato `onReadinessChange` permanecem **idênticos** — só muda o estilo. | #157 (RTL existente verde) |
| **DS-17-MN-3** | NÃO PODE introduzir mecanismo próprio de dark-mode; usar `[data-theme]` + tokens (AD-014). Semânticas de cor: atenção/"verificar" → família `cta` (laranja); sucesso/"verificada" → `success`; rejeição → `danger`. | #157 |

## 3. Limites (NFR)

- **L-001 (Perf):** painel de verificação carrega ≤ 3s p95.
- **L-002 (Auditoria):** snapshot retido por toda a retenção (ADR-0008) — CNPJ, razão social, nome
  fantasia, endereço, contato no instante da verificação.

## 4. Módulos

`src/modules/moderation` (orquestração + hook + UI) · `src/modules/companies` (modelo + verificação +
histórico) · `src/modules/audit` (evento `COMPANY_VERIFIED`).

## 5. Critérios de pronto do dono do intent (UAT)

D-002 (ensaio Empresa-fantasma → rejeita, mantém não verificada, incrementa contador) · D-003 (ensaio
Empresa legítima → aprova, verifica, vaga ativa, MP2 incrementa) · D-004 (bypass: API direta marcando
verificada=true é rejeitada — P-005) · D-005 (histórico de 3 rejeições visível) · D-006 (painel destaca
campos alterados desde a verificação anterior — USP-015).

## 6. ⛔ Gate de PRODUÇÃO (não bloqueia dev)

- **D-001 (BLOQUEANTE DE GO-LIVE):** antes de ir para produção, a **checklist de verificação de Empresa**
  precisa estar validada por escrito (sponsor + coordenador + Bravi PO), integrada e testada com
  voluntários — entregável da **Fase 0** (`seed-taxonomia-checklists`, AC-111-2). Sem conteúdo objetivo
  de checklist, RP-005 fica desprotegido. **Esta USP entra em dev** (mecanismo de checklist P-001 está
  RESOLVIDO); o conteúdo dos itens é seedado depois. Rastrear até o cutover.

## 7. Métricas

- **MP2** — Empresas verificadas (incrementa em E-002).
- Métrica instrumentada (intent §4): nº de Empresas rejeitadas na verificação inicial / nº de tentativas.
