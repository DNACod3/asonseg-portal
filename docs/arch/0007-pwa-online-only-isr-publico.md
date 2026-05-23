# ADR-0007 (Técnico) — PWA online-only e estratégia de cache para conteúdo público

- **Status:** Aceito — Reescrito para Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** frontend | pwa | cache | conteudo-publico
- **Substitui:** versão anterior deste ADR (escopo Frente 4); a substituição amplia o escopo, não diverge do princípio online-only

## Contexto e Problema

A versão original deste ADR resolvia o caso da Frente 4: aplicação majoritariamente autenticada, sem páginas públicas relevantes, com risco real de "ver saldo de estoque defasado se cachear demais". Decisão: PWA online-only com `NetworkOnly` em runtime.

O Portal MVP muda dois fatos centrais:

1. **Existe conteúdo público navegável anonimamente** — busca de vagas (USP-021), detalhe de vaga (USP-022), busca de serviços (USP-030), detalhe de serviço (USP-031), home pública com indicadores em tempo real (USP-041). Esse conteúdo é **read-heavy** (acessado muito mais do que mutado) e tem **baixa frequência de mudança** (vaga aprovada fica ativa por dias/semanas).

2. **Custo de bandwidth e latência importam mais** — visitante anônimo pode chegar via link compartilhado em WhatsApp/Instagram e abandonar se a página demorar. Vercel Hobby tem 100GB de bandwidth/mês — possivelmente suficiente, mas tem que ser usado com inteligência.

Por outro lado, **a área autenticada do Portal mantém a mesma natureza da Frente 4**: dados sensíveis e operacionais que não podem ficar em cache (saldo de candidaturas, fila de moderação, ficha social, indicadores administrativos).

Adicionalmente:

- PRD §3.2 reafirma "operação online-only; sem modo offline"
- ADR-0017 de negócio (visibilidade conservadora) torna `NetworkOnly` em rotas autenticadas ainda mais defensável

A decisão precisa cobrir duas dimensões distintas: comportamento PWA (instalabilidade, service worker) e estratégia de cache de conteúdo público.

## Drivers de Decisão

- Performance percebida pelo visitante anônimo (p95 da home pública ≤ 1.5s, busca de vagas/serviços ≤ 2s — PRD §6.1)
- Custo de bandwidth e de queries ao Postgres (cada visita anônima sem cache é uma query)
- Zero risco de dados defasados em rotas autenticadas
- Disponibilidade de 99% (PRD §6.2) — cache funciona como degradação graciosa em caso de banco indisponível por minutos
- Vaga aprovada precisa aparecer na busca em tempo razoável (vai aparecer "imediato" para a empresa autora; "em poucos minutos" para o público anônimo é aceitável)

## Opções Consideradas

### Opção A — PWA online-only com `NetworkOnly` em tudo, sem ISR

**Descrição:** mantém integralmente a decisão da Frente 4. Todas as rotas (públicas e autenticadas) são server-rendered a cada request, sem cache no Next.js nem CDN.

- **Prós:** simples; zero risco de cache defasado
- **Contras:** desperdiça bandwidth e CPU em conteúdo público que é o mesmo para milhares de visitantes; performance pior; risco de hit em limite de Free tier mais cedo

### Opção B — PWA online-only + ISR longo (15-30 min) + on-demand revalidation por eventos de moderação (escolhida)

**Descrição:** mantém o PWA online-only para áreas autenticadas (NetworkOnly em service worker), mas usa **Incremental Static Regeneration (ISR) do Next.js App Router** para rotas públicas:

- **Páginas públicas com `revalidate: 1800` (30 min)** — busca de vagas, busca de serviços, detalhe de vaga, detalhe de serviço, home pública
- **On-demand revalidation via `revalidatePath` / `revalidateTag`** acionada nos eventos de moderação (aprovação, inativação, expiração) — vaga aparece em segundos após aprovação
- **Combinação garante "defesa em profundidade":** se a revalidação on-demand falhar (erro transitório, deploy em andamento), o cache ainda expira sozinho em até 30 min — vaga eventualmente aparece sem intervenção

- **Prós:** vaga aparece rapidamente após aprovação (UX boa para empresas e candidatos); bandwidth e queries ao Postgres reduzidas significativamente em volume de tráfego anônimo; aderente ao padrão idiomático do Next.js App Router; resiliente a falhas pontuais da invalidação on-demand
- **Contras:** lógica de invalidação tem que estar correta em todos os fluxos que mudam conteúdo público (moderação aprovar/rejeitar, autor pausar/arquivar, expiração automática, vaga editada que volta para rascunho) — riscos mitigados por convenção e testes

### Opção C — Sem PWA, apenas web responsivo + ISR

**Descrição:** abandonar PWA (não tem manifest, não tem service worker) e adotar apenas ISR para público.

- **Prós:** simplicidade máxima
- **Contras:** voluntário ASONSEG perde a "instalabilidade" no celular que tem valor real para uso interno (operações da AS, coordenador moderando em mobile). PWA tem custo de configuração baixo e ganho de UX real

### Opção D — PWA + ISR + cache de runtime no service worker (stale-while-revalidate em algumas rotas)

**Descrição:** adicionar SWR no service worker para rotas públicas para mostrar conteúdo em cache mesmo offline.

