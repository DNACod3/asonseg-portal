# USP-029 — Publicar serviço (spec)

**Epic:** servicos · **Fase:** 4 (Serviços + Manifestações) · **Unidade:** U2 · **Sizing:** Large (net-new + foundational + must-nots)
**Deps:** USP-010 (papel prestador ativo), USP-016 (moderação `transitionContent`) — ambas concluídas/mergeadas.
**Tipo:** NET-NEW. Não existe módulo `services` nem model `Service`/`ServicePhoto`. Esta USP **cria a fundação** do domínio de serviços (princípio AD-005/AD-009: a 1ª USP que precisa da infra a cria).

Fonte: `.specs/features/servicos/spec.md` (épico) + PRD `docs/prd/prd-asonseg-portal-mvp.md` (Épico 7, USP-029 @616) + `docs/arch/technical-design.md` §2.6 (Service, status-on-entity) + ADR-0008/0010/0011/0015.

## Problem Statement

Prestadores de serviço — Pessoa Física (PF, papel `PROVIDER` ativo) ou Pessoa-responsável de uma Empresa — não têm canal para anunciar serviços. É preciso um caminho de publicação **moderado** (todo serviço passa por moderação antes de ficar público) que espelhe estruturalmente o de vagas (`jobs`), reusando a FSM de moderação, a taxonomia `ServiceCategory` e as regiões `Region` já existentes.

## Precedente estrutural (gêmeo)

Espelhar `src/modules/jobs` (USP-020/021/023) para `src/modules/services`. A FSM já provisiona `ContentKind.SERVICE` e `TRANSITIONS[SERVICE]`; falta o model `Service`, o `PrismaServiceStatusRepository`, o registro no container, a extensão de `eventTypeFor`, e a UNIÃO da fila de moderação. Detalhes no `design.md`.

## Acceptance Criteria (EARS)

- **AC-029-1** — QUANDO o usuário inicia o cadastro de serviço ENTÃO o sistema DEVE exigir a escolha entre "publicar como PF" ou "publicar em nome de [Empresa X]", listando apenas as Empresas das quais a Pessoa é **responsável ativo**.
- **AC-029-2** — QUANDO o serviço é submetido ENTÃO o sistema DEVE persistir o serviço e transicioná-lo para **`IN_MODERATION`** (via `transitionContent`), nunca diretamente para `ACTIVE`.
- **AC-029-3** — QUANDO o serviço é submetido ENTÃO o sistema DEVE exigir (Zod): **título, categoria, descrição, valor (faixa priceMin/priceMax), unidade (por hora/diária/serviço), região de atendimento e disponibilidade (dias/horários)**. Rascunho (`createServiceDraft`) exige só título (demais nullable no DB — padrão `Job`/`CandidateProfile`).
- **AC-029-4** — QUANDO o usuário anexa fotos ENTÃO o sistema DEVE permitir **até 3 fotos** do trabalho (JPG/PNG/WEBP, ≤5MB cada), opcionalmente, com **validação de MIME real** (magic bytes, não extensão).

## Must-Nots (negativos, com teste discriminante)

- **SVC029-MN-01** — Um serviço submetido NÃO PODE ficar público sem moderação: o status persistido após submit é `IN_MODERATION` (jamais `ACTIVE` por escrita direta). *(neg-test: submit → assert status === IN_MODERATION; assert nenhuma escrita `status:'ACTIVE'` no caminho de publicação)*
- **SVC029-MN-02** — Uma Pessoa **sem papel `PROVIDER` ativo** NÃO PODE publicar serviço (retorna `FORBIDDEN`). *(neg-test: sessão sem role PROVIDER → FORBIDDEN, nenhuma linha em `services`)*
- **SVC029-MN-03** — Uma Pessoa NÃO PODE publicar "em nome de Empresa X" sem ser **responsável ativo** de X (retorna `FORBIDDEN`). *(neg-test: companyId de empresa não representada → FORBIDDEN)* (edge da spec do épico)
- **SVC029-MN-04** — Upload de foto NÃO PODE aceitar >3 arquivos, MIME real fora de JPG/PNG/WEBP, ou >5MB (retorna `VALIDATION`). *(neg-test: 4ª foto / PDF renomeado .jpg / 6MB → rejeitado)*
- **SVC029-MN-05** — A IA/qualquer serviço NÃO se aplica aqui (sem LLM). `Service.status` só é escrito pelo adapter/`editService` (guarda estática — ver USP-032 SVC032-MN-01, cujo teste cobre o módulo `services` inteiro).

## Edge Cases

- Submit sem título/categoria/descrição/valor/unidade/região/disponibilidade → `VALIDATION` (campos obrigatórios no submit).
- Prestador PF: a UI **alerta** que o **nome** será exposto publicamente (TD §4.4; ADR-0010 — nome do prestador é público, contato não).
- Serviço duplicado idêntico vivo do mesmo autor (mesma categoria+título) → `CONFLICT` (índice único parcial `service_dedup_alive`).
- Publicar em nome de Empresa **não** exige `company.isVerified` (verificação de Empresa é gate exclusivo de vagas — USP-017; o hook de verificação faz no-op para SERVICE).

## Traceability

| Req | AC | Fato (teste) |
| --- | --- | --- |
| SVC-01 | AC-029-1 | int: `submit-service.int.test.ts::escolha-pf-vs-empresa` + component `service-form.test.tsx` |
| SVC-01 | AC-029-2 | int: `submit-service.int.test.ts::persist-in-moderation` |
| SVC-01 | AC-029-3 | unit: `submit-service.schema.test.ts` (campos exigidos) |
| SVC-01 | AC-029-4 | int: `upload-service-photo.int.test.ts` (MIME/limite/quantidade) |
| SVC029-MN-01 | must-not | int: `submit-service.int.test.ts::never-active-on-submit` |
| SVC029-MN-02 | must-not | int: `submit-service.int.test.ts::no-provider-role-forbidden` |
| SVC029-MN-03 | must-not | int: `submit-service.int.test.ts::not-company-responsible-forbidden` |
| SVC029-MN-04 | must-not | int: `upload-service-photo.int.test.ts::reject-bad-mime-size-count` |

## Success Criteria

- [ ] Prestador PF/Empresa publica serviço → status inicial `IN_MODERATION`; aparece na fila de moderação.
- [ ] Campos obrigatórios e regras de foto validados; dedup ativo.
- [ ] Fundação `services` (model, adapter, container, eventos, fila) pronta para USP-030/031/032.

## Fronteira com U3 (deixar aberta)

- **NÃO** criar `ServiceInterest`/`ServicePhoto`-de-interesse, `viewProviderForClient`, `viewServiceAfterInterest`, nem gate `SERVICE_HIRING`. Manifestação de interesse + revelação de contato são **USP-033 (U3)**. O model `Service` desta USP **omite** a relação `interests` (U3 a adiciona por migração incremental, como `applications` foi em AD-012).
