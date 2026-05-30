# ARCHITECTURE.md — Estado arquitetural real

> Estado **atual** do repo, contrastado com a visão IDSD. Fundação sólida, **zero domínio implementado**.

## Topologia

Monolito modular Next.js 15 App Router, fundação completa, módulos vazios.

```
src/
├── app/
│   ├── layout.tsx                      # root layout
│   ├── globals.css                     # Tailwind base + variáveis CSS
│   ├── (public)/  layout + page.tsx    # ISR (revalidate=600 home)
│   ├── (auth)/    layout + login/page.tsx (placeholder)
│   └── (app)/     layout + perfil/page.tsx (placeholder)
├── modules/                            # ⚠️ VAZIO (apenas README com template)
└── shared/                             # ✅ fundação completa
    ├── errors.ts          # ActionResult<T>, ok(), fail(), ActionErrorCode
    ├── env.ts             # Zod env + parseEnv()
    ├── container.ts       # DI: Token<T>, register/resolve/reset
    ├── ui/                # ⚠️ vazio (.gitkeep) — shadcn/ui a scaffoldar
    └── lib/
        ├── prisma.ts      # Prisma singleton + globalThis dev reuse
        ├── logger.ts      # pino + redaction PII (35 campos)
        ├── time.ts        # date-fns-tz America/Sao_Paulo
        └── supabase/
            ├── browser.ts  # createSupabaseBrowserClient
            └── server.ts   # createSupabaseServerClient + Admin
```

## Route groups

| Group | Estratégia | Status real |
|-------|------------|-------------|
| `(public)` | ISR + revalidação on-demand (`revalidate=600` home, `1800` detalhe) | ✅ scaffold mínimo (home placeholder) |
| `(auth)` | `force-dynamic` | ✅ scaffold mínimo (login placeholder vazio) |
| `(app)` | `force-dynamic` autenticado | ✅ scaffold mínimo (perfil placeholder); **sem middleware ainda** |

## Camada `src/shared/`

| Componente | Status | Notas |
|------------|--------|-------|
| `errors.ts` | ✅ completo | `ActionResult<T> = {ok:true,data} \| {ok:false,error}`; `ActionErrorCode` enum **sem variante `INVALID_CREDENTIALS`** (gap USP-004 — `gap-analysis.md INC-009`) |
| `env.ts` | ✅ completo | 13 obrigatórias + 3 opcionais validadas por Zod; mensagem agregada em PT-BR |
| `container.ts` | ✅ completo | DI puro com `Token<T>` simbólico; **nenhum binding real registrado** |
| `lib/prisma.ts` | ✅ singleton | reuse via `globalThis` em dev |
| `lib/logger.ts` | ✅ pino estruturado | redaction de 35+ campos sensíveis; `childLogger(bindings)` |
| `lib/time.ts` | ✅ utils TZ | `saoPauloToUtc`, `utcToSaoPaulo`, `formatSaoPaulo` |
| `lib/supabase/browser.ts` | ✅ | `createSupabaseBrowserClient` |
| `lib/supabase/server.ts` | ✅ | `createSupabaseServerClient` + `createSupabaseAdminClient` (service role) |
| `ui/` | ⚠️ vazio | shadcn/ui pendente |

## Camada `src/modules/` (planejada vs real)

IDSD prevê **11 módulos**: `identity` · `persons` · `companies` · `consents` · `moderation` · `jobs` · `services` · `referrals` · `cv-extraction` · `audit` · `reporting`.

**Real:** diretório `src/modules/` contém apenas um `README.md` com o template de módulo. **Zero implementação.**

## DI / Container

`Container` em `shared/container.ts` é completo (lazy + singleton + `reset()` para testes) mas **nenhum port foi registrado ainda**. Validação real só virá quando o primeiro adapter (ex: `SupabaseAuthAdapter` da USP-004) for plugado.

## Supabase clients

Padrão claro de separação:
- **Browser** — `NEXT_PUBLIC_*` keys, sem cookies de servidor.
- **Server** — sessão via `cookies()` do Next 15, para Server Components/Actions/Route Handlers.
- **Admin** — `SERVICE_ROLE_KEY`, sem cookies, server-only (nunca exposto ao browser).

## Cache / ISR

Estratégia documentada e parcialmente exercitada:
- `(public)/page.tsx` — `revalidate = 600` (10 min, "tempo real" para indicadores) — alinhado `architecture-document §9.3` + ADR-0026.
- `(auth)/` e `(app)/` — sem cache (force-dynamic).
- **Revalidação por request de status/permissão (ADR-0030)** — ❌ ainda **não tem middleware** que aplique isso. Próxima entrega na USP-004 (T-08).

## Gaps arquiteturais vs IDSD

- ❌ **`src/middleware.ts` não existe** — exigido por ADR-0030 (revalidação por request) e pela USP-004 T-08.
- ❌ Helpers transversais ausentes: `requirePermission`, `requireActiveConsent`, `withAudit`, `transitionContent` — todos previstos nos módulos correspondentes.
- ❌ Sem View Models (camada `views/`) em nenhum módulo — risco de Pessoa exposta crua se algum dev pular a etapa.
- ❌ Sem componentes shadcn/ui (`shared/ui/`) — primeiro form (USP-004 T-07) terá que scaffoldar.
- ⚠️ Comentário no `docker-compose.yml` diz que é legado, mas o `README.md` ainda instrui `docker compose up` — fonte de confusão (`CONCERNS.md §C-01`).
