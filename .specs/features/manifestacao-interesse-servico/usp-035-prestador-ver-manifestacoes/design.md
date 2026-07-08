# USP-035 — Design

Espelha **AD-018 / `listJobApplicants` + `viewCandidateForEmployer`** (empregador vê candidatos):
leitura owner-scoped, recorte de PII no `select`, projeção única por View Model, auditoria de acesso.

## D1 — Query `listProviderInterests` (inbox provider-wide)

Arquivo `src/modules/services/queries/list-provider-interests.ts`.
Assinatura: `listProviderInterests(viewer: CurrentPerson, page?: number): Promise<ProviderInterestsResult>`
(ou `ActionResult<…>` se preferir o shape de `listJobApplicants` — manter consistência com o precedente).

Decisão de escopo: **inbox agregado do prestador** (todas as manifestações ativas dos serviços
dele), não por-serviço. Satisfaz "manifestações nos meus serviços" (plural) com uma rota só;
cada linha referencia o serviço (AC-035-1 "serviço referenciado"). Divergência de forma vs. o
precedente por-vaga de `jobs` (justificada: prestador PF é uma Pessoa, não tem contexto `empresaId`).

- **Ownership no `where`** (SVC035-MN-01): `{ service: { authorPersonId: viewer.id }, cancelledAt: null }`. Não há como ver interesse de serviço alheio — o filtro é a barreira (não há id de serviço vindo do input a validar).
- **Paginação obrigatória:** `take: PROVIDER_INTERESTS_PAGE_SIZE (=20)`, `skip`, `orderBy:{ interestedAt: 'desc' }`.
- **`select` recortado** (SVC035-MN-02): `{ id, interestedAt, service:{ select:{ id, title } }, client:{ select:{ fullName, phone, emailLogin } } }`. `cpf`/`birthDate`/endereço **nunca** entram no payload.
- **Auditoria de acesso** (espelha AD-018): dentro de uma tx, emitir um `SENSITIVE_FIELD_VIEWED` por cliente exibido (`entityType:'person'`, `entityId: clientPersonId`, `after:{ viewedFields:['phone','email'], via:'provider_interests' }`, actor = viewer). Evento já existe (`events.ts:113`). Sem evento novo.

## D2 — View Model `viewClientForProvider`

Arquivo `src/modules/services/views/client-for-provider.view.ts` (ou em `persons/views/` se
espelhar `viewCandidateForEmployer` — **decisão: manter em `services`**, pois o observador é o
prestador do serviço e o dado é escopado ao agregado de manifestações). Assinatura pura
`viewClientForProvider(row): ProviderInterestView = { interestId, clientName: string, contact: { phone: string|null, email: string|null }, interestedAt: Date, service: { id, title } }`.
Único ponto de projeção; o componente consome só o View Model, nunca linhas Prisma
(AC-035-2). O recorte de campos entitled acontece no `select` da query (D1); o View Model só
projeta o shape.

## D3 — Rota + componente

- Página NET-NEW `src/app/(app)/prestador/manifestacoes/page.tsx` (`export const dynamic = 'force-dynamic'`). Guard igual ao de `prestador/servicos/page.tsx`: `const person = await requireActivePerson(); if (!person.roles.includes('PROVIDER')) notFound();`. Depois `const rows = await listProviderInterests(person)` → `<ProviderInterestsList items={rows} />`. Título "Manifestações recebidas".
- Component NET-NEW `src/modules/services/components/provider-interests-list.tsx` — server component de apresentação, espelha `job-applicants-list.tsx`; consome `ProviderInterestView[]`; estado vazio ("Nenhuma manifestação ainda."). Data formatada por `formatDate` (borda `America/Sao_Paulo`).
- **Navegação:** adicionar link para `/prestador/manifestacoes` a partir do painel `prestador/servicos` (afordância mínima).

## D4 — Decisão sobre serviços não-ativos com manifestação

Diferente da lista pública, o inbox **não filtra pelo status do serviço** — lista toda
manifestação ativa dos serviços do prestador mesmo que o serviço esteja PAUSED/ARCHIVED (o
prestador ainda quer contatar quem já o procurou). Documentado no spec §Edge.

## Convenções / lições
- Barrel: exportar `listProviderInterests`, `PROVIDER_INTERESTS_PAGE_SIZE`, `viewClientForProvider`, tipos e o componente em `index.ts`.
- **L-008:** a rota `(app)` com guard `requireActivePerson + notFound()` DEVE ganhar um `page.test.tsx` barato (mock de `next/navigation` + `requireActivePerson` + prisma) — não deferir o 404 só ao E2E.
- **L-007 / AD-019:** E2E autenticado do inbox é deferido (sem seed de sessão Supabase no Playwright); cobertura autoritativa em int/component; E2E cobre só o gate de sessão da rota (spec real, não `.fixme`).
