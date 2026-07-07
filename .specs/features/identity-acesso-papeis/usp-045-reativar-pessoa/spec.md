# USP-045 Reativar Pessoa - Specification (BACKFILL)

> **Spec de backfill.** A USP-045 (reativar Pessoa) é o extra do board/IDSD - **não** está no
> PRD (que termina na USP-044) nem no épico `identity-acesso-papeis/spec.md`. Ela **já está
> implementada e mergeada** na Fase 1. Esta spec é derivada de duas fontes, não inventada:
> **(a)** o comportamento real no código; **(b)** o desenho deliberado como **inverso da USP-007**
> (inativar). As ACs abaixo documentam o que o código **garante** hoje - não adicionam requisitos
> novos. A unidade de refactor (Grupo E) adiciona só o **restyle** do diálogo ao Design System.

## Fonte da verdade (de onde este backfill foi derivado)

| Fonte | O que fornece |
|---|---|
| `src/modules/persons/actions/reactivate-person.ts` | Sequência da Server Action: authz por rank, idempotência, zeragem de grants na tx, consentimentos preservados, `withAudit`. |
| `src/modules/persons/domain/person-reactivation.ts` | Política pura: `canReactivatePerson`, `institutionalRank` (BOARD=2 > COORDINATOR=1 > 0), `hasReactivationPrivilege`. |
| `src/modules/persons/schemas/reactivate-person.schema.ts` | `reactivatePersonSchema` (motivo obrigatório, 5..500) + a ❓ aberta D-005 (catálogo de motivos). |
| `src/modules/persons/components/reactivate-person-dialog.tsx` | UI: aviso de zeragem de grants (E-003/D-002), coleta de motivo, tratamento de erro. |
| `src/app/(app)/pessoas/[id]/page.tsx` (ramo INATIVO) | Gate `hasReactivationPrivilege`, exibição de metadados de inativação, CTA de reativação. |
| Testes existentes | `person-reactivation.test.ts` (unit), `reactivate-person.int.test.ts` (integração), `ReactivatePersonDialog.test.tsx` (RTL) - servem de teste negativo das must-nots. |
| USP-007 (`identity-acesso-papeis/spec.md`, IDN-15/16) | Referência de simetria (inverso): esta USP reverte o `status` que a USP-007 flipou. |

**IDs internos reusados como âncora (não re-mintados):** o código já referencia `R1`, `R2`,
`E-003`, `E-004`, `P-001`, `P-003`, `D-002`, `D-005`, `D-006`, `L-003`, `F1`, `F4` (de um
intent/expectations de USP-045 que existiu no ICE, ausente do PRD). Uso-os onde aparecem no código.
Requisitos **de restyle** desta unidade recebem IDs locais `U45-NN` / `U45-MN-NN`.

## Problem Statement

Uma Pessoa inativada pela USP-007 precisa poder ser reativada por um operador institucional
autorizado, revertendo o `status` para ATIVO **sem** devolver silenciosamente os papéis e permissões
que ela tinha antes (isso seria retorno indevido de privilégio - fracasso F1), e **sem** reinstaurar
consentimentos LGPD (re-aceite é ato do titular - ADR-0025). A UI de reativação foi escrita com
Tailwind ad-hoc antes do Design System (AD-014); esta unidade a reestiliza, sem tocar comportamento.

## Goals

- [ ] Documentar (backfill) as regras reais de reativação como ACs e must-nots rastreáveis.
- [ ] `reactivate-person-dialog.tsx` reestilizado com primitivos/tokens do DS, sem paleta fixa.
- [ ] Zero mudança de comportamento: authz por rank (R1), idempotência, zeragem de grants na mesma tx (R2), consentimentos não reinstaurados (P-003) e `withAudit` preservados; suíte de comportamento verde e inalterada.

## Out of Scope

