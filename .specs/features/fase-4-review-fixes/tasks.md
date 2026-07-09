# Tasks — Fase 4: Remediação da Review do PR #284

Branch: `feat/fase-4-servicos-manifestacoes` (base `master`). Mesma branch — **não** criar branch nova.
9 tasks atômicas, ~1 por achado (F2/F3 split em código+teste). Ordem de prioridade FINDINGS.md:
F1 → F2 → F3 → F4 → F5/F6/F7.

**Regras de commit (todas as tasks):**
- **Nunca** `git add -A` / `git add .`. Adicionar **só** os arquivos listados em "Commit", por caminho
  explícito. (Working tree tem deleções pré-existentes não relacionadas em `.claude/skills/**` e
  `.agents/**` — não tocar.)
- Conventional Commits com escopo de módulo. Rodapé:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Cada task deve deixar a árvore **verde** (typecheck+lint+unit no mínimo; testes de integração
  quando a task os toca).

**Paralelismo:** `[P]` = independente, pode rodar em paralelo. T7/T8/T9 são `[P]` entre si (arquivos
disjuntos). T1, T6 são `[P]` em relação ao resto.

---

## T1 — [F1] CTA do prestador aponta para `/prestador/servicos/nova`
- **What:** trocar o href do CTA "Publicar primeiro serviço" para a rota real e corrigir o
  teste-âncora cúmplice.
- **Where:**
  - `src/modules/persons/components/provider-form.tsx:268` — `href="/servicos/novo"` →
    `href="/prestador/servicos/nova"`.
  - `src/modules/persons/__tests__/ProviderForm.test.tsx:87` — literal do `toHaveAttribute`
    `'/servicos/novo'` → `'/prestador/servicos/nova'`.
- **Depends on:** — (independente, `[P]`)
- **Reuses:** rota `src/app/(app)/prestador/servicos/nova/page.tsx` (já existe). Nenhum código novo.
- **Done when:** o `<Link>` renderiza `/prestador/servicos/nova`; o teste assere o href correto e
  passa; nenhuma referência a `/servicos/novo` resta em `provider-form.tsx` nem no teste.
- **Tests:** `ProviderForm.test.tsx` (caso "revela CTA publicar primeiro serviço (E-003)") — âncora
  corrigida (AC-F1-1, AC-F1-2). Rodar: `npm run test -- ProviderForm`.
- **Gate:** typecheck, lint, unit (arquivo).
- **Commit:** `fix(persons): CTA do prestador aponta para /prestador/servicos/nova (F1)`
  — arquivos: `src/modules/persons/components/provider-form.tsx`,
  `src/modules/persons/__tests__/ProviderForm.test.tsx`.

---

## T2 — [F2] Gate de papel PROVIDER em `uploadServicePhoto` (código)
- **What:** aplicar o gate de papel PROVIDER logo após resolver a sessão, antes de tocar o Storage.
- **Where:** `src/modules/services/actions/upload-service-photo.ts` — inserir após o bloco
  "2. Ownership" (`:53-56`), antes do bloco "3. MIME real":
  ```
  if (!person.roles.includes('PROVIDER')) {
    return fail('FORBIDDEN', 'Você precisa ativar o papel de prestador para enviar fotos de serviço.');
  }
  ```
- **Depends on:** — (independente)
- **Reuses:** predicado espelha `require-service-authorization.ts:23-25`. `person.roles` de
  `getCurrentPerson()`.
- **Done when:** sessão sem PROVIDER → `FORBIDDEN` sem tocar Storage; happy-paths existentes
  (roles:['PROVIDER']) seguem OK. **Não** usar `requireServiceAuthorization` completo (exige consent —
  ver design F2 / spec assumption 2).
- **Tests:** os testes de integração existentes de `upload-service-photo.int.test.ts` (JPG/PNG/WEBP,
  MIME, tamanho, unauth, sem-arquivo) permanecem **verdes** (AC-F2-1). O caso negativo novo é T3.
