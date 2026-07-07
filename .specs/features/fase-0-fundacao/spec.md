# Fase 0 — Fundação (Especificação unificada)

> **Unidade ad-hoc, NÃO é uma linha do ROADMAP.** Não editar `.specs/project/ROADMAP.md`.
> Fonte de escopo: `ROADMAP.md` §"Fase 0 — Setup e Spikes" (linhas 18-28) — indexada, não restada.
> Projeto já em Fase 2. "Planejar do zero" = derivar a fundação **ideal** dos docs de
> arquitetura, diferenciá-la do código atual (Fase 1 done, Fase 2 quase done) e transformar o
> **gap** em tarefas de refactor/implementação. NÃO reescrever features que funcionam.

## Problem Statement

A fundação do Portal foi construída incrementalmente ao longo das Fases 1-2, então há **deriva
(drift)** entre o que os docs canônicos (`CLAUDE.md`, `docs/arch/project-guideline.md`) prescrevem
e o que o código realmente faz: imports profundos que furam o barrel, uma 4ª pasta em `src/` que
quebra a raiz fechada, seed monolítico, checklist de verificação como constante TS (não seed
configurável → viola "sem redeploy" do B-004), testes-fonte da US-111 nunca escritos, e serviços
externos (Sentry, Anthropic, B2) em estados de provisionamento heterogêneos e não documentados num
único runbook. Esta unidade consolida a **dívida de fundação** de Fase 0 em três workstreams
executáveis.

## Goals

- [ ] **WS-A** — Reconciliar o scaffolding fundacional (`src/shared`, template de módulos, regra
      barrel, raiz `src/` fechada, `prisma/`) com `CLAUDE.md` + `project-guideline.md`; drift
      concreto vira refactor com alvo e guarda estática.
- [ ] **WS-B** — Tornar a US-111 (`seed-taxonomia-checklists`) **implementável agora**: testes-fonte
      RED da taxonomia (AC-111-1) e do checklist (AC-111-2) escritos e verdes, e itens do checklist
      como **dado de seed configurável** (R3 / B-004), não constante hard-coded.
- [ ] **WS-C** — Produzir um **runbook** único de provisionamento externo que reconcilie o estado
      real (present/partial/missing) por serviço com os alvos de Fase 0 e diga, por serviço, o que
      exige ação manual/credencial e como verificar.

## Out of Scope

Excluído explicitamente para evitar creep.

| Item | Motivo |
| ---- | ------ |
| Construir os módulos `services`, `referrals`, `cv-extraction` | São trabalho das USPs donas (USP-029+/033+/040). AD-005/AD-009: "a US que precisa primeiro cria a infra". Scaffolding prematuro colide com as migrations donas. Registrado como assunção A-01. |
| Instalar/configurar `@sentry/nextjs` (SDK + `sentry.*.config.ts`) | Hardening de observabilidade é Fase 6 (transversal). Fase 0 apenas **documenta** o estado no runbook (A-02). |
| Provisionar de fato serviços externos (criar contas, gerar chaves, girar segredos) | Exige credenciais/ação manual que a esteira NÃO executa. WS-C entrega o runbook que descreve o "como", não a execução (A-02/A-05). |
| Reescrever features de Fase 1-2 que funcionam | O mandato é diferenciar contra o ideal e fechar o gap, não reescrever o que passa nos gates. |
| Conteúdo **definitivo** da checklist de empresa-fantasma | É gate de **go-live** (B-004: sponsor + coordenador + PO assinam). Fase 0 entrega o **mecanismo** configurável; o conteúdo é seedado depois sem redeploy (A-04). |
| Lista **final** da taxonomia refinada com a diretoria | D-007 / QP-010 — confirmação pré-go-live. Os facts asseguram não-vazio + idempotente + `is_suggestion=false`; a lista canônica de trabalho é `docs/operacao/taxonomia-inicial.md` (A-08). |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada — nada fica silenciosamente indefinido. Modo autônomo:
resolvidas como assunções de spec.

