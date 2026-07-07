# USP-017 — Validar Empresa na primeira vaga publicada — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **11h** (= 6+5) — já no
> board (#155=11h, #156=6h, #157=5h). Tests vêm de [`tests/`](./tests/) (skill-tdad, RED). Issue #155.

## Grafo de dependências

```
#156 (backend: schema + hook real + rejeição + P-005) ──▶ #157 (UI: painel + checklist + histórico + diff)
```

Cadeia linear: #157 consome os campos novos da Company (`verifiedAt/By/JobId/Snapshot`, `rejectionCount`)
e a flag `companyUnverified` já populada. #156 fecha → cascade desbloqueia #157 (OpenWolf regra 5).

**Upstream (✅ pronto):** USP-016 (`transitionContent` + hook cabeado, `transition-content.ts:106-113`),
USP-020 (jobs em moderação), USP-012 (Empresa não verificada). Entry gate de DEV: **aberto**
(P-001 mecanismo RESOLVIDO; D-001 conteúdo da checklist é gate só de PRODUÇÃO).

---

## T1 — #156 · feat(moderation): verificar Empresa na aprovação da 1ª vaga (side effect) · 6h · Backlog→In Progress

- **What:** migração Prisma com os campos de verificação/snapshot/contador na `Company`; adapter real
  `PrismaCompanyVerifyHook` (substitui o stub); detecção "1ª vaga" via `isVerified=false`; marcação +
  snapshot dos dados vigentes + `COMPANY_VERIFIED` dentro do `tx` de ativação; incremento de
  `rejectionCount` no caminho de rejeição; guard P-005.
- **Where:**
  - `prisma/schema.prisma` (model Company: `verifiedAt`, `verifiedByPersonId`, `verificationJobId`, `verifiedSnapshot Json`, `rejectionCount`) + migração.
  - `src/modules/moderation/adapters/prisma-company-verify-hook.ts` (novo, substitui `stub-company-verify-hook.ts`).
  - `src/modules/moderation/ports/company-verify-hook.port.ts` (estender com `onContentRejected` se AD-5 exigir).
  - `src/modules/moderation/actions/transition-content.ts` (acionar hook também no caminho `REJECTED`, se AD-5).
  - `src/shared/container.ts` (trocar binding `COMPANY_VERIFY_HOOK_TOKEN`: Stub → Prisma).
  - `src/modules/companies/domain/` (regra pura de montagem do snapshot) + barrel.
  - `src/modules/moderation/__tests__/company-verify-hook.int.test.ts`, `.../transition-content.int.test.ts`, `src/modules/companies/__tests__/no-external-verify.test.ts`.
- **Depends on:** USP-016 (#122/#123 ✅). **Reuses:** `withAudit` + `AuditEvent.COMPANY_VERIFIED` (`@/modules/audit`, já existe `events.ts:46`), `transitionContent` hook (já cabeado), Prisma singleton.
- **Done when:**
  - [ ] Migração adiciona os 5 campos; `isVerified` reusado como estado de "1ª vaga" (sem contagem de jobs — AD-2).
  - [ ] `onContentActivated`: se `JOB` e `company.isVerified=false` → set `isVerified=true`, `verifiedAt=now`, `verifiedByPersonId=actor`, `verificationJobId=contentId`, `verifiedSnapshot` lido **dentro do tx** (P-004/AD-4); emite `COMPANY_VERIFIED` no mesmo `withAudit` que ativa a vaga (E-002/ADR-0024).
  - [ ] Idempotência: Empresa já verificada → no-op (não regrava, não re-emite — E-004/AD-2).
  - [ ] Rejeição de vaga de Empresa não verificada → `rejectionCount += 1`, mantém `isVerified=false`, `CONTENT_REJECTED` com motivo (E-003/AD-5).
  - [ ] **P-005:** nenhum action de `companies` expõe set de `isVerified`; marcação só pelo hook (AD-3). Teste negativo D-004.
  - [ ] Sem `prisma.company.update({isVerified})` fora do hook.
- **Tests:** **integração** — `moderation/__tests__/company-verify-hook.int.test.ts` (E-002 marca+snapshot+evento na mesma tx; P-004 dados vigentes pós-USP-015; E-004 idempotência); `transition-content.int.test.ts` (E-003 rejectionCount++); `companies/__tests__/no-external-verify.test.ts` (P-005/D-004 bypass). Fonte RED: [`tests/unit/usp-017-…spec.ts`](./tests/unit/usp-017-validar-empresa-primeira-vaga.spec.ts) bloco `#156` + [`tests/bdd`](./tests/bdd/usp-017-validar-empresa-primeira-vaga.feature) `@ac-017-2/-3/-4/p005`.
- **TestGate:** `npm run typecheck` ✓ · `npm run lint` ✓ · integração verde (precisa Postgres local — `supabase start`).

## T2 — #157 · feat(moderation): UI de verificação da Empresa na 1ª vaga · 5h · Backlog (bloqueada por #156)

- **What:** popular `companyUnverified` na query da fila; View Model dos dados da Empresa para o moderador;
  painel de destaque + banner (E-001); checklist interativa com bloqueio de aprovação (P-001); separação
  visual verificação ↔ decisão (P-002); histórico de rejeições (P-003/D-005); diff de campos editados
  (D-006); estado "verificada em DD/MM por X" para Empresa já verificada (E-004).
- **Where:**
  - `src/modules/moderation/queries/moderation-queue.ts` (join jobs→companies, popular `companyUnverified`).
  - `src/modules/companies/views/` (View Model dos dados da Empresa + diff vs snapshot).
  - `src/modules/companies/queries/` (histórico de rejeições a partir do `audit_log`).
  - `src/modules/moderation/components/verification-panel.tsx` (novo) + integração em `moderation-queue.tsx`/`decision-dialog.tsx`.
  - `src/modules/moderation/components/__tests__/verification-panel.test.tsx`, `companies/queries/__tests__/rejection-history.*`.
- **Depends on:** **#156** (campos da Company + flag populada). **Reuses:** shadcn/ui, padrão de View Model (CLAUDE.md), `viewModerationQueue` existente, RHF p/ checklist.
- **Done when:**
  - [ ] Fila popula `companyUnverified = !company.isVerified` (E-001).
  - [ ] Painel exibe CNPJ/razão social/nome fantasia/endereço/contato em destaque + banner de 1ª vaga/edição.
  - [ ] Checklist interativa; aprovar **bloqueado** até todos os itens marcados ou dispensados com motivo (P-001). Itens lidos de fonte configurável (seed Fase 0), não hard-coded (R3).
  - [ ] Bloco "Verificação da Empresa" separado de "Decisão da vaga", confirmações conscientes distintas (P-002/AD-6).
  - [ ] Histórico de rejeições (quantas/quando/quem/motivos) visível; badge "rejeitada N vezes" (P-003/D-005).
  - [ ] Empresa já verificada → sem painel, só "Empresa verificada em DD/MM/AAAA por Nome" (E-004).
  - [ ] Painel destaca campos alterados desde o snapshot anterior (D-006).
  - [ ] View Model controla visibilidade (sem Prisma direto na UI).
- **Tests:** **unit/RTL** — `moderation/components/__tests__/verification-panel.test.tsx` (E-001 painel+banner+checklist; P-001 bloqueio; P-002 separação; D-006 diff; E-004 estado verificado); `companies/queries/__tests__/rejection-history.*` (P-003/D-005). Fonte RED: [`tests/unit`](./tests/unit/usp-017-validar-empresa-primeira-vaga.spec.ts) bloco `#157` + [`tests/bdd`](./tests/bdd/usp-017-validar-empresa-primeira-vaga.feature) `@ac-017-1/p001/p002/p003/d006/-4`.
- **TestGate:** `npm run typecheck` ✓ · `npm run lint` ✓ · unit verde · (E2E L-001 fica em verificação pós-merge).

---

> **Estado (Fase 2 — restyle):** T1 (#156 backend) e T2 (#157 UI) já estão **implementadas e merged em
> `master`**. Nesta rodada são o **baseline de comportamento a preservar** (gate de não-regressão: suítes
> `moderation/**/__tests__/` + `companies/**/__tests__/`). O trabalho novo é **T3** (adoção do Design System
> no `VerificationPanel`), padrão AD-015.

## T3 — refactor(moderation): restyle do VerificationPanel ao Design System (AD-014) · restyle · Ready

- **What:** substituir paleta crua Tailwind e o `<input>` de texto nativo por tokens/`color-mix` e o
  primitivo `<Input>` em `verification-panel.tsx`, **preservando 100% do comportamento** (gating da
  checklist P-001, separação P-002, histórico P-003, diff D-006, estado verificado E-004,
  `onReadinessChange`). Ver mapeamento em `design.md` §8.2.
- **Where:**
  - `src/modules/moderation/components/verification-panel.tsx` (banner, `<dl>`, histórico, checklist, input→`Input`, cores→tokens/`color-mix`).
  - `src/shared/__tests__/ds-moderation-parity.test.ts` (**estender** o guard da USP-016 para incluir este arquivo; criar se ainda não existir).
- **Depends on:** Fundação DS (AD-014 ✅) + baseline T1/T2 ✅. Idealmente após o T4 da USP-016 (guard já
  existente). **Reuses:** `Input` de `@/shared/ui`; padrão de tint `color-mix` do `Badge`/`StepIcon`;
  `accent-primary` do `LgpdCheck`.
- **Done when:**
  - [ ] DS-17-01: painel usa tokens/primitivos; paridade light/dark via `[data-theme]` (verificar nos dois temas: banner âmbar→`cta`, verde→`success`, vermelho→`danger`).
  - [ ] DS-17-MN-1: guard `ds-moderation-parity` verde para `verification-panel.tsx` (zero paleta crua/hex).
  - [ ] DS-17-MN-2: comportamento intacto — `components/__tests__/verification-panel.test.tsx` **verde sem alterar asserções de comportamento** (gating/diff/E-004/`onReadinessChange` preservados).
  - [ ] DS-17-MN-3: sem `dark:`/`prefers-color-scheme`/lib de tema.
  - [ ] Nenhum arquivo de backend (`adapters/`, `actions/`, `ports/`, `companies/**`, `schema.prisma`, `container.ts`) nem `domain/verification-checklist.ts`/`queries/list-verification-checklist.ts` tocado (invariante §8.1).
- **Tests:** **guard estático** `ds-moderation-parity.test.ts` (DS-17-MN-1) · **RTL de regressão**
  `verification-panel.test.tsx` verde (DS-17-MN-2). (skill-tdad materializa o guard RED antes do restyle.)
- **TestGate:** `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` verde (guard + RTL) · 1 commit atômico.

## Notas de gate / riscos (do design)

- **R1 (P-004):** snapshot DEVE ler a Company dentro do `tx` (não objeto pré-submit) — teste de integração simula edição USP-015 entre submit e moderação.
- **R2 (rejeição):** confirmar em #156 se o hook dispara só em `ACTIVE`; estender p/ `REJECTED` (AD-5).
- **R3 (D-001):** itens da checklist de fonte configurável (seed) — evita redeploy no go-live. ⛔ Conteúdo da checklist é **gate de produção** (sponsor+coord+PO por escrito), não bloqueia merge.
