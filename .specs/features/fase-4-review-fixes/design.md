# Design — Fase 4: Remediação da Review do PR #284

Escopo: 7 correções cirúrgicas (F1–F7). Cada seção dá o arquivo exato, a forma da mudança (contrato,
não código completo), o que reusa, como a must-not é enforçada e a estratégia de teste. Convenções:
`CLAUDE.md` (sequência de Server Action, `ActionResult`, sem `throw`, `select`/`take`).

---

## F1 — CTA do prestador → rota real `/prestador/servicos/nova`

**Arquivo:** `src/modules/persons/components/provider-form.tsx:268`
**Mudança:** trocar o `href` do `<Link>` dentro do CTA "Publicar primeiro serviço":
- de `href="/servicos/novo"` → `href="/prestador/servicos/nova"`.

**Por que a rota certa:** `src/app/(app)/prestador/servicos/nova/page.tsx` existe (`force-dynamic`,
`requireActivePerson`, renderiza `ServiceForm` + `listServiceCategories`). É a mesma rota que
`service-management-list.tsx:24` já usa ("Publicar serviço") — âncora coerente pelos dois lados.
`/servicos/novo` casaria `(public)/servicos/[id]` (id="novo") → `getActiveServiceDetail` → null →
`ServicoIndisponivel`. Nenhum rewrite salva (verificado em `next.config`).

**Teste cúmplice:** `src/modules/persons/__tests__/ProviderForm.test.tsx:85-88` assere
`toHaveAttribute('href', '/servicos/novo')`. Atualizar o literal para `/prestador/servicos/nova`.
O teste é parte da correção — ancora o href correto (evita reincidência).

**Reusa:** rota já existente; nenhum código novo.

---

## F2 — Gate de papel PROVIDER em `uploadServicePhoto`

**Arquivo:** `src/modules/services/actions/upload-service-photo.ts`
**Mudança:** logo após resolver a sessão (bloco "2. Ownership", `:53-56`) e **antes** do bloco
"3. MIME real" (e portanto muito antes do Storage no bloco 4), inserir o gate de papel:

```
const person = await getCurrentPerson();
if (!person) {
  return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
}
// NOVO (F2): gate de papel PROVIDER antes de tocar o Storage (passo 2 da sequência canônica).
if (!person.roles.includes('PROVIDER')) {
  return fail('FORBIDDEN', 'Você precisa ativar o papel de prestador para enviar fotos de serviço.');
}
```

**Reusa:** o predicado espelha o 1º check de `requireServiceAuthorization`
(`server/require-service-authorization.ts:23-25`) e o formato de mensagem. `person.roles` vem de
`getCurrentPerson()` (`CurrentPerson`), que já filtra grants ACTIVE (session.ts).

**Decisão (assumption 2 do spec):** gate = **papel apenas**, sem `SERVICE_OFFERING` consent. Não
chamar `requireServiceAuthorization(person.id, person.roles, null)` integralmente aqui — ele exige
consent ativo, o que quebraria os happy-paths existentes (JPG/PNG/WEBP têm `roles:['PROVIDER']` mas
não semeiam consent) e semanticamente o consent pertence ao create/submit (a foto ainda não é de um
serviço). Teto de volume por Pessoa fica como follow-up (FINDINGS.md).

**Enforcement de MN-F2:** o `return fail('FORBIDDEN', …)` ocorre **antes** de
`createSupabaseStorageClient().upload(...)`. Nada é gravado no bucket para não-PROVIDER.

**Ordem preservada:** parse do File (bloco 1) permanece antes do gate — mesma ordem de
`uploadCv`/sequência canônica (validação de input → autenticação → autorização → efeito). O teste
"sem arquivo → VALIDATION" continua verde (parse falha antes do gate).

---

## F3 — Validação de posse+formato de `photoStoragePaths`

### Novo arquivo puro: `src/modules/services/domain/photo-path.ts`
Regra pura, sem IO (espelha `domain/photo-mime.ts`). Exporta:

```
/** Formato estrito gerado por uploadServicePhoto: `${uuid}/${uuid}.(jpg|png|webp)`. */
const SERVICE_PHOTO_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** true se `path` casa o formato do upload E pertence a `ownerPersonId` (1º segmento). */
export function isOwnedServicePhotoPath(path: string, ownerPersonId: string): boolean {
  return SERVICE_PHOTO_PATH_RE.test(path) && path.startsWith(`${ownerPersonId}/`);
}
```

- O regex garante **um único** `/` e segmentos hex-UUID → bloqueia `../`, segmentos extras,
  não-UUID e extensões fora de {jpg,png,webp}.
