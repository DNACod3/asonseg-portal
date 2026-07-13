# ADR-0013 (Técnico) — ISR longo + on-demand revalidation para conteúdo público

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** performance | cache | nextjs | conteudo-publico
- **Resolve:** QP-004 (política de cache dos indicadores em tempo real) e D-012 do PRD MVP Portal

## Contexto e Problema

ADR-T-0007 (PWA reescrito) define a postura de cache: conteúdo público com ISR longo + on-demand revalidation; conteúdo autenticado em NetworkOnly. Este ADR detalha a **implementação técnica** dessa estratégia.

A pergunta concreta: como traduzir "ISR longo + on-demand revalidation acionada por moderação" em código Next.js App Router de forma:
- Resiliente (falha de revalidation não derruba o sistema)
- Auditável (operador entende por que uma vaga aparece/desaparece)
- Performante (não invalida o que não precisa)
- Testável (cobertura mínima de "transição X invalida path Y")

Componentes envolvidos:
- Páginas de listagem (`/vagas`, `/servicos`)
- Páginas de detalhe (`/vagas/[id]`, `/servicos/[id]`, `/prestadores/[id]`)
- Home pública (`/`) com indicadores agregados (USP-041)
- Máquina de estados de moderação (ADR-T-0011) que dispara as invalidações
- Job de expiração (cron diário) para vagas

## Drivers de Decisão

- p95 ≤ 1.5s da home pública e ≤ 2s nas buscas (PRD §6.1)
- Vaga aprovada deve aparecer rapidamente (segundos, não 30 min) — UX para empresas
- Bandwidth Vercel preservado (Hobby cobre Portal MVP folgadamente com ISR)
- Resiliência — falha em `revalidatePath` não deve travar a moderação
- Indicadores em tempo real (USP-041) — alvo: até 10 min de atraso é aceitável

## Opções Consideradas

Já enumeradas no ADR-T-0007 reescrito. Este ADR detalha a **Opção B** (combinação) escolhida lá.

## Decisão

### Estratégia por rota

**Páginas de listagem e detalhe** com `export const revalidate = 1800` (30 min):

```typescript
// src/app/(public)/vagas/page.tsx
export const revalidate = 1800
export const dynamic = 'force-static'    // permite ISR estática agressiva

export default async function VagasPage(props: { searchParams: ... }) {
  const jobs = await listActiveJobs(props.searchParams)
  return <JobList jobs={jobs} />
}

// src/app/(public)/vagas/[id]/page.tsx
export const revalidate = 1800
export const dynamicParams = true        // permite caminhos dinâmicos serem gerados sob demanda

export async function generateStaticParams() {
  // Pré-gerar páginas das vagas mais recentes (top 50 ativas)
  // outras são geradas on-demand no primeiro acesso e cacheadas
}
```

**Home pública** com `revalidate: 600` (10 min) — alinhada com QP-004 do PRD; cache mais curto porque indicadores são "em tempo real" no contrato com a UI:

```typescript
// src/app/(public)/page.tsx
export const revalidate = 600

export default async function HomePage() {
  const indicators = await getPublicIndicators()
  return <Home indicators={indicators} />
}
```

**Rotas autenticadas** com `dynamic = 'force-dynamic'` — sem cache (postura defensiva do ADR-T-0007):

```typescript
// src/app/(app)/layout.tsx
export const dynamic = 'force-dynamic'   // herda para todas as rotas autenticadas
```

### Tags para invalidação granular

Tagueamento de cache via `unstable_cache` (Next.js 15) ou `cache` direto com tags:

```typescript
// src/modules/jobs/queries/listActiveJobs.ts
import { unstable_cache } from 'next/cache'

export const listActiveJobs = unstable_cache(
  async (filters: JobFilters) => {
    return prisma.job.findMany({ where: { status: 'ACTIVE', ...filtersToWhere(filters) } })
  },
  ['list-active-jobs'],                   // cache key prefix
  { tags: ['jobs:list', 'jobs:public'] }  // tags para invalidação
)

export const getJobById = unstable_cache(
  async (jobId: string) => prisma.job.findUnique({ where: { id: jobId } }),
  ['get-job-by-id'],
  { tags: (jobId) => [`job:${jobId}`, 'jobs:public'] }
)
```