| # | Assunção / decisão | Owner | Default escolhido | Racional | Confirmed? |
|---|--------------------|-------|-------------------|----------|------------|
| A-01 | Módulos ausentes (`services`, `referrals`, `cv-extraction`) e skeletais (`reporting` sem `queries/domain/components`, `persons` sem `queries/`) **não** são scaffoldados agora | agent | Deferir para as USPs donas; registrar como dívida documentada, não gerar pastas vazias | AD-005/AD-009: a US que precisa cria sua infra; scaffolding prematuro colide com migrations das USPs (ex.: `cv-extraction` = USP-040) | y |
| A-02 | WS-C é **documentação** (runbook). Instalar Sentry SDK e construir `cv-extraction` são downstream | agent | Runbook descreve estado + passos manuais + verificação; não instala nada | Provisionamento exige credencial/ação manual fora da esteira; hardening Sentry é Fase 6, CV é USP-040 | y |
| A-03 | Local do runbook = `docs/infra/fase-0-provisioning-runbook.md` (índice único que cross-linka `docs/infra/*` + `docs/spikes/*`) | agent | Consolidar sobre a árvore `docs/infra/` já existente | `docs/infra/` já tem doc por serviço; o guideline pede `runbooks/` (ausente) — registrado como dívida separada, não bloqueia | y |
| A-04 | Realização de "configurável" do checklist = mover `VERIFICATION_CHECKLIST_ITEMS` para fonte **seedável** (o mecanismo lê do seed) | agent (mecanismo) / **external** (conteúdo assinado) | Modelo/seed configurável lido por port; conteúdo definitivo permanece gate de go-live | B-004: mecanismo + seed configurável é o que se planeja agora; "conteúdo seedado depois sem redeploy" exige dado fora do bundle | y (mecanismo) / **n (conteúdo, external)** |
| A-05 | Credencial commitada em `.env.staging` deve ser **girada**; untrack + guarda estática são dev; a rotação é manual | **external** (Supabase console) | Planejar untrack de `.env.staging` + guarda anti-segredo; runbook documenta a rotação | Achado do audit WS-C: `.env.staging` versionado contém senha de pooler viva | **n (rotação, external)** |
| A-06 | Split do seed monolítico: WS-A faz o **split estrutural** (`prisma/seeds/`), WS-B corrige o **dado** da taxonomia + testes | agent | Sequenciar B (seed/test) após A (split), ou preservar assinatura de `main()` | Evita dupla-titularidade sobre `prisma/seed.ts`; guideline §2 pede `prisma/seeds/` | y |
| A-07 | Mismatches de doc (`docs/adr/` vs `docs/arch/`; carve-out do deep-import do `container.ts`) reconciliados por uma nota/ADR curta, sem churn de código | agent | ADR/nota de conformidade documenta a exceção do DI container e a localização real dos ADRs | O guideline afirma a regra sem carve-out; o container tem trade-off deliberado (evita ciclo barrel→container→barrel) | y |
| A-08 | Fonte de verdade da taxonomia = `docs/operacao/taxonomia-inicial.md` (já existe) | agent / **external** (diretoria refina) | Seed segue esse doc; facts pinam nomes canônicos nos `it.todo` | PRD §11/§3.3, D-007/QP-010: lista inicial vem do protótipo refinada com diretoria (pendente pré-go-live, não bloqueia dev) | y (trabalho) / n (final, external) |

**Open questions:** none — tudo resolvido ou registrado acima.

**Entry-Gate pré-check (para Tasks §0):** nenhum item `external`/`n` acima é uma decisão de que a
**implementação depende**. B-004 (conteúdo), A-08 (lista final), A-05 (rotação) e as chaves reais de
Sentry/Anthropic são todos coisas que o código **contorna** (mecanismo configurável) ou apenas
**documenta** (runbook). Logo **não há STOP de entry gate**; a unidade entra em task breakdown.

---

## User Stories

### P1: WS-A — Reconciliar scaffolding fundacional ⭐ MVP

**User Story**: Como dev do Portal, quero a fundação (`src/shared`, template de módulos, regra
barrel, raiz `src/` fechada, `prisma/`) conforme os docs canônicos e protegida por guardas
estáticas, para que a deriva pare de crescer e o padrão seja executável, não só documental.

**Why P1**: Toda USP futura importa via barrel, respeita a raiz fechada e semeia dados. Drift na
fundação propaga para todas as fases.

**Acceptance Criteria**:

1. WHEN um módulo importa símbolo de outro módulo THEN o sistema SHALL resolver via barrel
   (`@/modules/<x>`), nunca por caminho profundo (`@/modules/<x>/<subpath>`) — corrigidos os 3
   pontos em `persons/components/*form.tsx` que furam para `@/modules/identity/{actions,domain}`.
2. WHEN se lista as pastas de topo de `src/` THEN SHALL existir apenas `app/`, `modules/`,
   `shared/` (mais os arquivos requeridos `middleware.ts`); `src/__tests__/` SHALL ser realocado.
3. WHEN `prisma/seed.ts` é inspecionado THEN dados de **referência** (taxonomia) e dados de **demo**
   SHALL estar separados (estrutura `prisma/seeds/` por guideline §2), sem colidir com WS-B.
4. WHEN `src/shared/lib/supabase/` é inspecionado THEN SHALL existir o client de Storage
   (`supabase-storage.ts`, ADR-0005) ou registro explícito de deferimento com dono.
5. WHEN os mismatches de doc (localização de ADR; deep-import do `container.ts`) são revisados THEN
   SHALL existir uma nota/ADR de conformidade que os concilie (carve-out do DI container documentado).