- **Gate:** typecheck, lint, unit; integração `upload-service-photo.int.test.ts` verde.
- **Commit:** `fix(services): gate de papel PROVIDER em uploadServicePhoto (F2)`
  — arquivo: `src/modules/services/actions/upload-service-photo.ts`.

---

## T3 — [F2] Teste negativo: sessão sem PROVIDER → FORBIDDEN, sem escrita (MN-F2)
- **What:** adicionar caso de integração que prova MN-F2.
- **Where:** `src/modules/services/__tests__/upload-service-photo.int.test.ts` — novo `it(...)`:
  `mockPerson` com `roles: []` (ou `['CANDIDATE']`) + arquivo JPG válido → espera `res.ok===false` e
  `res.error.code==='FORBIDDEN'`; assere que `listStorageFiles(personId)` **não** cresceu (padrão
  `before.length` já usado nos casos MIME/tamanho).
- **Depends on:** T2.
- **Reuses:** helpers `baseMockPerson`, `jpgBytes`, `fileOf`, `listStorageFiles`, `storageOverride`
  já no arquivo.
- **Done when:** o novo caso passa; confirma FORBIDDEN + zero objetos novos no bucket sob o prefixo
  da Pessoa (AC-F2-2 / MN-F2).
- **Tests:** `npm run test -- upload-service-photo.int` (integração; requer DB local).
- **Gate:** typecheck, lint, integração (arquivo).
- **Commit:** `test(services): uploadServicePhoto nega sessão sem papel PROVIDER (F2)`
  — arquivo: `src/modules/services/__tests__/upload-service-photo.int.test.ts`.

---

## T4 — [F3] Validação de posse+formato de `photoStoragePaths` (código)
- **What:** regra pura de validação + wiring nas duas actions, antes do `create`.
- **Where:**
  - **Novo:** `src/modules/services/domain/photo-path.ts` — `isOwnedServicePhotoPath(path, ownerId)`
    com o regex estrito `/^<uuid>\/<uuid>\.(jpg|png|webp)$/` + `startsWith(`${ownerId}/`)` (ver design
    F3; extensões `jpg|png|webp`, **não** jpeg).
  - `src/modules/services/actions/create-service-draft.ts` — após `:61`
    (`const photoStoragePaths = …`), antes do `withAudit`:
    `if (!photoStoragePaths.every((p) => isOwnedServicePhotoPath(p, person.id))) return fail('VALIDATION', 'Foto inválida. Reenvie as fotos do serviço.');`
  - `src/modules/services/actions/submit-service-for-moderation.ts` — o **mesmo** check no ramo
    form-direto após `:82` (o ramo `{ serviceId }` não recebe paths → sem check).
- **Depends on:** — (independente)
- **Reuses:** padrão de `domain/photo-mime.ts` (regra pura), `fail` de `@/shared/errors`, `person.id`
  já resolvido nas actions.
- **Done when:** path próprio válido persiste; path de terceiro ou malformado (`../`, ext ruim,
  segmentos extras) → `VALIDATION` **antes** de `tx.service.create`; schema permanece `.min(1).max(3)`
  (não mover a validação para o Zod). Import intra-módulo via `../domain/photo-path`.
- **Tests:** o teste que prova é T5. Nesta task, garantir que a suíte existente segue verde
  (`submit-service.int.test.ts`, `create`-related, `submit-service.schema.test.ts` — nenhum passa
  photoStoragePaths reais, ver design "Riscos").
- **Gate:** typecheck, lint, unit; integração de serviços verde.
- **Commit:** `fix(services): valida posse/formato de photoStoragePaths no create/submit (F3)`
  — arquivos: `src/modules/services/domain/photo-path.ts`,
  `src/modules/services/actions/create-service-draft.ts`,
  `src/modules/services/actions/submit-service-for-moderation.ts`.

---

