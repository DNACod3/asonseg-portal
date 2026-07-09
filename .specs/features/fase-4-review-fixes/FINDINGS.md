# Fase 4 — Remediação da Review do PR #284

Unidade de execução: correção de **todos** os achados da review multi-agente do PR #284
(branch `feat/fase-4-servicos-manifestacoes`, base `master`). Não é uma USP nova — é
remediação cirúrgica de USPs já entregues na Fase 4. Corrigir na **mesma branch**.

Cada achado abaixo é uma task candidata. Ordem de prioridade: F1 (🚨) → F2/F3 (🔒) → F4 (⚡) → F5–F7 (⚠️).

---

## F1 — 🚨 CTA quebrada USP-010 → USP-029 (correctness / integração)
- **Onde:** `src/modules/persons/components/provider-form.tsx` — o CTA "Publicar primeiro serviço" (E-003) aponta para `/servicos/novo`.
- **Problema:** a rota `/servicos/novo` **não existe**. A rota real de publicação criada na USP-029 é `/prestador/servicos/nova`. Em runtime `/servicos/novo` casa no detalhe público `(public)/servicos/[id]` com `id="novo"` → `getActiveServiceDetail("novo", null)` → null → `ServicoIndisponivel`. O prestador nunca chega ao formulário de publicação.
- **Teste cúmplice:** o teste-âncora em `src/modules/persons/__tests__/` (provavelmente `provider-ds-tokens.guard.test.ts` ou o test de `provider-form`) fixa o href errado, então o CI verde mascara o bug.
- **Correção:** trocar o href para `/prestador/servicos/nova` e ajustar o teste-âncora para refletir o href correto. Confirmar que não há rewrite/redirect que salve `/servicos/novo` (não há — verificado na review).
- **Verificação:** o teste deve assertir o href correto; idealmente um E2E/rota-guard que garanta que a rota do CTA resolve para a página de publicação e não para "serviço indisponível".

## F2 — 🔒 `uploadServicePhoto` sem gate de papel PROVIDER nem teto de volume
- **Onde:** `src/modules/services/actions/upload-service-photo.ts` (~L53, resolução da sessão).
- **Problema:** a action só exige sessão autenticada. Qualquer Pessoa (mesmo sem papel PROVIDER, ou só CANDIDATE/CLIENT) grava no bucket **público** `provider-photos`, com URL determinística de CDN, sem moderação e sem vínculo obrigatório a um serviço. Desvia do passo 2 da sequência canônica de Server Action (verificação de permissão). Sem teto de quantidade — o limite de 3 fotos só existe no client e no array do submit.
- **Correção:** aplicar o gate de papel PROVIDER (espelhar `createServiceDraft`/`submitServiceForModeration`: `requireServiceAuthorization(person.id, person.roles, null)` ou no mínimo o check de papel PROVIDER) logo após resolver a sessão, antes de tocar o Storage. Considerar teto por Pessoa (contagem de objetos sob o prefixo `person.id/` ou rate-limit) — se for além do escopo mínimo, documentar como follow-up, mas o gate de papel é obrigatório.
- **Verificação:** teste de integração cobrindo: PROVIDER → OK; sessão sem papel PROVIDER → FORBIDDEN (sem escrita no Storage). Manter os testes existentes de MIME/tamanho verdes.

## F3 — 🔒 `photoStoragePaths` do input do cliente sem validação de posse/formato
- **Onde:** `src/modules/services/actions/create-service-draft.ts` (~L61) e o caminho equivalente em `src/modules/services/actions/submit-service-for-moderation.ts`; schema em `src/modules/services/schemas/publish-service.schema.ts` (ou onde `photoStoragePaths` é validado).
- **Problema:** `photoStoragePaths` vem do cliente e é validado só como `string.trim().min(1)` + máx. 3, sem vínculo com a Pessoa da sessão. Como o upload namespaces o path por Pessoa (`${person.id}/${uuid}.${ext}`), um cliente malicioso pode: (a) referenciar a foto de **outro** prestador (misatribuição de conteúdo); (b) enviar strings arbitrárias (incl. `../`) persistidas cruas em `ServicePhoto.storagePath` e interpoladas em `buildServicePhotoUrl` → `<img src>` na busca e detalhe públicos.
- **Correção:** validar server-side, antes do `create`, que cada path (1) casa o formato estrito gerado pelo upload — ex.: `/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/` (confirmar o padrão real de `uploadServicePhoto`) — e (2) começa com `${person.id}/` (posse). Rejeitar com erro `VALIDATION` caso contrário. Aplicar no `createServiceDraft` **e** no `submitServiceForModeration`.
- **Verificação:** teste cobrindo path de outro `person.id` → rejeitado; path com formato inválido/`../` → rejeitado; path próprio válido → aceito.