| Feature | Reason |
|---|---|
| Qualquer mudança em handlers, schema, action, query, view, navegação, metadata, cache | Restyle é style-only; comportamento é congelado. |
| Restaurar papéis/permissões anteriores na reativação | Decisão central R2/D-006: grants são **zerados**, não restaurados (previne F1). |
| Reinstaurar consentimentos LGPD | ADR-0025 / P-003 / F4: re-consentimento é ato do titular, não desta action. |
| Catálogo controlado de motivos de reativação (D-005) | Questão aberta do dono do intent (gate Fase 0); hoje é texto livre. Ver Assumptions. |
| Restyle de `pessoas/[id]/page.tsx` (ramo INATIVO) | O arquivo de página é reestilizado **inteiro** pela USP-007 (tarefa de página, arquivo único). Aqui só o **diálogo**. |
| Introduzir primitivo Dialog/Modal ou dependência de dialog | DS não tem Dialog; diálogo bespoke permanece (sem nova dependência). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| **D-005** - catálogo controlado de motivos de reativação | external (dono do intent / gate Fase 0) | Texto livre (5..500 chars), mesmos limites da inativação | Código já ship com esse default; o catálogo é refinamento futuro, não bloqueia o restyle | **n** |
| Reativação usa `Button variant="primary"` (laranja CTA), não uma variante `success` nova | agent | `primary` para gatilho e "Confirmar reativação"; `outline` para "Cancelar" | Evita adicionar variante `success` à fundação; o "positivo" é sinalizado pelo contexto/Badge; minimiza toque no DS | y (autônomo) |
| Aviso "amber" de zeragem de grants → token do sistema | agent | Bloco de aviso com token (ex.: `bg-danger/10 text-danger` ou `bg-background`+`text-fg` com "Atenção:" em negrito) | DS não tem token de warning/amber; manter amber quebraria a linguagem de tokens | y (autônomo) |
| Page (ramo INATIVO) é reestilizada pela USP-007 (arquivo único) | agent | USP-045 não toca `page.tsx`; só `reactivate-person-dialog.tsx` | Ownership de arquivo limpo no pipeline por-unidade | y (autônomo) |

**Entry Gate (Tasks §0):** o único item externo aberto é **D-005**. A **implementação atual não
depende** dele (já ship com texto livre como default deliberado) e o **restyle** certamente não
depende. Portanto o Entry Gate **não** trava esta unidade. D-005 fica registrado como refinamento
futuro de produto, não como bloqueio de desenvolvimento.

**Open questions:** D-005 (acima) - único item aberto, com owner externo, não-bloqueante.

---

## User Stories

### P1: Reativar Pessoa inativada (comportamento - BACKFILL do código, PRESERVAR) ⭐ MVP

**User Story:** Como coordenador ou diretoria, quero reativar uma Pessoa que foi inativada,
restabelecendo o acesso ao portal **sem** devolver automaticamente os papéis/permissões anteriores
e **sem** reinstaurar consentimentos, para reverter inativações (ex.: engano) com controle explícito
de privilégio.

**Why P1:** Contraparte necessária da USP-007; sem ela, uma inativação por engano é irreversível pela UI.

**Acceptance Criteria (backfilled - o código já garante cada uma):**

1. (R1) QUANDO um ator reativa uma Pessoa, ENTÃO o sistema DEVE permitir apenas se `rank(ator) >= rank(quem fez a inativação original)`, onde BOARD=2 > COORDINATOR=1 > demais=0. "Não abre por baixo o que foi fechado por cima."
2. (R1) QUANDO o ator não tem papel institucional (rank 0), ENTÃO o sistema DEVE recusar com `FORBIDDEN` / `NOT_AUTHORIZED`.
3. (R1) QUANDO `rank(ator) < rank(inativador)`, ENTÃO o sistema DEVE recusar com `FORBIDDEN` / `INSUFFICIENT_RANK` ("...inativada por alguém com permissão superior à sua. Acione a diretoria.").
4. (R1) QUANDO o inativador original é desconhecido (`inactivatedByPersonId` nulo) ou não tem papel institucional atual, ENTÃO seu rank é 0 (qualquer coordenador/diretoria pode reativar).
5. QUANDO o ator não tem privilégio, ENTÃO o `FORBIDDEN` DEVE ser retornado **antes** da checagem de idempotência (o ator não aprende que a Pessoa já está ativa).
6. (idempotência) QUANDO a Pessoa já está ATIVA, ENTÃO o sistema DEVE retornar `CONFLICT` ("Esta Pessoa já está ativa.").
7. (transição) QUANDO a reativação procede, ENTÃO o `status` DEVE virar ATIVO e os metadados de inativação (`inactivatedAt`/`inactivatedByPersonId`/`inactivationReason`) DEVEM ser limpos (o histórico completo permanece no `audit_log`).
8. (R2 / E-003 / P-001) QUANDO a reativação procede, ENTÃO, **na mesma transação**, o sistema DEVE revogar **todos** os grants de papel ATIVOS (status ACTIVE→REVOKED, carimbando `revokedAt`/`revokedBy`/`revocationReason`) e retornar `grantsRevoked` = contagem revogada. A Pessoa volta **sem** privilégios.
9. (guard de concorrência) QUANDO dois submits concorrem, ENTÃO o `updateMany where status=INATIVO` DEVE garantir que só um vença; o perdedor casa 0 linhas e vira `CONFLICT`.
10. (P-003 / ADR-0025) QUANDO a reativação procede, ENTÃO os consentimentos LGPD NÃO DEVEM ser reinstaurados - ficam como estavam.
11. (auditoria) A transição DEVE rodar em `withAudit('PERSON_REACTIVATED')` (uma transação), registrando `before={status:'INATIVO'}`, `after={status:'ATIVO', grantsRevoked, consentsPreserved:true}` e a justificativa na coluna `justification`.
12. (justificativa) QUANDO o motivo falta ou tem menos de 5 caracteres, ENTÃO o sistema DEVE recusar na borda (Zod) sem persistir.
13. (E-004 / ADR-0030) QUANDO reativada, ENTÃO o login DEVE voltar a ser aceito na próxima janela de revalidação (<= 30s / próxima requisição).
14. (contrato) QUANDO a sessão do operador é nula/expirada → `UNAUTHENTICATED`; QUANDO o alvo não existe → `NOT_FOUND`. A action **nunca lança**: retorna sempre `ActionResult<{ personId, status:'ATIVO', grantsRevoked }>`.