- `startsWith(`${ownerPersonId}/`)` garante **posse** (1º segmento === `person.id`). Combinado ao
  regex de segmento único, é equivalente a "primeiro segmento é exatamente o person.id".
- Extensões: `(jpg|png|webp)` — **não** `jpeg` (o detector nunca emite `.jpeg`). Divergência
  deliberada e mais estrita que a sugestão de FINDINGS.md (spec, assumption 1).

### Wiring nas duas actions
Barrel do domínio: importar via `../domain/photo-path` (caminho relativo intra-módulo, como
`../domain/dedup`).

**`create-service-draft.ts`** — após `const photoStoragePaths = data.photoStoragePaths ?? [];`
(`:61`), antes do `withAudit`:
```
if (!photoStoragePaths.every((p) => isOwnedServicePhotoPath(p, person.id))) {
  return fail('VALIDATION', 'Foto inválida. Reenvie as fotos do serviço.');
}
```

**`submit-service-for-moderation.ts`** — no ramo **form-direto** (3b/4b), após
`const photoStoragePaths = data.photoStoragePaths ?? [];` (`:82`), antes do `withAudit`, o mesmo
check. O ramo `{ serviceId }` (submeter rascunho existente) **não** recebe paths — as fotos já foram
validadas na criação do rascunho — logo não precisa do check.

**Reusa:** `fail('VALIDATION', …)` do `@/shared/errors`; `person.id` já resolvido acima em ambas as
actions.

**Enforcement de MN-F3:** o `return fail('VALIDATION')` ocorre **antes** de `tx.service.create` →
zero linhas `Service`/`ServicePhoto` criadas para input malicioso.

**Camada, não schema:** a validação fica na **action** (precisa de `person.id` da sessão, que o Zod
schema não tem). O schema `publish-service.schema.ts:52` permanece `.min(1).max(3)` — o teste
`submit-service.schema.test.ts:105` (rejeita 4 fotos) fica verde (opera na camada Zod, antes do
check de posse). Fixtures de view (`author-1/foto.jpg`) não passam pela action → intactos.

---

## F4 — Reescrever o ramo de categoria como predicado de `services`

**Arquivo:** `src/modules/services/queries/search-services.ts`
**Função:** `buildWhere` (`:61-89`) + o SQL raw das duas queries (`:110-123`).

**Antes** (`:81-85`):
```
conds.push(Prisma.sql`(
  immutable_unaccent(lower(coalesce(s.title, '') || ' ' || coalesce(s.description, '')))
    LIKE immutable_unaccent(lower(${pattern}))
  OR immutable_unaccent(lower(sc.name)) LIKE immutable_unaccent(lower(${pattern}))
)`);
```

**Depois** — ambos os ramos viram predicados de `services` (título/descrição via índice trgm;
categoria via `category_id IN (subselect)`), permitindo ao planner combinar índices por BitmapOr:
```
conds.push(Prisma.sql`(
  immutable_unaccent(lower(coalesce(s.title, '') || ' ' || coalesce(s.description, '')))
    LIKE immutable_unaccent(lower(${pattern}))
  OR s.category_id IN (
    SELECT id FROM service_categories
    WHERE immutable_unaccent(lower(name)) LIKE immutable_unaccent(lower(${pattern}))
  )
)`);
```

**JOIN morto:** após a reescrita, o alias `sc` não é mais referenciado em `buildWhere`. Remover o
`LEFT JOIN service_categories sc ON sc.id = s.category_id` das **duas** queries (página `:113-114` e
count `:121-122`) — join agora inútil. Confirmar por grep que nenhuma outra referência a `sc.`
sobra no arquivo antes de remover.

**Parametrização:** mantém `${pattern}` via `Prisma.sql` (sem concatenação). O subselect é
self-contained (sem colisão de alias). A tabela `service_categories` é o catálogo D-007 (pequeno) —
seq scan nela é barato; o ganho é o predicado de `services` deixar de bloquear o GIN index.

**Semântica preservada (AC-F4-2):** termo casa título, descrição **ou** nome de categoria. Não
mexe nos demais `conds` (status ACTIVE, prestador ativo, categoria/região/preço em AND).

**Sem migração:** o índice `service_search_trgm` já existe e está correto (FINDINGS.md). Nada muda no
schema.

---

## F5/F6/F7 — Testes que exercitam o `where` real (integração)

Padrão comum (espelha `search-services.int.test.ts`): `describe.skipIf(!process.env.DATABASE_URL)`,
`beforeAll` semeia fixture com nomes únicos, `afterAll` limpa (`deleteMany` por id/nome), asserção
por presença/ausência de id. Postgres local :55322.

