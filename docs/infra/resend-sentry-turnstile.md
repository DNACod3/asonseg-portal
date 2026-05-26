# Infra — Resend (e-mail) · Sentry (observabilidade) · Cloudflare Turnstile (CAPTCHA)

> **Task:** #98 · **US:** #95 (Provisionamento de ambientes) · **Épico:** #4 (Fase 0)
> **ADRs relacionados:** [ADR-0014](../arch/0014-captcha-cloudflare-turnstile.md) (Turnstile)
> **Status do provisionamento:** ✅ provisionado (contas/secrets geridos nos consoles)

Runbook dos três serviços auxiliares. Sem secrets aqui — valores na Vercel env e em `.env.local`.
Localmente, e-mails de Auth caem no **Mailpit** (Supabase CLI, `http://127.0.0.1:55324`),
e o Turnstile usa **chaves de teste** que sempre passam (ver `.env.example`).

---

## 1. Resend — e-mail transacional

Em produção substitui o Mailpit local. Usado para confirmação de cadastro, recuperação de senha,
avisos de moderação, expiração de vaga e notificações ([USP-044](../prd/prd-asonseg-portal-mvp.md)).

| Item | Valor |
|---|---|
| Domínio de envio | `asonseg.org.br` (verificado via DNS) |
| Remetente | `nao-responda@asonseg.org.br` (`EMAIL_FROM`) |
| DNS exigido | **SPF** + **DKIM** (e DMARC recomendado) |

**Secrets:** `RESEND_API_KEY`, `EMAIL_FROM`.

### Checklist
- [x] Conta/projeto Resend criado
- [x] Domínio `asonseg.org.br` verificado (SPF/DKIM propagados)
- [x] `RESEND_API_KEY` registrada na Vercel (Production/Preview)
- [x] E-mail de teste entregue (ver runbook)

---

## 2. Sentry — observabilidade

Captura de erros + source maps para o Next.js (server e client).

| Item | Valor |
|---|---|
| Plataforma | Next.js |
| Org / projeto | (definidos no console Sentry) |
| Ambientes | `production`, `preview`/`staging`, `development` (`SENTRY_ENVIRONMENT`) |

**Secrets:**
- `NEXT_PUBLIC_SENTRY_DSN` — DSN público (client + server). Opcional/vazio em dev.
- `SENTRY_AUTH_TOKEN` — upload de source maps no build (CI/Vercel, server-only).
- `SENTRY_ENVIRONMENT` — rótulo do ambiente.

### Checklist
- [x] Projeto Sentry (Next.js) criado, org/projeto definidos
- [x] `NEXT_PUBLIC_SENTRY_DSN` e `SENTRY_AUTH_TOKEN` na Vercel
- [x] DSN vazio em Development (ruído de dev fora do Sentry)

---

## 3. Cloudflare Turnstile — CAPTCHA

CAPTCHA no auto-cadastro público ([ADR-0014](../arch/0014-captcha-cloudflare-turnstile.md),
USP-001 AC-001-5). Escolhido por ser gratuito, sem rastreamento de usuário (LGPD-friendly) e
com boa UX para público de baixo letramento digital.

| Item | Valor |
|---|---|
| Widget | criado no dashboard Cloudflare |
| Modo | managed / invisível (preferência por desafio mínimo) |
| Domínios | domínio de produção + previews da Vercel |

**Secrets:**
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — site key (público, no widget).
- `TURNSTILE_SECRET_KEY` — secret de verificação server-side (server-only).

> **Dev local:** usar as chaves de teste públicas do Turnstile (sempre passam) já presentes
> no `.env.example` — `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`.

### Checklist
- [x] Widget Turnstile criado, domínios de prod + preview adicionados
- [x] Site key + secret key registrados na Vercel

---

## 4. Done when (DoD da task #98)

- [x] Resend: domínio verificado, `RESEND_API_KEY` na Vercel, e-mail de teste entregue
- [x] Sentry: projeto criado, `SENTRY_DSN`/`SENTRY_AUTH_TOKEN` na Vercel
- [x] Turnstile: widget criado, site key + secret key na Vercel

---

## 5. Runbook — validar

```bash
# Resend — enviar e-mail de teste (substitua destinatário; NÃO commitar a key)
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"nao-responda@asonseg.org.br","to":["dev@exemplo.com"],"subject":"Teste Resend ASONSEG","text":"ok"}'

# Turnstile — validar token server-side (siteverify)
curl -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
  -d "secret=$TURNSTILE_SECRET_KEY" -d "response=<TOKEN_DO_WIDGET>"

# Sentry — o DSN é validado no boot da app; conferir evento de teste no dashboard
#   (ex.: lançar um erro proposital em rota de health e ver chegar no Sentry)
```