**Independent Test:** `person-reactivation.test.ts` (unit da política de rank), `reactivate-person.int.test.ts` (integração: authz, idempotência, zeragem de grants na tx, consentimentos preservados, auditoria) e `ReactivatePersonDialog.test.tsx` (RTL) - todos já existentes e verdes.

---

### P1: Restyle da UI de reativação ao Design System (LOCAL - trabalho desta unidade) ⭐ MVP

**User Story:** Como mantenedor do Portal, quero o diálogo de reativação estilizado pelos tokens e
primitivos do DS (AD-014), para paridade visual e consistência no dark mode, sem mudança de comportamento.

**Why P1:** Objetivo desta unidade de refactor.

**Acceptance Criteria:**

1. (U45-01) QUANDO o `reactivate-person-dialog.tsx` é renderizado, ENTÃO seus controles DEVEM usar `Button` (`primary` para gatilho/confirmar, `outline` para cancelar), `Textarea` e `Label` via `@/shared/ui`, e a casca DEVE usar tokens (`bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `rounded-lg`, `shadow-xl`) - sem paleta fixa (`bg-green-600`, `text-gray-*`, `bg-amber-*`).
2. (U45-02) QUANDO o diálogo abre, ENTÃO o aviso de zeragem de grants ("todos os papéis e permissões anteriores serão removidos...") DEVE permanecer presente, reestilizado com token (bloco de atenção), preservando o texto.
3. (U45-03) O restyle DEVE preservar os seletores acessíveis dos testes: nomes dos botões ("Reativar Pessoa", "Confirmar reativação", "Cancelar"), `role="dialog"` com `aria-labelledby`, o `htmlFor`/label "Motivo da reativação", e os `role="alert"`.

**Independent Test:** `npm run test` (RTL verde, incluindo a asserção do aviso), `npm run typecheck`/`lint`/`build` verdes; diff só de markup/classes.

---

## Edge Cases

- QUANDO o inativador original perdeu o papel de BOARD desde a inativação, ENTÃO seu rank atual (recalculado dos grants ATIVOS) cai - um coordenador pode passar a poder reativar (comportamento por design: rank é do estado atual, não histórico).
- QUANDO a Pessoa não tem nenhum grant ATIVO ao ser reativada, ENTÃO `grantsRevoked=0` (zeragem vacuamente satisfeita).
- QUANDO o dark mode está ativo, ENTÃO os tokens re-resolvem e o diálogo permanece legível sem `dark:`.
- QUANDO a action retorna `FORBIDDEN` (rank insuficiente), ENTÃO o diálogo DEVE exibir a mensagem e permanecer aberto (comportamento preservado; só o estilo do bloco de erro muda).

---

## Must-Nots (world-level prohibitions)

Backfilled (B) = prohibições de comportamento que o código **já** garante (preservar); Restyle (R) =
prohibições do trabalho de restyle.

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| U45-MN-B01 | QUANDO uma Pessoa é reativada, o sistema NÃO DEVE devolver ativos os grants de papel que ela tinha antes (os ACTIVE anteriores DEVEM terminar REVOKED na mesma transação). | Retorno silencioso de privilégio (fracasso F1) - o operador teria de volta permissões que nunca reconcedeu | T1 (preservar) | `reactivate-person.int.test.ts` (asserção de grants ACTIVE→REVOKED na tx) verde e inalterado |
| U45-MN-B02 | QUANDO uma Pessoa é reativada, o sistema NÃO DEVE reinstaurar consentimentos LGPD revogados/ausentes. | Reinstauração indevida de consentimento (fracasso F4 / viola ADR-0025) | T1 (preservar) | `reactivate-person.int.test.ts` (asserção `consentsPreserved` / consentimentos intactos) verde e inalterado |
| U45-MN-B03 | QUANDO um ator de rank inferior ao do inativador tenta reativar, o sistema NÃO DEVE permitir a reativação. | Abrir "por baixo" o que foi fechado "por cima" (violação de R1) | T1 (preservar) | `person-reactivation.test.ts` + `reactivate-person.int.test.ts` (INSUFFICIENT_RANK) verdes e inalterados |
| U45-MN-R01 | QUANDO reestilizando, o sistema NÃO DEVE alterar authz por rank (R1), idempotência, zeragem de grants na mesma tx (R2), consentimentos-não-reinstaurados (P-003), guard de concorrência ou o `withAudit('PERSON_REACTIVATED')`. | Regressão de comportamento sob o rótulo "só estilo" | T1 | Suíte de comportamento (`person-reactivation.test.ts`, `reactivate-person.int.test.ts`, `ReactivatePersonDialog.test.tsx`) verde e inalterada |
| U45-MN-R02 | QUANDO reestilizando, o sistema NÃO DEVE remover o aviso na tela de que todos os papéis/permissões serão removidos na reativação (E-003/D-002). | Operador reativar sem perceber que os grants são zerados | T1 | Asserção RTL `getByText(/todos os papéis e permissões anteriores serão removidos/i)` verde |
| U45-MN-R03 | QUANDO reestilizando, o sistema NÃO DEVE introduzir dependência de dialog/modal (`@radix-ui/react-dialog` etc.). | Inchaço de dependência / fuga do overlay bespoke | T1 | Grep guard de ausência de dep de dialog verde |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| R45-01 (=R1 authz por rank) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-02 (=R2 zeragem de grants na tx) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-03 (idempotência + guard de concorrência) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-04 (=P-003 consentimentos preservados) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-05 (auditoria `PERSON_REACTIVATED`) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-06 (justificativa obrigatória Zod) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| R45-07 (=E-004 login volta na revalidação) | Reativar (comportamento) | - | Implemented (backfill / preserve) |
| U45-01 | Restyle do diálogo (primitivos + tokens) | Tasks | In Tasks |
| U45-02 | Preservar/estilizar o aviso de zeragem de grants | Tasks | In Tasks |
| U45-03 | Preservar seletores acessíveis | Tasks | In Tasks |
| U45-MN-B01..B03 | Must-nots de comportamento (backfill) | Tasks | Implemented (preserve) |
| U45-MN-R01..R03 | Must-nots do restyle | Tasks | In Tasks |

**ID format:** R45-* são requisitos de comportamento **backfilled** do código (âncoras R1/R2/P-003/
E-004 reusadas). U45-* são adições locais do restyle.

**Coverage:** 7 requisitos de comportamento (backfilled, preservados) + 3 de restyle + 6 must-nots, todos mapeados.

---

## Success Criteria

- [ ] Spec de backfill documenta fielmente o comportamento implementado (ACs 1..14) e as must-nots B01..B03, com o único item aberto (D-005) marcado como não-bloqueante.
- [ ] `reactivate-person-dialog.tsx` consome primitivos/tokens do DS; zero paleta fixa; aviso de zeragem preservado.
- [ ] `npm run test`/`typecheck`/`lint`/`build` verdes; integração verde como rede de segurança.
- [ ] Nenhum teste de comportamento modificado, enfraquecido ou removido.
