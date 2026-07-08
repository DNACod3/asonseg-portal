# USP-031 — Ver detalhe do serviço (design)

Espelha `jobs/queries/get-job-detail.ts` + `jobs/views/job-detail.view.ts` + `(public)/vagas/[id]/page.tsx`. NET-NEW. **Sem migração** (usa o schema da USP-029).

## 1. Query `getActiveServiceDetail(id, viewer)` — `services/queries/get-service-detail.ts`

Mirror de `getActiveJobDetail` com `React.cache()` memoizado por `(id, authenticated)` (para a página e o `generateMetadata` anônimo compartilharem 1 hit).

**Filtro on-read (retorna `null` se não casar → estado "indisponível", não conteúdo):**
```ts
prisma.service.findFirst({
  where: { id, status: 'ACTIVE', author: { inactivatedAt: null } },
  select: serviceDetailSelect,   // ver §2 — NUNCA seleciona phone/emailLogin
});
```
`serviceDetailSelect`: `id, title, description, priceMin, priceMax, priceUnit, availabilityDescription, publishedAt, category:{select:{name}}, region:{select:{name}}, photos:{select:{storagePath,position}, orderBy:{position:'asc'}}, author:{select:{fullName}}, company:{select:{nomeFantasia}}`. **Contato ausente do select** (SVC031-MN-01 — defesa RSC/Flight: o campo nem é carregado).

Opcional: `getServiceUnavailableNotice(id)` (mirror `getPausedJobNotice`) para distinguir "pausado/encerrado" de inexistente. MVP pode retornar só `null`→"indisponível".

## 2. View Model fonte única — `viewServiceDetail(row, viewer)` — `services/views/service-detail.view.ts`

Mirror de `viewJobDetail`. Retorna `ServiceDetail`:
```
{ id, title, description, category, region,
  price: { min, max, unit } | null,        // sempre exibido (PRD "valor"); null só se todos ausentes
  availability, photos: PhotoUrl[],        // URLs públicas do bucket provider-photos
  provider: { displayName, isPF },         // displayName = company.nomeFantasia (companyId) | author.fullName (PF)
  publishedAt,
  canManifestInterest }                    // = viewer != null (afordância; ação é U3)
```
- **Nome público** (ADR-0010): `provider.displayName` exibido a todos (anônimo e autenticado). Não há branch de anonimização de nome (diferença vs jobs).
- **Contato ausente**: `ServiceDetail` **não tem** campos de telefone/e-mail. A barreira U2 é o contato, revelado só na USP-033.
- Também exporta `serviceDetailJsonLd(service: ServiceDetail)` (schema.org `Service`, **sem contato**) e reusa o `serializeJsonLd` de jobs (promover para `@/shared/lib` OU replicar — replicar é mais simples; documentar).

## 3. Rota `(public)/servicos/[id]/page.tsx`

Mirror `vagas/[id]/page.tsx`:
- `export const revalidate = 1800;`
- `generateMetadata({params})`: `getActiveServiceDetail(id, null)` (**sempre anônimo**), `noindex`/"Serviço indisponível" se `null`, senão título/descrição/OG/canonical de `viewServiceDetail(row, null)` (SVC031-MN-03 — mesma fonte).
- Página: `viewer = getCurrentPerson()` → `getActiveServiceDetail(id, viewer)` → `viewServiceDetail(row, viewer)` → `<ServiceDetailView>`; se `null` → `<ServicoIndisponivel>`. JSON-LD `<script dangerouslySetInnerHTML>` com `serializeJsonLd(serviceDetailJsonLd(viewServiceDetail(row, null)))`.
- `<AsonsegDisclaimer/>` (AC-031-4, componente da USP-030).
- CTA autenticado (seam U3): se `canManifestInterest`, renderizar botão "Entrar em contato" que aponta para o fluxo de manifestação (a ação real e a revelação são USP-033). Não implementar persistência/revelação.

## 4. Componentes

`components/service-detail.tsx` (server) — mirror `job-detail.tsx`: galeria de fotos, valor/unidade, região, disponibilidade, nome do prestador/Empresa, disclaimer, CTA. `components/servico-indisponivel.tsx`.

## 5. Fonte única — teste de arquitetura (SVC031-MN-03)

`__tests__/service-detail-single-source.test.ts` (estático): a rota `servicos/[id]/page.tsx` e `generateMetadata` derivam de `viewServiceDetail`/`serviceDetailJsonLd`; **não** há segunda query Prisma de serviço na rota que selecione campos de contato. Espelha o espírito do teste que garante `viewJobDetail` como fonte única.

## 6. Barrel

`services/index.ts`: `getActiveServiceDetail`, `viewServiceDetail` (+`ServiceDetail`, `serviceDetailJsonLd`, `serializeJsonLd`), `ServiceDetailView`.

## Knowledge chain

Resolvido do codebase (get-job-detail, job-detail.view, vagas/[id]). Sem incerteza pendente.