## T5 — [F3] Testes: rejeita path de terceiro/malformado (unit + integração) (MN-F3)
- **What:** unit exaustivo do helper puro + integração provando rejeição na action sem persistência.
- **Where:**
  - **Novo:** `src/modules/services/domain/__tests__/photo-path.test.ts` — matriz de
    `isOwnedServicePhotoPath`: próprio `${owner}/${uuid}.jpg|png|webp` → true; primeiro segmento de
    outro person → false; `${owner}/../x.jpg` → false; extensão `.jpeg`/`.gif`/sem ext → false;
    segmento não-UUID → false; string vazia → false (AC-F3-1..3).
  - **Novo:** `src/modules/services/__tests__/create-service-draft.int.test.ts` — `createServiceDraft`
    com `photoStoragePaths=['<other-person-uuid>/<uuid>.jpg']` → `VALIDATION` e **zero** serviços
    criados (checar `prisma.service.count` por author); com path próprio válido → `ok` e linha
    `ServicePhoto` criada. (AC-F3-2/3 / MN-F3.)
  - **Estender:** `src/modules/services/__tests__/submit-service.int.test.ts` — caso no ramo
    form-direto: submit com path de terceiro → `VALIDATION`, sem serviço criado.
- **Depends on:** T4.
- **Reuses:** padrão de fixture/cleanup de `search-services.int.test.ts` / `submit-service.int.test.ts`
  (`skipIf(!DATABASE_URL)`, `beforeAll`/`afterAll`, mock de `getCurrentPerson`).
- **Done when:** unit cobre a matriz e mata mutação (ex.: trocar `every`→`some`, remover
  `startsWith`); integração confirma VALIDATION + zero linhas.
- **Tests:** `npm run test -- photo-path` (unit) + `create-service-draft.int` / `submit-service.int`
  (integração).
- **Gate:** typecheck, lint, unit, integração.
- **Commit:** `test(services): rejeita photoStoragePath de terceiro/malformado (F3)`
  — arquivos: `src/modules/services/domain/__tests__/photo-path.test.ts`,
  `src/modules/services/__tests__/create-service-draft.int.test.ts`,
  `src/modules/services/__tests__/submit-service.int.test.ts`.

---

## T6 — [F4] Busca por categoria via subselect preserva o índice trgm
- **What:** reescrever o ramo de categoria do `WHERE` como predicado de `services` e remover o JOIN
  morto. Query-only, **sem migração**.
- **Where:** `src/modules/services/queries/search-services.ts`:
  - `buildWhere` (`:81-85`): substituir o `OR immutable_unaccent(lower(sc.name)) LIKE …` por
    `OR s.category_id IN (SELECT id FROM service_categories WHERE immutable_unaccent(lower(name)) LIKE immutable_unaccent(lower(${pattern})))` — parametrizado via `Prisma.sql` (ver design F4).
  - remover `LEFT JOIN service_categories sc ON sc.id = s.category_id` das **duas** queries (página
    `:113-114`, count `:121-122`) — após confirmar por grep que nenhum outro `sc.` resta.
- **Depends on:** — (independente, `[P]`)
- **Reuses:** `Prisma.sql`/`Prisma.join` já usados; índice `service_search_trgm` existente.
- **Done when:** ambos os ramos (título/descrição e categoria) são predicados de `services`;
  semântica preservada (termo casa título, descrição ou nome de categoria); nenhuma migração criada;
  nenhuma referência a `sc.` sobra no arquivo.
- **Tests:** `search-services.int.test.ts` **verde**, com o caso "busca textual casa pelo nome da
  categoria" (L215) provando AC-F4-2. (Opcional: reforçar com asserção de que q=nome-de-categoria
  retorna os serviços da categoria.) Rodar: `npm run test -- search-services.int`.
- **Gate:** typecheck, lint, integração (arquivo). **Confirmar `git status` — nenhum arquivo em
  `prisma/migrations/`.**
- **Commit:** `perf(services): busca por categoria via subselect preserva índice trgm (F4)`
  — arquivo: `src/modules/services/queries/search-services.ts`.

---

