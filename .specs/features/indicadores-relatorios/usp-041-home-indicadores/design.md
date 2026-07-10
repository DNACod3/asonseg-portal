# USP-041 — Home pública com indicadores em tempo real (Design)

> **ICE mode — thin design adapter.** Resolves the matrix card's technical pointers (TD §4.4/§4.5,
> ADRs 0022/0026/0019/0017/0010, runbooks) and records the **decisions/assumptions** the card leaves
> to the Arquiteto/Planner. Does not re-derive architecture.

**Status:** Draft · **Módulo dono:** `reporting` · **Migração:** **nenhuma** (agregação de leitura sobre tabelas existentes).
**Depende de (upstream, todos já em master):** USP-009 (candidatos), USP-012+017 (empresas verificadas), USP-020+016 (vagas). U1 é a primeira feature da Fase 6.

## 1. Shape — camada de indicadores compartilhada (co-desenhada com USP-042)

USP-041 **funda** a camada `domain`/`queries` do módulo `reporting`; USP-042 a **estende**. Fronteira nesta USP:

```
src/modules/reporting/
├── domain/
│   ├── metrics.ts        # NOVO — catálogo puro MP1..MP10 (id/label/unidade) + descritor por métrica.
│   │                     #        041 usa MP1/MP2/MP4; 042 preenche o resto. SEM IO.
│   └── indicators.ts     # NOVO — regra pura de exibição mínima: applyMinimumDisplay(n, threshold=5)
│   │                     #        → { kind:'value', value:n } | { kind:'placeholder' } ; MINIMUM_DISPLAY_THRESHOLD=5
├── queries/
│   └── home-indicators.ts# NOVO — getHomeIndicators(): Promise<HomeIndicators> — 3 counts agregados, SEM PII.
├── components/
│   └── home-indicators.tsx # NOVO — cards de indicador (apresentacional; "Em breve" quando placeholder).
├── server/
│   └── revalidate-home.ts  # NOVO — revalidateHomeIndicators() = revalidatePath('/') (chamada pós-commit).
└── index.ts              # barrel estendido
```
Consumo: `src/app/(public)/page.tsx` (Server Component, `revalidate=600` **já setado**) chama `getHomeIndicators()` e renderiza `<HomeIndicators/>`. Import **sempre** via barrel `@/modules/reporting`.

## 2. As três métricas → agregados concretos (TD §4.5; campos verificados no schema)

| Indicador | Métrica | Query (Prisma agregado, explícito, sem PII) |
|---|---|---|
| Vagas ativas | **MP4** | `prisma.job.count({ where: { status: 'ACTIVE' } })` |
| Candidatos ativos | **MP1** | `prisma.candidateProfile.count({ where: { publicationStatus: 'ACTIVE' } })` |
| Empresas verificadas | **MP2** | `prisma.company.count({ where: { isVerified: true } })` |

- **`count` only** — nenhum `findMany`, nenhum `select` de coluna de pessoa/empresa. O tipo de retorno é
  `{ activeJobs: number; activeCandidates: number; verifiedCompanies: number }` — três inteiros, nada mais.
  Isto é a barreira estrutural do **REL41-MN-01**: a query não tem como vazar PII porque não seleciona linhas.
- **On-read consistency (ADR-0026):** "vagas ativas" = `status='ACTIVE'` (a expiração on-read/cron da USP-024 já
  rebaixa vagas vencidas; a home reflete o mesmo estado canônico). Não reimplementamos o filtro `validUntil>=hoje`
  aqui — a home conta o `status` materializado, coerente com a busca pública.

> **Decisão (D-VALOR-CORRENTE):** a home mostra o **valor corrente** de cada métrica, **não** progresso-vs-meta.

## 3. Cache / atualização em tempo real (E-002; D-012/QP-004 RESOLVIDO)

- **ISR `revalidate = 600`** — já presente em `page.tsx` (ADR-0013/0019). É o **piso de frescor** e satisfaz
  estruturalmente **REL41-MN-03** (TTL = janela acordada = 600s).