### Invalidação via `revalidatePath` e `revalidateTag`

A função canônica `transitionContent` (ADR-T-0011) chama `revalidateAfterTransition()`:

```typescript
// src/modules/moderation/services/revalidate-after-transition.ts
import { revalidatePath, revalidateTag } from 'next/cache'

export async function revalidateAfterTransition(kind: ContentKind, contentId: string, from: ContentStatus, to: ContentStatus) {
  const affectsPublic = wasPublic(from) || isPublic(to)
  if (!affectsPublic) return

  try {
    switch (kind) {
      case 'JOB':
        revalidateTag('jobs:list')
        revalidateTag(`job:${contentId}`)
        revalidatePath('/vagas')
        revalidatePath(`/vagas/${contentId}`)
        revalidatePath('/')              // home — indicador de "vagas ativas"
        break
      case 'SERVICE':
        revalidateTag('services:list')
        revalidateTag(`service:${contentId}`)
        revalidatePath('/servicos')
        revalidatePath(`/servicos/${contentId}`)
        // perfil público do prestador também muda quando serviço dele entra/sai
        const providerId = await loadServiceProviderId(contentId)
        revalidatePath(`/prestadores/${providerId}`)
        revalidatePath('/')
        break
      case 'CV':
        // CV não aparece em rota pública, mas afeta indicador de "candidatos ativos"
        revalidatePath('/')
        break
    }
  } catch (err) {
    // Falha de revalidation NÃO bloqueia a transição
    logger.warn({ err, kind, contentId, from, to }, 'revalidation failed; ISR will catch up')
    Sentry.captureException(err, { tags: { component: 'revalidation' } })
  }
}
```

### `force-cache` em queries de leitura

Server Components em rotas públicas usam `cache: 'force-cache'` ao fetchar (próprio default em ISR). Queries via Prisma são invocadas dentro de `unstable_cache` com tags — isso garante que mesma página servida do cache do Next não vai dar query no banco.

### Considerações sobre Server Components dinâmicos

Funções como `cookies()`, `headers()`, `searchParams` (dinâmico via prop) tornam um Server Component automaticamente dinâmico em Next. Para manter ISR:

- Páginas de listagem usam `searchParams` mas tratamos como **parâmetros de filtro** — cada combinação de filtro vira sua própria entrada de cache (com TTL próprio); manageable porque os filtros têm cardinalidade limitada (área × escolaridade × região)
- Páginas autenticadas usam `cookies()` para sessão — naturalmente dinâmicas (sem ISR), o que está alinhado com a postura

### Métricas e observabilidade

- Sentry captura falhas de `revalidatePath` (warning, não erro bloqueante)
- Vercel Analytics mostra hit rate de ISR — alvo: >70% hit rate em rotas públicas no horizonte de 30 dias pós go-live
- Audit log da transição registra `revalidationStatus: 'ok' | 'failed'` no contexto

### Testes

- Unitário: para cada transição que afeta visibilidade pública, `revalidateAfterTransition` chama os paths/tags corretos (mock de `revalidatePath`/`revalidateTag`)
- Integração: simular fluxo "aprovar vaga + verificar que tag foi invalidada"
- E2E (Playwright): "moderador aprova vaga → recarregar /vagas → vaga aparece"

## Consequências

**Positivas:**
- Conteúdo público servido majoritariamente do cache → baixa latência percebida e baixo custo
- Vaga aprovada aparece em segundos no público (não em 30 min)
- Defesa em profundidade: se on-demand falha, ISR de 30 min eventualmente atualiza
- Telemetria clara — hit rate visível na Vercel
- Vincula naturalmente à máquina de estados (ADR-T-0011) — invalidação é side effect orquestrado