## T7 — [F5][P] Teste: `listServiceCategories` exclui sugestões
- **What:** integração que exercita `where: { isSuggestion: false }`.
- **Where:** **Novo** `src/modules/services/__tests__/list-service-categories.int.test.ts`. Semeia
  `catApproved` (`isSuggestion:false`) + `catSuggestion` (`isSuggestion:true`), nomes únicos; assere
  `listServiceCategories()` inclui approved, exclui suggestion. Cleanup por `name IN [...]`.
- **Depends on:** — (`[P]` com T8/T9)
- **Reuses:** padrão `skipIf(!DATABASE_URL)` + `beforeAll`/`afterAll` de `search-services.int.test.ts`.
- **Done when:** o filtro real é provado (AC-F5-1); mata a mutação de remover o `where`.
- **Tests:** `npm run test -- list-service-categories.int`.
- **Gate:** typecheck, lint, integração (arquivo).
- **Commit:** `test(services): listServiceCategories exclui sugestões (F5)`
  — arquivo: `src/modules/services/__tests__/list-service-categories.int.test.ts`.

---

## T8 — [F6][P] Teste: `listProviderServices` escopa por `authorPersonId`
- **What:** integração que exercita `where: { authorPersonId }`.
- **Where:** **Novo** `src/modules/services/__tests__/list-provider-services.int.test.ts`. Semeia
  2 Persons (A, B) + 1 `Service` cada (categoria/região próprias); assere
  `listProviderServices(A.id)` inclui o serviço de A e **exclui** o de B.
- **Depends on:** — (`[P]` com T7/T9)
- **Reuses:** padrão de fixture/cleanup de `search-services.int.test.ts`.
- **Done when:** prova que dado de outro author não vaza (AC-F6-1); mata a mutação de remover/afrouxar
  o `where`.
- **Tests:** `npm run test -- list-provider-services.int`.
- **Gate:** typecheck, lint, integração (arquivo).
- **Commit:** `test(services): listProviderServices escopa por authorPersonId (F6)`
  — arquivo: `src/modules/services/__tests__/list-provider-services.int.test.ts`.

---

## T9 — [F7][P] Teste: `getMyActiveServiceInterest` ignora canceladas
- **What:** integração que exercita `where: { …, cancelledAt: null }`.
- **Where:** **Novo** `src/modules/services/__tests__/get-my-service-interest.int.test.ts`. Semeia
  `Service` ACTIVE + `client` Person; cria 1 interesse **cancelado** (`cancelledAt` setado) + 1
  **ativo** (`cancelledAt:null`) para o mesmo client+service (o índice parcial
  `uq_service_interest_active` permite coexistirem). Assere retorna o id do ativo e nunca o cancelado
  (AC-F7-1/2). Caso extra: só cancelado → `null`.
- **Depends on:** — (`[P]` com T7/T8)
- **Reuses:** padrão de fixture/cleanup; modelos `ServiceInterest`/`Service`/`Person`.
- **Done when:** prova cancelada≠ativa e ativa=ativa; mata a mutação de remover `cancelledAt:null`.
- **Tests:** `npm run test -- get-my-service-interest.int`.
- **Gate:** typecheck, lint, integração (arquivo).
- **Commit:** `test(services): getMyActiveServiceInterest ignora canceladas (F7)`
  — arquivo: `src/modules/services/__tests__/get-my-service-interest.int.test.ts`.

---

## Gate final (no HEAD, após todas as tasks — pré-condição de PASS do Verifier)
- `npm run typecheck` · `npm run lint`
- `npm run test` (unit) · integração completa (DB local :55322)
- `NODE_ENV=production npm run build`
- `git status` limpo dos arquivos alvo; **nenhuma** migração nova em `prisma/migrations/`; nenhuma
  deleção de `.claude/skills/**` / `.agents/**` commitada por engano.

## Grafo de dependências
```
T1 [F1] ──────────────(P)
T2 [F2 code] → T3 [F2 test]
T4 [F3 code] → T5 [F3 test]
T6 [F4] ──────────────(P)
T7 [F5] ─┐
T8 [F6] ─┼─(P entre si)
T9 [F7] ─┘
```
</content>
