# USP-032 — Editar serviço (pausar, arquivar) (spec)

**Epic:** servicos · **Fase:** 4 · **Unidade:** U2 · **Sizing:** Large (must-not de escrita fora-de-banda + FSM + exceção atômica)
**Deps:** USP-029. **Tipo:** NET-NEW.

Fonte: épico + PRD USP-032 (@653) + ADR-0011 (FSM) + AD-016 (USP-023 `editJob` — exceção atômica conteúdo+status; `eventTypeFor` kind-aware).

## Problem Statement

O prestador (PF ou via Empresa) precisa gerenciar o ciclo de vida do seu serviço: **editar** (volta a rascunho e re-modera), **pausar**, **arquivar** — e, por paridade com vagas, **retomar** (unpause) um pausado. Serviço não tem validade automática. Espelha `editJob`/`pauseJob`/`archiveJob` (USP-023) sobre a FSM `transitionContent(SERVICE, ...)`.

## Acceptance Criteria (EARS)

- **AC-032-1** — QUANDO o prestador edita um serviço `ACTIVE` ENTÃO o sistema DEVE alterar o status para `DRAFT` e **exigir nova moderação** (editar grava campos+status atomicamente e a UI encadeia `submitServiceForModeration` → `IN_MODERATION`).
- **AC-032-2** — QUANDO o prestador pausa o serviço ENTÃO o sistema DEVE alterar o status para `PAUSED` (`ACTIVE→PAUSED`, `AUTHOR_ACTION`).
- **AC-032-3** — QUANDO o prestador arquiva o serviço ENTÃO o sistema DEVE alterar o status para `ARCHIVED`.
- **AC-032-4** — QUANDO um serviço está `ACTIVE` ENTÃO o sistema DEVE mantê-lo ativo **sem validade automática**, até o prestador pausar/arquivar. (Paridade: retomar `PAUSED→ACTIVE` via `resumeService`.)

## Must-Nots

- **SVC032-MN-01** — `Service.status` NÃO PODE ser escrito fora do `PrismaServiceStatusRepository` ou de `editService`. *(guard estático `no-out-of-band-status-write.test.ts` cobrindo `src/modules/services`; `editService` é a única exceção documentada de escrita atômica conteúdo+status, e só com `status:'ACTIVE'` no `where`)*
- **SVC032-MN-02** — Um prestador NÃO PODE editar/pausar/arquivar/retomar serviço que **não é seu** (retorna `FORBIDDEN`). Ownership = `authorPersonId === person.id` OU (companyId setado E responsável ativo). *(neg-test: serviço de outro autor → FORBIDDEN, sem transição)*
- **SVC032-MN-03** — Editar um serviço `ACTIVE` NÃO PODE deixá-lo `ACTIVE`: DEVE forçar re-moderação (→`DRAFT`, depois `IN_MODERATION`). *(neg-test: após edit, status ≠ ACTIVE)*

## Edge Cases

- Editar serviço não-`ACTIVE` → `CONFLICT` ("só é possível editar um serviço ativo") — concorrência otimista `where {id, status:'ACTIVE'}`.
- Pausar/arquivar/retomar em estado inválido → `INVALID_TRANSITION` (via FSM).
- Serviços `PAUSED`/`ARCHIVED` não aparecem na busca pública (garantido pela USP-030 on-read).

## Traceability

| Req | AC | Fato |
| --- | --- | --- |
| SVC-04 | AC-032-1 / MN-03 | int `edit-service.int.test.ts::forces-remoderation` |
| SVC-04 | AC-032-2 | int `lifecycle-service.int.test.ts::pause` |
| SVC-04 | AC-032-3 | int `lifecycle-service.int.test.ts::archive` |
| SVC-04 | AC-032-4 | int `lifecycle-service.int.test.ts::resume` + no-expiry |
| SVC032-MN-01 | must-not | static `no-out-of-band-status-write.test.ts` |
| SVC032-MN-02 | must-not | int `lifecycle-service.int.test.ts::ownership-forbidden` |

## Success Criteria

- [ ] Prestador edita (→rascunho+remoderação), pausa, arquiva e retoma **somente seus** serviços; status só muda via adapter/`editService`; sem validade automática.
