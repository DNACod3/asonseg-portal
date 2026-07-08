# USP-022 — Ver detalhe da vaga — Refactor (Fase 2 / Design System) — Design

**Spec**: `.specs/features/vagas/usp-022-detalhe-vaga/spec.md`
**Status**: Draft

> **Disciplina (AD-015).** Restyle **style-only**: muda-se **markup/classes**; não se tocam a query
> on-read, o View Model, o `generateMetadata`, o `jobDetailJsonLd`/`serializeJsonLd`, o `revalidate`/ISR
> nem a injeção do `<script ld+json>`. Os testes existentes (`get-job-detail.int.test.ts`,
> `job-detail.view.spec.ts`, `job-detail.spec.tsx`) são os **testes de preservação**. Ver `project-guideline`
> (§5/§10/§18) e AD-014/AD-012.

## 0. Comportamento preservado (fonte da verdade = código)

- **Query** `queries/get-job-detail.ts`: `getActiveJobDetail(id, viewer)` com WHERE on-read **idêntico à
  busca** (`status='ACTIVE' AND validUntil >= hojeSaoPaulo() AND company.isVerified`) → **`null`** se não
  casa (nunca 404). Conta candidaturas ativas via `_count.applications where cancelledAt=null` (sem N+1).
  `select` condicional ao papel (`nomeFantasia` só p/ autenticado); memoizada com `cache()` por
  `(id, authenticated)`.
- **View Model** `views/job-detail.view.ts`: `viewJobDetail` = **única fonte de anonimização** (ADR-0022);
  `APPLICATION_COUNTER_THRESHOLD=3` (contador `null` se `<3`, P-001); `canApply`/`showActivateCandidateCta`
  por papel; `salaryVisible=false` ⇒ `salary=null`. `jobDetailJsonLd` (schema.org `JobPosting`,
  `hiringOrganization` = `displayName` anonimizado) + `serializeJsonLd` (escape XSS `<`/`>`/`&`/U+2028/U+2029).
- **Rota** `(public)/vagas/[id]/page.tsx`: `revalidate=1800`; `generateMetadata` chama
  `getActiveJobDetail(id, null)` (**sempre anônimo**) → título/description/OG/Twitter/canonical anonimizados
  (`robots.index=false` p/ vaga indisponível); página injeta `<script type="application/ld+json">` com
  `viewJobDetail(row, null)` (**sempre anônimo**, independente do viewer, P-002); `row == null ?
  <VagaIndisponivel/> : <JobDetailView job={viewJobDetail(row, viewer)}/>`.

Nada disso muda. O delta é 100% de apresentação; `JobDetailView` e a página são **Server Components**.

## 1. Architecture Overview

```mermaid
graph TD
    P["(public)/vagas/[id]/page.tsx (Server, ISR 1800)"] -->|getActiveJobDetail + viewJobDetail| Q[query + view]
    P -->|generateMetadata + JSON-LD = viewJobDetail(row,null)| M[metadados SEMPRE anônimos]
    P -->|row==null → VagaIndisponivel| E[Card 'vaga encerrada']
    P -->|row!=null → JobDetailView| D[JobDetailView Server]
    D -->|Card/FormCard/Badge/Button| UI[@/shared/ui]
    E --> UI
```

## 2. Code Reuse Analysis

### Primitivos do DS a adotar

| Primitivo | Uso | Substitui |
| --- | --- | --- |
| `Card` / `FormCard` / `FormSectionTitle` | envelope do detalhe; `Section`; `<dl>` local/validade; estado "vaga encerrada" | `<article className="flex flex-col gap-6">`, `<dl className="… border-t border-gray-100">`, `VagaIndisponivel` |
| `Badge` | pílulas de metadados (área/região/regime/contrato) e, se aplicável, status | `<li className="rounded-full bg-gray-100 … text-gray-700">` |
| `Button` (+`asChild`) | CTAs: candidatar-se (display-only), ativar candidato (`asChild`→`/candidato`), criar conta (`asChild`→`/cadastro`), voltar à lista | `<button className="bg-blue-600 …">`, `<Link>` cru |

### Padrões existentes (reusar)

- `job-card.tsx` já reestilizado na USP-021 (mesmas pílulas → `Badge`) — consistência.
- **View types intocáveis:** `JobDetail` (o componente consome `company.displayName`, `applicationCount`,
  `canApply`, `showActivateCandidateCta`, `salary` já resolvidos; nunca acessa `nomeFantasia` nem recomputa
  o limiar).

## 3. Refactor deltas — `job-detail.tsx` (`JobDetailView`, Server Component)

1. Raiz `<article className="flex flex-col gap-6">` → `<Card>`/`<FormCard>` com spacing por token.
2. Título `<h1 className="text-2xl font-bold text-gray-900">` → `text-fg` (+ `font-heading`).
3. Empresa (`job.company.displayName`) → `text-fg-muted` (**displayName preservado**; nunca nome real).
4. Pílulas de metadados → `<Badge variant="gray|blue">` (mesmo mapa da USP-021).
5. Linha do salário e contador `<p>{count} pessoas se candidataram</p>` → tokens; **condição preservada**
   (`job.applicationCount != null`, P-001).