**Negativas (trade-offs aceitos):**
- Lógica de invalidação tem que estar correta para cada transição — coberta por testes
- TTL de 30 min em listagem pode mostrar vaga já expirada por alguns minutos — aceitável; visitante vê "Vaga indisponível" se clicar (rota de detalhe é invalidada)
- Cache de tag tem cardinalidade que pode crescer (tag `job:{id}` por vaga) — Next gerencia internamente; não vimos issue na escala MVP

**Neutras / a monitorar:**
- Se hit rate ficar baixo (<50%) em produção, reduzir cardinalidade de filtros em URL (talvez algumas combinações exóticas servem dinamicamente)
- Se `unstable_cache` virar `cache` estável em Next 16+, migrar API

## Riscos e Mitigações

**Risco 1 — Conteúdo proibido permanece visível por até 30 min após inativação** se revalidation falhar. **Mitigação:** inativação dispara invalidação; em casos críticos, redeploy manual via Vercel Dashboard purga tudo (RTO 2-3 min).

**Risco 2 — Cache cresce demais em memória da Vercel** (muitas tags). **Mitigação:** monitoramento do consumo no painel; em escala futura, considerar Vercel Pro (caches maiores) ou retirar ISR e usar `force-cache` simples.

**Risco 3 — Filtro de busca raro nunca aquece o cache** (cada visita é cache MISS). **Mitigação:** aceitável — pior caso é a primeira visita ser ~2s, dentro da meta.

## Referências

- ADR-T-0007 (PWA + ISR — decisão arquitetural)
- ADR-T-0011 (Máquina de estados — dispara revalidation)
- ADR-T-0004 (audit log — registra revalidation status)
- PRD MVP Portal §6.1 (performance), USP-021, USP-022, USP-030, USP-031, USP-041
- QP-004, D-012 (resolvidos)
- Next.js App Router cache docs (revisar versão antes da Fase 0)
- Lentes do arquiteto: Performance, Fail-Fast & Blast Radius, Custo

## Atualização — 2026-07-13 (AD-026 / USP-054 / EMP-3, Fase 8 remediação UAT)

`/vagas` (listagem, `(public)/vagas/page.tsx`) e `/vagas/[id]` (detalhe) tiveram
`export const revalidate` reduzido de **1800s → 600s**, divergindo do valor
documentado na seção Decisão acima ("Páginas de listagem e detalhe... 1800").
Registrado como decisão consciente (`AD-026` em `.specs/project/STATE.md`, ver
histórico de decisões), não como drift — esta seção formaliza a decisão no ADR
técnico oficial, que o `/pr-review` da PR #291 apontou corretamente como
desatualizado.

**Motivo:** EMP-3 corrigiu um bug onde `transitionContent` não revalidava o
cache ao mover uma vaga **para fora** de `ACTIVE` (pausar/arquivar/inativar) —
com TTL de 1800s, uma vaga pausada podia continuar visível na busca pública
por até 30 min após a decisão. Reduzir o piso de ISR para 600s (o mesmo "ISR
10min" já usado pela home, USP-041/T6) encurta essa janela de exposição para o
pior caso em que a invalidação on-demand (`revalidatePath`) falhe — mesmo
padrão de defesa em profundidade já descrito na seção "Riscos e Mitigações"
(Risco 1) deste ADR, só que agora aplicado também a `/vagas`, não só à home.

**`/servicos`/`/servicos/[id]`/`/prestadores/[id]` permanecem em 1800s** —
decisão consciente, não drift: o mesmo bug de EMP-3 (falta de revalidação ao
sair de `ACTIVE`) não foi reportado para o fluxo de serviços nesta rodada de
UAT/remediação. `transitionContent` é kind-aware (`eventTypeFor`) e o efeito
colateral de cache (`CACHE_INVALIDATION_TOKEN`) já roda para qualquer
`ContentKind`, então o mesmo ajuste de TTL pode ser replicado para `SERVICE`
no dia em que o bug equivalente for confirmado lá — não há razão arquitetural
para a assimetria além de "ainda não investigado", registrada aqui para não
virar drift silencioso.

`docs/arch/technical-design.md` não precisou de atualização correspondente —
o único ponto ali relevante à política de ISR já aponta para este ADR, sem
hardcodar o valor 1800/600.
