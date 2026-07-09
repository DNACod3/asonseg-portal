# USP-035 — Tasks (todas NET-NEW)

Gate por task: `npm run typecheck && npm run lint` + testes do campo Tests. Commits atômicos `feat(services):`.

---

### T1 — Query `listProviderInterests` + View Model `viewClientForProvider`
- **What:** `queries/list-provider-interests.ts` (owner-scoped, paginado, `select` recortado, auditoria SENSITIVE_FIELD_VIEWED por cliente — design §D1); `views/client-for-provider.view.ts` (`viewClientForProvider` + tipo `ProviderInterestView` — §D2). Exports no barrel (query, `PROVIDER_INTERESTS_PAGE_SIZE`, view, tipos).
- **Where:** `src/modules/services/queries/`, `src/modules/services/views/`, `index.ts`.
- **Depends on:** USP-033 T1 (modelo `ServiceInterest`).
- **Reuses:** `jobs/queries/list-job-applicants.ts`, `persons/views/view-candidate-for-employer.ts`.
- **Done when:** dois prestadores isolados (SVC035-MN-01); canceladas ausentes (SVC035-MN-03); payload sem PII extra (SVC035-MN-02); acesso audita SENSITIVE_FIELD_VIEWED.
- **Tests:** int em T3; unit do View Model.
- **Gate:** typecheck + lint.

### T2 — Rota `/prestador/manifestacoes` + componente + page.test
- **What:** Página `src/app/(app)/prestador/manifestacoes/page.tsx` (`force-dynamic`, guard `requireActivePerson` + `PROVIDER` senão `notFound()` — design §D3). Componente `components/provider-interests-list.tsx` (apresentação, estado vazio). Link no painel `prestador/servicos`. `page.test.tsx` do guard 404 (L-008). Export do componente no barrel.
- **Where:** `src/app/(app)/prestador/manifestacoes/page.tsx` (+ `page.test.tsx`), `src/modules/services/components/provider-interests-list.tsx`, `src/app/(app)/prestador/servicos/page.tsx` (link), `index.ts`.
- **Depends on:** T1.
- **Reuses:** `src/app/(app)/prestador/servicos/page.tsx` (guard), `jobs/components/job-applicants-list.tsx`, `empresa/[empresaId]/editar/page.test.tsx` (padrão do teste de guard, L-008).
- **Done when:** prestador vê linhas (nome/contato/data/serviço); não-PROVIDER ⇒ 404; lista vazia renderiza estado vazio.
- **Tests:** `page.test.tsx` (guard 404); component render.
- **Gate:** typecheck + lint + component/page.

### T3 — Testes de integração + E2E do gate
- **What:** `__tests__/list-provider-interests.int.test.ts`: ownership isolado (SVC035-MN-01 — sensor mata a mutação: remover o filtro `authorPersonId` ⇒ vê interesse alheio ⇒ falha); canceladas ausentes (SVC035-MN-03); não-vazamento de PII no payload (SVC035-MN-02); serviço PAUSED com manifestação ativa ainda aparece (§D4); auditoria SENSITIVE_FIELD_VIEWED emitida. E2E: gate de sessão da rota `/prestador/manifestacoes` (não autenticado / não-PROVIDER) — spec **real** (L-007); fluxo autenticado deferido a int/component (AD-019).
- **Where:** `src/modules/services/__tests__/list-provider-interests.int.test.ts`, `e2e/prestador-manifestacoes-gate.spec.ts`.
- **Depends on:** T1, T2. (Cruzado com USP-034 T4 para "cancelada some da lista".)
- **Reuses:** `jobs/__tests__/applications.int.test.ts` / `list-job-applicants` int tests.
- **Done when:** matriz verde; sensores de ownership e de não-vazamento matam suas mutações.
- **Gate:** `npm run test` + `npm run test:e2e` (gate) + build `NODE_ENV=production`.

---

## Matriz de rastreio AC → teste

| AC / MN | Teste |
|---|---|
| AC-035-1 | list-provider-interests.int :: retorna nome+contato+data+serviço das ativas |
| AC-035-2 | client-for-provider.view.spec :: shape via View Model; component consome só a view |
| SVC035-MN-01 | list-provider-interests.int :: prestador B não vê interesse do serviço de A |
| SVC035-MN-02 | list-provider-interests.int :: payload sem cpf/nascimento/endereço |
| SVC035-MN-03 | list-provider-interests.int :: manifestação cancelada ausente |
| Edge PROVIDER guard | prestador/manifestacoes/page.test :: não-PROVIDER ⇒ notFound |
| Edge sessão | e2e prestador-manifestacoes-gate :: não autenticado ⇒ gate |