6. `Section({title, content})` → `FormSectionTitle` + corpo em `Card`/token (descrição, requisitos,
   benefícios). Renderização condicional (só se `content`) preservada.
7. `<dl className="grid … border-t border-gray-100 … sm:grid-cols-2">` (local/validade) → `FormRow cols={2}`
   ou grid com `border-border`/token.
8. **`ApplyCta`** (preserva a lógica de branch por papel):
   - `canApply` → `<Button type="button" variant="primary">Candidatar-se</Button>` — **somente exibição**
     (sem `onClick` de ação; a candidatura é USP-025) — must-not U22-MN-04.
   - `showActivateCandidateCta` → `<Button asChild><Link href="/candidato">Ativar perfil candidato</Link></Button>`.
   - anônimo → `<Button variant="outline" asChild><Link href="/cadastro">Criar conta para candidatar-se</Link></Button>`.

**Preservado:** toda a leitura de `JobDetail`, a condição do contador, os três branches de CTA, a omissão
de salário.

## 4. Refactor deltas — `(public)/vagas/[id]/page.tsx` (Server Component, ISR)

1. Back-link e container da página → tokens/`Button asChild`.
2. `VagaIndisponivel` (estado "vaga encerrada / temporariamente indisponível") → `<Card>` neutro +
   `<Button asChild><Link href="/vagas">Ver outras vagas</Link></Button>`; **sem** botão candidatar (P-005).
3. **Preservado sem tocar (crítico p/ P-002):**
   - `export const revalidate = 1800`.
   - `generateMetadata` → `getActiveJobDetail(id, null)` + `viewJobDetail(row, null)` (**sempre anônimo**);
     título/description/OG/Twitter/canonical/`robots` inalterados.
   - injeção `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: serializeJsonLd(
     jobDetailJsonLd(viewJobDetail(row, null)))}} />` **somente** quando `row != null`, **sempre anônimo**.
   - `row == null ? <VagaIndisponivel/> : <JobDetailView job={viewJobDetail(row, viewer)}/>`.

> O restyle **não** toca a serialização: só a apresentação HTML dos ramos `VagaIndisponivel`/`JobDetailView`.

## 5. Data Models

Nenhum. O `model Application` (AD-012) e o índice de contagem já existem; o restyle não os toca.

## 6. Error Handling / Estados

| Cenário | Comportamento (preservado) | Delta |
| --- | --- | --- |
| Vaga não-ativa/expirada/Empresa não verificada | `getActiveJobDetail` ⇒ `null` → "vaga encerrada" (nunca 404) | `Card` neutro + `Button` p/ `/vagas` |
| Contador `<3` | `applicationCount=null` (não renderiza) | inalterado |
| Salário oculto | `salary=null` | inalterado |
| Anônimo | metadados/JSON-LD via `viewJobDetail(row,null)` | serialização inalterada |

## 7. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Restyle introduzir nome real no HTML/JSON-LD ao "melhorar" o cabeçalho | `job-detail.tsx` / `page.tsx` | Vazamento P-002 (LGPD, alto custo) | Componente consome só `displayName`; metadados/JSON-LD **sempre** `viewJobDetail(row,null)`; must-not U22-MN-01 travado por `job-detail.view.spec.ts` + teste de metadados anônimos. |
| Botão "candidatar-se" ganhar `onClick`/action ao virar `Button` | `job-detail.tsx` (`ApplyCta`) | Invadir USP-025 / candidatura não intencional | `type="button"` display-only; must-not U22-MN-04 (`job-detail.spec.tsx`). |
| Componente decidir visibilidade por `status` (reintroduzir vaga não-ativa) | `job-detail.tsx` | Quebra E-005/P-004/P-005 | Visibilidade fica na query (`null`); componente só renderiza o que recebe; `get-job-detail.int.test.ts`. |
| Converter `JobDetailView`/página em client | `page.tsx` | Quebra ISR + expõe serialização ao cliente | Permanecem Server Components. |
| Guarda estática de paleta crua com falso-positivo | arquivos tocados | Ruído no gate | Guarda restrita a `className`; allowlist `ds-*`. |

## 8. Tech Decisions (não óbvias)

| Decisão | Escolha | Rationale |
| --- | --- | --- |
| Preservar `viewJobDetail(row, null)` nos metadados/JSON-LD | Intocável | Fonte única de anonimização em todos os canais (P-002, ADR-0022). |
| Botão candidatar permanece display-only | Sim | A ação é USP-025; U22-MN-04. |
| Reforço de teste de P-002 nos metadados | Novo/estendido teste que assevera ausência de `nomeFantasia` em HTML/OG/Twitter/JSON-LD/canonical p/ anônimo | Must-not de maior custo trava por teste, não inspeção. |
| Teste do restyle do componente | `job-detail.spec.tsx` (existente, estender) | RTL de detalhe já existe; passa a asseverar primitivos + CTA display-only. |

> **Decisões de projeto:** nenhuma nova — consome AD-014/AD-015/AD-012. Nada a acrescentar em `STATE.md`.