**Independent Test**: `npm run test` verde nas guardas estáticas novas (barrel, raiz fechada) +
`npm run typecheck`/`npm run build` verdes após os refactors de import.

---

### P1: WS-B — US-111 implementável: seed testado + checklist configurável ⭐ MVP

> **Source-of-truth adapter.** Requisitos canônicos vivem em
> `.specs/features/seed-taxonomia-checklists/spec.md` (US issue #111) e `tests/traceability.md`.
> IDs upstream `US-111`, `AC-111-1`, `AC-111-2` são **canônicos** aqui — não re-derivados. Esta
> spec adiciona só o **delta** (`F0B-*`) para torná-la implementável agora.

**User Story**: Como time de produto/operação, quero a taxonomia inicial semeada e testada de forma
idempotente e o checklist de empresa-fantasma como dado **configurável** (não hard-coded), para que
vagas/serviços e a moderação tenham dados de referência desde já e o conteúdo assinado possa entrar
sem redeploy.

**Why P1**: Destrava o "verde" final do AC-111-1 (facts RED nunca escritos) e materializa a saída do
B-004 (mecanismo + seed configurável) sem esperar o sign-off do conteúdo.

**Acceptance Criteria** (upstream, verbatim + delta):

1. **AC-111-1** (upstream) — WHEN `npm run db:seed` roda THEN `regions`, `job_areas` e
   `service_categories` SHALL ser populadas com os valores iniciais, **idempotente** (re-rodar não
   duplica), com `is_suggestion=false` e regiões ativas. Teste-fonte hoje **inexistente**
   (`prisma/__tests__/` não existe) — escrever `prisma/__tests__/seed.integration.test.ts`.
2. **AC-111-2** (upstream) — WHEN o checklist de empresa-fantasma é necessário THEN SHALL existir
   documento com critérios verificáveis (CNPJ, razão social, endereço, aprovar/rejeitar com motivo).
   Doc `docs/operacao/checklist-empresa-fantasma.md` **já existe** — escrever o teste estrutural
   `tests/docs/checklist-empresa-fantasma.test.ts` que o ancora.
3. **F0B-01** (delta local) — WHEN a moderação apresenta a checklist THEN os itens SHALL vir de uma
   **fonte configurável seedável**, não de constante embutida no bundle; alterar os itens NÃO SHALL
   exigir redeploy. Hoje `src/modules/moderation/domain/verification-checklist.ts` é constante TS
   (4 itens genéricos) desconectada dos 12 critérios do doc — realizar R3/B-004.

**Independent Test**: `npm run test:integration` roda o seed 2× contra banco efêmero sem duplicar;
`npm run test` verifica o doc do checklist e a origem-seed dos itens; demo/refactor de WS-A não quebra.

---

### P2: WS-C — Runbook de provisionamento externo

**User Story**: Como responsável de infra/deploy, quero um runbook único que diga, por serviço
externo, o estado atual (present/partial/missing), o que provisionar manualmente e como verificar,
para que o go-live não descubra lacunas de provisionamento tarde demais.

**Why P2**: Não bloqueia desenvolvimento (B-001/B-003/B-004 bloqueiam go-live, não dev), mas é o
entregável de reconciliação de Fase 0 e o índice de verificação pré-cutover.

**Acceptance Criteria**:

1. **F0C-01** — WHEN o runbook é consultado THEN SHALL conter, por serviço (Vercel, Supabase,
   Resend, Sentry, Turnstile, Anthropic) e por drill/spike (restore B2; spikes Pooler+Prisma,
   Turnstile, Claude CV), uma linha com **estado atual / o que provisionar manualmente / como
   verificar**, cross-linkando os docs já existentes (`docs/infra/*`, `docs/spikes/*`) sem duplicá-los.
2. **F0C-02** — WHEN o repositório é varrido THEN NÃO SHALL conter credencial real versionada;
   `.env.staging` SHALL ser removido do tracking e uma guarda estática anti-segredo SHALL falhar se
   um segredo reaparecer. A **rotação** da credencial vazada é ação manual documentada no runbook.

**Independent Test**: `npm run test` verifica a estrutura do runbook (seções por serviço) e a guarda
anti-segredo; inspeção manual confirma os cross-links.

---

## Edge Cases

- WHEN o seed roda contra um banco que já tem a taxonomia THEN SHALL fazer `upsert` por `name` e não
  criar duplicatas nem alterar `id`s existentes (idempotência — AC-111-1).
- WHEN o split do seed (WS-A) muda a estrutura de arquivos THEN o `db:seed` (`prisma db seed`) SHALL
  continuar apontando para o entrypoint correto (ajustar `prisma.seed` no `package.json`/config).
- WHEN a guarda de barrel encontra o deep-import legítimo do `container.ts` THEN SHALL tratá-lo pela
  exceção documentada (A-07), não como violação — a guarda cobre `src/modules/**`, não o container DI.
- WHEN a guarda anti-segredo roda hoje (antes do untrack) THEN SHALL falhar (RED) por causa de
  `.env.staging` — RED esperado até o untrack + rotação (F0-MN-05).
- WHEN a diretoria ainda não refinou a lista final da taxonomia THEN o seed usa `taxonomia-inicial.md`
  e o teste pina o conjunto atual; o "verde final" do AC-111-1 canônico aguarda D-007/QP-010 (não bloqueia).

---

## Must-Nots (proibições de nível-mundo)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo verde (ver
validate §6b). Dono e teste preenchidos em Tasks.