## F4 — ⚡ `OR` sobre `sc.name` derruba o índice `service_search_trgm`
- **Onde:** `src/modules/services/queries/search-services.ts` (~L84, ramo de categoria do WHERE do SQL raw).
- **Problema:** o `OR` que compara `sc.name` (relação juntada `service_categories`) impede o Postgres de usar o índice GIN trgm `service_search_trgm` (que é sobre `services.title||description`), forçando varredura por linha das services ACTIVE — O(N_active) por busca. O ramo título+descrição já está correto (wrappers `immutable_unaccent(lower(...))` idênticos entre índice e query).
- **Correção:** reescrever o ramo de categoria como predicado da tabela `services` — ex.: `s.category_id IN (SELECT id FROM service_categories WHERE immutable_unaccent(lower(name)) LIKE ...)` — para que ambos os ramos sejam predicados de `services` e o planner possa combinar índices via BitmapOr. Manter a semântica de busca (termo casa título, descrição **ou** nome de categoria). Preservar a parametrização via `Prisma.sql` (sem concatenação).
- **Verificação:** o teste de integração `search-services.int.test.ts` deve continuar verde (busca por nome de categoria ainda retorna o serviço); idealmente um caso que prove que buscar por termo de categoria acha o serviço.

## F5 — ⚠️ `listServiceCategories` sem teste do filtro `isSuggestion: false`
- **Onde:** `src/modules/services/queries/list-service-categories.ts` (~L16).
- **Problema:** o filtro `isSuggestion: false` (só categorias aprovadas) só é referenciado via `vi.fn()` em page tests; a lógica real do `where` nunca é exercitada.
- **Correção:** adicionar teste (integração de preferência, ou unit se houver harness de prisma-mock consistente no módulo) que prove que sugestões (`isSuggestion: true`) são excluídas e aprovadas são retornadas.

## F6 — ⚠️ `listProviderServices` sem teste do escopo por `authorPersonId`
- **Onde:** `src/modules/services/queries/list-provider-services.ts` (~L27).
- **Problema:** o escopo por `authorPersonId` (dados próprios do prestador) só é validado por "a query foi chamada com o id certo" no page test — o `where` em si não é exercitado.
- **Correção:** teste que prove que serviços de **outro** `authorPersonId` não vazam no resultado.

## F7 — ⚠️ `getMyActiveServiceInterest` sem teste do filtro `cancelledAt: null`
- **Onde:** `src/modules/services/queries/get-my-service-interest.ts` (~L16).
- **Problema:** o filtro `cancelledAt: null` (que decide CTA de manifestar vs. bloqueio/revelação de contato) só é mockado no page test.
- **Correção:** teste que prove que uma manifestação cancelada (`cancelledAt` != null) não é retornada como ativa e uma ativa é.

---

## Gates obrigatórios no HEAD (rodar antes de declarar PASS)
- `npm run typecheck` · `npm run lint`
- `npm run test` (unit) · integração (Postgres/Supabase local em :55322)
- `NODE_ENV=production npm run build`
- Migrações: nenhuma nova esperada (F4 é query-only; **não** criar migração salvo se o índice precisar mudar — a review indica que o índice está correto, só a query precisa aproveitá-lo).

## Restrições
- **Não** usar `git add -A` / `git add .`: o working tree tem deleções pré-existentes não relacionadas em `.claude/skills/**` e `.agents/**`. Commitar apenas os arquivos tocados por cada task (add por caminho explícito).
- Convencional Commits com escopos de módulo: `fix(services):`, `fix(persons):`, `test(services):`, `perf(services):`.
- Manter os padrões do `CLAUDE.md` (sequência de Server Action, View Models, `take`/`select`, `withAudit`, sem `throw` em Server Action).
