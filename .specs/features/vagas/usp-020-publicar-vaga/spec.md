# USP-020 — Publicar vaga — Refactor (Fase 2 / Design System) — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-020 já
> vivem nos artefatos ICE — `docs/IDSD/ice-portal-asonseg/intents/intent-USP-020.md` +
> `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-020.md` (resolvidos pelo card da
> `matriz-conexoes.md`) — e a feature **já está implementada e mergeada** em `src/modules/jobs/`.
> Os IDs de requisito **E-001/E-003/E-004/E-005/P-003/P-005/P-006/L-003/L-004** permanecem **canônicos**
> e verbatim; esta spec **não os re-deriva**. Ela especifica o **delta de refactor da Fase 2**: adotar o
> Design System (AD-014) nas telas de vagas, na mesma disciplina da Fase 1 (AD-015) — **style-only,
> comportamento preservado**. Os IDs locais `U20-*` cobrem só o que o épico ICE não descreve (restyle).

## Problem Statement

A publicação de vaga (USP-020) está entregue e correta — `createJobDraft` + `submitJobForModeration`,
gate de responsável ativo (P-006), dedup exata (P-003), validade em `America/Sao_Paulo` com teto de 180
dias (E-004/E-005), rascunho (E-003) e log imutável (L-004). Porém a UI — o `JobForm` (Client Component
RHF+Zod) e a rota `(app)/empresa/[id]/vagas/nova` — foi construída antes da fundação de Design System
extraída do protótipo (AD-014) e usa markup/classes fora do contrato de tokens/primitivos de
`@/shared/ui`, destoando das telas já reestilizadas na Fase 1. Este refactor aplica o DS ao formulário de
publicação e à casca de página **preservando 100% do comportamento** (RHF/Zod, os dois Server Actions, o
mapeamento de `ActionResult`→PT-BR, o gate P-006 e a máquina de estados), ancorado nos testes existentes
verdes usados como testes de preservação.

## Goals

