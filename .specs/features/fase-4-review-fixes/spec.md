# Spec — Fase 4: Remediação da Review do PR #284

**Feature slug:** `fase-4-review-fixes`
**Unit type:** Remediação cirúrgica (NÃO é USP nova). Correção dos 7 achados da review
multi-agente do PR #284, na **mesma** branch `feat/fase-4-servicos-manifestacoes` (base `master`).
**Source of truth (WHAT):** `.specs/features/fase-4-review-fixes/FINDINGS.md` (achados F1–F7).
**Project glue:** ROADMAP Fase 4 (AD-020, 100% concluída) · STATE `## Recent Decisions` AD-020 ·
`CLAUDE.md` (sequência de Server Action, View Models, `take`/`select`, sem `throw`) ·
`docs/arch/project-guideline.md` (DoD de testes de Server Action).

> As ACs deste spec mapeiam **1:1** aos achados F1–F7. Nada fora de FINDINGS.md entra.
> Traceabilidade chaveada nos IDs de achado (F1..F7); os dois achados de segurança viram
> **must-nots** de primeira classe (MN-F2, MN-F3) com teste negativo obrigatório.

---

## Sizing verdict: **Large**

- 9 tasks atômicas sobre **8 arquivos de produção** + testes → não é Quick (≤3 arquivos/uma frase)
  nem Medium (>5 passos com dependências).
