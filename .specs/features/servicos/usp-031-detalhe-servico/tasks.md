# USP-031 — Ver detalhe do serviço (tasks)

Sizing: **Large**. NET-NEW. Sem migração. Ordem: query → View Model → rota/metadata/JSON-LD → componentes → guard de fonte única → testes.

### T031-1 — Query `getActiveServiceDetail` (on-read filter, sem contato)
- **What:** `services/queries/get-service-detail.ts` com `React.cache()` por `(id, authenticated)`; `where { id, status:'ACTIVE', author:{ inactivatedAt:null } }`; `serviceDetailSelect` **sem** phone/emailLogin. Opcional `getServiceUnavailableNotice`.
- **Where:** `src/modules/services/queries/get-service-detail.ts`
- **Depends on:** USP-029 T029-1  ·  **Reuses:** `get-job-detail.ts` (template)
- **Done when:** retorna `null` para não-ACTIVE/prestador inativado; row sem contato.
- **Tests:** int `get-service-detail.int.test.ts`: ACTIVE → row completo sem contato; **SVC031-MN-02** PAUSED/ARCHIVED/DRAFT/prestador-inativado → null.
- **Gate:** `npm run test -- get-service-detail`

### T031-2 — View Model `viewServiceDetail` + JSON-LD
- **What:** `services/views/service-detail.view.ts` — `viewServiceDetail(row, viewer)` (nome público; sem contato; `canManifestInterest = viewer!=null`), `serviceDetailJsonLd`, `serializeJsonLd` (replicar de jobs).
- **Where:** `src/modules/services/views/service-detail.view.ts`
- **Depends on:** T031-1  ·  **Reuses:** `viewJobDetail` (template)
- **Done when:** tipo `ServiceDetail` não possui campo de contato; nome correto PF/Empresa; JSON-LD sem contato.
- **Tests:** unit `service-detail.view.test.ts`: **AC-031-1** expõe campos públicos; **AC-031-2/MN-01** oculta contato para viewer null **e** autenticado (tipo não carrega contato); `canManifestInterest` true só autenticado.
- **Gate:** `npm run test -- service-detail.view`

### T031-3 — Rota `/servicos/[id]` + generateMetadata + JSON-LD + disclaimer + CTA seam
- **What:** `src/app/(public)/servicos/[id]/page.tsx` (`revalidate=1800`), `generateMetadata` anônimo, JSON-LD via fonte única, `<AsonsegDisclaimer/>`, CTA autenticado (seam U3, sem persistência). `components/service-detail.tsx`, `components/servico-indisponivel.tsx`.
- **Where:** `src/app/(public)/servicos/[id]/page.tsx`, `src/modules/services/components/`
- **Depends on:** T031-2, USP-030 T030-4 (disclaimer)  ·  **Reuses:** `vagas/[id]/page.tsx`, `@/shared/ui`
- **Done when:** detalhe ativo renderiza; não-ativo → indisponível + `noindex`; disclaimer presente; CTA só autenticado.
- **Tests:** component `service-detail-page.test.tsx`: AC-031-1 render; AC-031-4 disclaimer; CTA seam autenticado; anônimo sem contato. E2E `e2e/services/detail.spec.ts` (público): abre detalhe ativo, vê nome/fotos/valor, **não** vê telefone/e-mail.
- **Gate:** `npm run test -- service-detail-page` + `npm run build`

### T031-4 — Guard de fonte única (SVC031-MN-03)
- **What:** `services/__tests__/service-detail-single-source.test.ts` (estático) — a rota e o metadata derivam de `viewServiceDetail`/`serviceDetailJsonLd`; sem 2ª query de serviço selecionando contato.
- **Where:** `src/modules/services/__tests__/service-detail-single-source.test.ts`
- **Depends on:** T031-3  ·  **Reuses:** padrão de guard estático do repo
- **Done when:** teste falha se a rota introduzir query paralela com campo de contato.
- **Gate:** `npm run test -- service-detail-single-source`

### T031-5 — Barrel
- **What:** exportar símbolos da 031 no `services/index.ts`.
- **Gate:** `npm run lint && npm run typecheck`

---

## Test Matrix (USP-031)

| AC / MN | Tipo | Arquivo::caso |
| --- | --- | --- |
| AC-031-1 | unit+component | `service-detail.view.test.ts::public-fields` + `service-detail-page.test.tsx` |
| AC-031-2 / MN-01 | unit+E2E | `service-detail.view.test.ts::hides-contact` (viewer null & auth) + `e2e/services/detail.spec.ts` |
| AC-031-4 | component | `service-detail-page.test.tsx::disclaimer` |
| SVC031-MN-02 | int | `get-service-detail.int.test.ts::non-active-null` |
| SVC031-MN-03 | static | `service-detail-single-source.test.ts` |