- [ ] **G1** — Reestilizar o `JobForm` (Client Component) com os primitivos e tokens do DS (AD-014)
      — `FormCard`/`FormHeader`/`StepIcon`/`Label`/`Input`/`Textarea`/`Button`/`FormRow`/`Badge`,
      barrel `@/shared/ui` — com paridade visual ao protótipo em light **e** dark, **sem alterar
      comportamento** (RHF+`zodResolver(publishJobSchema)`, os botões "Salvar rascunho"/"Enviar para
      moderação", o mapa de erros `ActionResult`→PT-BR).
- [ ] **G2** — Reestilizar a(s) casca(s) de página `(app)/empresa/[id]/vagas/nova` (e seletor de Empresa
      responsável, se em página) com `FormHeader`/`StepIcon`/`FormCard`, preservando o guard de sessão,
      o `metadata` e o `dynamic`/cache da rota.
- [ ] **G3** — Preservar o comportamento sensível como **testes negativos verdes**: gate P-006 (só
      responsável ativo publica), dedup P-003 (→ `CONFLICT`), validade E-004/E-005 (passado / > 180 dias),
      rascunho parcial E-003, audit L-004 (`JOB_DRAFT_SAVED` / `CONTENT_SUBMITTED_TO_MODERATION`).
- [ ] **G4** — Manter verdes todos os testes existentes da USP-020 (unit de validade, integração das
      actions, schema) e cobrir os deltas de UI com um teste de render (RTL) que trava a preservação.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| --- | --- |
| Alterar a sequência dos Server Actions (`createJobDraft`/`submitJobForModeration`), o gate P-006, o dedup P-003, a regra de validade ou o wiring da FSM (`PrismaJobStatusRepository`, container) | Refactor é **só de estilo**. O comportamento (AD-009: `status` na entidade; ADR-0021 dedup parcial; ADR-0020 atomicidade) é preservado e ancorado nos testes existentes. |
| Mudar o schema `Job` / migração / campos (`educationLevelRequired`, `contractType`, `salaryMin/Max`, `salaryVisible`, `regionId`) | Esses campos já existem (AD-011, entregues na USP-021). O restyle apenas os exibe com primitivos do DS; nenhuma coluna é adicionada/removida. |
| Novos requisitos funcionais de E-001/E-003/E-004/E-005/P-003/P-005/P-006/L-003/L-004 | Já entregues e cobertos pelos testes existentes; o refactor não os altera. |
| Verificação atômica da 1ª vaga (P-001/E-002), filtro on-read de visibilidade (P-002/P-007), checklist legal (P-004) | Downstream — USP-016/017 (verificação), USP-021/024 (visibilidade), USP-016 (checklist). USP-020 leva a vaga só até `IN_MODERATION`. |
| Fundir a página de publicação com a de moderação, ou adicionar preview público | Fora da fronteira da US; nenhuma mudança de fluxo. |

---

## Assumptions & Open Questions

Modo autônomo — o dono já fixou as decisões governantes da rodada de refactor (AD-015): (a) aplicar o DS
a todas as telas; (b) preservar fluxos/arquitetura, mudar só o estilo. O restante é discricionário do
agente (owner: `agent`).

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| O `JobForm` é o único Client Component da USP-020 e concentra o restyle; as páginas são Server Components (casca). | agent | Restyle do `JobForm` com RTL de preservação; páginas com gate de build (padrão do repo p/ Server Component restilizado, cf. USP-001 T3/T4). | O repo só tem teste de página para `login`/`redefinir-senha` (AD-015); restyle de Server Component é validado por `build`. | y |
| Selects de área/região/contrato/regime e o date picker de validade permanecem `<select>`/`<input type="date">` nativos estilizados por tokens (não novos primitivos de combobox). | agent | Reusar `Input`/`Label` do DS + classes token nos `<select>`/`<input type="date">`; **não** criar primitivo de select no escopo desta US. | O DS (AD-014) não exporta Select/DatePicker; criar um é foundation work fora do escopo. Aparência via tokens é suficiente p/ paridade. | y |
| O toggle "exibir salário" (`salaryVisible`) e a faixa salarial já coletados no form permanecem com o mesmo controle, só reestilizados. | agent | Restyle do controle existente (checkbox/switch) com tokens; sem mudar o binding RHF nem o default `true`. | Comportamento (edge `salaryVisible=false` omite salário no View Model) é da USP-021/022; aqui só estilo. | y |
| Mensagens de erro (`ActionResult` → PT-BR: validade passada, > 180 dias, `CONFLICT`, `FORBIDDEN`) mantêm o texto atual, só a caixa de erro é reestilizada com o token `danger`. | agent | Restyle da caixa de erro no padrão danger-token do `LoginForm`; texto e mapeamento inalterados. | Mudar texto seria mudança de comportamento observável; fora do escopo. | y |
| Se o `JobForm` já usa algum primitivo shadcn cru (`@/components/ui/*`) em vez de `@/shared/ui`, a migração é para o barrel `@/shared/ui` (fonte única, AD-014). | agent | Trocar imports crus por `@/shared/ui`; import via barrel (regra do CLAUDE.md). | Consistência com o resto da Fase 1/2; evita drift de dois vocabulários de UI. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Restyle do formulário de publicação de vaga para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como Pessoa responsável de uma Empresa, quero que o formulário de publicar vaga tenha a
mesma identidade visual do restante do portal, para que a experiência de publicação seja coesa e
profissional.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 2 (AD-014/AD-015). O formulário de
publicação é a principal superfície de criação de conteúdo do lado Empresa.

**Acceptance Criteria**:

1. QUANDO o `JobForm` é renderizado ENTÃO o sistema DEVE compô-lo com os primitivos do DS
   (`FormCard`/`FormHeader`/`StepIcon`, `Label`/`Input`/`Textarea`, `Button`, `FormRow` para pares de
   campos, `Badge` onde houver rótulo de status), importados de `@/shared/ui`, **sem** classes de paleta
   crua (`bg-blue-600`, `text-gray-*`, `focus:ring-blue-*`, `system-ui`) nem hex literal.
2. QUANDO o `JobForm` é reestilizado ENTÃO o sistema DEVE **preservar** RHF + `zodResolver(publishJobSchema)`
   / schema de rascunho, os dois botões de ação ("Salvar rascunho" → `createJobDraft`; "Enviar para
   moderação" → `submitJobForModeration`) e o mapeamento de `ActionResult` para mensagens PT-BR — sem
   qualquer mudança de fluxo.
3. QUANDO os campos são exibidos ENTÃO o sistema DEVE manter **todos** os campos atuais (título, área,
   descrição, requisitos, benefícios, salário/faixa + `salaryVisible`, regime, local/região, escolaridade,
   contrato, validade) com o mesmo binding RHF; nenhum campo é adicionado ou removido pelo restyle.
4. QUANDO a caixa de erro do servidor é exibida (validade passada, > 180 dias, `CONFLICT`, `FORBIDDEN`)
   ENTÃO o sistema DEVE usar o token `danger` do DS, preservando texto e mapeamento.
5. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru — paridade light/dark.

**Independent Test**: Renderizar `JobForm` (RTL) e confirmar que os campos/labels/botões são preservados,
que os primitivos do DS são usados, e que "Salvar rascunho"/"Enviar para moderação" chamam os actions
mockados; abrir a rota em browser em light/dark e confirmar paridade com o protótipo; a suíte da USP-020
permanece verde.

---

### P1: Restyle da casca de página de publicação (Server Component) — só estilo ⭐ MVP

**User Story**: Como Pessoa responsável, quero que a página `(app)/empresa/[id]/vagas/nova` (cabeçalho,
card, seletor de Empresa) siga o DS, para que a moldura em torno do formulário também seja coesa.

**Why P1**: A casca dá o enquadramento visual (título, ícone de etapa, card) que o protótipo define.

**Acceptance Criteria**:

1. QUANDO a página de publicação é renderizada ENTÃO o sistema DEVE compô-la com `StepIcon` +
   `FormHeader` + `FormCard` ao redor do `JobForm`, sem classes de paleta crua.
2. QUANDO a página lista as Empresas das quais a Pessoa é responsável ativa (seleção "publicar em nome
   de") ENTÃO o sistema DEVE **preservar** essa lógica (P-006 na camada de dados) e reestilizar só a
   apresentação.
3. QUANDO a página é restilizada ENTÃO o sistema DEVE **preservar** sem alteração: o guard de sessão, o
   `metadata`, o `dynamic`/cache da rota e a navegação pós-submit.
4. QUANDO a página é aberta em modo escuro ENTÃO o sistema DEVE renderizar corretamente via tokens.

**Independent Test**: Abrir a rota em light/dark e confirmar composição via primitivos e paridade; `npm
run build` compila a rota; nenhum teste de comportamento quebra.

---

## Edge Cases

- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** introduzir novos campos, **não** remover
  campos e **não** converter o Server Component de página em Client Component sem necessidade.
- QUANDO a validade informada é passada ou > 180 dias ENTÃO o gate de submit (Zod + `validadeStatus`)
  DEVE continuar bloqueando com a mesma mensagem — o restyle não toca a regra.
- QUANDO a Pessoa não é responsável ativa da Empresa ENTÃO `submitJobForModeration`/`createJobDraft` DEVE
  continuar retornando `FORBIDDEN` (gate P-006) — inalterado pelo restyle.
- QUANDO há duas vagas idênticas vivas (título+Empresa+área) ENTÃO a persistência DEVE continuar
  retornando `CONFLICT` (dedup P-003 / índice parcial) — inalterado.
- QUANDO um primitivo recebe `className` extra ENTÃO o sistema DEVE mesclar via `cn` sem contradizer
  classes de token.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo verde asseverando que o
resultado proibido não ocorre. Os `MN` de comportamento reusam os **testes de integração existentes** como
testes negativos (o restyle não pode torná-los vermelhos); os `MN` de estilo usam guarda estática/RTL.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U20-MN-01 | QUANDO `submitJobForModeration`/`createJobDraft` é chamada por Pessoa que **não** é responsável **ativa** da Empresa ENTÃO o sistema NÃO DEVE persistir a vaga nem transicioná-la (retorna `FORBIDDEN`). | Empresa-fantasma/terceiro publicar vaga em nome alheio (RP-005 / bypass do gate P-006). | T1 (preservação) | `submit-job-for-moderation.int.test.ts` / `create-job-draft.int.test.ts` — não-responsável ⇒ `FORBIDDEN`, zero linhas em `jobs`, zero transição. |
| U20-MN-02 | QUANDO a validade submetida é ≤ hoje (SP) ou > 180 dias ENTÃO o sistema NÃO DEVE aceitar o submit para `IN_MODERATION`. | Vaga eterna / vaga já vencida entrando na moderação (E-004/E-005/P-005). | T1 (preservação) | `validade.spec.ts` + `submit-job-for-moderation.int.test.ts` — validade passada/excede ⇒ `VALIDATION`, status permanece `DRAFT`. |
| U20-MN-03 | QUANDO duas vagas idênticas vivas (mesma Empresa+área+título) são submetidas ENTÃO o sistema NÃO DEVE criar a segunda. | Poluição/duplicação de vaga como vetor (P-003 / ADR-0021). | T1 (preservação) | `submit-job-for-moderation.int.test.ts` — 2ª vaga idêntica ⇒ `CONFLICT` (P2002 mapeado). |
| U20-MN-04 | QUANDO o `JobForm` / a página de publicação é reestilizado ENTÃO o sistema NÃO DEVE reter utilitário de paleta crua (`bg-blue-600`, `text-gray-*`, `focus:ring-blue-*`, `system-ui`) nem hex literal para superfícies temáticas. | "DS construído mas não adotado" — regressão visual / quebra de dark-mode. | T2 (form) + T3 (página) | Guarda estática (`node:fs`) sobre os arquivos tocados: zero ocorrência de paleta crua/hex. |
| U20-MN-05 | QUANDO o restyle é aplicado ENTÃO o sistema NÃO DEVE alterar o conjunto de campos do form (nem adicionar, nem remover) nem o binding RHF de cada campo. | Mudança silenciosa de contrato de dados sob o disfarce de restyle (L-003). | T2 | `JobForm` RTL — todos os campos esperados presentes; submit válido chama o action com o mesmo payload. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| E-001 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| E-003 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| E-004 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| E-005 / P-005 (upstream) | USP-020 | Verified (entregue) | Preservado |
| P-003 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| P-006 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| L-003 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| L-004 (upstream, canônico) | USP-020 | Verified (entregue) | Preservado |
| U20-STYLE-01 (local) | P1 Restyle form | Tasks | Pending |
| U20-STYLE-02 (local) | P1 Restyle página | Tasks | Pending |
| U20-MN-01 (local) | P1 (preservação gate) | Tasks | Pending |
| U20-MN-02 (local) | P1 (preservação validade) | Tasks | Pending |
| U20-MN-03 (local) | P1 (preservação dedup) | Tasks | Pending |
| U20-MN-04 (local) | P1 Restyle | Tasks | Pending |
| U20-MN-05 (local) | P1 Restyle | Tasks | Pending |

- **U20-STYLE-01**: Restyle do `JobForm` com primitivos/tokens do DS, estilo apenas (AC P1-form 1-5).
- **U20-STYLE-02**: Restyle da casca de página `(app)/empresa/[id]/vagas/nova` (AC P1-página 1-4).

**Coverage:** 15 itens (8 upstream preservados, 7 locais); 7 locais mapeados a tasks.

---

## Success Criteria

- [ ] `JobForm` e a página de publicação usam exclusivamente primitivos/tokens de `@/shared/ui`; paridade
      visual com o protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: RHF/Zod, `createJobDraft`/`submitJobForModeration`, gate P-006,
      dedup P-003, validade E-004/E-005, rascunho E-003, audit L-004 — todos preservados.
- [ ] Os 5 must-nots têm teste negativo verde (3 de preservação reusam integração existente; 2 de estilo
      via guarda/RTL).
- [ ] Suíte da USP-020 permanece verde; gates `npm run typecheck`, `lint`, `test`, `test:integration`,
      `build` verdes.
