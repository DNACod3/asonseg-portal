# Checklist de Secrets & Hardening (US #200)

Referência operacional do hardening de segurança (US #200 — Fase 6). Não contém
valores; apenas o inventário e as garantias verificadas. Specs de apoio:
ADR-0014 (Turnstile), ADR-T-0004 (audit append-only), `technical-design.md §8`.

## Variáveis de ambiente

Validação centralizada em [`src/shared/env.ts`](../../src/shared/env.ts) (Zod). O
boot falha se qualquer variável obrigatória estiver ausente ou malformada. Guarda
de regressão: [`src/shared/__tests__/env-secrets.test.ts`](../../src/shared/__tests__/env-secrets.test.ts).

### Server-only (NUNCA expostas ao client — sem prefixo `NEXT_PUBLIC_`)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Pooler Postgres (runtime) |
| `DIRECT_URL` | Conexão direta (migrations) |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas server-side |
| `RESEND_API_KEY` | E-mail transacional |
| `TURNSTILE_SECRET_KEY` | Verificação server-side do CAPTCHA |
| `ANTHROPIC_API_KEY` | Extração de CV (LLM) |
| `B2_KEY_ID` / `B2_APPLICATION_KEY` | Backup duplo (Backblaze B2) |

### Públicas (expostas ao browser por design — `NEXT_PUBLIC_*`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

> Adicionar uma nova `NEXT_PUBLIC_*` exige incluí-la na whitelist do teste de
> secrets — isso força revisão consciente de que o valor pode ir ao client.

## Garantias verificadas por teste

- [x] Toda variável referenciada em código está no schema Zod (`env.ts`).
- [x] Nenhum secret server-side usa o prefixo `NEXT_PUBLIC_`.
- [x] Rate limiting por categoria (10/min anon, 60/min auth, 3/15min cadastro).
- [x] Headers de segurança (CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
      Referrer-Policy, Permissions-Policy) em toda resposta via Edge Middleware.
- [x] CAPTCHA Turnstile verificado server-side (fail-closed).
- [x] Upload valida MIME real por magic bytes (rejeita extensão/Content-Type forjado).
- [x] `audit_log` append-only no DB: `UPDATE`/`DELETE` bloqueados por trigger +
      `REVOKE` (ADR-T-0004) — ver `src/modules/audit/__tests__/append-only.int.test.ts`.

## Follow-ups de produção (fora do MVP)

- Role de banco dedicada de menor privilégio para a app (hoje conecta como owner
  no ambiente local; o trigger garante append-only à prova de owner).
- Store distribuído de rate limit (`@upstash/ratelimit`) — o atual é em memória
  por instância do Edge Middleware (podado por amostragem ~1%/request).
- CSP por nonce/request (hoje `'unsafe-inline'` em `script-src`/`style-src`).
  **Tradeoff deliberado:** o nonce + `'strict-dynamic'` do Next.js 15 exige
  **renderização dinâmica**, o que desabilitaria o ISR das rotas `(public)/`
  (home/vagas/servicos — ADR-0013). Migrar exige aplicar nonce apenas às rotas
  `force-dynamic` (`(app)/`) e manter hash/`'unsafe-inline'` nas rotas ISR — ou
  rever o ADR-0013. Follow-up rastreado, fora do escopo do MVP.
