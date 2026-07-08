# USP-030 — Buscar serviços (pública) (spec)

**Epic:** servicos · **Fase:** 4 · **Unidade:** U2 · **Sizing:** Large (multi-componente: query + índice trgm + View Model + rota ISR + filtros)
**Deps:** USP-029 (model `Service`, fundação). **Tipo:** NET-NEW.

Fonte: épico `.specs/features/servicos/spec.md` + PRD USP-030 (@629) + ADR-0011/0013 + AD-011 (busca `unaccent`).

## Problem Statement

Qualquer pessoa (anônima ou autenticada) precisa descobrir serviços **ativos** por filtros (categoria, faixa de preço, região, disponibilidade) e busca textual sem acento. Espelha a busca pública de vagas (`searchJobs`, ISR `/vagas`), com as diferenças: **sem gate `company.isVerified`** e o **nome do prestador é público** (só o contato é oculto — USP-031/033).

## Acceptance Criteria (EARS)

- **AC-030-1** — QUANDO o visitante acessa a lista de serviços ENTÃO o sistema DEVE exibir **apenas serviços `ACTIVE`** (prestador ativo), **ordenados por data de publicação** (`published_at DESC`).
- **AC-030-2** — QUANDO o visitante aplica filtros (categoria, faixa de preço, região) ENTÃO o sistema DEVE atualizar a lista respeitando os filtros, em DB com **paginação obrigatória** (`take`).
- **AC-030-3** — QUANDO o visitante faz busca textual ENTÃO o sistema DEVE aplicar busca **case-insensitive e sem acento** sobre **título, descrição e categoria**.
- **AC-030-4** — QUANDO a lista é exibida ENTÃO o sistema DEVE apresentar o **termo de isenção de responsabilidade da ASONSEG** (plataforma de conexão; não presta/intermedia/garante).

## Must-Nots

- **SVC030-MN-01** — A busca NÃO PODE retornar serviços não-`ACTIVE` (DRAFT/IN_MODERATION/AWAITING_ADJUSTMENTS/PAUSED/ARCHIVED/REJECTED/INACTIVATED) nem de prestador inativado. *(neg-test: seed com todos os status → só ACTIVE aparece)*
- **SVC030-MN-02** — Os itens de busca NÃO PODEM carregar contato do prestador (telefone/e-mail) — nem no payload RSC/Flight. Contato não é `SELECT`-ado. *(neg-test: inspeção do row/serializado não contém phone/emailLogin)*
- **SVC030-MN-03** — A consulta NÃO PODE ser não-paginada: `take`/`LIMIT` obrigatório (filtro no DB, nunca em memória). *(guard: SQL usa LIMIT/OFFSET)*

## Edge Cases

- Filtros sem resultado → **estado vazio** sem erro.
- Termo com acento ("jardinagem") casa itens sem acento (e vice-versa) via `immutable_unaccent` nos dois lados.
- "disponibilidade" como filtro: MVP trata como **texto livre** — ver design (não há enum de disponibilidade); filtro de disponibilidade é **best-effort textual** ou deferido (documentado no design).

## Traceability

| Req | AC | Fato |
| --- | --- | --- |
| SVC-02 | AC-030-1 | int `search-services.int.test.ts::only-active-ordered` |
| SVC-02 | AC-030-2 | int `search-services.int.test.ts::filters-paginated` |
| SVC-02 | AC-030-3 | int `search-services.int.test.ts::unaccent-textual` |
| SVC-02 | AC-030-4 | component `services-page.test.tsx::disclaimer` |
| SVC030-MN-01 | must-not | int `search-services.int.test.ts::excludes-non-active` |
| SVC030-MN-02 | must-not | int `search-services.int.test.ts::no-contact-leak` |

## Success Criteria

- [ ] `/servicos` lista só ativos, ordenados por publicação, com filtros e busca sem acento, paginado, com aviso de isenção. Sem vazamento de contato.
