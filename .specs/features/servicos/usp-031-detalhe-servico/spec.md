# USP-031 — Ver detalhe do serviço (spec)

**Epic:** servicos · **Fase:** 4 · **Unidade:** U2 · **Sizing:** Large (must-not de privacidade + fonte única de anonimização + metadata/JSON-LD)
**Deps:** USP-029. **Tipo:** NET-NEW.

Fonte: épico + PRD USP-031 (@641) + ADR-0010 (visibilidade/View Models) + ADR-0012/0013 + AD-012 (padrão `viewJobDetail` como fonte única, consumida por página **e** `generateMetadata`/JSON-LD).

## Problem Statement

Qualquer pessoa precisa ver o detalhe completo de um serviço **ativo** (nome do prestador/Empresa, categorias, descrição, fotos, valor, região, disponibilidade) para decidir contratar — **sem** ver telefone/e-mail do prestador, que só são revelados após manifestação de interesse autenticada (**USP-033/U3**). Espelha `viewJobDetail` + `(public)/vagas/[id]`.

## Acceptance Criteria (EARS)

- **AC-031-1** — QUANDO o visitante (anônimo ou autenticado) abre o detalhe de um serviço `ACTIVE` ENTÃO o sistema DEVE exibir **nome do prestador/Empresa, categoria, descrição, fotos, valor, região e disponibilidade**.
- **AC-031-2** — QUANDO o detalhe é exibido ENTÃO o sistema DEVE **ocultar telefone e e-mail do prestador** — para anônimo **e** autenticado — até a manifestação de interesse (USP-033).
- **AC-031-3** — (fronteira U3, fora de escopo aqui) A revelação do contato ocorre na manifestação autenticada (USP-033). Esta USP apenas deixa o **seam**: CTA autenticado presente, sem lógica de revelação.
- **AC-031-4** — QUANDO o detalhe é exibido ENTÃO o sistema DEVE apresentar o **termo de isenção de responsabilidade da ASONSEG**.

## Must-Nots

- **SVC031-MN-01** — O detalhe público NÃO PODE expor telefone/e-mail do prestador a **ninguém** (anônimo OU autenticado) nesta USP — nem no payload RSC/Flight. O contato **não é `SELECT`-ado** pelo View Model. *(neg-test: página e metadata como anônimo e como autenticado → sem phone/emailLogin no output/serializado)*
- **SVC031-MN-02** — Um serviço não-`ACTIVE` (draft/moderação/pausado/arquivado/rejeitado/inativado) ou de prestador inativado NÃO PODE ser exposto publicamente — nem no corpo, nem em `generateMetadata`/JSON-LD (retorna estado "indisponível"/`noindex`). *(neg-test: id de serviço PAUSED → não expõe conteúdo)*
- **SVC031-MN-03** — `generateMetadata` e o JSON-LD NÃO PODEM usar consulta paralela própria que contorne o View Model — DEVEM consumir a **mesma** `viewServiceDetail` (fonte única de anonimização, AD-012/ADR-0010). *(guard: metadata/JSON-LD derivam de `viewServiceDetail(row, null)`)*

## Edge Cases

- Serviço inexistente/ inativo → página de "serviço indisponível" (não 404 cru se preferir estado; alinhar a `getPausedJobNotice`), metadata `noindex`.
- Prestador PF: nome exibido publicamente (ADR-0010) — coerente com o aviso dado na publicação (USP-029).
- JSON-LD (schema.org) **não** inclui contato.

## Traceability

| Req | AC | Fato |
| --- | --- | --- |
| SVC-03 | AC-031-1 | unit `service-detail.view.test.ts::exposes-public-fields` + component |
| SVC-03 | AC-031-2 / MN-01 | unit `service-detail.view.test.ts::hides-contact-both-viewers` + int/page |
| SVC-03 | AC-031-4 | component `service-detail-page.test.tsx::disclaimer` |
| SVC031-MN-02 | must-not | int `get-service-detail.int.test.ts::non-active-not-exposed` |
| SVC031-MN-03 | must-not | test `service-detail-single-source.test.ts` (metadata/JSON-LD via viewServiceDetail) |

## Success Criteria

- [ ] Detalhe de serviço ativo mostra todos os campos públicos + fotos + disclaimer, oculta contato (anônimo e autenticado), estados não-ativos não vazam, metadata/JSON-LD anonimizados pela fonte única.

## Fronteira com U3

- CTA "Manifestar interesse / Entrar em contato" renderizado como **afordância autenticada** (seam), **sem** persistência nem revelação — isso é USP-033. `viewServiceDetail` **não** carrega contato; U3 adiciona `viewServiceAfterInterest`/`viewProviderForClient` + gate `SERVICE_HIRING`.