- **Prós:** UX em conexão instável
- **Contras:** PRD declara "online-only"; risco de ver vaga já expirada em cache; complexidade extra sem ganho proporcional

## Decisão

Adotamos a **Opção B — PWA online-only para áreas autenticadas + ISR longo + on-demand revalidation para conteúdo público**.

### Configuração concreta

**1. Manifest PWA** (`public/manifest.json`):
- `name`: "ASONSEG Portal Empregabilidade e Serviços"
- `short_name`: "ASONSEG"
- `display: standalone`
- Ícones 192/512 + maskable

**2. Service worker via `next-pwa`** (ou Workbox direto se houver atrito):
- **Pre-cache:** assets do build (`_next/static/*`, fontes, ícones)
- **Runtime caching strategy:** `NetworkOnly` para todas as rotas de API e Server Actions
- **Sem fallback offline** — perda de conexão expõe erro padrão; PRD declara online-only
- Auto-update com `skipWaiting: true` + toast "Atualização disponível — recarregue"

**3. ISR em rotas públicas** (Next.js App Router):

| Rota | Estratégia | TTL |
|---|---|---|
| `/` (home pública com indicadores) | ISR + on-demand para indicadores | 600s (10 min) — alinhado com QP-004 |
| `/vagas` (busca/listagem) | ISR | 1800s (30 min) |
| `/vagas/[id]` (detalhe) | ISR + on-demand quando moderação muda status | 1800s |
| `/servicos` (busca/listagem) | ISR | 1800s |
| `/servicos/[id]` (detalhe) | ISR + on-demand | 1800s |
| `/prestadores/[id]` (perfil público) | ISR + on-demand | 1800s |
| Rotas autenticadas (`/app/(app)/*`) | Dinâmico (sem cache) | n/a |

**4. On-demand revalidation** — disparada nos seguintes eventos:

| Evento | Caminhos invalidados |
|---|---|
| Vaga aprovada na moderação | `/vagas`, `/vagas/[id]`, `/` (indicadores) |
| Vaga rejeitada / inativada / pausada / arquivada / editada | `/vagas`, `/vagas/[id]`, `/` |
| Vaga expirada (job de expiração) | `/vagas`, `/vagas/[id]`, `/` |
| Serviço aprovado na moderação | `/servicos`, `/servicos/[id]`, `/prestadores/[id]`, `/` |
| Serviço inativado/pausado/arquivado | `/servicos`, `/servicos/[id]`, `/prestadores/[id]`, `/` |
| CV aprovado | `/` (indicadores — total de candidatos ativos) |
| Empresa verificada (após 1ª vaga) | `/` (indicadores — total de empresas verificadas) |

Detalhes técnicos no ADR-T-0013.

**5. Comportamento esperado em perda de conexão (PWA):**
- Cliente vê erro padrão do navegador
- Sem UI de "modo offline ativo" (evita falsa expectativa)
- Tela em memória continua, mas qualquer ação falha visivelmente

## Consequências

**Positivas:**
- Visitante anônimo tem experiência rápida (página servida do cache do Next.js, sem hit no banco)
- Bandwidth da Vercel preservado (cabe folgadamente em Hobby para o volume previsto)
- Vaga aprovada aparece em segundos no público graças à invalidação on-demand
- Rotas autenticadas continuam com a postura defensiva da Frente 4 (zero risco de dado defasado)
- PWA mantido com baixo custo de configuração — instalabilidade no celular tem valor para uso interno

**Negativas (trade-offs aceitos):**
- Lógica de invalidação on-demand é nova superfície de erro — mitigada pela combinação com TTL e por testes específicos
- Foto de prestador (bucket público — ADR-0005) pode ficar até 30 min defasada se a invalidação falhar — aceitável
- Indicadores da home têm TTL menor (10 min) — risco de números levemente defasados, mas é "indicador" de tempo real, não fonte de verdade

**Neutras / a monitorar:**
- Se telemetria mostrar volume significativo de falhas por conexão flapping, reavaliar SWR limitado a leituras públicas
- Se a invalidação on-demand mostrar-se frágil em produção, reduzir TTL para 5-10 min como mitigação

## Riscos e Mitigações

**Risco 1 — Invalidação on-demand falha silenciosamente.** **Mitigação:** TTL agindo como expiração natural; Sentry captura falhas de `revalidatePath` (loga warning); monitoramento manual nos primeiros 30 dias.

**Risco 2 — Conteúdo proibido aprovado por engano fica visível por até 30 min mesmo após inativação.** **Mitigação:** inativação dispara `revalidatePath` imediatamente; em caso de conteúdo crítico, coordenador pode também forçar redeploy via Vercel Dashboard (purga total).

**Risco 3 — Cache de assets do PWA "preso" em versão antiga após deploy.** **Mitigação:** `skipWaiting` + toast de atualização (mesmo da Frente 4).

## Referências

- PRD MVP Portal §3.1 (in-scope), §3.2 (out-of-scope — modo offline), §6.1 (performance), USP-021, USP-022, USP-030, USP-031, USP-041
- QP-004 (política de cache dos indicadores)
- ADR-T-0013 (detalhes técnicos de cache e revalidation)
- ADR-T-0011 (máquina de estados de moderação — eventos que disparam revalidation)
- Lentes do arquiteto: Custo, Fail-Fast & Blast Radius, Data Flow & Ownership