### F5 — `list-service-categories.int.test.ts` (novo)
Semeia 2 categorias com nomes únicos: `catApproved` (`isSuggestion:false`) e `catSuggestion`
(`isSuggestion:true`). Chama `listServiceCategories()` e assere: inclui `catApproved.id`, **não**
inclui `catSuggestion.id`. Cleanup por `name IN [...]`.

### F6 — `list-provider-services.int.test.ts` (novo)
Semeia 2 Persons (`authorA`, `authorB`) e um `Service` para cada (categoria/região próprias do
teste). Chama `listProviderServices(authorA.id)` e assere: inclui o serviço de A, **não** inclui o
de B. Cleanup: `service.deleteMany` por author, `person.deleteMany`, taxonomia por nome.

### F7 — `get-my-service-interest.int.test.ts` (novo)
Semeia um `Service` ACTIVE + um `client` Person. Cria **um interesse cancelado** (`cancelledAt`
setado) e **um interesse ativo** (`cancelledAt:null`) para o mesmo client+service — o índice único
parcial `uq_service_interest_active` permite coexistirem (só 1 ativo). Assere:
`getMyActiveServiceInterest(service.id, client.id)` retorna o id do **ativo** (AC-F7-2) e nunca o do
cancelado (AC-F7-1). Caso extra: um par service/client só com interesse cancelado → retorna `null`.
Cleanup: `serviceInterest.deleteMany`, `service.deleteMany`, `person.deleteMany`, taxonomia.

---

## Estratégia de teste — matriz AC → teste

| AC | Prova | Arquivo de teste | Tipo |
|---|---|---|---|
| AC-F1-1, AC-F1-2 | href correto no CTA | `persons/__tests__/ProviderForm.test.tsx` (âncora corrigida) | componente (unit) |
| AC-F2-1 | PROVIDER → upload OK (happy-paths existentes) | `services/__tests__/upload-service-photo.int.test.ts` (existentes verdes) | integração |
| AC-F2-2 / MN-F2 | sem PROVIDER → FORBIDDEN, sem escrita no Storage | `upload-service-photo.int.test.ts` (novo caso) | integração (negativo) |
| AC-F3-1..3 (matriz) | própria válida→true; terceiro/`../`/ext ruim→false | `services/domain/__tests__/photo-path.test.ts` (novo) | unit (puro) |
| AC-F3-2/3 / MN-F3 | action rejeita path de terceiro/malformado, sem linha | `create-service-draft.int.test.ts` (novo) + `submit-service.int.test.ts` (caso novo, ramo form-direto) | integração (negativo) |
| AC-F4-1, AC-F4-2 | busca por nome de categoria ainda acha o serviço | `services/__tests__/search-services.int.test.ts` (existente L215 verde; reforço opcional) | integração |
| AC-F5-1 | sugestão excluída, aprovada incluída | `services/__tests__/list-service-categories.int.test.ts` (novo) | integração |
| AC-F6-1 | serviço de outro author não vaza | `services/__tests__/list-provider-services.int.test.ts` (novo) | integração |
| AC-F7-1, AC-F7-2 | cancelada não conta como ativa; ativa conta | `services/__tests__/get-my-service-interest.int.test.ts` (novo) | integração |

**DoD de Server Action (F2/F3):** os dois achados de segurança têm **teste negativo** dedicado
(permission-denied em F2; rejected-input em F3), além do happy-path preservado — conforme
`project-guideline.md`.

---

## Divergências declaradas de FINDINGS.md
1. **Extensões do regex de F3:** `(jpg|png|webp)` em vez de `(jpg|jpeg|png|webp)` — o path gerado
   nunca contém `.jpeg`; ser mais estrito é seguro (design F3 / spec assumption 1).
2. **Gate de F2:** papel PROVIDER **apenas**, não `requireServiceAuthorization` completo (que exige
   consent) — evita quebrar happy-paths e respeita a fronteira de consent no create/submit (design
   F2 / spec assumption 2). FINDINGS.md autoriza explicitamente ("no mínimo o check de papel").

## Riscos / regressões
- **F4:** risco de o `LEFT JOIN` removido ser referenciado em outro lugar do arquivo — mitigado por
  grep de `sc.` antes de remover. A query de count e a de página devem sofrer a **mesma** edição
  (fonte única do `WHERE` via `buildWhere` já garante o predicado; só os JOINs das duas queries
  externas mudam).
- **F3:** risco de quebrar um teste que passe path fora do formato — verificado: nenhum teste de
  integração passa `photoStoragePaths`; o único uso é schema-level (`.max(3)`) e mocks de client.
- **F2:** risco de os happy-paths de upload não terem PROVIDER — verificado: `baseMockPerson` usa
  `roles:['PROVIDER']`, ficam verdes.
</content>