- **Piso de sizing (regra dura):** F2 e F3 são achados 🔒 de segurança — prohibições de mundo
  ("uma Pessoa sem papel PROVIDER **não pode** gravar no bucket público"; "um serviço **não pode**
  persistir um caminho de foto não-próprio/malformado"). Materializadas como **must-nots**
  (MN-F2/MN-F3) exigem teste negativo discriminante cada → o auto-sizing **não pode** rebaixar
  para Quick/Medium. Design + Tasks obrigatórios.
- Multi-componente: Client Component (F1) + Server Actions (F2/F3) + schema/domain puro (F3) +
  query SQL raw (F4) + 3 queries de leitura (F5/F6/F7).

---

## Escopo

**Em escopo:** exatamente os achados F1–F7. Correção + o(s) teste(s) que a prova.

**Fora de escopo (non-goals):**
- Re-planejar a Fase 4 ou qualquer USP entregue. Só remediação dos achados.
- Migrações novas. F4 é **query-only** (o índice `service_search_trgm` já está correto — só a query
  precisa aproveitá-lo). Nenhuma migração salvo se o índice precisar mudar (não precisa).
- Teto de volume de upload por Pessoa (rate-limit/contagem de objetos) — FINDINGS.md o marca como
  **follow-up** aceitável; o gate de papel de F2 é o mínimo obrigatório e é o que entra aqui.
- E2E autenticado de rota do CTA (F1) — deferido ao padrão do repo (L-007, sem seed de sessão
  Supabase no Playwright); a correção de F1 é fechada por teste de componente + rota já existente.

---

## Requisitos e critérios de aceitação

### REQ-F1 — 🚨 CTA de publicação do prestador aponta para a rota real (correctness)
**Achado:** `src/modules/persons/components/provider-form.tsx:268` — CTA "Publicar primeiro serviço"
(E-003) usa `href="/servicos/novo"`, rota **inexistente** (em runtime casa `(public)/servicos/[id]`
com `id="novo"` → `ServicoIndisponivel`). O teste-âncora `ProviderForm.test.tsx:87` fixa o href
errado, mascarando o bug no CI verde (teste cúmplice).

- **AC-F1-1** — O CTA "Publicar primeiro serviço" renderiza `href="/prestador/servicos/nova"`
  (rota real da USP-029, confirmada: `src/app/(app)/prestador/servicos/nova/page.tsx` existe e
  renderiza `ServiceForm`).
- **AC-F1-2** — O teste-âncora em `ProviderForm.test.tsx` assere o href **correto**
  (`/prestador/servicos/nova`); deixa de assertir `/servicos/novo`.

### REQ-F2 — 🔒 `uploadServicePhoto` exige papel PROVIDER (authorization)
**Achado:** `src/modules/services/actions/upload-service-photo.ts:53` — a action só exige sessão
autenticada; qualquer Pessoa (CANDIDATE/CLIENT/sem papel) grava no bucket **público**
`provider-photos` com URL determinística, sem passar pelo passo 2 (permissão) da sequência canônica.

- **AC-F2-1** — Sessão com papel PROVIDER + arquivo válido → upload OK (`ok:true`), comportamento
  atual preservado (MIME real ≤5MB, `storagePath` sob `${person.id}/`).
- **AC-F2-2** — Sessão autenticada **sem** papel PROVIDER → `FORBIDDEN`, **sem** escrita no Storage.
- **MN-F2 (must-not)** — Uma Pessoa sem papel PROVIDER ativo **não pode** gravar objeto no bucket
  `provider-photos`. Verificação: teste negativo que confirma `FORBIDDEN` **e** zero objetos novos
  sob o prefixo da Pessoa. O gate é aplicado **antes** de tocar o Storage.

### REQ-F3 — 🔒 `photoStoragePaths` do cliente validado por posse+formato server-side (authorization)
**Achado:** `create-service-draft.ts:61` e `submit-service-for-moderation.ts:82` persistem
`photoStoragePaths` vindos do cliente validados só por `string.trim().min(1)` + `.max(3)`
(`publish-service.schema.ts:52`), sem vínculo com a Pessoa da sessão. Vetores: (a) referenciar a
foto de **outro** prestador (misatribuição); (b) string arbitrária (incl. `../`) persistida crua em
`ServicePhoto.storagePath` e interpolada em `buildServicePhotoUrl` → `<img src>` público.

- **AC-F3-1** — Antes do `tx.service.create`, cada `photoStoragePath` é validado server-side contra
  (1) o **formato estrito** gerado pelo upload e (2) **posse** (`${person.id}/`). Caminho próprio
  válido → aceito; persiste normalmente.
- **AC-F3-2** — Caminho cujo primeiro segmento **não** é o `person.id` da sessão (foto de terceiro)
  → `VALIDATION`, **sem** persistir o serviço.
- **AC-F3-3** — Caminho com formato inválido (`../`, extensão fora de {jpg,png,webp}, segmentos
  extras, não-UUID) → `VALIDATION`, **sem** persistir. Aplica-se em `createServiceDraft` **e** no
  ramo form-direto de `submitServiceForModeration`.
- **MN-F3 (must-not)** — Um serviço **não pode** persistir uma linha `ServicePhoto` cujo
  `storagePath` não case o formato do upload E não pertença à Pessoa autora. Verificação: teste
  negativo (unit no helper puro + integração na action) que confirma `VALIDATION` e zero linhas
  criadas.

### REQ-F4 — ⚡ Busca por categoria não derruba o índice `service_search_trgm` (performance)
**Achado:** `search-services.ts:84` — o `OR immutable_unaccent(lower(sc.name)) LIKE ...` sobre a
relação juntada `service_categories` impede o Postgres de usar o índice GIN trgm (sobre
`services.title||description`), forçando varredura O(N_active) por busca.

- **AC-F4-1** — O ramo de categoria é reescrito como predicado da tabela `services`
  (`s.category_id IN (SELECT id FROM service_categories WHERE immutable_unaccent(lower(name)) LIKE …)`),
  parametrizado via `Prisma.sql` (sem concatenação de string).
- **AC-F4-2** — Semântica preservada: o termo casa por **título, descrição OU nome de categoria**.
  O teste de integração `search-services.int.test.ts` (incl. "busca textual casa pelo nome da
  categoria", L215) continua verde.

### REQ-F5 — ⚠️ `listServiceCategories` — teste do filtro `isSuggestion:false` (test-coverage)
**Achado:** `list-service-categories.ts:16` — o `where: { isSuggestion: false }` só é referenciado
via `vi.fn()` em page tests; o `where` real nunca é exercitado.

- **AC-F5-1** — Teste de integração prova que categorias-sugestão (`isSuggestion:true`) são
  excluídas e categorias aprovadas (`isSuggestion:false`) são retornadas.

### REQ-F6 — ⚠️ `listProviderServices` — teste do escopo por `authorPersonId` (test-coverage)
**Achado:** `list-provider-services.ts:27` — o `where: { authorPersonId }` só é validado por "a query
foi chamada com o id certo" no page test; o `where` não é exercitado.

- **AC-F6-1** — Teste de integração prova que serviços de **outro** `authorPersonId` não vazam no
  resultado (dados próprios do prestador scoped).

### REQ-F7 — ⚠️ `getMyActiveServiceInterest` — teste do filtro `cancelledAt:null` (test-coverage)
**Achado:** `get-my-service-interest.ts:15` — o `where: { …, cancelledAt: null }` (decide CTA
manifestar vs. bloco de contato/cancelar) só é mockado no page test.

- **AC-F7-1** — Teste de integração prova que uma manifestação cancelada (`cancelledAt != null`)
  **não** é retornada como ativa.
- **AC-F7-2** — Teste prova que uma manifestação ativa (`cancelledAt = null`) **é** retornada.

---

## Assumptions pinned (resolvidas do código real)

1. **Formato do caminho de foto (F3)** — `uploadServicePhoto` gera exatamente
   `` `${person.id}/${randomUUID()}.${mimeType}` `` (`upload-service-photo.ts:71`), onde `person.id`
   e `randomUUID()` são UUIDs e `mimeType ∈ {jpg, png, webp}` (`domain/photo-mime.ts:9` —
   `ServicePhotoMimeType = 'jpg' | 'png' | 'webp'`). Regex estrito pinado:
   ```
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/
   ```
   **Divergência deliberada de FINDINGS.md:** o conjunto de extensões é `(jpg|png|webp)`, **não**
   `(jpg|jpeg|png|webp)` — o path nunca contém `.jpeg` (o detector emite `'jpg'` para JPEG). Ser mais
   estrito é seguro: nenhum caminho legítimo termina em `.jpeg`. A posse é checada em separado
   (primeiro segmento === `person.id`), o que — combinado ao regex de segmento único — bloqueia `../`.

2. **Gate de F2 = papel PROVIDER apenas (não consent).** `uploadServicePhoto` passa a exigir
   `person.roles.includes('PROVIDER')` (espelha o 1º check de `requireServiceAuthorization`), **sem**
   exigir o consent `SERVICE_OFFERING`. Razão: (a) a foto ainda não pertence a um serviço — o gate de
   consent é aplicado no create/submit; (b) chamar `requireServiceAuthorization(id, roles, null)`
   integralmente exigiria consent ativo e **quebraria** os testes happy-path existentes de upload
   (que têm `roles:['PROVIDER']` mas nenhum consent semeado). FINDINGS.md autoriza "no mínimo o check
   de papel PROVIDER".

3. **F5/F6/F7 = testes de integração** (Postgres local :55322). Não há harness de prisma-mock
   consistente para essas queries no módulo; o `where` real só é exercitado contra o DB real. Cada
   teste semeia um fixture mínimo e limpa após.

4. **F3 = unit (helper puro) + integração (action).** A validação de formato/posse vira uma regra
   pura em `domain/photo-path.ts` (espelha `domain/photo-mime.ts`), coberta por unit test exaustivo,
   e um teste de integração prova a rejeição na action com zero persistência.

5. **F1 sem E2E de rota.** A rota `/prestador/servicos/nova` existe e renderiza `ServiceForm`
   (verificado); não há rewrite/redirect salvando `/servicos/novo` (verificado em `next.config`).
   A correção é fechada por teste de componente (âncora corrigida). E2E autenticado deferido (L-007).

---

## Gates obrigatórios no HEAD (antes de declarar PASS)
- `npm run typecheck` · `npm run lint`
- `npm run test` (unit) · integração (Postgres/Supabase local :55322)
- `NODE_ENV=production npm run build`
- **Sem migração nova** (F4 é query-only).

## Restrições de execução
- **Nunca** `git add -A` / `git add .` — o working tree tem deleções pré-existentes não relacionadas
  em `.claude/skills/**` e `.agents/**`. Cada task commita **só** os arquivos que tocou, por caminho
  explícito.
- Conventional Commits com escopo de módulo: `fix(persons):`, `fix(services):`, `perf(services):`,
  `test(services):`.
- Manter os padrões do `CLAUDE.md` (sequência de Server Action, `ActionResult`, sem `throw`,
  `select` explícito, `take` obrigatório).
</content>
</invoke>