- **Revalidação on-demand** (`revalidateHomeIndicators()` → `revalidatePath('/')`), chamada **após o commit**
  das Server Actions que mudam as fontes: (1) aprovação de vaga → `ACTIVE` (moderation), (2) ativação de perfil
  de candidato → `ACTIVE`, (3) verificação de Empresa (`COMPANY_VERIFIED`). Satisfaz D-005 ("nova vaga aprovada
  aparece no contador em ≤ janela"). Chamada **fora** da transação (revalidatePath não é transacional); o piso
  de 600s é o backstop de correção caso um call-site fique de fora.
- **Pico/CDN (P-003, RP-009):** ISR na Vercel (ADR-0019) — sem CDN paga no MVP. Sem rate-limit novo aqui.

## 4. Exibição mínima "Em breve" (E-003 / REL41-MN-02; D-012 RESOLVIDO N=5)

- Regra **pura** `applyMinimumDisplay(n, threshold=MINIMUM_DISPLAY_THRESHOLD)` em `domain/indicators.ts`:
  `n < threshold` → `{ kind: 'placeholder' }` (UI renderiza "Em breve"); senão `{ kind: 'value', value: n }`.
- `MINIMUM_DISPLAY_THRESHOLD = 5` (tunável por constante única). Cobre também o edge **baseline 0** (0 < 5 → "Em breve").
- O componente **nunca** renderiza `0` cru para um indicador abaixo do limiar — mutação que remove/inverte a
  comparação faz o teste do cold start ficar vermelho.

## 5. Privacidade (REL41-MN-01 / ADR-0017 / ADR-0022 / runbook-view-model-visibility)

- A home é ISR **pública**. Defesa estrutural em profundidade:
  1. **Query** retorna só 3 inteiros (`count`) — não há linha/coluna de pessoa/empresa para vazar (nem no
     payload RSC/Flight — lição "anonimizar no View Model não basta" / view-model-anonimizacao-nao-basta).
  2. **Tipo** `HomeIndicators` não tem campo de PII — impossível serializar nome/identificador.
  3. **Componente** exibe apenas rótulo + número/"Em breve".
- Nenhum `withAudit` — indicadores agregados não-sensíveis não são leitura auditável (contraste com a ficha social).

## 6. Assumptions & deferrals (autonomous mode — sem gate de confirmação)

- **ASSUMP-U1-01 (metas MP deferidas):** metas absolutas MP1–MP10 (QP-007/D-004) **não confirmadas com o
  sponsor** → a home exibe **valor corrente/contagem**, não comparação com meta. Metas ficam fora do escopo até
  o sponsor confirmar. *(Flag ao dono; não bloqueia dev — a home é um instrumento de comunicação, não de metas.)*
- **ASSUMP-041-02 (D-001 gate operacional):** exibição mínima N=5 (D-012/QP-004) já **RESOLVIDA** pela diretoria
  (matriz 2026-05-29). O gate D-001 dos expectations (política decidida por escrito) está satisfeito; nada bloqueia.
- **ASSUMP-041-03 (P-004 cross-USP):** o contra-controle da métrica "Empresas verificadas" (diretoria acompanha
  MP10 + taxa de reprovação) é entregue pelo **relatório de fila de moderação/verificação da USP-042** — não é
  requisito de código da home. Registrado como dependência de fase, não como must-not de 041.
- **ASSUMP-041-04 (Fase reconciliada):** o card aponta "Fase 3 (TD §5)"; o ROADMAP posiciona USP-041 na **Fase 6**.
  Adotado o ROADMAP (fonte executável do loop). Sem impacto técnico.

## 7. Testing strategy (contrato do repo — project-guideline §12)

| Layer | Test type | Foco |
|---|---|---|
| `domain/indicators.ts` (regra pura) | **unit** ≥90% | limiar N=5: 0..4 → placeholder; ≥5 → value; fronteira exata em 5 |
| `queries/home-indicators.ts` | **integration** (Postgres real) | os 3 `count` com `where` real; baseline 0; **REL41-MN-01** (retorno só numérico, sem PII) |
| `components/home-indicators.tsx` | **unit (component)** | rótulos + número; "Em breve" no placeholder; **sem PII no markup** |
| `app/(public)/page.tsx` | **page + e2e** | anônimo vê 3 indicadores; carrega sem sessão; guard estático `revalidate<=600` (**REL41-MN-03**) |

E2E é público (sem sessão) — cobre o carregamento anônimo da home (não precisa de seed de sessão; contraste com L-007).

## 8. Design references

- Runbooks: `docs/IDSD/architecture/runbooks/runbook-view-model-visibility.md`, `runbook-search-pagination.md`
- ADRs: 0022 (sem PII), 0026 (on-read), 0019 (ISR/CDN), 0017 (agregados), 0013 (ISR home)
- TD §4.4 (endpoint `reporting.indicadoresHome`), §4.5 (schemas agregados)