| ID | WHEN [contexto] THEN o sistema SHALL NOT… | Previne | Owning task | Teste negativo |
| -- | ------------------------------------------ | ------- | ----------- | -------------- |
| F0-MN-01 | WHEN `db:seed` roda 2+ vezes THEN SHALL NOT duplicar linhas em `regions`/`job_areas`/`service_categories` | Taxonomia inflada/duplicada corrompendo filtros de vaga/serviço | B1 | `prisma/__tests__/seed.integration.test.ts::idempotente` |
| F0-MN-02 | WHEN um módulo em `src/modules/**` importa outro módulo THEN SHALL NOT usar caminho profundo `@/modules/<x>/<subpath>` (barrel obrigatório; exceção documentada: `container.ts`) | Acoplamento a internals, quebra de encapsulamento do módulo | A1 | guarda estática `src/__tests__/no-deep-module-imports.test.ts` |
| F0-MN-03 | WHEN se listam pastas de topo de `src/` THEN SHALL NOT existir pasta fora de `app/`/`modules/`/`shared/` sem RFC | Erosão da raiz `src/` fechada | A2 | guarda estática `src/shared/__tests__/closed-src-root.test.ts` |
| F0-MN-04 | WHEN os itens da checklist de verificação são exibidos THEN SHALL NOT estar embutidos no JSX/bundle de forma que trocá-los exija redeploy | Conteúdo assinado (B-004) não poder entrar sem redeploy | B3 | guarda + integração: itens vêm da fonte seedável, não de literal no componente |
| F0-MN-05 | WHEN o repositório é varrido THEN SHALL NOT conter credencial real versionada (`.env.staging` etc.) | Vazamento de segredo de produção/staging | C2 | guarda estática `src/shared/__tests__/no-committed-secrets.test.ts` |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| F0A-01 (barrel) | WS-A | Design | Pending |
| F0A-02 (raiz fechada) | WS-A | Design | Pending |
| F0A-03 (split seed) | WS-A | Design | Pending |
| F0A-04 (storage client) | WS-A | Design | Pending |
| F0A-05 (nota conformidade) | WS-A | Design | Pending |
| US-111 / AC-111-1 (upstream) | WS-B | Design | Pending |
| US-111 / AC-111-2 (upstream) | WS-B | Design | Pending |
| F0B-01 (checklist configurável) | WS-B | Design | Pending |
| F0C-01 (runbook) | WS-C | Design | Pending |
| F0C-02 (guarda segredo) | WS-C | Design | Pending |
| F0-MN-01 (idempotência) | WS-B | Design | Pending |
| F0-MN-02 (barrel) | WS-A | Design | Pending |
| F0-MN-03 (raiz fechada) | WS-A | Design | Pending |
| F0-MN-04 (checklist redeploy) | WS-B | Design | Pending |
| F0-MN-05 (segredos) | WS-C | Design | Pending |

**ID format:** WS-A/WS-C usam `F0A-NN`/`F0C-NN` (locais, novos); WS-B **reusa IDs upstream**
`US-111`/`AC-111-*` como canônicos e só minta `F0B-NN` para o delta. Must-nots: `F0-MN-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 0 mapeados a tasks (mapeamento em tasks.md).

---

## Success Criteria

- [ ] 3 guardas estáticas novas (barrel, raiz fechada, anti-segredo) verdes; `npm run build`,
      `npm run typecheck`, `npm run lint` verdes após os refactors de WS-A.
- [ ] `prisma/__tests__/seed.integration.test.ts` verde: seed popula as 3 tabelas e é idempotente
      (roda 2×, contagem estável).
- [ ] `tests/docs/checklist-empresa-fantasma.test.ts` verde ancorando o doc existente.
- [ ] Itens do checklist lidos de fonte seedável (F0B-01) — trocar itens não exige redeploy.
- [ ] `docs/infra/fase-0-provisioning-runbook.md` cobre os 6 serviços + restore drill + 3 spikes com
      estado/ação-manual/verificação e cross-links.
- [ ] `.env.staging` fora do tracking; rotação registrada como ação manual pendente no runbook.
